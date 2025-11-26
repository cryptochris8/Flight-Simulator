/**
 * Server-side handler for hangar interactions
 */

import { Player, World } from 'hytopia';
import type { OwnedPlane } from '../gameplay/OwnedPlaneTypes';
import type { AirportConfig, HangarSlot } from '../gameplay/AirportTypes';
import { HytopiaAirplane } from '../aircraft/HytopiaAirplane';
import { MessageType } from './NetworkMessages';

// Mock plane inventory - in production this would come from NFT backend
const MOCK_PLAYER_PLANES: OwnedPlane[] = [
  {
    id: 'plane_001',
    name: 'SkyRacer Mk1',
    class: 'rookie',
    stats: { maxSpeed: 100, handling: 70, acceleration: 80 },
  },
  {
    id: 'plane_002',
    name: 'Thunderbolt',
    class: 'pro',
    stats: { maxSpeed: 150, handling: 85, acceleration: 90 },
  },
  {
    id: 'plane_003',
    name: 'Golden Eagle',
    class: 'legendary',
    skinId: 'gold_skin',
    stats: { maxSpeed: 200, handling: 95, acceleration: 100 },
  },
];

// Map plane IDs to model URIs
const PLANE_MODELS: Record<string, { modelUri: string; modelScale: number }> = {
  plane_001: { modelUri: 'models/low-poly/scene.gltf', modelScale: 0.3 },
  plane_002: { modelUri: 'models/curtiss_p40/scene.gltf', modelScale: 0.015 },
  plane_003: { modelUri: 'models/vintage-toy/scene.gltf', modelScale: 0.5 },
};

export class HangarServer {
  private world: World;
  private airport: AirportConfig;
  private playerAirplanes: Map<Player, HytopiaAirplane>;

  constructor(
    world: World,
    airport: AirportConfig,
    playerAirplanes: Map<Player, HytopiaAirplane>
  ) {
    this.world = world;
    this.airport = airport;
    this.playerAirplanes = playerAirplanes;
  }

  /**
   * Handle HANGAR_OPEN_REQUESTED message from client
   */
  handleOpenRequest(player: Player, hangarId: string): void {
    console.log(`[HangarServer] Player ${player.username} requested to open ${hangarId}`);

    // Validate hangar exists
    const hangar = this.airport.hangarDistrict.slots.find(s => s.id === hangarId);
    if (!hangar) {
      player.ui.sendData({
        type: MessageType.HANGAR_ERROR,
        error: `Hangar ${hangarId} not found`,
      });
      return;
    }

    // In production, fetch from NFT backend based on player wallet
    // For now, return mock planes
    const planes = this.getPlayerPlanes(player);

    player.ui.sendData({
      type: MessageType.HANGAR_CONTENTS,
      hangarId,
      planes,
    });

    console.log(`[HangarServer] Sent ${planes.length} planes to ${player.username}`);
  }

  /**
   * Handle PLANE_SELECTION_CONFIRMED message from client
   */
  handlePlaneSelection(player: Player, hangarId: string, planeId: string): void {
    console.log(`[HangarServer] Player ${player.username} selected plane ${planeId} from ${hangarId}`);

    // Validate ownership (mock validation)
    const planes = this.getPlayerPlanes(player);
    const selectedPlane = planes.find(p => p.id === planeId);

    if (!selectedPlane) {
      player.ui.sendData({
        type: MessageType.HANGAR_ERROR,
        error: 'You do not own this plane',
      });
      return;
    }

    // Get hangar slot for spawn position
    const hangar = this.airport.hangarDistrict.slots.find(s => s.id === hangarId);
    if (!hangar) {
      player.ui.sendData({
        type: MessageType.HANGAR_ERROR,
        error: 'Invalid hangar',
      });
      return;
    }

    // Despawn existing airplane if any
    const existingAirplane = this.playerAirplanes.get(player);
    if (existingAirplane) {
      existingAirplane.despawn();
      this.playerAirplanes.delete(player);
    }

    // Get model config for selected plane
    const modelConfig = PLANE_MODELS[planeId] || PLANE_MODELS['plane_001'];

    // Spawn new airplane at runway spawn position (not hangar position)
    const airplane = new HytopiaAirplane({
      modelUri: modelConfig.modelUri,
      modelScale: modelConfig.modelScale,
      spawnPosition: this.airport.spawn.position,
      spawnYawDegrees: this.airport.spawn.yawDegrees,
      groundLevel: this.airport.elevation,
      startInAir: false,
    });

    airplane.spawn(this.world, player, this.airport.spawn.position);
    this.playerAirplanes.set(player, airplane);

    // Notify client
    player.ui.sendData({
      type: MessageType.PLANE_SPAWNED,
      planeId,
      hangarId,
    });

    // Send chat message
    this.world.chatManager.sendPlayerMessage(
      player,
      `${selectedPlane.name} ready for takeoff!`,
      '00FF00'
    );

    console.log(`[HangarServer] Spawned ${selectedPlane.name} for ${player.username}`);
  }

  /**
   * Get planes owned by a player (mock implementation)
   */
  private getPlayerPlanes(_player: Player): OwnedPlane[] {
    // In production, query NFT backend with player.wallet or player.id
    return MOCK_PLAYER_PLANES;
  }
}
