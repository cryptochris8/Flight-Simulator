/**
 * HYTOPIA Flight Simulator
 *
 * A flight simulator game built with the HYTOPIA SDK.
 * Controls: W/S = Throttle, A/D = Yaw, Mouse = Pitch/Roll, Space = Brake, Shift = Boost
 * Press E near hangars to select and spawn planes.
 */

import {
  startServer,
  Player,
  PlayerEvent,
  PlayerUIEvent,
} from 'hytopia';

import worldMap from './assets/map.json' with { type: 'json' };
import airportData from './world/airport.json' with { type: 'json' };
import { HytopiaAirplane } from './src/aircraft/HytopiaAirplane';
import { CheckpointSystem } from './src/gameplay/CheckpointSystem';
import { HangarInteractionController } from './src/gameplay/HangarInteraction';
import { HangarServer } from './src/networking/HangarServer';
import type { AirportConfig } from './src/gameplay/AirportTypes';
import { MessageType } from './src/networking/NetworkMessages';

// Cast airport data to typed config
const airport = airportData as AirportConfig;

// Store active airplanes per player
const playerAirplanes = new Map<Player, HytopiaAirplane>();

// Store hangar controllers per player (for proximity/E key handling)
const playerHangarControllers = new Map<Player, HangarInteractionController>();

// Track E key state per player to detect key press (not hold)
const playerEKeyState = new Map<Player, boolean>();

// Track which hangar each player is assigned to
const playerHangarAssignments = new Map<Player, string>();

// Track which hangars are occupied
const occupiedHangars = new Set<string>();

/** Assign a hangar to a player, returns the hangar slot or null if none available */
function assignHangar(player: Player): typeof airport.hangarDistrict.slots[0] | null {
  for (const slot of airport.hangarDistrict.slots) {
    if (!occupiedHangars.has(slot.id)) {
      occupiedHangars.add(slot.id);
      playerHangarAssignments.set(player, slot.id);
      return slot;
    }
  }
  return null; // All hangars occupied
}

/** Release a player's hangar assignment */
function releaseHangar(player: Player): void {
  const hangarId = playerHangarAssignments.get(player);
  if (hangarId) {
    occupiedHangars.delete(hangarId);
    playerHangarAssignments.delete(player);
  }
}

// Checkpoint system for ring gameplay
const checkpointSystem = new CheckpointSystem();

