// Combat: a short-range punch and a hitscan pistol. The pistol raycasts
// against people (spheres) and buildings (AABBs) by hand, so it needs no mesh
// list. A tracer line and a muzzle flash show each shot.
import { THREE } from './three.js';
import { PLAYER } from './config.js';

function raySphere(origin, dir, center, radius) {
  const ox = center.x - origin.x;
  const oy = center.y - origin.y;
  const oz = center.z - origin.z;
  const tca = ox * dir.x + oy * dir.y + oz * dir.z;
  if (tca < 0) return -1;
  const d2 = ox * ox + oy * oy + oz * oz - tca * tca;
  if (d2 > radius * radius) return -1;
  return tca - Math.sqrt(radius * radius - d2);
}

function rayAABB(origin, dir, b) {
  let tmin = 0;
  let tmax = 1e9;
  const o = [origin.x, origin.y, origin.z];
  const d = [dir.x, dir.y, dir.z];
  const mn = [b.minX, 0, b.minZ];
  const mx = [b.maxX, 60, b.maxZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < mn[i] || o[i] > mx[i]) return -1;
    } else {
      let t1 = (mn[i] - o[i]) / d[i];
      let t2 = (mx[i] - o[i]) / d[i];
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

export function createCombat(scene) {
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.frustumCulled = false;
  scene.add(tracer);
  const flash = new THREE.PointLight(0xffd27a, 0, 14, 1.5);
  scene.add(flash);
  let tracerT = 0;

  function muzzlePos(player) {
    return { x: player.pos.x, y: 1.35, z: player.pos.z };
  }

  // Returns {hit:'ped'|'officer'|'car'|'building'|null, point, ped} .
  function shoot(player, camera, city, peds, officers, policeCars) {
    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const m = muzzlePos(player);
    let best = PLAYER.pistolRange;
    let bestKind = null;
    let bestPed = null;
    let bestPoint = null;
    const consider = (t, kind, ped, px, py, pz) => {
      if (t >= 0 && t < best) {
        best = t;
        bestKind = kind;
        bestPed = ped;
        bestPoint = { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t };
      }
    };
    for (const ped of peds) {
      if (ped.state !== 'walk' && ped.state !== 'flee') continue;
      const t = raySphere(origin, dir, { x: ped.pos.x, y: 1.2, z: ped.pos.z }, 0.7);
      consider(t, 'ped', ped);
    }
    for (const off of officers) {
      const t = raySphere(origin, dir, { x: off.pos.x, y: 1.2, z: off.pos.z }, 0.7);
      consider(t, 'officer', off);
    }
    for (const car of policeCars) {
      const t = raySphere(origin, dir, { x: car.pos.x, y: 0.9, z: car.pos.z }, 2.1);
      consider(t, 'car', null);
    }
    for (const b of city.colliders) {
      const t = rayAABB(origin, dir, b);
      consider(t, 'building', null);
    }
    const end = bestPoint || {
      x: origin.x + dir.x * PLAYER.pistolRange,
      y: origin.y + dir.y * PLAYER.pistolRange,
      z: origin.z + dir.z * PLAYER.pistolRange,
    };
    const pos = tracerGeo.attributes.position;
    pos.setXYZ(0, m.x, m.y, m.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    tracerMat.opacity = 0.95;
    tracerT = 0.09;
    flash.position.set(m.x, m.y, m.z);
    flash.intensity = 60;
    return { hit: bestKind, point: end, ped: bestPed };
  }

  // Punch: nearest person in front of the player within range falls down.
  function punch(player, peds, officers) {
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    let best = null;
    let bestD = PLAYER.punchRange;
    const check = (list, kind) => {
      for (const p of list) {
        if (p.state && p.state !== 'walk' && p.state !== 'flee') continue;
        const dx = p.pos.x - player.pos.x;
        const dz = p.pos.z - player.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < bestD && (dx * fx + dz * fz) / (d || 1) > 0.4) {
          bestD = d;
          best = { ped: p, kind };
        }
      }
    };
    check(peds, 'ped');
    check(officers, 'officer');
    if (!best) return null;
    const p = best.ped;
    if (best.kind === 'ped') {
      p.state = 'down';
      p.downT = 6;
      p.mesh.rotation.x = 0.4;
    } else {
      // An officer who is punched is knocked down and stops the arrest timer.
      p.arrestT = 0;
      p.pos.x += fx * 2;
      p.pos.z += fz * 2;
    }
    return best;
  }

  function update(dt) {
    if (tracerT > 0) {
      tracerT -= dt;
      tracerMat.opacity = Math.max(0, tracerT / 0.09) * 0.95;
    } else {
      tracerMat.opacity = 0;
    }
    flash.intensity = Math.max(0, flash.intensity - dt * 900);
  }

  return { shoot, punch, update };
}
