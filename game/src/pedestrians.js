// Pedestrians: low-poly people strolling the sidewalks, turning at corners,
// fleeing when trouble starts nearby, and going down when hit by a car.

import { STREET_COUNT, streetAt, STREET, CITY_HALF, nearestStreetIndex } from './config.js';
import { randomInt, randomPick, randomRange } from './rng.js';

const THREE = window.THREE;
const PED_COUNT = 24;
const WALK_SPEED = 1.4;
const FLEE_SPEED = 5.5;
const SIDEWALK = STREET / 2 + 2.2; // sidewalk centre offset from a street line

const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xe8d84a, 0xd84ad8, 0x4ad8d8, 0xe8e8e8, 0x8a5a3a];

/** Build a simple low-poly person. */
export function makePedMesh(random) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: randomPick(random, SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: randomPick(random, [0xe8b88a, 0xc88a5a, 0x8a5a3a, 0xf0c8a0]) });
  const pants = new THREE.MeshLambertMaterial({ color: randomPick(random, [0x2a3a5a, 0x3a3a3a, 0x5a4a3a]) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.28), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), pants);
  legL.position.set(-0.13, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), pants);
  legR.position.set(0.13, 0.36, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.15), shirt);
  armL.position.set(-0.33, 1.05, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.15), shirt);
  armR.position.set(0.33, 1.05, 0);
  group.add(armR);
  group.userData = { legL, legR, armL, armR };
  return group;
}

export class Pedestrians {
  constructor(scene, city, random) {
    this.scene = scene;
    this.city = city;
    this.random = random;
    this.peds = [];
  }

  spawn() {
    for (let i = 0; i < PED_COUNT; i++) {
      const ped = this.makePed();
      this.peds.push(ped);
      this.scene.add(ped.mesh);
    }
  }

  makePed(x, z) {
    const random = this.random;
    const mesh = makePedMesh(random);
    const axis = random() < 0.5 ? 'x' : 'z';
    const street = randomInt(random, 0, STREET_COUNT - 1);
    const dir = random() < 0.5 ? 1 : -1;
    const along = x !== undefined ? x : randomRange(random, -CITY_HALF + 20, CITY_HALF - 20);
    const zz = z !== undefined ? z : 0;
    const ped = {
      mesh,
      state: 'walk', // walk | flee | down
      speed: randomRange(random, WALK_SPEED * 0.7, WALK_SPEED * 1.3),
      phase: random() * Math.PI * 2,
      downTimer: 0,
      fleeX: 0,
      fleeZ: 0,
      axis,
      street,
      dir,
      x: 0,
      z: 0,
    };
    if (axis === 'x') {
      ped.x = along;
      ped.z = streetAt(street) + (dir > 0 ? SIDEWALK : -SIDEWALK);
    } else {
      ped.x = streetAt(street) + (dir > 0 ? -SIDEWALK : SIDEWALK);
      ped.z = along;
    }
    if (x !== undefined) {
      ped.x = x;
      ped.z = zz;
    }
    ped.mesh.position.set(ped.x, 0, ped.z);
    return ped;
  }

  /** Make every ped within radius run away from (x, z). */
  scare(x, z, radius) {
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius) {
        ped.state = 'flee';
        const away = Math.atan2(ped.x - x, ped.z - z);
        ped.fleeX = ped.x + Math.sin(away) * 60;
        ped.fleeZ = ped.z + Math.cos(away) * 60;
      }
    }
  }

  /** Knock a ped down (hit by a car or shot). Returns the ped or null. */
  knockDown(x, z, radius) {
    let best = null;
    let bestD = radius;
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    if (best) {
      best.state = 'down';
      best.downTimer = 8;
      best.mesh.rotation.x = -Math.PI / 2;
      best.mesh.position.y = 0.25;
    }
    return best;
  }

  update(dt) {
    for (const ped of this.peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          // Get up far away and walk on.
          const fresh = this.makePed();
          ped.mesh.position.copy(fresh.mesh.position);
          ped.x = fresh.x;
          ped.z = fresh.z;
          ped.axis = fresh.axis;
          ped.street = fresh.street;
          ped.dir = fresh.dir;
          ped.state = 'walk';
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
        }
        continue;
      }
      let speed = ped.speed;
      let tx;
      let tz;
      if (ped.state === 'flee') {
        speed = FLEE_SPEED;
        tx = ped.fleeX;
        tz = ped.fleeZ;
        if (Math.hypot(tx - ped.x, tz - ped.z) < 4) ped.state = 'walk';
      } else {
        // Walk along the sidewalk; turn at the next intersection sometimes.
        const along = ped.axis === 'x' ? ped.x : ped.z;
        const idx = nearestStreetIndex(along);
        const target = streetAt(idx);
        const ahead = ped.dir > 0 ? target > along + 2 : target < along - 2;
        if (!ahead) {
          // At an intersection: maybe turn onto the crossing street.
          if (this.random() < 0.45) {
            const newAxis = ped.axis === 'x' ? 'z' : 'x';
            const newStreet = idx;
            const newDir = this.random() < 0.5 ? 1 : -1;
            ped.axis = newAxis;
            ped.street = newStreet;
            ped.dir = newDir;
          }
        }
        if (ped.axis === 'x') {
          tx = ped.x + ped.dir * 10;
          tz = streetAt(ped.street) + (ped.dir > 0 ? SIDEWALK : -SIDEWALK);
        } else {
          tx = streetAt(ped.street) + (ped.dir > 0 ? -SIDEWALK : SIDEWALK);
          tz = ped.z + ped.dir * 10;
        }
      }
      const dx = tx - ped.x;
      const dz = tz - ped.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.01) {
        const vx = (dx / dist) * speed;
        const vz = (dz / dist) * speed;
        ped.x += vx * dt;
        ped.z += vz * dt;
        const fixed = this.city.resolveCircle({ x: ped.x, z: ped.z }, 0.4);
        ped.x = fixed.x;
        ped.z = fixed.z;
        ped.mesh.rotation.y = Math.atan2(vx, vz);
        ped.phase += dt * speed * 2.2;
        const swing = Math.sin(ped.phase) * 0.55;
        ped.mesh.userData.legL.rotation.x = swing;
        ped.mesh.userData.legR.rotation.x = -swing;
        ped.mesh.userData.armL.rotation.x = -swing * 0.7;
        ped.mesh.userData.armR.rotation.x = swing * 0.7;
        ped.mesh.position.y = Math.abs(Math.sin(ped.phase)) * 0.06;
      }
      ped.mesh.position.x = ped.x;
      ped.mesh.position.z = ped.z;
    }
  }
}
