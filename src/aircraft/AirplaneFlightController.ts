import {
  BaseEntityController,
  Entity,
  PlayerEntity,
  PlayerInput,
  PlayerCameraOrientation,
  Quaternion,
} from 'hytopia';

import { FlightPhysics, FlightState, ControlInput } from './FlightPhysics';
import { CameraRig } from './CameraRig';
import { clamp } from '../util/clamp';

/**
 * Custom entity controller for airplane flight mechanics.
 * Handles player input and applies flight physics each tick.
 */
export class AirplaneFlightController extends BaseEntityController {
  private physics: FlightPhysics;
  private cameraRig: CameraRig;
  private controlInput: ControlInput;

  // Input settings
  private invertY = true;
  private throttleRate = 0.8;
  private mouseSensitivity = 0.005;

  // Track last mouse position for delta calculation
  private lastPitch = 0;
  private lastYaw = 0;

  constructor() {
    super();
    this.physics = new FlightPhysics();
    this.cameraRig = new CameraRig();
    this.controlInput = {
      pitch: 0,
      roll: 0,
      yaw: 0,
      throttleDelta: 0,
      brake: false,
      boost: false,
    };
  }

  get flightState(): FlightState {
    return this.physics.state;
  }

  get camera(): CameraRig {
    return this.cameraRig;
  }

  /**
   * Called when entity spawns - initialize physics state
   */
  override spawn(entity: Entity): void {
    super.spawn(entity);
    // Initialize position from spawn point
    const pos = entity.position;
    this.physics.state.position = { x: pos.x, y: pos.y, z: pos.z };
    this.physics.state.velocity = { x: 0, y: 0, z: 20 }; // Start with forward velocity
  }

  /**
   * Called every tick with player input - this is the main update loop
   */
  override tickWithPlayerInput(
    entity: PlayerEntity,
    input: PlayerInput,
    cameraOrientation: PlayerCameraOrientation,
    deltaTimeMs: number
  ): void {
    super.tickWithPlayerInput(entity, input, cameraOrientation, deltaTimeMs);

    const dt = deltaTimeMs / 1000; // Convert to seconds

    // Process keyboard input
    this.processKeyboardInput(input);

    // Process mouse input (camera orientation changes = mouse movement)
    this.processMouseInput(cameraOrientation);

    // Update flight physics
    this.physics.update(this.controlInput, dt);

    // Apply physics state to entity
    this.applyPhysicsToEntity(entity);

    // Update camera rig
    this.updateCamera(entity);

    // Reset per-frame input
    this.resetFrameInput();
  }

  /**
   * Process keyboard input into control values
   */
  private processKeyboardInput(input: PlayerInput): void {
    // W/S - Throttle
    if (input.w) {
      this.controlInput.throttleDelta = this.throttleRate;
    } else if (input.s) {
      this.controlInput.throttleDelta = -this.throttleRate;
    } else {
      this.controlInput.throttleDelta = 0;
    }

    // A/D - Yaw
    if (input.a) {
      this.controlInput.yaw = -1;
    } else if (input.d) {
      this.controlInput.yaw = 1;
    } else {
      this.controlInput.yaw = 0;
    }

    // Space - Air brake
    this.controlInput.brake = !!input.sp;

    // Shift - Boost
    this.controlInput.boost = !!input.sh;
  }

  /**
   * Process mouse input (via camera orientation) into pitch/roll
   */
  private processMouseInput(cameraOrientation: PlayerCameraOrientation): void {
    // Calculate delta from last frame
    const pitchDelta = cameraOrientation.pitch - this.lastPitch;
    const yawDelta = cameraOrientation.yaw - this.lastYaw;

    // Map camera pitch delta to aircraft pitch
    this.controlInput.pitch = clamp(
      (this.invertY ? pitchDelta : -pitchDelta) * this.mouseSensitivity * 100,
      -1,
      1
    );

    // Map camera yaw delta to aircraft roll
    this.controlInput.roll = clamp(
      yawDelta * this.mouseSensitivity * 100,
      -1,
      1
    );

    // Store for next frame
    this.lastPitch = cameraOrientation.pitch;
    this.lastYaw = cameraOrientation.yaw;
  }

  /**
   * Apply physics state to the HYTOPIA entity
   */
  private applyPhysicsToEntity(entity: Entity): void {
    const state = this.physics.state;

    // Set position
    entity.setPosition({
      x: state.position.x,
      y: state.position.y,
      z: state.position.z,
    });

    // Convert euler angles to quaternion rotation
    // HYTOPIA uses Quaternion.fromEuler(pitch, yaw, roll) in degrees
    const pitchDeg = (state.pitch * 180) / Math.PI;
    const yawDeg = (state.yaw * 180) / Math.PI;
    const rollDeg = (state.roll * 180) / Math.PI;

    entity.setRotation(Quaternion.fromEuler(pitchDeg, yawDeg, rollDeg));
  }

  /**
   * Update the camera rig and apply to player camera
   */
  private updateCamera(entity: PlayerEntity): void {
    const state = this.physics.state;
    const dt = 1/60; // Approximate for camera smoothing

    this.cameraRig.update(state.position, state.velocity, dt);

    // The camera is attached to the entity, so we use offset to position it
    // behind the plane. The CameraRig calculates ideal positions.
    const camPos = this.cameraRig.position;
    const planePos = state.position;

    // Calculate offset from plane to camera position
    entity.player.camera.setOffset({
      x: camPos.x - planePos.x,
      y: camPos.y - planePos.y,
      z: camPos.z - planePos.z,
    });
  }

  /**
   * Reset per-frame input values
   */
  private resetFrameInput(): void {
    // Pitch and roll reset each frame (they're based on mouse delta)
    this.controlInput.pitch = 0;
    this.controlInput.roll = 0;
  }

  /**
   * Set Y-axis inversion for mouse control
   */
  setInvertY(invert: boolean): void {
    this.invertY = invert;
  }

  /**
   * Get current speed in m/s
   */
  getSpeed(): number {
    const v = this.physics.state.velocity;
    return Math.hypot(v.x, v.y, v.z);
  }

  /**
   * Get current altitude
   */
  getAltitude(): number {
    return this.physics.state.position.y;
  }

  /**
   * Get current throttle (0-1)
   */
  getThrottle(): number {
    return this.physics.state.throttle;
  }
}
