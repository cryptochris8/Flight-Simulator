import { Vec3, v3, add, mul } from "../engine/math";
import { damp } from "../engine/smoothing";

export class CameraRig {
  position: Vec3 = v3();
  target: Vec3 = v3();

  private dist = 12;
  private height = 3.5;
  private stiffness = 6;

  update(planePos: Vec3, planeVel: Vec3, dt: number) {
    const speed = Math.hypot(planeVel.x, planeVel.y, planeVel.z) || 1;
    const dir = v3(planeVel.x/speed, planeVel.y/speed, planeVel.z/speed);

    const idealPos = add(planePos, add(mul(dir, -this.dist), v3(0, this.height, 0)));
    const idealTarget = add(planePos, mul(dir, 4));

    this.position.x = damp(this.position.x, idealPos.x, this.stiffness, dt);
    this.position.y = damp(this.position.y, idealPos.y, this.stiffness, dt);
    this.position.z = damp(this.position.z, idealPos.z, this.stiffness, dt);

    this.target.x = damp(this.target.x, idealTarget.x, this.stiffness, dt);
    this.target.y = damp(this.target.y, idealTarget.y, this.stiffness, dt);
    this.target.z = damp(this.target.z, idealTarget.z, this.stiffness, dt);
  }
}
