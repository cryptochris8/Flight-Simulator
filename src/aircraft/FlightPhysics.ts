import { Vec3, v3, add, mul, qFromEuler, forward } from "../engine/math";
import { clamp } from "../util/clamp";

export type FlightState = {
  velocity: Vec3;     // world m/s - this controls entity movement
  pitch: number;      // radians
  yaw: number;        // radians
  roll: number;       // radians
  throttle: number;   // 0..1
  isGrounded: boolean;
};

export type FlightConfig = {
  mass: number;           // kg
  maxThrust: number;      // N
  dragCoef: number;       // air drag coefficient
  liftCoef: number;       // lift coefficient (for v² formula)
  gravity: number;        // 9.81
  maxPitchRate: number;   // rad/s
  maxRollRate: number;    // rad/s
  maxYawRate: number;     // rad/s
  airBrakeDrag: number;   // added drag when braking
  boostThrust: number;    // extra thrust when boosting
  groundLevel: number;    // Y level of the ground/runway
  takeoffSpeed: number;   // minimum speed to generate enough lift
  groundFriction: number; // friction when taxiing
};

export type ControlInput = {
  pitch: number;        // -1..1
  roll: number;         // -1..1
  yaw: number;          // -1..1
  throttleDelta: number; // change per second
  brake: boolean;
  boost: boolean;
};

export class FlightPhysics {
  public state: FlightState;
  public cfg: FlightConfig;

  constructor(cfg?: Partial<FlightConfig>) {
    this.cfg = {
      mass: 800,
      maxThrust: 6000,        // Strong thrust for good acceleration and climb
      dragCoef: 0.003,        // Air drag - lower for better flight performance
      liftCoef: 12.5,         // Calculated so lift = weight at takeoff speed
      gravity: 9.81,
      maxPitchRate: 1.5,
      maxRollRate: 2.0,
      maxYawRate: 1.0,
      airBrakeDrag: 0.02,     // Reduced air brake drag
      boostThrust: 3000,      // Extra boost power
      groundLevel: 180,
      takeoffSpeed: 25,       // Need ~25 m/s to lift off
      groundFriction: 0.015,  // Rolling resistance on tarmac
      ...cfg,
    };

    // Recalculate liftCoef based on takeoff speed
    // At takeoff: lift = weight, so liftCoef * v² = mass * g
    // liftCoef = (mass * g) / (takeoffSpeed²)
    this.cfg.liftCoef = (this.cfg.mass * this.cfg.gravity) / (this.cfg.takeoffSpeed * this.cfg.takeoffSpeed);

    this.state = {
      velocity: v3(0, 0, 0),
      pitch: 0,
      yaw: 0,
      roll: 0,
      throttle: 0,
      isGrounded: true,
    };
  }

  setGroundLevel(level: number) {
    this.cfg.groundLevel = level;
  }

  /**
   * Update physics - call each tick
   * @param input - Control inputs
   * @param dt - Delta time in seconds
   * @param entityY - Current Y position from entity (for ground detection)
   */
  update(input: ControlInput, dt: number, entityY: number) {
    const s = this.state;
    const c = this.cfg;

    // Calculate current speed
    const speed = Math.hypot(s.velocity.x, s.velocity.y, s.velocity.z);
    const groundSpeed = Math.hypot(s.velocity.x, s.velocity.z);

    // Ground detection - are we on or very close to the ground?
    const onGround = entityY <= c.groundLevel + 0.5;
    const canTakeoff = speed >= c.takeoffSpeed && s.throttle >= 0.5;

    // State transitions
    if (s.isGrounded && canTakeoff) {
      s.isGrounded = false;
      console.log(`[FlightPhysics] TAKEOFF! Speed: ${speed.toFixed(1)}, Throttle: ${(s.throttle * 100).toFixed(0)}%`);
    } else if (!s.isGrounded && onGround && speed < c.takeoffSpeed * 0.8) {
      s.isGrounded = true;
      s.velocity.y = 0;
      console.log(`[FlightPhysics] LANDED. Speed: ${speed.toFixed(1)}`);
    }

    // Throttle update
    s.throttle = clamp(s.throttle + input.throttleDelta * dt, 0, 1);

    if (s.isGrounded) {
      // ==================== GROUND/TAXI MODE ====================
      this.updateGround(input, dt, groundSpeed);
    } else {
      // ==================== FLIGHT MODE ====================
      this.updateFlight(input, dt, speed, entityY);
    }
  }

