import type { Vec3 } from "../engine/math";

export type Ring = { center: Vec3; radius: number };

export class CheckpointSystem {
  rings: Ring[] = [];
  current = 0;
  laps = 0;

  addRing(center: Vec3, radius=6) { this.rings.push({ center, radius }); }

  update(planePos: Vec3) {
    if (this.rings.length === 0) return;
    const ring = this.rings[this.current];
    const dx = planePos.x - ring.center.x;
    const dy = planePos.y - ring.center.y;
    const dz = planePos.z - ring.center.z;
    const d2 = dx*dx + dy*dy + dz*dz;
    if (d2 <= ring.radius * ring.radius) {
      this.current = (this.current + 1) % this.rings.length;
      if (this.current === 0) this.laps++;
      // TODO: reward player, play sound, show UI, etc.
    }
  }
}
