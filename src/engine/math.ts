export type Vec3 = { x: number; y: number; z: number };
export const v3 = (x=0, y=0, z=0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x+b.x, a.y+b.y, a.z+b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x-b.x, a.y-b.y, a.z-b.z);
export const mul = (a: Vec3, s: number): Vec3 => v3(a.x*s, a.y*s, a.z*s);
export const dot = (a: Vec3, b: Vec3): number => a.x*b.x + a.y*b.y + a.z*b.z;
export const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1; return v3(a.x/l, a.y/l, a.z/l);
};

export type Quat = { x: number; y: number; z: number; w: number };
export const qIdent = (): Quat => ({ x: 0, y: 0, z: 0, w: 1 });

export const qFromEuler = (pitch: number, yaw: number, roll: number): Quat => {
  // Z (roll) * X (pitch) * Y (yaw)
  const cz = Math.cos(roll*0.5), sz = Math.sin(roll*0.5);
  const cx = Math.cos(pitch*0.5), sx = Math.sin(pitch*0.5);
  const cy = Math.cos(yaw*0.5), sy = Math.sin(yaw*0.5);
  return {
    w: cz*cx*cy + sz*sx*sy,
    x: cz*sx*cy + sz*cx*sy,
    y: cz*cx*sy - sz*sx*cy,
    z: sz*cx*cy - cz*sx*sy
  };
};

export const forward = (q: Quat): Vec3 => {
  // Rotate (0,0,1) by quaternion q (assuming +Z forward for HYTOPIA)
  // Standard quaternion rotation of unit Z vector
  const x = 2*(q.x*q.z + q.w*q.y);
  const y = 2*(q.y*q.z - q.w*q.x);
  const z = 1 - 2*(q.x*q.x + q.y*q.y);
  return v3(x, -y, z);  // +Z forward, pitch up = negative Y
};
