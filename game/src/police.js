// Wanted level and the police: patrol cars that spawn at the wanted level,
// chase and ram the player, officers on foot who make the arrest, and the
// Busted screen when they hold the player still long enough.

import { WANTED_MAX, WANTED_DECAY_IDLE, WANTED_DECAY_STEP, POLICE_PER_STAR, BUSTED_HOLD_SECONDS, STREET_COUNT, streetAt, CITY_HALF } from './config.js';
import { randomInt, randomRange } from './rng.js';
import { Car, makeCarMesh } from './vehicles.js';

const THREE = window.THREE;
const OFFICER_COUNT_PER_STAR = 1;

function makeOfficerMesh() {
  const group = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc88a5a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), navy);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
  head.position.y = 1.55;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.22, 0.1, 10), navy);
  cap.position.y = 1.68;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), navy);
  legL.position.set(-0.13, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), navy);
  legR.position.set(0.13, 0.36, 0);
  group.add(legR);
  group.userData = { legL, legR };
  return group;
}

export class Police {
  constructor(scene, city, random) {
    this.scene = scene;
    this.city = city;
    this.random = random;
    this.wanted = 0;
    this.heat = 0; // seconds since the last crime
    this.decayTimer = 0;
    this.cars = [];
    this.officers = [];
    this.bustedTimer = 0;
    this.flashPhase = 0;
    this.onBusted = null; // set by main.js
    this.onWantedChange = null;
  }

  setWanted(level) {
    const next = Math.max(0, Math.min(WANTED_MAX, level));
    if (next !== this.wanted) {
      this.wanted = next;
      this.heat = 0;
      if (this.onWantedChange) this.onWantedChange(next);
    }
  }

  addWanted(amount) {
    this.setWanted(this.wanted + amount);
    this.heat = 0;
  }

  commitCrime(amount) {
    this.addWanted(amount);
    this.heat = 0;
  }

  spawnPoliceCar(x, z) {
    const mesh = makeCarMesh(this.random, 'police');
    const car = new Car(mesh, 'police');
    car.driver = 'police';
    car.x = x;
    car.z = z;
    car.heading = (this.playerX !== undefined && this.playerZ !== undefined)
      ? Math.atan2(this.playerX - x, this.playerZ - z)
      : 0;
    car.syncMesh(0);
    car.health = 5;
    this.scene.add(mesh);
    this.cars.push(car);
    return car;
  }

  spawnOfficer(x, z) {
    const mesh = makeOfficerMesh();
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const officer = { mesh, x, z, heading: 0, holdTimer: 0, phase: Math.random() * 6, health: 3 };
    this.officers.push(officer);
    return officer;
  }

  /** Pick a spawn point on a street 60-110 m from the player. */
  spawnPoint(playerX, playerZ) {
    for (let tries = 0; tries < 12; tries++) {
      const street = randomInt(this.random, 0, STREET_COUNT - 1);
      const axis = this.random() < 0.5 ? 'x' : 'z';
      const along = randomRange(this.random, -CITY_HALF + 20, CITY_HALF - 20);
      const x = axis === 'x' ? along : streetAt(street);
      const z = axis === 'x' ? streetAt(street) : along;
      const d = Math.hypot(x - playerX, z - playerZ);
      if (d > 55 && d < 120) return { x, z };
    }
    return { x: playerX + 70, z: playerZ };
  }

