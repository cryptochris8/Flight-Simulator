import {
  Entity,
  Player,
  World,
  RigidBodyType,
  ColliderShape,
  Quaternion,
  Vector3Like,
  PlayerCameraMode,
  EntityEvent,
} from 'hytopia';

import { FlightPhysics, ControlInput } from './FlightPhysics';
import { clamp } from '../util/clamp';

export interface AirplaneOptions {
  modelUri?: string;
  modelScale?: number;
  spawnPosition?: Vector3Like;
}

const DEFAULT_OPTIONS: Required<AirplaneOptions> = {
  modelUri: 'models/low-poly/scene.gltf',
  modelScale: 0.3,  // Smaller scale for better visibility
  spawnPosition: { x: 0, y: 100, z: 0 },
};

/**
 * Creates and manages a player-controlled airplane in HYTOPIA.
 * Uses a separate Entity for the plane and attaches the player's camera to it.
 */
export class HytopiaAirplane {
  private entity: Entity | null = null;
  private player: Player | null = null;
  private world: World | null = null;
  private physics: FlightPhysics;
  private options: Required<AirplaneOptions>;
  private controlInput: ControlInput;

  // Input state
  private lastPitch = 0;
  private lastYaw = 0;
  private tickCount = 0;

  constructor(options?: AirplaneOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.physics = new FlightPhysics();
    this.controlInput = {
      pitch: 0,
      roll: 0,
      yaw: 0,
      throttleDelta: 0,
      brake: false,
      boost: false,
    };
  }

  /**
   * Spawn the airplane for a player in the world
   */
  spawn(world: World, player: Player, position?: Vector3Like): Entity {
    this.world = world;
    this.player = player;
    const spawnPos = position || this.options.spawnPosition;

    // Initialize physics at spawn position
    this.physics.state.position = { ...spawnPos };
    this.physics.state.velocity = { x: 0, y: 0, z: 30 }; // Start with forward velocity

    // Create the airplane entity (separate from player)
    this.entity = new Entity({
      name: 'Airplane',
      modelUri: this.options.modelUri,
      modelScale: this.options.modelScale,
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_VELOCITY,
        colliders: [
          {
            shape: ColliderShape.BLOCK,
            halfExtents: { x: 1.5, y: 0.5, z: 2 },
          },
        ],
      },
    });

    // Spawn the airplane entity
    this.entity.spawn(world, spawnPos);

    // Setup camera to follow the airplane
    this.setupCamera(player);

    // Setup tick handler for physics updates
    this.entity.on(EntityEvent.TICK, ({ entity, tickDeltaMs }) => {
      this.update(tickDeltaMs);
    });

    return this.entity;
  }

  /**
   * Configure the player's camera for flight
   */
  private setupCamera(player: Player): void {
    if (!this.entity) return;

    // Third-person mode
    player.camera.setMode(PlayerCameraMode.THIRD_PERSON);

    // Track the airplane so camera always looks at it
    player.camera.setTrackedEntity(this.entity);

    // Standard FOV
    player.camera.setFov(75);

    // Default zoom
    player.camera.setZoom(2);

    console.log('Camera setup complete for airplane');
  }

  /**
   * Update camera position to follow behind airplane
   */
  private updateCamera(): void {
    if (!this.entity || !this.player) return;

    const pos = this.physics.state.position;

    // Position camera behind and above the plane using setAttachedToPosition
    // This sets the camera at a fixed world position each tick
    this.player.camera.setAttachedToPosition({
      x: pos.x,
      y: pos.y + 20,   // Above the plane
      z: pos.z + 50    // Behind the plane
    });
  }

  /**
   * Main update loop - called every tick
   */
  private update(deltaTimeMs: number): void {
    if (!this.entity || !this.player) return;

    const dt = deltaTimeMs / 1000;

    // Read player input
    this.processInput();

    // Update physics
    this.physics.update(this.controlInput, dt);

    // Apply to entity
    this.applyPhysicsToEntity();

    // Update camera position
    this.updateCamera();

    // Debug logging every 100 ticks
    this.tickCount++;
    if (this.tickCount % 100 === 0) {
      const pos = this.physics.state.position;
      const vel = this.physics.state.velocity;
      const speed = Math.hypot(vel.x, vel.y, vel.z);
      console.log(`[Airplane] Pos: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}) | Speed: ${speed.toFixed(1)} | Throttle: ${(this.physics.state.throttle * 100).toFixed(0)}%`);
    }

    // Reset frame input
    this.controlInput.pitch = 0;
    this.controlInput.roll = 0;
  }

  /**
   * Process player input
   */
  private processInput(): void {
    if (!this.player) return;

    const input = this.player.input;
    const camOrientation = this.player.camera.orientation;

    // W/S - Throttle
    if (input.w) {
      this.controlInput.throttleDelta = 0.8;
    } else if (input.s) {
      this.controlInput.throttleDelta = -0.8;
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

    // Space - Brake
    this.controlInput.brake = !!input.sp;

    // Shift - Boost
    this.controlInput.boost = !!input.sh;

    // Mouse - Pitch/Roll (from camera orientation delta)
    const pitchDelta = camOrientation.pitch - this.lastPitch;
    const yawDelta = camOrientation.yaw - this.lastYaw;

    this.controlInput.pitch = clamp(-pitchDelta * 0.5, -1, 1);
    this.controlInput.roll = clamp(yawDelta * 0.5, -1, 1);

    this.lastPitch = camOrientation.pitch;
    this.lastYaw = camOrientation.yaw;
  }

  /**
   * Apply physics state to entity
   */
  private applyPhysicsToEntity(): void {
    if (!this.entity) return;

    const state = this.physics.state;

    // Set position using linear velocity (for KINEMATIC_VELOCITY)
    const vel = state.velocity;
    this.entity.setLinearVelocity({
      x: vel.x,
      y: vel.y,
      z: vel.z,
    });

    // Set rotation
    const pitchDeg = (state.pitch * 180) / Math.PI;
    const yawDeg = (state.yaw * 180) / Math.PI;
    const rollDeg = (state.roll * 180) / Math.PI;

    this.entity.setRotation(Quaternion.fromEuler(pitchDeg, yawDeg, rollDeg));
  }

  /**
   * Get flight data for UI
   */
  getFlightData(): { speed: number; altitude: number; throttle: number } {
    const v = this.physics.state.velocity;
    return {
      speed: Math.hypot(v.x, v.y, v.z),
      altitude: this.physics.state.position.y,
      throttle: this.physics.state.throttle,
    };
  }

  /**
   * Get the flight physics state
   */
  get flightState() {
    return this.physics.state;
  }

  /**
   * Get the underlying entity
   */
  getEntity(): Entity | null {
    return this.entity;
  }

  /**
   * Despawn the airplane
   */
  despawn(): void {
    if (this.entity?.isSpawned) {
      this.entity.despawn();
    }
    this.entity = null;
    this.player = null;
    this.world = null;
  }
}
