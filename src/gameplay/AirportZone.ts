import type { Vec3Like, AirportConfig, RunwayConfig, HangarSlot } from "./AirportTypes";

/**
 * Compute squared distance from a point to the runway centerline segment.
 */
function distanceSqToRunwayCenterline(pos: Vec3Like, runway: RunwayConfig): number {
  const ax = runway.start.x;
  const ay = runway.start.y;
  const az = runway.start.z;
  const bx = runway.end.x;
  const by = runway.end.y;
  const bz = runway.end.z;

  const vx = bx - ax;
  const vy = by - ay;
  const vz = bz - az;

  const wx = pos.x - ax;
  const wy = pos.y - ay;
  const wz = pos.z - az;

  const vLenSq = vx*vx + vy*vy + vz*vz || 1;
  let t = (wx*vx + wy*vy + wz*vz) / vLenSq;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + vx * t;
  const cy = ay + vy * t;
  const cz = az + vz * t;

  const dx = pos.x - cx;
  const dy = pos.y - cy;
  const dz = pos.z - cz;

  return dx*dx + dy*dy + dz*dz;
}

/**
 * Returns true if the plane position is roughly over the runway strip
 * and within a given lateral margin.
 */
export function isOnRunway(pos: Vec3Like, airport: AirportConfig, margin = 2): boolean {
  const runway = airport.runway;
  const halfWidth = runway.width / 2 + margin;

  const dSq = distanceSqToRunwayCenterline(pos, runway);
  if (dSq > halfWidth * halfWidth) return false;

  // Simple altitude check around airport elevation
  const maxHeightDiff = 5;
  if (Math.abs(pos.y - airport.elevation) > maxHeightDiff) return false;

  return true;
}

/**
 * Find the nearest hangar slot to a given position.
 */
export function findNearestHangar(pos: Vec3Like, airport: AirportConfig): HangarSlot | null {
  let best: HangarSlot | null = null;
  let bestDistSq = Infinity;

  for (const slot of airport.hangarDistrict.slots) {
    const dx = pos.x - slot.position.x;
    const dy = pos.y - slot.position.y;
    const dz = pos.z - slot.position.z;
    const dSq = dx*dx + dy*dy + dz*dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = slot;
    }
  }

  return best;
}
