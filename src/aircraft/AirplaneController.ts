import { clamp } from "../util/clamp";
import type { ControlInput } from "./FlightPhysics";

export class AirplaneController {
  private input: ControlInput = {
    pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, brake: false, boost: false
  };
  private invertY = true;
  private throttleRate = 0.8; // per second

  setInvertY(v: boolean) { this.invertY = v; }

  setKeyState(key: string, down: boolean) {
    const amt = down ? 1 : 0;
    switch (key) {
      case "KeyW": this.input.throttleDelta = +this.throttleRate * amt; break;
      case "KeyS": this.input.throttleDelta = -this.throttleRate * amt; break;
      case "KeyA": this.input.yaw = -amt; break;
      case "KeyD": this.input.yaw = +amt; break;
      case "Space": this.input.brake = down; break;
      case "ShiftLeft": this.input.boost = down; break;
    }
  }

  setMouseDelta(dx: number, dy: number) {
    const sens = 1.0 / 200; // tuned for pixels
    this.input.roll  = clamp(dx * sens, -1, 1);
    this.input.pitch = clamp((this.invertY ? -dy : dy) * sens, -1, 1);
  }

  get(): ControlInput { return this.input; }
}
