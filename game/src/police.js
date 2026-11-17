// Wanted stars and the police response. Police cars chase and ram; foot
// officers chase and, close for two seconds, arrest: BUSTED. Wanted decays
// when the player is out of sight and quiet.
import { THREE } from './three.js';
import { WANTED, PALETTE } from './config.js';
import { createCar, stepCar, collideCars } from './vehicles.js';

function makeOfficerMesh() {
  const g = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.8 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), navy);
  legL.position.set(-0.15, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.15;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.78, 0.36), navy);
  body.position.y = 1.18;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
  head.position.y = 1.78;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0x0a1428, roughness: 0.7 }));
  cap.position.y = 1.98;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.15), navy);
  armL.position.set(-0.42, 1.18, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(legL, legR, body, head, cap, armL, armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createPolice(scene, city, rng) {
  const policeCars = [];
  const officers = [];
  let wanted = 0;
  let lastCrimeAt = -1e9;
  let quietT = 0;
  let time = 0;

  function spawnPoliceCar(x, z) {
    const car = createCar('police', PALETTE.police, x, z, 0, { police: true });
    car.maxSpeed = 37;
    scene.add(car.mesh);
    policeCars.push(car);
    return car;
  }

  function spawnOfficer(x, z) {
    const mesh = makeOfficerMesh();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const off = { mesh, pos: mesh.position, heading: 0, arrestT: 0, legPhase: rng.range(0, 6) };
    officers.push(off);
    return off;
  }

  function removeAll() {
    for (const c of policeCars) scene.remove(c.mesh);
    for (const o of officers) scene.remove(o.mesh);
    policeCars.length = 0;
    officers.length = 0;
  }

  function addWanted(n) {
    if (n <= 0) return;
    wanted = Math.min(WANTED.max, wanted + n);
    lastCrimeAt = time;
    quietT = 0;
  }

  function clearWanted() {
    wanted = 0;
    removeAll();
  }

  // Returns events: {type:'busted'} when an officer arrests the player.
  function update(dt, player, allCars) {
    time += dt;
    const events = [];
    const wantCars = Math.min(wanted, 3);
    const wantOfficers = wanted >= 2 ? Math.min(wanted - 1, 3) : 0;
    const px = player.inCar ? player.car.pos.x : player.pos.x;
    const pz = player.inCar ? player.car.pos.z : player.pos.z;
    while (policeCars.length < wantCars) {
      const a = rng.range(0, Math.PI * 2);
      spawnPoliceCar(px + Math.sin(a) * 55, pz + Math.cos(a) * 55);
    }
    while (officers.length < wantOfficers) {
      const a = rng.range(0, Math.PI * 2);
      spawnOfficer(px + Math.sin(a) * 22, pz + Math.cos(a) * 22);
    }
    while (policeCars.length > wantCars) {
      const c = policeCars.pop();
      scene.remove(c.mesh);
    }
    while (officers.length > wantOfficers) {
      const o = officers.pop();
      scene.remove(o.mesh);
    }
    // Police cars chase the player's car (or the player on foot).
    for (const car of policeCars) {
      const desired = Math.atan2(px - car.pos.x, pz - car.pos.z);
      const err = wrapAngle(desired - car.heading);
      const dist = Math.hypot(px - car.pos.x, pz - car.pos.z);
      car.input.steer = Math.max(-1, Math.min(1, err * 1.8));
      car.input.throttle = dist > 6 ? 1 : 0.6;
      stepCar(car, dt, city);
      if (player.inCar) collideCars(car, player.car);
    }
    // Officers chase on foot; close for two seconds means an arrest.
    for (const off of officers) {
      const dx = player.pos.x - off.pos.x;
      const dz = player.pos.z - off.pos.z;
      const dist = Math.hypot(dx, dz);
      if (player.inCar) {
        // Officers wait by the roadside when the player is driving.
        off.arrestT = 0;
        continue;
      }
      off.heading = Math.atan2(dx, dz);
      const speed = dist > 2 ? 6.4 : 0;
      off.pos.x += Math.sin(off.heading) * speed * dt;
      off.pos.z += Math.cos(off.heading) * speed * dt;
      off.legPhase += dt * 10;
      off.mesh.position.copy(off.pos);
      off.mesh.rotation.y = off.heading;
      const swing = Math.sin(off.legPhase) * 0.6;
      off.mesh.userData.legL.rotation.x = swing;
      off.mesh.userData.legR.rotation.x = -swing;
      if (dist < 2.4) {
        off.arrestT += dt;
        if (off.arrestT > 2) {
          events.push({ type: 'busted' });
          return events;
        }
      } else {
        off.arrestT = 0;
      }
    }
    // Wanted decays after a quiet stretch with no police nearby.
    const nearestPolice = Math.min(
      ...policeCars.map((c) => Math.hypot(c.pos.x - px, c.pos.z - pz)),
      ...officers.map((o) => Math.hypot(o.pos.x - px, o.pos.z - pz)),
      1e9
    );
    if (wanted > 0 && time - lastCrimeAt > 6 && nearestPolice > 55) {
      quietT += dt;
      if (quietT > WANTED.decaySeconds) {
        wanted -= 1;
        quietT = 0;
      }
    } else {
      quietT = 0;
    }
    return events;
  }

  return {
    policeCars,
    officers,
    get wanted() {
      return wanted;
    },
    set wanted(v) {
      wanted = Math.max(0, Math.min(WANTED.max, v));
      lastCrimeAt = time;
    },
    addWanted,
    clearWanted,
    removeAll,
    update,
  };
}
