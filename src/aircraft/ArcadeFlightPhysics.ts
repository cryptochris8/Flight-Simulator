import { Vec3, v3, add, mul } from "../engine/math";
import { clamp } from "../util/clamp";

export type ArcadeFlightState = {
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  roll: number;
  throttle: number;
};

export type ArcadeControlInput = {
  pitch: number;        // -1..1
  roll: number;         // -1..1
  yaw: number;          // -1..1
  throttleDelta: number;// -1..1
  boost: boolean;
  brake: boolean;
};

export type ArcadeFlightConfig = {
  maxSpeed: number;
  accel: number;
  decel: number;
  turnRateYaw: number;
  turnRatePitch: number;
  turnRateRoll: number;
  autoLevelStrength: number;
  gravity: number;
  boostMultiplier: number;
  brakeMultiplier: number;
};

export class ArcadeFlightPhysics {
  public state: ArcadeFlightState;
  private cfg: ArcadeFlightConfig;

  constructor(cfg?: Partial<ArcadeFlightConfig>) {
    this.cfg = Object.assign({
      maxSpeed: 100,         // Slightly slower for better control
      accel: 35,             // Smooth acceleration
      decel: 25,             // Gradual deceleration
      turnRateYaw: 1.5,      // Yaw rate (A/D keys)
      turnRatePitch: 1.2,    // Pitch rate (mouse Y)
      turnRateRoll: 1.8,     // Roll rate (mouse X)
      autoLevelStrength: 2.5,// Stronger auto-level for stability
      gravity: 2.5,          // Gentler gravity
      boostMultiplier: 1.4,
      brakeMultiplier: 0.3
    }, cfg);

    this.state = {
      position: v3(0, 200, 0),
      velocity: v3(0, 0, 0),  // Will be set by HytopiaAirplane based on spawn yaw
      yaw: 0,
      pitch: 0,
      roll: 0,
      throttle: 0.6
    };
  }

  update(input: ArcadeControlInput, dt: number) {
    const s = this.state;
    const c = this.cfg;

    s.throttle = clamp(s.throttle + input.throttleDelta * dt, 0, 1);

    let targetSpeed = c.maxSpeed * s.throttle;
    if (input.boost) targetSpeed *= c.boostMultiplier;
    if (input.brake) targetSpeed *= c.brakeMultiplier;

    const currentSpeed = Math.hypot(s.velocity.x, s.velocity.y, s.velocity.z);
    const speedDiff = targetSpeed - currentSpeed;
    const accel = speedDiff > 0 ? c.accel : c.decel;
    const newSpeed = currentSpeed + clamp(speedDiff, -accel*dt, accel*dt);

    // Apply control inputs
    s.yaw   += input.yaw   * c.turnRateYaw   * dt;
    s.pitch += input.pitch * c.turnRatePitch * dt;
    s.roll  += input.roll  * c.turnRateRoll  * dt;

    // Auto-level roll when no roll input
    if (Math.abs(input.roll) < 0.1) {
      s.roll -= s.roll * c.autoLevelStrength * dt;
    }

    // Auto-level pitch when no pitch input (gentler)
    if (Math.abs(input.pitch) < 0.1) {
      s.pitch -= s.pitch * c.autoLevelStrength * 0.5 * dt;
    }

    // Clamp pitch to prevent over-rotation
    s.pitch = clamp(s.pitch, -Math.PI/4, Math.PI/4);

    const forward = this.forwardFromEuler(s.pitch, s.yaw);
    s.velocity = mul(forward, newSpeed);

    s.velocity.y -= c.gravity * dt * (1 - s.throttle * 0.8);

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
