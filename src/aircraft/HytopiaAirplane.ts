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

import { createFlightPhysicsAdapter, IFlightPhysicsAdapter, UnifiedControlInput } from './FlightPhysicsAdapter';
import { FLIGHT_MODE } from './FlightConfig';
import { clamp } from '../util/clamp';

export interface AirplaneOptions {
  modelUri?: string;
  modelScale?: number;
  spawnPosition?: Vector3Like;
  spawnYawDegrees?: number;  // Initial facing direction
  groundLevel?: number;       // Ground elevation for taxi mode
  startInAir?: boolean;       // If false, start grounded in hangar
}

const DEFAULT_OPTIONS: Required<AirplaneOptions> = {
  modelUri: 'models/low-poly/scene.gltf',
  modelScale: 0.3,  // Smaller scale for better visibility
  spawnPosition: { x: 0, y: 100, z: 0 },
  spawnYawDegrees: 0,
  groundLevel: 180,
  startInAir: false,  // Start grounded by default
};

/**
 * Creates and manages a player-controlled airplane in HYTOPIA.
 * Uses a separate Entity for the plane and attaches the player's camera to it.
 *
 * IMPORTANT: Position comes from entity.position (physics engine handles it).
 * We only set velocity on the entity, and the physics engine moves it.
 *
 * Physics mode is controlled by FLIGHT_MODE in FlightConfig.ts:
 * - "arcade"   : Simple, responsive controls. Always airborne.
 * - "hybrid"   : Semi-realistic lift/drag but simplified controls.
 * - "realistic": Full taxi + takeoff physics.
 */
export class HytopiaAirplane {
  private entity: Entity | null = null;
  private player: Player | null = null;
  private world: World | null = null;
  private physics: IFlightPhysicsAdapter;
  private options: Required<AirplaneOptions>;
  private controlInput: UnifiedControlInput;

  // Input state
  private lastPitch = 0;
  private lastYaw = 0;
  private tickCount = 0;

  constructor(options?: AirplaneOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.physics = createFlightPhysicsAdapter();
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

    // Set ground level for realistic mode (other modes ignore this)
    if (this.physics.setGroundLevel) {
      this.physics.setGroundLevel(this.options.groundLevel);
    }

    // Convert spawn yaw from degrees to radians
    const yawRad = (this.options.spawnYawDegrees * Math.PI) / 180;

    // Initialize physics state based on mode
    const state = this.physics.state;
    state.yaw = yawRad;

    // For arcade/hybrid modes, set initial position if they track it
    if (this.physics.tracksPosition && state.position) {
      state.position.x = spawnPos.x;
      state.position.y = spawnPos.y;
      state.position.z = spawnPos.z;
    }

    if (this.options.startInAir || FLIGHT_MODE !== "realistic") {
      // Start airborne with forward velocity (in the direction we're facing)
      // Forward: yaw=0 → +Z, yaw=90° → +X
      const fwdX = Math.sin(yawRad);
      const fwdZ = Math.cos(yawRad);
      state.velocity = { x: fwdX * 40, y: 0, z: fwdZ * 40 };
      state.isGrounded = false;
    } else {
      // Start grounded with zero velocity (in hangar) - realistic mode only
      state.velocity = { x: 0, y: 0, z: 0 };
      state.isGrounded = true;
      state.throttle = 0;
    }

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

    // Spawn the airplane entity at the spawn position
    this.entity.spawn(world, spawnPos);

    // Setup camera to follow the airplane
    this.setupCamera(player);

    // Setup tick handler for physics updates
    this.entity.on(EntityEvent.TICK, ({ entity, tickDeltaMs }) => {
      this.update(tickDeltaMs);
    });

    console.log(`[Airplane] Spawned at (${spawnPos.x}, ${spawnPos.y}, ${spawnPos.z}), yaw: ${this.options.spawnYawDegrees}deg`);

    return this.entity;
  }

  /**
   * Configure the player's camera for flight
   */
  private setupCamera(player: Player): void {
    if (!this.entity) return;

    // Third-person mode for flight
    player.camera.setMode(PlayerCameraMode.THIRD_PERSON);

    // Track the airplane entity
    player.camera.setTrackedEntity(this.entity);

    // Wider FOV for better peripheral vision while flying
    player.camera.setFov(85);

    // Zoom out more for better visibility
    player.camera.setZoom(4);

    // Camera offset - behind and above the plane
    player.camera.setOffset({ x: 0, y: 8, z: -25 });

    console.log('Camera setup complete for airplane');
  }

  /**
   * Update camera position to follow behind airplane
   * Uses smooth camera tracking based on velocity direction
   */
  private updateCamera(): void {
    if (!this.entity || !this.player) return;

    // The camera tracks the entity automatically via setTrackedEntity
    // We can dynamically adjust offset based on speed for cinematic effect
    const vel = this.physics.state.velocity;
    const speed = Math.hypot(vel.x, vel.y, vel.z);

    // Pull camera back more at higher speeds
    const dynamicZoom = 4 + Math.min(speed / 40, 3);
    this.player.camera.setZoom(dynamicZoom);
  }

  /**
   * Main update loop - called every tick
   */
  private update(deltaTimeMs: number): void {
    if (!this.entity || !this.player) return;

    const dt = deltaTimeMs / 1000;

    // Get actual position from entity (physics engine handles position via velocity)
    const entityPos = this.entity.position;

    // Read player input
    this.processInput();

    // Update physics - pass entity Y for ground detection
    this.physics.update(this.controlInput, dt, entityPos.y);

    // Apply velocity to entity (position is handled by physics engine)
    this.applyPhysicsToEntity();

    // Update camera position
    this.updateCamera();

    // Debug logging every 100 ticks
    this.tickCount++;
    if (this.tickCount % 100 === 0) {
      const vel = this.physics.state.velocity;
      const speed = Math.hypot(vel.x, vel.y, vel.z);
      const mode = this.physics.state.isGrounded ? 'TAXI' : 'FLIGHT';
      console.log(`[Airplane] Pos: (${entityPos.x.toFixed(1)}, ${entityPos.y.toFixed(1)}, ${entityPos.z.toFixed(1)}) | Speed: ${speed.toFixed(1)} | Throttle: ${(this.physics.state.throttle * 100).toFixed(0)}% | Mode: ${mode}`);
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
    // Get altitude from entity position (physics engine handles position)
    const altitude = this.entity ? this.entity.position.y : 0;
    return {
      speed: Math.hypot(v.x, v.y, v.z),
      altitude: altitude,
      throttle: this.physics.state.throttle,
    };
  }

  /**
   * Get the flight physics state with position from entity
   */
  get flightState() {
    // Return physics state augmented with position from entity
    const pos = this.entity ? this.entity.position : { x: 0, y: 0, z: 0 };
    return {
      ...this.physics.state,
      position: pos,
    };
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
