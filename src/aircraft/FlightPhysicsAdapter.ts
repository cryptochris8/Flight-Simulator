/**
 * Flight Physics Adapter
 *
 * Provides a unified interface for different flight physics implementations.
 * This allows switching between Arcade, Hybrid, and Realistic physics modes
 * without changing the HytopiaAirplane code.
 */

import { Vec3, v3 } from "../engine/math";
import { FlightPhysics, ControlInput, FlightState } from "./FlightPhysics";
import { ArcadeFlightPhysics, ArcadeControlInput } from "./ArcadeFlightPhysics";
import { HybridFlightPhysics, HybridControlInput } from "./HybridFlightPhysics";
import { FLIGHT_MODE, FlightMode } from "./FlightConfig";

/**
 * Unified flight state that all physics modes expose
 */
export interface UnifiedFlightState {
  velocity: Vec3;
  pitch: number;
  yaw: number;
  roll: number;
  throttle: number;
  isGrounded: boolean;
  position?: Vec3;  // Some physics track position internally
}

/**
 * Unified control input for all physics modes
 */
export interface UnifiedControlInput {
  pitch: number;        // -1..1
  roll: number;         // -1..1
  yaw: number;          // -1..1
  throttleDelta: number;// change per second
  brake: boolean;
  boost: boolean;
}

/**
 * Interface for physics adapters
 */
export interface IFlightPhysicsAdapter {
  /** Current flight state */
  readonly state: UnifiedFlightState;

  /** Update physics for one frame */
  update(input: UnifiedControlInput, dt: number, entityY?: number): void;

  /** Set ground level for realistic mode */
  setGroundLevel?(level: number): void;

  /** Get velocity for entity movement */
  getVelocity(): Vec3;

  /** Get position (for arcade/hybrid which track position internally) */
  getPosition(): Vec3 | null;

  /** Whether this physics mode tracks position internally */
  readonly tracksPosition: boolean;
}

/**
 * Adapter for the original realistic FlightPhysics
 */
class RealisticPhysicsAdapter implements IFlightPhysicsAdapter {
  private physics: FlightPhysics;
  readonly tracksPosition = false;

  constructor() {
    this.physics = new FlightPhysics();
  }

  get state(): UnifiedFlightState {
    return {
      ...this.physics.state,
    };
  }

  update(input: UnifiedControlInput, dt: number, entityY?: number): void {
    this.physics.update(input as ControlInput, dt, entityY ?? 0);
  }

  setGroundLevel(level: number): void {
    this.physics.setGroundLevel(level);
  }

  getVelocity(): Vec3 {
    return { ...this.physics.state.velocity };
  }

  getPosition(): Vec3 | null {
    return null; // Realistic mode doesn't track position
  }
}

/**
 * Adapter for ArcadeFlightPhysics
 */
class ArcadePhysicsAdapter implements IFlightPhysicsAdapter {
  private physics: ArcadeFlightPhysics;
  readonly tracksPosition = true;

  constructor() {
    this.physics = new ArcadeFlightPhysics();
  }

  get state(): UnifiedFlightState {
    const s = this.physics.state;
    return {
      velocity: s.velocity,
      pitch: s.pitch,
      yaw: s.yaw,
      roll: s.roll,
      throttle: s.throttle,
      isGrounded: false, // Arcade mode is always in flight
      position: s.position,
    };
  }

  update(input: UnifiedControlInput, dt: number, _entityY?: number): void {
    const arcadeInput: ArcadeControlInput = {
      pitch: input.pitch,
      roll: input.roll,
      yaw: input.yaw,
      throttleDelta: input.throttleDelta,
      boost: input.boost,
      brake: input.brake,
    };
    this.physics.update(arcadeInput, dt);
  }

  getVelocity(): Vec3 {
    return { ...this.physics.state.velocity };
  }

  getPosition(): Vec3 {
    return { ...this.physics.state.position };
  }
}

/**
 * Adapter for HybridFlightPhysics
 */
class HybridPhysicsAdapter implements IFlightPhysicsAdapter {
  private physics: HybridFlightPhysics;
  readonly tracksPosition = true;

  constructor() {
    this.physics = new HybridFlightPhysics();
  }

  get state(): UnifiedFlightState {
    const s = this.physics.state;
    return {
      velocity: s.velocity,
      pitch: s.pitch,
      yaw: s.yaw,
      roll: s.roll,
      throttle: s.throttle,
      isGrounded: false, // Hybrid mode is always in flight
      position: s.position,
    };
  }

  update(input: UnifiedControlInput, dt: number, _entityY?: number): void {
    const hybridInput: HybridControlInput = {
      pitch: input.pitch,
      roll: input.roll,
      yaw: input.yaw,
      throttleDelta: input.throttleDelta,
      boost: input.boost,
      brake: input.brake,
    };
    this.physics.update(hybridInput, dt);
  }

  getVelocity(): Vec3 {
    return { ...this.physics.state.velocity };
  }

  getPosition(): Vec3 {
    return { ...this.physics.state.position };
  }
}

/**
 * Factory function to create the appropriate physics adapter based on FLIGHT_MODE
 */
export function createFlightPhysicsAdapter(mode?: FlightMode): IFlightPhysicsAdapter {
  const effectiveMode = mode ?? FLIGHT_MODE;

  switch (effectiveMode) {
    case "arcade":
      console.log("[FlightPhysics] Using ARCADE physics mode");
      return new ArcadePhysicsAdapter();
    case "hybrid":
      console.log("[FlightPhysics] Using HYBRID physics mode");
      return new HybridPhysicsAdapter();
    case "realistic":
      console.log("[FlightPhysics] Using REALISTIC physics mode");
      return new RealisticPhysicsAdapter();
    default:
      console.log("[FlightPhysics] Unknown mode, defaulting to ARCADE");
      return new ArcadePhysicsAdapter();
  }
}