// Setup checkpoint rings
function setupCheckpoints(): void {
  // Ring positions - fly through these in order
  checkpointSystem.addRing({ x: 0, y: 110, z: -50 }, 10);
  checkpointSystem.addRing({ x: 50, y: 120, z: -120 }, 10);
  checkpointSystem.addRing({ x: -30, y: 105, z: -200 }, 10);
  checkpointSystem.addRing({ x: 80, y: 130, z: -280 }, 10);
  checkpointSystem.addRing({ x: 0, y: 115, z: -350 }, 10);
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
  const hangarServer = new HangarServer(world, airport, playerAirplanes);

  // Handle player joining
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    console.log(`Player ${player.username} joined - setting up at airport`);

    // Create hangar interaction controller for this player
    const hangarController = new HangarInteractionController(airport);
    playerHangarControllers.set(player, hangarController);
    playerEKeyState.set(player, false);

    // Wire up hangar controller callbacks to send network messages
    hangarController.onRequestOpenHangar = (_playerId, hangar) => {
      console.log(`[Network] Sending HANGAR_OPEN_REQUESTED for ${hangar.id}`);
      hangarServer.handleOpenRequest(player, hangar.id);
    };

    hangarController.onRequestPlaneSpawn = (_playerId, hangarId, planeId) => {
      console.log(`[Network] Sending PLANE_SELECTION_CONFIRMED for ${planeId}`);
      hangarServer.handlePlaneSelection(player, hangarId, planeId);
    };

    // Assign a hangar to this player
    const assignedHangar = assignHangar(player);

    if (assignedHangar) {
      // Create and spawn airplane inside the assigned hangar
      const airplane = new HytopiaAirplane({
        modelUri: 'models/low-poly/scene.gltf',
        modelScale: 0.3,
        spawnPosition: assignedHangar.position,
        spawnYawDegrees: assignedHangar.yawDegrees,
        groundLevel: airport.elevation,
        startInAir: false,  // Start grounded in hangar
      });

      airplane.spawn(world, player, assignedHangar.position);
      playerAirplanes.set(player, airplane);

      console.log(`[Airport] Player ${player.username} assigned to ${assignedHangar.id}`);
    } else {
      // All hangars full - spawn at runway instead
      const airplane = new HytopiaAirplane({
        modelUri: 'models/low-poly/scene.gltf',
        modelScale: 0.3,
        spawnPosition: airport.spawn.position,
        spawnYawDegrees: airport.spawn.yawDegrees,
        groundLevel: airport.elevation,
        startInAir: false,
      });

      airplane.spawn(world, player, airport.spawn.position);
      playerAirplanes.set(player, airplane);

      console.log(`[Airport] All hangars full - Player ${player.username} spawned at runway`);
    }

    // Load the UI
    player.ui.load('ui/index.html');

    // Handle UI messages from client (plane selection)
    player.ui.on(PlayerUIEvent.DATA, ({ data }) => {
      if (data.type === MessageType.PLANE_SELECTION_CONFIRMED) {
        hangarServer.handlePlaneSelection(player, data.hangarId, data.planeId);
      }
    });

    // Send welcome message
    const hangarName = assignedHangar ? assignedHangar.id.replace('hangar_', 'Hangar ') : 'Runway';
    world.chatManager.sendPlayerMessage(
      player,
      `Welcome to ${airport.name}! You're in ${hangarName}`,
      '00FF00'
    );
    world.chatManager.sendPlayerMessage(
      player,
      'TAXI: W = Throttle up, S = Throttle down, A/D = Steer',
      '00FFFF'
    );
    world.chatManager.sendPlayerMessage(
      player,
      'TAKEOFF: Build speed on runway, then lift off!',
      '00FFFF'
    );
    world.chatManager.sendPlayerMessage(
      player,
      'FLIGHT: Mouse = Pitch/Roll, Space = Brake, Shift = Boost',
      '00FF00'
    );
  });

  // Handle player leaving
  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    console.log(`Player ${player.username} left - cleaning up`);

    const airplane = playerAirplanes.get(player);
    if (airplane) {
      airplane.despawn();
      playerAirplanes.delete(player);
    }

    // Clean up hangar controller
    playerHangarControllers.delete(player);
    playerEKeyState.delete(player);

    // Release hangar assignment
    releaseHangar(player);
  });

  // Game tick - update checkpoints, hangar proximity, and UI
  setInterval(() => {
    for (const [player, airplane] of playerAirplanes) {
      const state = airplane.flightState;
      const playerPos = state.position;

      // Update checkpoint system
      checkpointSystem.update(playerPos);

      // Update hangar proximity
      const hangarController = playerHangarControllers.get(player);
      if (hangarController) {
        hangarController.updateProximity(playerPos);

        // Send hangar prompt to UI
        player.ui.sendData({
          type: 'hangar-prompt',
          show: hangarController.hudPrompt.show,
          text: hangarController.hudPrompt.text,
        });

        // Check for E key press (detect press, not hold)
        const eKeyDown = !!player.input.e;
        const wasEKeyDown = playerEKeyState.get(player) || false;

        if (eKeyDown && !wasEKeyDown) {
          // E key just pressed - handle interaction
          hangarController.handleInteractKey(player.id, playerPos);
        }

        playerEKeyState.set(player, eKeyDown);
      }

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
      });
    }
  }, 100);

  console.log('Flight Simulator ready!');
  console.log(`Hangars available: ${airport.hangarDistrict.slots.map(s => s.id).join(', ')}`);
});
