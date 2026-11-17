// The player: a low-poly driver on foot (WASD + run, mouse-orbit camera)
// who can steal any car with E and drive it. Health, the pistol, and the
// enter/exit dance live here; the camera itself lives in main.js.

import { PLAYER, CAR } from './config.js';
import { makePedMesh } from './pedestrians.js';

const THREE = window.THREE;

export class Player {
  constructor(scene, city, random) {
    this.scene = scene;
    this.city = city;
    this.random = random;
    this.mesh = makePedMesh(random);
    // The player's own colours: sunset-orange jacket, dark jeans.
    this.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xe07a30 });
    this.mesh.children[2].material = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
    this.mesh.children[3].material = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
    this.scene.add(this.mesh);
    this.x = 0;
    this.z = 0;
    this.heading = 0; // facing, same convention as cars
    this.speed = 0;
    this.health = PLAYER.health;
    this.hasPistol = true;
    this.onFoot = true;
    this.car = null;
    this.phase = 0;
    this.lastDamageAt = -99;
    this.invulnerableUntil = 0;
  }

  get forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  place(x, z, heading = 0) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  /** On-foot step. move {x: strafe, y: forward} relative to camera yaw. */
  walk(dt, move, run, cameraYaw) {
    const targetSpeed = (run ? PLAYER.runSpeed : PLAYER.walkSpeed) * Math.min(1, Math.hypot(move.x, move.y));
    const fx = Math.sin(cameraYaw);
    const fz = Math.cos(cameraYaw);
    const rx = Math.cos(cameraYaw);
    const rz = -Math.sin(cameraYaw);
    let mx = fx * move.y + rx * move.x;
    let mz = fz * move.y + rz * move.x;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const desired = Math.atan2(mx, mz);
      let diff = desired - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += Math.max(-dt * 10, Math.min(dt * 10, diff));
      this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 10);
    } else {
      this.speed += (0 - this.speed) * Math.min(1, dt * 10);
    }
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    const fixed = this.city.resolveCircle({ x: this.x, z: this.z }, PLAYER.radius);
    this.x = fixed.x;
    this.z = fixed.z;
    this.phase += dt * this.speed * 2.4;
    const swing = Math.sin(this.phase) * 0.5 * Math.min(1, this.speed / 4);
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
    this.mesh.userData.armL.rotation.x = -swing * 0.7;
    this.mesh.userData.armR.rotation.x = swing * 0.7;
    this.mesh.position.y = Math.abs(Math.sin(this.phase)) * 0.05 * Math.min(1, this.speed / 4);
    this.syncMesh();
  }

  /** Get into a car (stealing it if it is not the player's already). */
  enterCar(car) {
    this.car = car;
    this.onFoot = false;
    car.driver = 'player';
    car.parked = false;
    this.mesh.visible = false;
    this.x = car.x;
    this.z = car.z;
    this.heading = car.heading;
  }

  /** Get out beside the car, on the driver's side. */
  exitCar() {
    if (!this.car) return null;
    const car = this.car;
    this.car = null;
    this.onFoot = true;
    car.driver = 'parked';
    car.parked = true;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.x = car.x + side.x * 2.2;
    this.z = car.z + side.z * 2.2;
    const fixed = this.city.resolveCircle({ x: this.x, z: this.z }, PLAYER.radius);
    this.x = fixed.x;
    this.z = fixed.z;
    this.heading = car.heading;
    this.mesh.visible = true;
    this.syncMesh();
    return car;
  }

  /** Drive the current car with arcade controls. */
  driveCar(dt, move) {
    if (!this.car) return;
    const throttle = move.y;
    const steer = -move.x; // steering left is positive turn
    this.car.drive(dt, { throttle, steer, brake: 0 });
    this.x = this.car.x;
    this.z = this.car.z;
    this.heading = this.car.heading;
  }

  damage(amount, now) {
    if (now < this.invulnerableUntil) return false;
    this.health -= amount;
    this.lastDamageAt = now;
    if (this.health < 0) this.health = 0;
    return true;
  }

  heal(dt, now) {
    if (this.health > 0 && this.health < PLAYER.health && now - this.lastDamageAt > 8) {
      this.health = Math.min(PLAYER.health, this.health + 5 * dt);
    }
  }

  get dead() {
    return this.health <= 0;
  }

  /** Camera target: head height on foot, roof height in a car. */
  cameraTarget() {
    return { x: this.x, y: this.onFoot ? 1.7 : 1.6, z: this.z };
  }
}
