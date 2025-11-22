import { Vec3, v3, add, mul, qFromEuler, forward } from "../engine/math";
import { clamp } from "../util/clamp";

export type FlightState = {
  position: Vec3;
  velocity: Vec3;   // world m/s
  pitch: number;    // radians
  yaw: number;      // radians
  roll: number;     // radians
  throttle: number; // 0..1
};

export type FlightConfig = {
  mass: number;          // kg
  maxThrust: number;     // N
  dragCoef: number;      // ~0.02..0.2
  liftCoef: number;      // simplistic lift scalar
  gravity: number;       // 9.81
  maxPitchRate: number;  // rad/s
  maxRollRate: number;   // rad/s
  maxYawRate: number;    // rad/s
  airBrakeDrag: number;  // added drag when braking
  boostThrust: number;   // extra thrust when boosting
};

export type ControlInput = {
  pitch: number; // -1..1
  roll: number;  // -1..1
  yaw: number;   // -1..1
  throttleDelta: number; // -1..1 per second
  brake: boolean;
  boost: boolean;
};

export class FlightPhysics {
  public state: FlightState;
  private cfg: FlightConfig;

  constructor(cfg?: Partial<FlightConfig>) {
    this.cfg = Object.assign({
      mass: 800,
      maxThrust: 2000,      // Reduced from 8000
      dragCoef: 0.08,       // Increased drag
      liftCoef: 0.4,        // Reduced from 0.9
      gravity: 9.81,
      maxPitchRate: 1.2,    // Slower pitch
      maxRollRate: 1.8,     // Slower roll
      maxYawRate: 0.8,      // Slower yaw
      airBrakeDrag: 0.5,    // More effective brakes
      boostThrust: 1000     // Reduced from 4000
    }, cfg);

    this.state = {
      position: v3(0, 200, 0),
      velocity: v3(0, 0, 0),
      pitch: 0,
      yaw: 0,
      roll: 0,
      throttle: 0.4
    };
  }

  update(input: ControlInput, dt: number) {
    const s = this.state;
    const c = this.cfg;

    // Orientation
    s.pitch += input.pitch * c.maxPitchRate * dt;
    s.roll  += input.roll  * c.maxRollRate  * dt;
    s.yaw   += input.yaw   * c.maxYawRate   * dt;

    s.pitch = clamp(s.pitch, -Math.PI/2 + 0.1, Math.PI/2 - 0.1);

    // Throttle
    s.throttle = clamp(s.throttle + input.throttleDelta * dt, 0, 1);

    // Forces
    const q = qFromEuler(s.pitch, s.yaw, s.roll);
    const fwd = forward(q);
    const speed = Math.hypot(s.velocity.x, s.velocity.y, s.velocity.z);

    const thrust = (c.maxThrust * s.throttle) + (input.boost ? c.boostThrust : 0);
    let force: Vec3 = mul(fwd, thrust);

    const dragMag = c.dragCoef * speed * speed * (input.brake ? (1 + c.airBrakeDrag) : 1);
    const drag: Vec3 = speed > 0 ? mul(s.velocity, -dragMag / speed) : v3();
    force = add(force, drag);

    // Lift based on speed and pitch (simplified)
    const liftMag = c.liftCoef * speed * s.throttle;
    const upLocal: Vec3 = { x: 0, y: 1, z: 0 };
    force = add(force, mul(upLocal, liftMag));  // Don't multiply by mass here

    // Gravity
    force = add(force, v3(0, -c.mass * c.gravity, 0));

    const acc = mul(force, 1 / c.mass);
    s.velocity = add(s.velocity, mul(acc, dt));

    // Clamp max speed to 100 units/sec
    const newSpeed = Math.hypot(s.velocity.x, s.velocity.y, s.velocity.z);
    const maxSpeed = 100;
    if (newSpeed > maxSpeed) {
      const scale = maxSpeed / newSpeed;
      s.velocity = mul(s.velocity, scale);
    }

    s.position = add(s.position, mul(s.velocity, dt));
  }
}
