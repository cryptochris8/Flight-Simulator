import {
  startServer,
  World,
  Player,
  PlayerEvent,
} from 'hytopia';

import { HytopiaAirplane } from './aircraft/HytopiaAirplane';
import { CheckpointSystem } from './gameplay/CheckpointSystem';

// Store active airplanes per player
const playerAirplanes = new Map<Player, HytopiaAirplane>();

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

  // Setup checkpoints
  setupCheckpoints();

  // Handle player joining
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    console.log(`Player ${player.username} joined - spawning airplane`);

    // Create and spawn airplane for this player
    const airplane = new HytopiaAirplane({
      modelUri: 'models/low-poly/scene.gltf',
      modelScale: 0.5,
      spawnPosition: { x: 0, y: 100, z: 0 },
    });

    airplane.spawn(world, player);
    playerAirplanes.set(player, airplane);

    // Send welcome message
    world.chatManager.sendPlayerMessage(
      player,
      'Welcome to Flight Simulator! Controls: W/S = Throttle, A/D = Yaw, Mouse = Pitch/Roll, Space = Brake, Shift = Boost',
      '00FF00'
    );
  });

  // Handle player leaving
  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    console.log(`Player ${player.username} left - cleaning up airplane`);

    const airplane = playerAirplanes.get(player);
    if (airplane) {
      airplane.despawn();
      playerAirplanes.delete(player);
    }
  });

  // Game tick - update checkpoints and UI
  setInterval(() => {
    for (const [player, airplane] of playerAirplanes) {
      const controller = airplane.getController();
      const state = controller.flightState;

      // Update checkpoint system
      checkpointSystem.update(state.position);

      // Send flight data to UI (if you have a custom UI)
      const flightData = airplane.getFlightData();
      player.ui.sendData({
        type: 'flight-update',
        speed: Math.round(flightData.speed),
        altitude: Math.round(flightData.altitude),
        throttle: Math.round(flightData.throttle * 100),
        checkpoint: checkpointSystem.current + 1,
        totalCheckpoints: checkpointSystem.rings.length,
        laps: checkpointSystem.laps,
      });
    }
  }, 100); // Update UI 10 times per second

  console.log('Flight Simulator ready!');
});