  private updateGround(input: ControlInput, dt: number, groundSpeed: number) {
    const s = this.state;
    const c = this.cfg;

    // Steering - more effective at low speed
    const steerFactor = Math.max(0.5, 1.5 - groundSpeed / 20);
    s.yaw += input.yaw * c.maxYawRate * steerFactor * dt;

    // Keep level on ground
    s.pitch = 0;
    s.roll = 0;

    // Forward direction based on yaw (+Z forward when yaw=0, +X forward when yaw=90°)
    const fwdX = Math.sin(s.yaw);
    const fwdZ = Math.cos(s.yaw);

    // Debug: log direction calculation occasionally
    if (Math.random() < 0.01 && s.throttle > 0) {
      console.log(`[Physics] yaw=${(s.yaw * 180 / Math.PI).toFixed(1)}° → fwdX=${fwdX.toFixed(2)}, fwdZ=${fwdZ.toFixed(2)}, vel=(${s.velocity.x.toFixed(2)}, ${s.velocity.z.toFixed(2)})`);
    }

    // Thrust force
    const thrust = c.maxThrust * s.throttle;
    let accelX = (fwdX * thrust) / c.mass;
    let accelZ = (fwdZ * thrust) / c.mass;

    // Rolling friction (opposes motion)
    if (groundSpeed > 0.1) {
      const frictionDecel = c.groundFriction * c.gravity;
      accelX -= (s.velocity.x / groundSpeed) * frictionDecel;
      accelZ -= (s.velocity.z / groundSpeed) * frictionDecel;
    }

    // Braking
    if (input.brake && groundSpeed > 0.5) {
      const brakeDecel = c.gravity * 0.4; // Strong brakes
      accelX -= (s.velocity.x / groundSpeed) * brakeDecel;
      accelZ -= (s.velocity.z / groundSpeed) * brakeDecel;
    }

    // Apply acceleration
    s.velocity.x += accelX * dt;
    s.velocity.z += accelZ * dt;
    s.velocity.y = 0; // Stay on ground

    // Speed limit on ground
    const newGroundSpeed = Math.hypot(s.velocity.x, s.velocity.z);
    const maxGroundSpeed = 50;
    if (newGroundSpeed > maxGroundSpeed) {
      const scale = maxGroundSpeed / newGroundSpeed;
      s.velocity.x *= scale;
      s.velocity.z *= scale;
    }

    // Full stop at very low speed with no throttle
    if (newGroundSpeed < 0.3 && s.throttle < 0.05 && !input.brake) {
      s.velocity.x = 0;
      s.velocity.z = 0;
    }
  }

