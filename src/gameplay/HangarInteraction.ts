import type { Vec3Like, AirportConfig, HangarSlot } from "./AirportTypes";
import { findNearestHangar } from "./AirportZone";
import type { OwnedPlane } from "./OwnedPlaneTypes";

const HANGAR_INTERACT_RADIUS = 10;

export type HangarHUDPrompt = {
  show: boolean;
  text: string;
  hangarId?: string;
};

export class HangarInteractionController {
  private airport: AirportConfig;

  public hudPrompt: HangarHUDPrompt = { show: false, text: "" };

  // These should be wired to your networking/backend layer:
  // - onRequestOpenHangar: client → server (ask for list of planes)
  // - onRequestPlaneSpawn: client → server (confirm chosen plane)
  onRequestOpenHangar: (playerId: string, hangar: HangarSlot) => void = () => {};
  onRequestPlaneSpawn: (playerId: string, hangarId: string, planeId: string) => void = () => {};

  constructor(airport: AirportConfig) {
    this.airport = airport;
  }

  updateProximity(playerPos: Vec3Like) {
    const nearest = findNearestHangar(playerPos, this.airport);
    if (!nearest) {
      this.hudPrompt = { show: false, text: "" };
      return;
    }

    const dx = playerPos.x - nearest.position.x;
    const dy = playerPos.y - nearest.position.y;
    const dz = playerPos.z - nearest.position.z;
    const dSq = dx*dx + dy*dy + dz*dz;

    if (dSq <= HANGAR_INTERACT_RADIUS * HANGAR_INTERACT_RADIUS) {
      this.hudPrompt = {
        show: true,
        text: `Press E to open ${nearest.id}`,
        hangarId: nearest.id
      };
    } else {
      this.hudPrompt = { show: false, text: "" };
    }
  }

  handleInteractKey(playerId: string, playerPos: Vec3Like) {
    const nearest = findNearestHangar(playerPos, this.airport);
    if (!nearest) return;

    const dx = playerPos.x - nearest.position.x;
    const dy = playerPos.y - nearest.position.y;
    const dz = playerPos.z - nearest.position.z;
    const dSq = dx*dx + dy*dy + dz*dz;
    if (dSq > HANGAR_INTERACT_RADIUS * HANGAR_INTERACT_RADIUS) return;

    this.onRequestOpenHangar(playerId, nearest);
  }

  handlePlaneChosen(playerId: string, hangarId: string, planeId: string) {
    this.onRequestPlaneSpawn(playerId, hangarId, planeId);
  }
}
