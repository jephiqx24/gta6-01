// Combat: the pistol (hitscan) and the punch (melee). The player shoots
// from the camera through the crosshair; police shoot back, badly, when the
// heat is high.

const PED_HIT_RADIUS = 1.1;
const CAR_HIT_RADIUS = 2.4;
const RANGE = 45;

/**
 * Fire one shot from `origin` along `dir` (a normalised {x, z} plus a pitch
 * the 2D test ignores). Returns the thing hit, if any.
 */
export function shoot(game, origin, dir) {
  const fx = dir.x;
  const fz = dir.z;
  let best = null;
  let bestAlong = RANGE;
  const consider = (x, z, radius, thing) => {
    const dx = x - origin.x;
    const dz = z - origin.z;
    const along = dx * fx + dz * fz;
    if (along < 1 || along > bestAlong) return;
    const side = Math.abs(dx * fz - dz * fx);
    if (side < radius && along < bestAlong) {
      bestAlong = along;
      best = thing;
    }
  };
  for (const ped of game.peds.peds) {
    if (ped.state === 'down') continue;
    consider(ped.x, ped.z, PED_HIT_RADIUS, { kind: 'ped', ped, along: bestAlong });
  }
  for (const officer of game.police.officers) {
    if (officer.down) continue;
    consider(officer.x, officer.z, PED_HIT_RADIUS, { kind: 'officer', officer });
  }
  for (const car of game.police.cars) {
    if (car.dead) continue;
    consider(car.x, car.z, CAR_HIT_RADIUS, { kind: 'policeCar', car });
  }
  for (const car of game.traffic.cars) {
    if (car.dead) continue;
    consider(car.x, car.z, CAR_HIT_RADIUS, { kind: 'trafficCar', car });
  }
  if (!best) return null;
  best.along = bestAlong;
  // Muzzle flash + impact burst at the hit point.
  const hx = origin.x + fx * bestAlong;
  const hz = origin.z + fz * bestAlong;
  game.particles.spawn(hx, 1.2, hz, 8, 0xffd24a, 3, 0.4, 0.6);
  if (best.kind === 'ped') {
    game.peds.knockDown(best.ped.x, best.ped.z, 0.5);
    game.police.commitCrime(1);
    game.peds.scare(best.ped.x, best.ped.z, 30);
  } else if (best.kind === 'officer') {
    if (game.police.damageOfficer(best.officer, 1)) game.audio.thud(0.5);
    game.police.commitCrime(1);
  } else if (best.kind === 'policeCar') {
    if (game.police.damageCar(best.car, 1)) {
      game.particles.crash(best.car.x, best.car.z);
      game.audio.thud();
    }
    game.police.commitCrime(1);
  } else if (best.kind === 'trafficCar') {
    game.particles.spawn(hx, 1, hz, 6, 0xbbbbbb, 2, 0.5, 0.4);
  }
  return best;
}

/** Punch whatever is in front of the player (1.8 m). */
export function punch(game, origin, dir) {
  const fx = dir.x;
  const fz = dir.z;
  for (const ped of game.peds.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - origin.x;
    const dz = ped.z - origin.z;
    const along = dx * fx + dz * fz;
    if (along > 0 && along < 1.8 && Math.abs(dx * fz - dz * fx) < 1) {
      game.peds.knockDown(ped.x, ped.z, 0.5);
      game.police.commitCrime(1);
      game.peds.scare(ped.x, ped.z, 20);
      return { kind: 'ped', ped };
    }
  }
  for (const officer of game.police.officers) {
    if (officer.down) continue;
    const dx = officer.x - origin.x;
    const dz = officer.z - origin.z;
    const along = dx * fx + dz * fz;
    if (along > 0 && along < 1.8 && Math.abs(dx * fz - dz * fx) < 1) {
      game.police.damageOfficer(officer, 1);
      game.police.commitCrime(1);
      return { kind: 'officer', officer };
    }
  }
  return null;
}

/** A police car takes a wild shot at the player (called from main.js). */
export function policeShoot(game, fromCar) {
  const player = game.player;
  const dist = fromCar.distanceTo(player.x, player.z);
  if (dist > 32) return;
  game.audio.gunshot();
  const mx = fromCar.x;
  const mz = fromCar.z;
  game.particles.muzzle(mx, 1.4, mz);
  // Inaccurate: closer and higher wanted = more likely to land.
  const hitChance = Math.max(0.08, 0.3 - dist * 0.008 + game.police.wanted * 0.02);
  if (Math.random() < hitChance) {
    player.damage(6, game.time);
    game.hud.flashDamage();
    game.particles.spawn(player.x, 1.4, player.z, 6, 0xff4040, 2, 0.4, 0.5);
  } else {
    // Near miss: sparks beside the player.
    game.particles.spawn(
      player.x + (Math.random() - 0.5) * 4, 1, player.z + (Math.random() - 0.5) * 4,
      4, 0xffd24a, 2, 0.3, 0.4,
    );
  }
}
