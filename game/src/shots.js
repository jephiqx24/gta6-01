// Screenshot scenes behind ?shot=cover|street|chase|mission. Each one sets
// the real game to a staged state (a car, a wanted level, a mission) and
// returns an autopilot the main loop calls for input, so the frame is what
// a short stretch of real play looks like — the same seed always gives the
// same frame.

import { streetAt, nearestStreetIndex, WATER_X } from './config.js';
import { MISSION_DEFS } from './missions.js';
import { makeCarMesh } from './vehicles.js';
import { Car } from './vehicles.js';

function clearRoadAhead(game, x, z, radius) {
  for (const car of game.traffic.cars) {
    if (Math.hypot(car.x - x, car.z - z) < radius) {
      car.x = -car.x;
      car.z = -car.z;
      car.syncMesh(0);
    }
  }
}

function putPlayerInCar(game, x, z, heading, speed) {
  const mesh = makeCarMesh(game.random, 'civilian');
  const car = new Car(mesh, 'civilian');
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = speed;
  car.syncMesh(0);
  game.scene.add(mesh);
  game.player.enterCar(car);
  game.player.car = car;
  game.camYaw = heading;
  game.camPitch = 0.3;
  game.camDist = 11;
  return car;
}

/** Two civilian cars ahead on the same street, same direction, slower. */
function addTrafficAhead(game, x, z, heading) {
  for (const [dx, speed] of [[55, 12], [95, 14]]) {
    const mesh = makeCarMesh(game.random, 'civilian');
    const car = new Car(mesh, 'civilian');
    car.driver = 'traffic';
    car.x = x + dx;
    car.z = z + 3.5;
    car.heading = heading;
    car.speed = speed;
    car.cruise = speed;
    car.target = { x: x + 400, z: z + 3.5, axis: 'x', street: 3, dir: 1, idx: 7 };
    car.syncMesh(0);
    game.scene.add(mesh);
    game.traffic.cars.push(car);
  }
}

/** Drive straight along the car's current heading. */
function straightDrive(game) {
  const car = game.player.car;
  if (!car) return { x: 0, y: 0 };
  let diff = car.heading - Math.PI / 2;
  // The driving shots all head east (+x, heading PI/2); steer back to it.
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, -diff * 2));
  return { x: -steer, y: game.shotThrottle ?? 0.8 };
}

