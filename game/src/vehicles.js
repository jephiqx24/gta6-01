// Cars: procedural box-built meshes plus arcade driving physics. A car is a
// circle for collision (radius ~1.6) so building and car hits stay robust.
import { THREE } from './three.js';
import { CAR } from './config.js';

const WHEEL_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
const WHEEL_MAT = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });

export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.55,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.62, CAR.length), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(CAR.width - 0.3, 0.55, CAR.length * 0.48),
    new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.15, metalness: 0.7 })
  );
  cabin.position.set(0, 1.18, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const wheels = [];
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const w = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
  for (const wx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), headMat);
    h.position.set(wx, 0.68, CAR.length / 2 + 0.02);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  for (const wx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), tailMat);
    t.position.set(wx, 0.68, -CAR.length / 2 - 0.02);
    g.add(t);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.52, -0.25);
    g.add(bar);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    r.position.set(-0.28, 1.6, -0.25);
    g.add(r);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    b.position.set(0.28, 1.6, -0.25);
    g.add(b);
    g.userData.lightBar = { red: r, blue: b };
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x111111 })
    );
    sign.position.set(0, 1.56, -0.25);
    g.add(sign);
  }
  if (opts.sport) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.4), paint);
    spoiler.position.set(0, 1.05, -CAR.length / 2 + 0.15);
    g.add(spoiler);
  }
  g.userData.wheels = wheels;
  return g;
}

export function createCar(kind, color, x, z, heading, opts = {}) {
  const mesh = makeCarMesh(color, opts);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    kind,
    mesh,
    color,
    pos: mesh.position,
    heading,
    speed: 0,
    steer: 0,
    radius: 1.55,
    opts,
    // Input set by whoever drives it: throttle -1..1, steer -1..1.
    input: { throttle: 0, steer: 0 },
  };
}

// Arcade step: throttle, steering that fades with speed, drag, then move and
// push out of buildings and the map edge. Returns impact speed (0 = no hit).
export function stepCar(car, dt, city) {
  const inp = car.input;
  const fwd = Math.sin(car.heading);
  const side = Math.cos(car.heading);
  if (inp.throttle > 0) car.speed += CAR.accel * inp.throttle * dt;
  else if (inp.throttle < 0) car.speed -= CAR.brake * -inp.throttle * dt;
  car.speed -= car.speed * CAR.drag * dt;
  if (Math.abs(inp.throttle) < 0.05 && Math.abs(car.speed) < 0.4) car.speed = 0;
  const maxSpeed = car.maxSpeed ?? CAR.maxSpeed;
  const maxReverse = car.maxReverse ?? CAR.maxReverse;
  car.speed = Math.max(-maxReverse, Math.min(maxSpeed, car.speed));
  const steerAuthority = 1 - Math.min(0.65, Math.abs(car.speed) / maxSpeed * 0.65);
  car.heading += inp.steer * CAR.steerRate * steerAuthority * Math.sign(car.speed || 1) * dt * Math.min(1, Math.abs(car.speed) / 4 + 0.25);
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.rotation.y = car.heading;
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
  if (car.mesh.userData.lightBar) {
    const on = Math.floor(performance.now() / 180) % 2 === 0;
    car.mesh.userData.lightBar.red.material.color.setHex(on ? 0xff2222 : 0x551111);
    car.mesh.userData.lightBar.blue.material.color.setHex(on ? 0x112266 : 0x2244ff);
  }
  // Building push-out (circle vs AABB), plus map edge and the sea.
  let impact = 0;
  for (const b of city.colliders) {
    const cx = Math.max(b.minX, Math.min(car.pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(car.pos.z, b.maxZ));
    const dx = car.pos.x - cx;
    const dz = car.pos.z - cz;
    const d2 = dx * dx + dz * dz;
    const r = car.radius;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      const push = (r - d) / d;
      car.pos.x += dx * push;
      car.pos.z += dz * push;
      const into = Math.abs(car.speed);
      if (into > 3) impact = Math.max(impact, into);
      car.speed *= 0.55;
    }
  }
  const edge = 218;
  if (car.pos.x > edge) { car.pos.x = edge; car.speed *= 0.5; }
  if (car.pos.x < -edge) { car.pos.x = -edge; car.speed *= 0.5; }
  if (car.pos.z > edge) { car.pos.z = edge; car.speed *= 0.5; }
  if (car.pos.z < -edge) { car.pos.z = -edge; car.speed *= 0.5; }
  if (car.pos.x > 208) { car.pos.x = 208; car.speed *= 0.5; }
  return impact;
}

// Circle-circle push-apart for two cars. Returns the closing speed.
export function collideCars(a, b) {
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;
  const d = Math.hypot(dx, dz);
  const min = a.radius + b.radius;
  if (d >= min || d < 0.001) return 0;
  const push = (min - d) / 2 / d;
  a.pos.x -= dx * push;
  a.pos.z -= dz * push;
  b.pos.x += dx * push;
  b.pos.z += dz * push;
  const closing = Math.abs(a.speed - b.speed);
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.7;
  b.speed = avg * 0.7;
  return closing;
}

export function forwardOf(car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}
