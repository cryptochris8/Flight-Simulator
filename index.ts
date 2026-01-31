/**
 * HYTOPIA Flight Simulator
 *
 * A flight simulator game built with the HYTOPIA SDK.
 *
 * Flow:
 * 1. Player spawns on foot at the airstrip
 * 2. Plane selection UI appears automatically
 * 3. Player selects a plane and it spawns on the runway
 * 4. Player flies the plane!
 *
 * Controls: W/S = Throttle, A/D = Yaw, Mouse = Pitch/Roll, Space = Brake, Shift = Boost
 */

import {
  startServer,
  Player,
  PlayerEvent,
  PlayerUIEvent,
  PlayerCameraMode,
  GameServer,
  DefaultPlayerEntity,
} from 'hytopia';

import worldMap from './assets/map.json' with { type: 'json' };
import airportData from './world/airport.json' with { type: 'json' };
import { HytopiaAirplane } from './src/aircraft/HytopiaAirplane';
import { CheckpointSystem } from './src/gameplay/CheckpointSystem';
import { HangarServer } from './src/networking/HangarServer';
import type { AirportConfig } from './src/gameplay/AirportTypes';
import { MessageType } from './src/networking/NetworkMessages';

// Cast airport data to typed config
const airport = airportData as AirportConfig;

// Store active airplanes per player
const playerAirplanes = new Map<Player, HytopiaAirplane>();

// Store player entities (for on-foot players)
const playerEntities = new Map<Player, DefaultPlayerEntity>();

// Track E key state per player to detect key press (not hold)
const playerEKeyState = new Map<Player, boolean>();

// Checkpoint system for ring gameplay
const checkpointSystem = new CheckpointSystem();

// Setup checkpoint rings
function setupCheckpoints(): void {
  // Ring positions - fly through these in order
  checkpointSystem.addRing({ x: 0, y: 200, z: -100 }, 15);
  checkpointSystem.addRing({ x: 100, y: 220, z: -200 }, 15);
  checkpointSystem.addRing({ x: -50, y: 210, z: -350 }, 15);
  checkpointSystem.addRing({ x: 150, y: 240, z: -500 }, 15);
  checkpointSystem.addRing({ x: 0, y: 230, z: -650 }, 15);
}

