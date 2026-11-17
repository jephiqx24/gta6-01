// Cars: the mesh builder and the Car entity. One class drives both the
// player's car (arcade physics) and the traffic (steered by traffic.js).
// Forward is (sin(heading), 0, cos(heading)); heading 0 faces +z.

import { CAR, PALETTE } from './config.js';
import { randomPick } from './rng.js';

const THREE = window.THREE;

/** Build a low-poly car mesh. kind: 'civilian' | 'police' | 'taxi'. */
export function makeCarMesh(random, kind = 'civilian') {
  const group = new THREE.Group();
  const color = kind === 'police' ? PALETTE.police
    : kind === 'taxi' ? PALETTE.taxi
    : randomPick(random, PALETTE.car);
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.3), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 2.2), darkMat);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14141a });
  const wheels = [];
  for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd81a1a });
  for (const x of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    head.position.set(x, 0.62, 2.16);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
    tail.position.set(x, 0.62, -2.16);
    group.add(tail);
  }
  let lightBar = null;
  if (kind === 'police') {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.7), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.x = -0.45;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.7), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.x = 0.45;
    lightBar.add(red);
    lightBar.add(blue);
    lightBar.position.set(0, 1.5, -0.25);
    lightBar.userData = { red, blue };
    group.add(lightBar);
    // White doors stripe.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.3, 2.4), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
    stripe.position.set(0, 0.62, -0.2);
    group.add(stripe);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    sign.position.set(0, 1.5, -0.25);
    group.add(sign);
  }
  group.userData = { wheels, lightBar, bodyMat };
  return group;
}

/** A car in the world. */
export class Car {
  constructor(mesh, kind = 'civilian') {
    this.mesh = mesh;
    this.kind = kind;
    this.heading = 0;
    this.speed = 0;
    this.steer = 0;
    this.x = 0;
    this.z = 0;
    this.crashed = false; // set by the caller when a hard impact happened
    this.driver = null; // 'player' | 'traffic' | 'police' | 'parked'
    this.parked = false;
    this.dead = false; // removed from the world
    this.wheelSpin = 0;
  }

  get forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  /** Arcade drive step. control: { throttle -1..1, steer -1..1, brake 0..1 }. */
  drive(dt, control) {
    const throttle = control.throttle ?? 0;
    const steer = control.steer ?? 0;
    const brake = control.brake ?? 0;
    const speedFactor = 1 - Math.min(Math.abs(this.speed) / CAR.maxSpeed, 1) * 0.65;
    const steerTarget = steer * CAR.steerMax * speedFactor;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    if (throttle > 0) this.speed += throttle * CAR.accel * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= CAR.brake * dt; // braking
      else this.speed += throttle * CAR.reverseAccel * dt; // reversing
    }
    if (brake > 0 && this.speed > 0) this.speed -= CAR.brake * brake * dt;
    if (brake > 0 && this.speed < 0) this.speed += CAR.brake * brake * dt;
    // Drag + rolling resistance.
    this.speed -= this.speed * 0.35 * dt;
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    this.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, this.speed));
    // Steering only bites while moving; turning circles tighten at low speed.
    const turnRate = this.steer * (this.speed / 2.6);
    this.heading += turnRate * dt * (this.speed >= 0 ? 1 : -1);
    const f = this.forward;
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
    this.syncMesh(dt);
  }

  /** Push the mesh to the car's state (called after any position change). */
  syncMesh(dt) {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.wheelSpin += (this.speed * dt) / 0.36;
    for (const wheel of this.mesh.userData.wheels) wheel.rotation.x = this.wheelSpin;
    // Body lean into corners and pitch under acceleration.
    this.mesh.rotation.z = -this.steer * 0.05 * Math.min(Math.abs(this.speed) / 10, 1);
  }

  /** Distance to a point. */
  distanceTo(x, z) {
    return Math.hypot(this.x - x, this.z - z);
  }
}
