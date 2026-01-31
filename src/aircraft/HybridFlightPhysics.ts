import { Vec3, v3, add, mul } from "../engine/math";
import { clamp } from "../util/clamp";

export type HybridFlightState = {
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  roll: number;
  throttle: number;
};

export type HybridControlInput = {
  pitch: number;
  roll: number;
  yaw: number;
  throttleDelta: number;
  boost: boolean;
  brake: boolean;
};

export type HybridFlightConfig = {
  mass: number;
  baseThrust: number;
  maxThrust: number;
  dragCoef: number;
  liftCoef: number;
  gravity: number;
  maxPitchRate: number;
  maxRollRate: number;
  maxYawRate: number;
  stallSpeed: number;
  stallLiftMultiplier: number;
};

export class HybridFlightPhysics {
  public state: HybridFlightState;
  private cfg: HybridFlightConfig;

  constructor(cfg?: Partial<HybridFlightConfig>) {
    this.cfg = Object.assign({
      mass: 900,
      baseThrust: 2000,
      maxThrust: 9000,
      dragCoef: 0.04,
      liftCoef: 1.1,
      gravity: 9.81,
      maxPitchRate: 1.5,
      maxRollRate: 2.0,
      maxYawRate: 1.0,
      stallSpeed: 25,
      stallLiftMultiplier: 0.3
    }, cfg);

    this.state = {
      position: v3(0, 220, 0),
      velocity: v3(0, 0, 0),  // Will be set by HytopiaAirplane based on spawn yaw
      yaw: 0,
      pitch: 0,
      roll: 0,
      throttle: 0.6
    };
  }

  update(input: HybridControlInput, dt: number) {
    const s = this.state;
    const c = this.cfg;

    s.pitch += input.pitch * c.maxPitchRate * dt;
    s.roll  += input.roll  * c.maxRollRate  * dt;
    s.yaw   += input.yaw   * c.maxYawRate   * dt;

    s.pitch = clamp(s.pitch, -Math.PI/2 + 0.2, Math.PI/2 - 0.2);

    s.throttle = clamp(s.throttle + input.throttleDelta * dt, 0, 1);

    const speed = Math.hypot(s.velocity.x, s.velocity.y, s.velocity.z);
    const forward = this.forwardFromEuler(s.pitch, s.yaw);

    let thrust = c.baseThrust + c.maxThrust * s.throttle;
    if (input.boost) thrust *= 1.35;
    const thrustForce = mul(forward, thrust);

    const dragMag = c.dragCoef * speed * speed;
    const drag = speed > 0 ? mul(s.velocity, -dragMag / (speed || 1)) : v3();

    const up = v3(0, 1, 0);
    let liftMag = c.liftCoef * speed * s.throttle;

    if (speed < c.stallSpeed) {
      const t = clamp(speed / c.stallSpeed, 0, 1);
      liftMag *= (c.stallLiftMultiplier + (1 - c.stallLiftMultiplier) * t);
    }

    const lift = mul(up, liftMag * c.mass);

    const gravity = v3(0, -c.mass * c.gravity, 0);

    let totalForce = v3();
    totalForce = add(totalForce, thrustForce);
    totalForce = add(totalForce, drag);
    totalForce = add(totalForce, lift);
    totalForce = add(totalForce, gravity);

    const acc = mul(totalForce, 1 / c.mass);
    s.velocity = add(s.velocity, mul(acc, dt));
    s.position = add(s.position, mul(s.velocity, dt));
  }

  private forwardFromEuler(pitch: number, yaw: number): Vec3 {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw),   sy = Math.sin(yaw);
    // Forward direction: yaw=0 → +Z, yaw=90° → +X
    // Pitch up → positive Y component
    return v3(
      sy * cp,
      -sp,
      cy * cp
    );
  }
}
