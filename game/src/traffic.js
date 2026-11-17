// Traffic: civilian cars that drive the grid on the right-hand side, turn at
// intersections and slow for the car ahead. Parked cars sit at the kerb and
// wait to be stolen.
//
// A traffic car's route is a chain of intersections: it always drives toward
// the next intersection on its current street (target {x, z, axis, street,
// dir, idx}); on arrival it picks straight, a turn, or a U-turn at the edge.

import { STREET_COUNT, streetAt, LANE, CITY_HALF, nearestStreetIndex } from './config.js';
import { randomInt, randomPick, randomRange } from './rng.js';
import { Car, makeCarMesh } from './vehicles.js';

const TRAFFIC_COUNT = 14;
const PARKED_COUNT = 10;
const CRUISE_MIN = 7;
const CRUISE_MAX = 11;

/** Lane coordinate for driving along a street. axis 'x': street at z; 'z': at x. */
export function laneFor(axis, streetCoord, dir) {
  if (axis === 'x') return streetCoord + (dir > 0 ? LANE : -LANE);
  return streetCoord + (dir > 0 ? -LANE : LANE);
}

/** Target point for the next intersection along a street. */
function targetFor(axis, street, dir, idx) {
  if (axis === 'x') {
    return { x: streetAt(idx), z: laneFor('x', streetAt(street), dir), axis, street, dir, idx };
  }
  return { x: laneFor('z', streetAt(street), dir), z: streetAt(idx), axis, street, dir, idx };
}

export class TrafficManager {
  constructor(scene, city, random) {
    this.scene = scene;
    this.city = city;
    this.random = random;
    this.cars = []; // traffic Cars (driver 'traffic')
    this.parked = []; // parked Cars (driver 'parked')
  }

  spawn() {
    const random = this.random;
    for (let i = 0; i < TRAFFIC_COUNT; i++) {
      const car = this.spawnTrafficCar();
      if (car) this.cars.push(car);
    }
    for (let i = 0; i < PARKED_COUNT; i++) {
      const axis = random() < 0.5 ? 'x' : 'z';
      const street = randomInt(random, 0, STREET_COUNT - 1);
      const along = randomRange(random, -CITY_HALF + 20, CITY_HALF - 20);
      const dir = random() < 0.5 ? 1 : -1;
      const mesh = makeCarMesh(random, 'civilian');
      const car = new Car(mesh, 'civilian');
      car.driver = 'parked';
      car.parked = true;
      if (axis === 'x') {
        car.x = along;
        car.z = streetAt(street) + (dir > 0 ? LANE + 3.2 : -LANE - 3.2);
        car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.x = streetAt(street) + (dir > 0 ? -LANE - 3.2 : LANE + 3.2);
        car.z = along;
        car.heading = dir > 0 ? 0 : Math.PI;
      }
      car.syncMesh(0);
      this.scene.add(mesh);
      this.parked.push(car);
    }
  }

  spawnTrafficCar() {
    const random = this.random;
    const kind = random() < 0.12 ? 'taxi' : 'civilian';
    const mesh = makeCarMesh(random, kind);
    const car = new Car(mesh, kind);
    car.driver = 'traffic';
    const axis = random() < 0.5 ? 'x' : 'z';
    const street = randomInt(random, 0, STREET_COUNT - 1);
    const dir = random() < 0.5 ? 1 : -1;
    const along = randomRange(random, -CITY_HALF + 30, CITY_HALF - 30);
    if (axis === 'x') {
      car.x = along;
      car.z = laneFor('x', streetAt(street), dir);
      car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.x = laneFor('z', streetAt(street), dir);
      car.z = along;
      car.heading = dir > 0 ? 0 : Math.PI;
    }
    car.cruise = randomRange(random, CRUISE_MIN, CRUISE_MAX);
    // Aim at the next intersection ahead (never the one just passed).
    let idx = nearestStreetIndex(along);
    if (dir > 0) {
      while (idx < STREET_COUNT - 1 && streetAt(idx) < along + 5) idx++;
    } else {
      while (idx > 0 && streetAt(idx) > along - 5) idx--;
    }
    car.target = targetFor(axis, street, dir, idx);
    car.syncMesh(0);
    this.scene.add(mesh);
    return car;
  }