startServer(world => {
  console.log('Flight Simulator starting...');
  console.log(`Airport: ${airport.name} at elevation ${airport.elevation}`);

  // Load the map
  world.loadMap(worldMap);

  // Setup environment - skybox and fog for visual reference while flying
  world.setSkyboxUri('skyboxes/partly-cloudy');
  world.setSkyboxIntensity(1.0);

  // Fog for depth perception and atmosphere
  world.setFogColor({ r: 135, g: 206, b: 235 });  // Sky blue
  world.setFogNear(200);   // Start fading at 200 blocks
  world.setFogFar(800);    // Fully faded at 800 blocks

  // Good lighting for flight
  world.setAmbientLightIntensity(0.8);
  world.setDirectionalLightIntensity(5);
  world.setDirectionalLightPosition({ x: 100, y: 200, z: 50 });

  // Setup checkpoints
  setupCheckpoints();

  // Create hangar server handler
  const hangarServer = new HangarServer(world, airport, playerAirplanes, playerEntities);

  // Handle player joining
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    console.log(`Player ${player.username} joined - spawning at airstrip`);

    // Initialize E key tracking
    playerEKeyState.set(player, false);

    // Spawn player on foot at the airstrip (near hangars)
    const spawnPos = {
      x: airport.spawn.position.x,
      y: airport.elevation + 2,  // Slightly above ground
      z: airport.spawn.position.z + 20  // In front of runway
    };

    // Create a player entity so they can walk around
    const playerEntity = new DefaultPlayerEntity({
      player,
      name: 'Pilot',
    });

    playerEntity.spawn(world, spawnPos);
    playerEntities.set(player, playerEntity);

    // Set up first-person camera attached to player entity
    player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
    player.camera.setAttachedToEntity(playerEntity);

    // Load the UI
    player.ui.load('ui/index.html');

    // Handle UI messages from client (plane selection)
    player.ui.on(PlayerUIEvent.DATA, ({ data }) => {
      if (data.type === MessageType.PLANE_SELECTION_CONFIRMED) {
        console.log(`[Hangar] Player ${player.username} selected plane ${data.planeId}`);
        hangarServer.handlePlaneSelection(player, data.hangarId, data.planeId);
      }
    });

    // Send welcome messages
    world.chatManager.sendPlayerMessage(
      player,
      `Welcome to ${airport.name}!`,
      '00FF00'
    );
    world.chatManager.sendPlayerMessage(
      player,
      'Select your aircraft to begin flying!',
      '00FFFF'
    );

    // Automatically show the plane selection UI after a short delay
    setTimeout(() => {
      console.log(`[UI] Showing plane selection for ${player.username}`);
      // Send hangar contents to player (using first hangar as default)
      hangarServer.handleOpenRequest(player, 'hangar_A1');
    }, 500);
  });

  // Handle player leaving
  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    console.log(`Player ${player.username} left - cleaning up`);

    // Clean up airplane if in one
    const airplane = playerAirplanes.get(player);
    if (airplane) {
      airplane.despawn();
      playerAirplanes.delete(player);
    }

    // Clean up player entity if on foot
    const playerEntity = playerEntities.get(player);
    if (playerEntity) {
      playerEntity.despawn();
      playerEntities.delete(player);
    }

    // Clean up E key tracking
    playerEKeyState.delete(player);
  });

  // Game tick - update checkpoints and UI for players in planes
  setInterval(() => {
    const connectedPlayers = GameServer.instance.playerManager.getConnectedPlayersByWorld(world);
    for (const player of connectedPlayers) {
      const airplane = playerAirplanes.get(player);

      if (airplane) {
        // Player is flying a plane
        const state = airplane.flightState;
        const playerPos = state.position;

        // Update checkpoint system
        checkpointSystem.update(playerPos);

        // Send flight data to UI
        const flightData = airplane.getFlightData();
        player.ui.sendData({
          type: 'flight-update',
          speed: Math.round(flightData.speed),
          altitude: Math.round(flightData.altitude),
          throttle: Math.round(flightData.throttle * 100),
          checkpoint: checkpointSystem.current + 1,
          totalCheckpoints: checkpointSystem.rings.length,
          laps: checkpointSystem.laps,
          isGrounded: state.isGrounded,
          mode: state.isGrounded ? 'TAXI' : 'FLIGHT',
          inPlane: true,
        });

        // Check for E key to open hangar menu (to switch planes)
        const eKeyDown = !!player.input.e;
        const wasEKeyDown = playerEKeyState.get(player) || false;

        if (eKeyDown && !wasEKeyDown) {
          // Show plane selection menu
          hangarServer.handleOpenRequest(player, 'hangar_A1');
        }

        playerEKeyState.set(player, eKeyDown);
      } else {
        // Player is on foot - send ground state to UI
        const playerEntity = playerEntities.get(player);
        const altitude = playerEntity ? Math.round(playerEntity.position.y) : 0;

        player.ui.sendData({
          type: 'flight-update',
          speed: 0,
          altitude: altitude,
          throttle: 0,
          checkpoint: checkpointSystem.current + 1,
          totalCheckpoints: checkpointSystem.rings.length,
          laps: checkpointSystem.laps,
          isGrounded: true,
          mode: 'ON FOOT',
          inPlane: false,
        });

        // Check for E key to open plane selection
        const eKeyDown = !!player.input.e;
        const wasEKeyDown = playerEKeyState.get(player) || false;

        if (eKeyDown && !wasEKeyDown) {
          hangarServer.handleOpenRequest(player, 'hangar_A1');
        }

        playerEKeyState.set(player, eKeyDown);
      }
    }
  }, 100);

  console.log('Flight Simulator ready!');
  console.log(`Hangars available: ${airport.hangarDistrict.slots.map(s => s.id).join(', ')}`);
});