export function stageShot(name, game) {
  const player = game.player;
  const traffic = game.traffic;
  const police = game.police;
  const missions = game.missions;
  police.playerX = player.x;
  police.playerZ = player.z;

  if (name === 'street') {
    // On foot on the sidewalk beside a parked car, seen at a three-quarter
    // angle: the player, the car, the street and the city behind them, with
    // pedestrians strolling past on the pavement.
    const parked = traffic.parked[0];
    // Sidewalk side: away from the street centre the car is parked on.
    let px;
    let pz;
    if (Math.abs(Math.sin(parked.heading)) > 0.5) {
      // Car runs along x: the street is the z-line nearest the car.
      const centre = streetAt(nearestStreetIndex(parked.z));
      const side = parked.z >= centre ? 1 : -1;
      px = parked.x;
      pz = parked.z + side * 3;
    } else {
      const centre = streetAt(nearestStreetIndex(parked.x));
      const side = parked.x >= centre ? 1 : -1;
      px = parked.x + side * 3;
      pz = parked.z;
    }
    clearRoadAhead(game, px, pz, 45);
    player.place(px, pz, Math.atan2(parked.x - px, parked.z - pz));
    // A few pedestrians on this pavement for life.
    for (let i = 0; i < 3; i++) {
      const ped = game.peds.makePed(px + (i - 1) * 7, pz + (i % 2 === 0 ? 1 : -1));
      game.peds.peds.push(ped);
      game.scene.add(ped.mesh);
    }
    game.camYaw = player.heading + 0.65;
    game.camPitch = 0.22;
    game.camDist = 9;
    game.shotAutopilot = () => ({ x: 0, y: 0 });
    return;
  }

  if (name === 'chase') {
    // Three-star chase: player fleeing east, three cruisers on the tail, and
    // the Hot Wheels getaway objective on the HUD.
    const car = putPlayerInCar(game, -120, streetAt(4), Math.PI / 2, 24);
    clearRoadAhead(game, -120, streetAt(4), 60);
    // No slow traffic ahead in this shot: the escort cruisers must hold speed
    // or the player rear-ends them (that is what stopped the car last time).
    game.shotThrottle = 0.9;
    police.setWanted(3);
    // Keep the pursuit cruisers well behind so they trail without ramming
    // the player inside the shot window.
    for (let i = 0; i < police.cars.length; i++) {
      const pc = police.cars[i];
      pc.x = car.x - 60 - i * 20;
      pc.z = car.z + (i % 2 === 0 ? 4 : -4);
      pc.heading = Math.PI / 2;
      pc.speed = 20;
      pc.syncMesh(0);
    }
    // Two cruisers flank the player just ahead (visible at the frame edges),
    // driven as straight traffic so they escort instead of boxing the car in;
    // the real pursuit cruisers from setWanted(3) chase from behind. The
    // escorts run faster than the player so he never rear-ends them.
    for (const [dx, dz] of [[20, 6], [30, -6]]) {
      const mesh = makeCarMesh(game.random, 'police');
      const cruiser = new Car(mesh, 'police');
      cruiser.driver = 'traffic';
      cruiser.x = car.x + dx;
      cruiser.z = car.z + dz;
      cruiser.heading = Math.PI / 2;
      cruiser.speed = 32;
      cruiser.cruise = 32;
      cruiser.target = { x: car.x + 400, z: car.z + dz, axis: 'x', street: 4, dir: 1, idx: 7 };
      cruiser.syncMesh(0);
      game.scene.add(mesh);
      game.traffic.cars.push(cruiser);
    }
    missions.cash = 1250;
    missions.debt = 3750;
    missions.done = ['first-fare'];
    missions.index = 1;
    missions.active = { def: MISSION_DEFS[1], step: 1, timer: 68, started: true };
    missions.showMarkerForStep();
    game.shotAutopilot = straightDrive;
    return;
  }

  if (name === 'mission') {
    // Cabbie drop-off: driving east along the marina road toward the marker
    // beam, the sun low over the sea ahead.
    const car = putPlayerInCar(game, -90, streetAt(5), Math.PI / 2, 16);
    clearRoadAhead(game, -90, streetAt(5), 60);
    addTrafficAhead(game, -90, streetAt(5), Math.PI / 2);
    game.shotThrottle = 0.7;
    missions.cash = 2100;
    missions.debt = 2900;
    missions.done = ['first-fare', 'hot-wheels'];
    missions.index = 2;
    missions.active = { def: MISSION_DEFS[2], step: 1, timer: 96, started: true };
    missions.showMarkerForStep();
    game.shotAutopilot = straightDrive;
    return;
  }

  // Default: cover — downtown drive at sunset, traffic, wanted 2, the first
  // mission's objective on the HUD.
  const car = putPlayerInCar(game, -150, streetAt(3), Math.PI / 2, 14);
  clearRoadAhead(game, -150, streetAt(3), 60);
  addTrafficAhead(game, -150, streetAt(3), Math.PI / 2);
  game.shotThrottle = 0.55;
  police.setWanted(2);
  const pc1 = police.spawnPoliceCar(car.x - 22, car.z + 4);
  pc1.heading = Math.PI / 2;
  pc1.speed = 18;
  pc1.syncMesh(0);
  const pc2 = police.spawnPoliceCar(car.x - 34, car.z - 4);
  pc2.heading = Math.PI / 2;
  pc2.speed = 18;
  pc2.syncMesh(0);
  missions.cash = 350;
  missions.begin();
  game.shotAutopilot = straightDrive;
}