  private updateFlight(input: ControlInput, dt: number, speed: number, entityY: number) {
    const s = this.state;
    const c = this.cfg;

    // Full orientation control
    s.pitch += input.pitch * c.maxPitchRate * dt;
    s.roll += input.roll * c.maxRollRate * dt;
    s.yaw += input.yaw * c.maxYawRate * dt;

    // Clamp pitch to ±45 degrees (more reasonable range)
    s.pitch = clamp(s.pitch, -Math.PI / 4, Math.PI / 4);

    // Auto-level roll slightly when no input
    if (Math.abs(input.roll) < 0.1) {
      s.roll *= 0.98;
    }

    // Get forward direction from orientation
    const q = qFromEuler(s.pitch, s.yaw, s.roll);
    const fwd = forward(q);

    // === ARCADE-STYLE FLIGHT MODEL ===
    // More intuitive: pitch controls climb/descent, throttle controls speed

    // 1. Thrust - in forward direction
    const thrustMag = c.maxThrust * s.throttle + (input.boost ? c.boostThrust : 0);
    let forceX = fwd.x * thrustMag;
    let forceY = fwd.y * thrustMag;
    let forceZ = fwd.z * thrustMag;

    // 2. Drag - opposes velocity, proportional to v²
    // Increased drag coefficient for better speed control
    const effectiveDrag = c.dragCoef * 2; // Double drag for better control
    const dragMag = effectiveDrag * speed * speed;
    const brakeDrag = input.brake ? c.airBrakeDrag * speed * speed * 3 : 0; // Stronger brakes
    const totalDrag = dragMag + brakeDrag;
    if (speed > 0.1) {
      forceX -= (s.velocity.x / speed) * totalDrag * c.mass;
      forceY -= (s.velocity.y / speed) * totalDrag * c.mass;
      forceZ -= (s.velocity.z / speed) * totalDrag * c.mass;
    }

    // 3. Lift - CAPPED to prevent runaway climbing
    // Base lift balances gravity at cruising speed
    const baseLift = c.liftCoef * speed * speed;
    // Cap lift at 1.5x weight to prevent rocket mode
    const maxLift = c.mass * c.gravity * 1.5;
    const cappedLift = Math.min(baseLift, maxLift);

    // Pitch affects lift significantly:
    // - Level (pitch=0): full lift
    // - Pitched up: slightly more lift (climbing)
    // - Pitched down: much less lift (descending)
    const pitchDegrees = s.pitch * 180 / Math.PI;
    let liftMultiplier: number;
    if (pitchDegrees > 0) {
      // Pitching up: lift increases slightly (max 1.2x)
      liftMultiplier = 1 + (pitchDegrees / 45) * 0.2;
    } else {
      // Pitching down: lift decreases significantly (min 0.3x)
      liftMultiplier = 1 + (pitchDegrees / 45) * 0.7;
    }
    liftMultiplier = clamp(liftMultiplier, 0.3, 1.2);

    const liftForce = cappedLift * liftMultiplier;
    forceY += liftForce;

    // 4. Gravity
    const gravityForce = c.mass * c.gravity;
    forceY -= gravityForce;

    // 5. Pitch-based climb/descent (arcade assist)
    // Directly influence vertical velocity based on pitch
    const climbRate = -Math.sin(s.pitch) * speed * 0.5; // Pitch down = descend
    forceY += climbRate * c.mass * 0.3;

    // Debug flight forces occasionally
    if (Math.random() < 0.02) {
      console.log(`[Flight] speed=${speed.toFixed(1)}, lift=${liftForce.toFixed(0)}N (cap=${maxLift.toFixed(0)}), pitch=${pitchDegrees.toFixed(0)}°, velY=${s.velocity.y.toFixed(2)}`);
    }

    // Apply forces as acceleration
    const accelX = forceX / c.mass;
    const accelY = forceY / c.mass;
    const accelZ = forceZ / c.mass;

    s.velocity.x += accelX * dt;
    s.velocity.y += accelY * dt;
    s.velocity.z += accelZ * dt;

    // Speed limit - reduced for better control
    const newSpeed = Math.hypot(s.velocity.x, s.velocity.y, s.velocity.z);
    const maxSpeed = 80; // Reduced from 120 for better control
    if (newSpeed > maxSpeed) {
      const scale = maxSpeed / newSpeed;
      s.velocity = mul(s.velocity, scale);
    }

    // Ground collision - prevent going below ground
    if (entityY <= c.groundLevel && s.velocity.y < 0) {
      s.velocity.y = 0;
      // If slow enough, land
      if (newSpeed < c.takeoffSpeed * 0.8) {
        s.isGrounded = true;
      }
    }
  }

  /**
   * Get the velocity to apply to the entity
   */
  getVelocity(): Vec3 {
    return { ...this.state.velocity };
  }
}
