// Traffic: cars that drive the street grid between intersections, stop for red
// lights and for the car ahead, plus parked cars at curbs that can be stolen.
import { WORLD, PALETTE } from './config.js';
import { createCar, stepCar } from './vehicles.js';

const DIRS = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
];

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function nearestLine(v) {
  let best = WORLD.lines[0];
  let bestD = 1e9;
  for (const l of WORLD.lines) {
    const d = Math.abs(l - v);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

export function createTraffic(scene, city, rng) {
  const cars = [];
  const group = scene;

  function spawnTrafficCar(nearX, nearZ) {
    const line = rng.pick(WORLD.lines);
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const dir = rng.chance(0.5) ? 1 : -1;
    const other = rng.pick(WORLD.lines);
    const x = axis === 'x' ? other : line;
    const z = axis === 'x' ? line : other;
    const color = rng.pick(PALETTE.carColors);
    const car = createCar('traffic', color, x, z, axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI);
    // Target = the next intersection along the drive direction.
    const tx = axis === 'x' ? nearestLine(x + dir * WORLD.pitch) : x;
    const tz = axis === 'z' ? nearestLine(z + dir * WORLD.pitch) : z;
    const entry = {
      car,
      target: { x: tx, z: tz },
      arrived: { x, z },
      cruise: rng.range(9, 14),
      wait: 0,
    };
    group.add(car.mesh);
    cars.push(entry);
    return entry;
  }

  for (let i = 0; i < 14; i++) spawnTrafficCar(0, 0);

  // Parked cars at curbs (stealable).
  const parked = [];
  for (let i = 0; i < 10; i++) {
    const line = rng.pick(WORLD.lines);
    const along = rng.pick(WORLD.lines) + rng.range(-18, 18);
    const side = rng.chance(0.5) ? 1 : -1;
    const horizontal = rng.chance(0.5);
    const x = horizontal ? along : line + side * 5.2;
    const z = horizontal ? line + side * 5.2 : along;
    if (Math.hypot(x, z) < 12) continue;
    const color = rng.pick(PALETTE.carColors);
    const car = createCar('parked', color, x, z, horizontal ? Math.PI / 2 : 0);
    group.add(car.mesh);
    parked.push(car);
  }

  function pickNext(entry) {
    const t = entry.target;
    const from = entry.arrived;
    const inDir = { x: Math.sign(t.x - from.x), z: Math.sign(t.z - from.z) };
    const options = [];
    for (const d of DIRS) {
      if (d.x === -inDir.x && d.z === -inDir.z) continue; // no U-turn
      const nx = t.x + d.x * WORLD.pitch;
      const nz = t.z + d.z * WORLD.pitch;
      if (Math.abs(nx) > 200 || Math.abs(nz) > 200) continue;
      options.push(d);
    }
    if (options.length === 0) return;
    const d = rng.pick(options);
    entry.arrived = { x: t.x, z: t.z };
    entry.target = { x: t.x + d.x * WORLD.pitch, z: t.z + d.z * WORLD.pitch };
  }

  function update(dt, playerPos, allCars, playerCar) {
    for (const entry of cars) {
      const car = entry.car;
      // The player's car is driven by the player, not the AI.
      if (playerCar && car === playerCar) continue;
      const dx = entry.target.x - car.pos.x;
      const dz = entry.target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6) pickNext(entry);
      const desired = Math.atan2(entry.target.x - car.pos.x, entry.target.z - car.pos.z);
      const err = wrapAngle(desired - car.heading);
      // Slow for a red light when close to the intersection.
      const nearLight = dist < 16 && !city.lightAt(entry.target.x, entry.target.z);
      // Slow for a car ahead in the same lane.
      let blocked = false;
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      for (const other of allCars) {
        if (other === car) continue;
        const ox = other.pos.x - car.pos.x;
        const oz = other.pos.z - car.pos.z;
        const along = ox * fx + oz * fz;
        const side = Math.abs(ox * fz - oz * fx);
        if (along > 0 && along < 10 && side < 2.6) {
          blocked = true;
          break;
        }
      }
      if (nearLight || blocked) {
        car.input.throttle = car.speed > 0.5 ? -0.8 : 0;
      } else {
        car.input.throttle = car.speed < entry.cruise ? 0.7 : 0;
      }
      car.input.steer = Math.max(-1, Math.min(1, err * 1.6));
      stepCar(car, dt, city);
      // Keep traffic near the player: respawn far cars closer in.
      if (playerPos && Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z) > 280) {
        const line = rng.pick(WORLD.lines);
        const other = rng.pick(WORLD.lines);
        const axis = rng.chance(0.5) ? 'x' : 'z';
        car.pos.x = axis === 'x' ? other : line;
        car.pos.z = axis === 'x' ? line : other;
        entry.target = { x: car.pos.x, z: car.pos.z };
        entry.arrived = { x: car.pos.x, z: car.pos.z };
        car.speed = 0;
      }
    }
  }

  return {
    cars: cars.map((e) => e.car),
    parked,
    update,
    allStealable() {
      return [...cars.map((e) => e.car), ...parked];
    },
  };
}
