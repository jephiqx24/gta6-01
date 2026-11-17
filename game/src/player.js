// Rio, on foot: WASD relative to the camera, Shift to run, E to enter and
// exit cars. Entering a car that is not the one you just left counts as a steal.
import { THREE } from './three.js';
import { PLAYER } from './config.js';

function makeRioMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x8a1f1f, roughness: 0.85 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.8 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), jeans);
  legL.position.set(-0.15, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.15;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.78, 0.36), jacket);
  body.position.y = 1.18;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 }));
  hair.position.y = 1.82;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.15), jacket);
  armL.position.set(-0.42, 1.18, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(legL, legR, body, head, hair, armL, armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export function createPlayer(scene, city) {
  const mesh = makeRioMesh();
  const spawn = city.places.spawn;
  mesh.position.set(spawn.x, 0, spawn.z);
  scene.add(mesh);
  const player = {
    mesh,
    pos: mesh.position,
    heading: spawn.heading,
    speed: 0,
    health: PLAYER.health,
    inCar: false,
    car: null,
    lastCar: null,
    legPhase: 0,
    hasPistol: true,
  };
  return player;
}

function collideBuildings(pos, radius, city) {
  for (const b of city.colliders) {
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      const d = Math.sqrt(d2) || 0.001;
      const push = (radius - d) / d;
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }
  pos.x = Math.max(-218, Math.min(208, pos.x));
  pos.z = Math.max(-218, Math.min(218, pos.z));
}

// Returns events: {type:'steal', car} when the player takes a new car.
export function updatePlayer(player, dt, input, camYaw, city, stealable) {
  const events = [];
  if (player.inCar) {
    const car = player.car;
    // Drive with WASD: W/S throttle, A/D steer.
    car.input.throttle = (input.keys['KeyW'] || input.keys['ArrowUp'] ? 1 : 0) + (input.keys['KeyS'] || input.keys['ArrowDown'] ? -1 : 0);
    car.input.steer = (input.keys['KeyA'] || input.keys['ArrowLeft'] ? -1 : 0) + (input.keys['KeyD'] || input.keys['ArrowRight'] ? 1 : 0);
    if (input.pressed('KeyE')) {
      // Exit to the driver's side.
      const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
      player.pos.set(car.pos.x + side.x * 2.2, 0, car.pos.z + side.z * 2.2);
      player.heading = car.heading;
      player.lastCar = car;
      player.car = null;
      player.inCar = false;
      car.input.throttle = 0;
      car.input.steer = 0;
      player.mesh.visible = true;
      player.mesh.position.copy(player.pos);
    }
    return events;
  }
  // On foot.
  let mx = 0;
  let mz = 0;
  if (input.keys['KeyW'] || input.keys['ArrowUp']) mz -= 1;
  if (input.keys['KeyS'] || input.keys['ArrowDown']) mz += 1;
  if (input.keys['KeyA'] || input.keys['ArrowLeft']) mx -= 1;
  if (input.keys['KeyD'] || input.keys['ArrowRight']) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  const run = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    const wx = mx * cos - mz * sin;
    const wz = mx * sin + mz * cos;
    player.pos.x += wx * speed * dt;
    player.pos.z += wz * speed * dt;
    player.heading = Math.atan2(wx, wz);
    player.speed = speed;
    player.legPhase += dt * (run ? 11 : 8);
  } else {
    player.speed = 0;
  }
  collideBuildings(player.pos, PLAYER.radius, city);
  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = player.heading;
  const swing = moving ? Math.sin(player.legPhase) * 0.6 : 0;
  player.mesh.userData.legL.rotation.x = swing;
  player.mesh.userData.legR.rotation.x = -swing;
  player.mesh.userData.armL.rotation.x = -swing * 0.7;
  player.mesh.userData.armR.rotation.x = swing * 0.7;
  // Enter a nearby car.
  if (input.pressed('KeyE') && stealable) {
    let best = null;
    let bestD = 3.4;
    for (const car of stealable) {
      const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (best) {
      player.inCar = true;
      player.car = best;
      player.mesh.visible = false;
      best.speed = 0;
      if (best !== player.lastCar) events.push({ type: 'steal', car: best });
    }
  }
  return events;
}

export function respawnPlayer(player, city) {
  const s = city.places.spawn;
  player.pos.set(s.x, 0, s.z);
  player.heading = s.heading;
  player.health = PLAYER.health;
  player.inCar = false;
  player.car = null;
  player.mesh.visible = true;
  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = player.heading;
}