  update(dt, game) {
    const player = game.player;
    this.playerX = player.x;
    this.playerZ = player.z;
    this.flashPhase += dt;
    this.heat += dt;

    // Wanted decay: hidden and quiet for a while, stars bleed off.
    if (this.wanted > 0 && this.heat > WANTED_DECAY_IDLE) {
      const nearest = this.nearestPoliceDist(player.x, player.z);
      if (nearest > 45) {
        this.decayTimer += dt;
        if (this.decayTimer > WANTED_DECAY_STEP) {
          this.decayTimer = 0;
          this.setWanted(this.wanted - 1);
        }
      } else {
        this.decayTimer = 0;
      }
    }

    // Keep the right number of police cars on the streets.
    const wantCars = this.wanted > 0 ? POLICE_PER_STAR[this.wanted] : 0;
    while (this.cars.length < wantCars) {
      const p = this.spawnPoint(player.x, player.z);
      this.spawnPoliceCar(p.x, p.z);
    }
    // Officers on foot from wanted 2 up.
    const wantOfficers = this.wanted >= 2 ? Math.min(4, this.wanted * OFFICER_COUNT_PER_STAR) : 0;
    while (this.officers.length < wantOfficers) {
      const p = this.spawnPoint(player.x, player.z);
      this.spawnOfficer(p.x, p.z);
    }

    // Chase cars.
    let nearestCarDist = Infinity;
    for (const car of this.cars) {
      if (car.dead) continue;
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      nearestCarDist = Math.min(nearestCarDist, dist);
      // Pursuit: aim slightly ahead of the player.
      const px = player.x + (player.car ? Math.sin(player.heading) * player.car.speed * 0.4 : 0);
      const pz = player.z + (player.car ? Math.cos(player.heading) * player.car.speed * 0.4 : 0);
      const desired = Math.atan2(px - car.x, pz - car.z);
      let diff = desired - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const aggression = 0.5 + this.wanted * 0.1;
      const steer = Math.max(-1, Math.min(1, diff * 2));
      car.drive(dt, { throttle: aggression, steer, brake: 0 });
      const fixed = this.city.resolveCircle({ x: car.x, z: car.z }, 1.9);
      if (Math.hypot(fixed.x - car.x, fixed.z - car.z) > 0.05) {
        car.x = fixed.x;
        car.z = fixed.z;
        car.speed *= 0.4;
        car.syncMesh(dt);
      }
      // Flash the light bar.
      const bar = car.mesh.userData.lightBar;
      if (bar) {
        const on = Math.floor(this.flashPhase * 4) % 2 === 0;
        bar.userData.red.material.color.setHex(on ? 0xff2020 : 0x601010);
        bar.userData.blue.material.color.setHex(on ? 0x101060 : 0x2040ff);
      }
      // Ram the player's car.
      if (player.car && dist < 3.4) {
        const impact = Math.abs(car.speed) + Math.abs(player.car.speed);
        if (impact > 6) {
          game.onCrash(player.car.x, player.car.z, impact);
          player.car.speed *= 0.45;
          car.speed *= 0.5;
        }
      }
    }
    // Remove police cars far away once the heat is off.
    if (this.wanted === 0) {
      for (const car of this.cars) {
        if (car.distanceTo(player.x, player.z) > 130) {
          car.dead = true;
          this.scene.remove(car.mesh);
        }
      }
      this.cars = this.cars.filter((c) => !c.dead);
      for (const officer of this.officers) {
        this.scene.remove(officer.mesh);
      }
      this.officers = [];
    }

    // Officers chase on foot and make the arrest.
    const OFFICER_SPEED = 5.2;
    let arrested = false;
    for (const officer of this.officers) {
      const dx = player.x - officer.x;
      const dz = player.z - officer.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.5) {
        officer.x += (dx / dist) * OFFICER_SPEED * dt;
        officer.z += (dz / dist) * OFFICER_SPEED * dt;
        officer.heading = Math.atan2(dx, dz);
        officer.phase += dt * OFFICER_SPEED * 2.2;
        const swing = Math.sin(officer.phase) * 0.5;
        officer.mesh.userData.legL.rotation.x = swing;
        officer.mesh.userData.legR.rotation.x = -swing;
        officer.mesh.position.y = Math.abs(Math.sin(officer.phase)) * 0.05;
      }
      officer.mesh.position.set(officer.x, 0, officer.z);
      officer.mesh.rotation.y = officer.heading;
      if (player.onFoot && dist < 1.8) {
        officer.holdTimer += dt;
        if (officer.holdTimer > 1.2) arrested = true;
      } else {
        officer.holdTimer = Math.max(0, officer.holdTimer - dt);
      }
    }

    // Busted: held still by police while on foot (officer), or boxed in while
    // driving (police car close and the player's car barely moving).
    if (arrested) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 1.2 && this.onBusted) this.onBusted('arrested');
    } else if (player.car && Math.abs(player.car.speed) < 1 && nearestCarDist < 5 && this.wanted > 0) {
      this.bustedTimer += dt;
      if (this.bustedTimer > BUSTED_HOLD_SECONDS && this.onBusted) this.onBusted('boxed');
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
  }

  nearestPoliceDist(x, z) {
    let best = Infinity;
    for (const car of this.cars) best = Math.min(best, car.distanceTo(x, z));
    for (const officer of this.officers) best = Math.min(best, Math.hypot(officer.x - x, officer.z - z));
    return best;
  }

  /** A police car took a bullet. Returns true when it is disabled. */
  damageCar(car, amount) {
    car.health -= amount;
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      car.speed = 0;
      return true;
    }
    return false;
  }

  /** An officer took a bullet. Returns true when he goes down. */
  damageOfficer(officer, amount) {
    officer.health -= amount;
    if (officer.health <= 0) {
      officer.mesh.rotation.x = -Math.PI / 2;
      officer.mesh.position.y = 0.25;
      officer.down = true;
      const idx = this.officers.indexOf(officer);
      if (idx >= 0) this.officers.splice(idx, 1);
      setTimeout(() => this.scene.remove(officer.mesh), 4000);
      return true;
    }
    return false;
  }
}
