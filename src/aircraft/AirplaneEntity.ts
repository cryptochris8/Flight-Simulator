import { FlightPhysics } from "./FlightPhysics";
import { AirplaneController } from "./AirplaneController";
import { CameraRig } from "./CameraRig";

// 🔧 Replace these with HYTOPIA SDK types & calls
type HytopiaVec3 = { x: number; y: number; z: number };

function setEntityTransform(entityId: string, pos: HytopiaVec3, euler: {x:number;y:number;z:number}) {
  // TODO: HYTOPIA API: set entity position & rotation
}

function setCamera(pos: HytopiaVec3, target: HytopiaVec3) {
  // TODO: HYTOPIA API: set camera position & target
}

export class AirplaneEntityAdapter {
  id: string;
  physics = new FlightPhysics();
  input = new AirplaneController();
  camera = new CameraRig();

  constructor(id: string) {
    this.id = id;
  }

  spawn(at: HytopiaVec3) {
    this.physics.state.position = { ...at };
    // TODO: HYTOPIA spawn model entity and store runtime id instead of using `id` directly
  }

  onKey(key: string, down: boolean) { this.input.setKeyState(key, down); }
  onMouse(dx: number, dy: number) { this.input.setMouseDelta(dx, dy); }

  update(dt: number) {
    this.physics.update(this.input.get(), dt);

    const s = this.physics.state;
    setEntityTransform(this.id, s.position as HytopiaVec3, { x: s.pitch, y: s.yaw, z: s.roll });

    this.camera.update(s.position, s.velocity, dt);
    setCamera(this.camera.position as HytopiaVec3, this.camera.target as HytopiaVec3);
  }

  emitFX() {
    // TODO: contrails/exhaust based on velocity & throttle using sockets on GLTF
  }
}