  /** Pick the next intersection after arriving at target `t`. */
  nextTarget(t) {
    const random = this.random;
    const at = t.idx; // intersection just reached, on the moving axis
    const options = [];
    // Straight on, same street.
    const straightIdx = at + t.dir;
    if (straightIdx >= 0 && straightIdx < STREET_COUNT) {
      options.push({ weight: 5, target: targetFor(t.axis, t.street, t.dir, straightIdx) });
    }
    // Turn onto the crossing street (its index on the other axis is t.street).
    for (const dir of [1, -1]) {
      const nextIdx = t.street + dir;
      if (nextIdx >= 0 && nextIdx < STREET_COUNT) {
        options.push({
          weight: 2,
          target: targetFor(t.axis === 'x' ? 'z' : 'x', at, dir, nextIdx),
        });
      }
    }
    if (options.length === 0) {
      // Dead end at a corner: U-turn.
      return targetFor(t.axis, t.street, -t.dir, at - t.dir);
    }
    let total = 0;
    for (const o of options) total += o.weight;
    let roll = random() * total;
    for (const o of options) {
      roll -= o.weight;
      if (roll <= 0) return o.target;
    }
    return options[0].target;
  }

  /** Car directly ahead of `car` within `dist` (traffic + the player's car). */
  carAhead(car, others, dist) {
    const f = car.forward;
    let best = null;
    let bestD = dist;
    for (const other of others) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const along = dx * f.x + dz * f.z;
      if (along < 2 || along > bestD) continue;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (side < 2.2) {
        bestD = along;
        best = other;
      }
    }
    return best;
  }

  update(dt, playerCar) {
    const others = [...this.cars, ...(playerCar ? [playerCar] : [])];
    for (const car of this.cars) {
      if (car.dead) continue;
      const t = car.target;
      const dx = t.x - car.x;
      const dz = t.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        car.target = this.nextTarget(t);
        continue;
      }
      const desired = Math.atan2(dx, dz);
      let diff = desired - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = Math.max(-1, Math.min(1, diff * 1.6));
      const ahead = this.carAhead(car, others, 14);
      let throttle = 0.55;
      if (ahead) {
        const gap = ahead.distanceTo(car.x, car.z);
        throttle = gap < 7 ? 0 : 0.25;
      }
      if (Math.abs(diff) > 0.5) throttle = Math.min(throttle, 0.3);
      car.drive(dt, { throttle, steer: turn, brake: 0 });
      const fixed = this.city.resolveCircle({ x: car.x, z: car.z }, 1.9);
      if (Math.hypot(fixed.x - car.x, fixed.z - car.z) > 0.05) {
        car.x = fixed.x;
        car.z = fixed.z;
        car.speed *= 0.5;
        car.syncMesh(dt);
      }
    }
  }

  /** Remove a car from the world (stolen, wrecked). */
  remove(car) {
    car.dead = true;
    this.scene.remove(car.mesh);
    const list = car.driver === 'parked' ? this.parked : this.cars;
    const idx = list.indexOf(car);
    if (idx >= 0) list.splice(idx, 1);
  }

  /** Nearest stealable car to a point (parked or traffic), within maxDist. */
  nearestStealable(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of [...this.parked, ...this.cars]) {
      if (car.dead) continue;
      const d = car.distanceTo(x, z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  /** Spawn a fresh traffic car far from the player to keep the streets full. */
  topUp(playerX, playerZ) {
    if (this.cars.length >= TRAFFIC_COUNT) return;
    const car = this.spawnTrafficCar();
    if (!car) return;
    if (car.distanceTo(playerX, playerZ) < 80) {
      car.x = -car.x;
      car.z = -car.z;
      car.syncMesh(0);
    }
    this.cars.push(car);
  }
}
