// Pedestrians: simple people who walk the sidewalks, cross at crosswalks and
// run from danger. A hit pedestrian falls and reports the hit to the game.
import { THREE } from './three.js';
import { WORLD } from './config.js';

const SHIRTS = [0xd84f4f, 0x4f7ad8, 0x4fd87a, 0xd8c84f, 0x9a4fd8, 0xd88a4f, 0x4fd8c8, 0xe8e8e8];
const SKINS = [0xe8b88a, 0xc88a5a, 0x8a5a3a, 0xf0c8a0];

function makePersonMesh(rng) {
  const g = new THREE.Group();
  const shirt = rng.pick(SHIRTS);
  const skin = rng.pick(SKINS);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 1 }));
  legL.position.set(-0.14, 0.38, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }));
  body.position.y = 1.12;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }));
  head.position.y = 1.68;
  head.castShadow = true;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }));
  armL.position.set(-0.4, 1.12, 0);
  const armR = armL.clone();
  armR.position.x = 0.4;
  g.add(legL, legR, body, head, armL, armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export function createPedestrians(scene, rng) {
  const peds = [];
  const group = scene;

  function sidewalkLine() {
    const street = rng.pick(WORLD.lines);
    return street + (rng.chance(0.5) ? 1 : -1) * (WORLD.street / 2 + 2.5);
  }

  function spawn(x, z) {
    const mesh = makePersonMesh(rng);
    mesh.position.set(x, 0, z);
    const horizontal = rng.chance(0.5);
    const line = horizontal ? z : x;
    const ped = {
      mesh,
      pos: mesh.position,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.1, 1.9),
      state: 'walk',
      lane: { axis: horizontal ? 'x' : 'z', line, dir: rng.chance(0.5) ? 1 : -1 },
      legPhase: rng.range(0, 6),
      fleeT: 0,
      downT: 0,
      target: null,
    };
    group.add(mesh);
    peds.push(ped);
    return ped;
  }

  for (let i = 0; i < 24; i++) {
    const horizontal = rng.chance(0.5);
    const line = sidewalkLine();
    const along = rng.pick(WORLD.lines) + rng.range(-20, 20);
    spawn(horizontal ? along : line, horizontal ? line : along);
  }

  function update(dt, danger, cars) {
    const events = [];
    for (const ped of peds) {
      if (ped.state === 'down') {
        ped.downT -= dt;
        ped.mesh.rotation.x = Math.min(ped.mesh.rotation.x + dt * 3, Math.PI / 2 - 0.1);
        if (ped.downT <= 0) {
          ped.mesh.visible = false;
          ped.state = 'gone';
        }
        continue;
      }
      if (ped.state === 'gone') continue;
      // Danger (fast car, punch, gunshot) makes the ped flee.
      if (danger) {
        const d = Math.hypot(ped.pos.x - danger.x, ped.pos.z - danger.z);
        if (d < danger.radius) {
          ped.state = 'flee';
          ped.fleeT = 2.5;
          ped.target = {
            x: ped.pos.x + (ped.pos.x - danger.x) / (d || 1) * 30,
            z: ped.pos.z + (ped.pos.z - danger.z) / (d || 1) * 30,
          };
        }
      }
      if (ped.state === 'flee') {
        ped.fleeT -= dt;
        const dx = ped.target.x - ped.pos.x;
        const dz = ped.target.z - ped.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1 || ped.fleeT <= 0) {
          ped.state = 'walk';
        } else {
          ped.heading = Math.atan2(dx, dz);
          ped.pos.x += Math.sin(ped.heading) * 6 * dt;
          ped.pos.z += Math.cos(ped.heading) * 6 * dt;
          ped.legPhase += dt * 11;
        }
      } else {
        // Walk the sidewalk lane; turn at intersections.
        const lane = ped.lane;
        const along = lane.axis === 'x' ? ped.pos.x : ped.pos.z;
        const cross = lane.axis === 'x' ? ped.pos.z : ped.pos.x;
        const nextLine = lane.dir > 0 ? Math.ceil((along + 1) / WORLD.pitch) * WORLD.pitch : Math.floor((along - 1) / WORLD.pitch) * WORLD.pitch;
        const toNext = (nextLine - along) * lane.dir;
        if (toNext < 2) {
          // At an intersection: continue, or turn onto the crossing sidewalk.
          if (rng.chance(0.45)) {
            const newLine = cross + (rng.chance(0.5) ? 1 : -1) * (WORLD.street / 2 + 2.5);
            ped.lane = { axis: lane.axis === 'x' ? 'z' : 'x', line: newLine, dir: rng.chance(0.5) ? 1 : -1 };
          } else {
            ped.lane = { axis: lane.axis, line: lane.line, dir: lane.dir };
          }
        }
        const dirSign = ped.lane.dir;
        ped.heading = ped.lane.axis === 'x' ? (dirSign > 0 ? Math.PI / 2 : -Math.PI / 2) : dirSign > 0 ? 0 : Math.PI;
        const step = ped.speed * dt;
        if (ped.lane.axis === 'x') {
          ped.pos.x += dirSign * step;
          ped.pos.z += (ped.lane.line - ped.pos.z) * Math.min(1, dt * 3);
        } else {
          ped.pos.z += dirSign * step;
          ped.pos.x += (ped.lane.line - ped.pos.x) * Math.min(1, dt * 3);
        }
        ped.legPhase += dt * 7;
      }
      // Hit by a moving car?
      for (const car of cars) {
        if (Math.abs(car.speed) < 3) continue;
        if (Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z) < 1.9) {
          ped.state = 'down';
          ped.downT = 6;
          ped.mesh.rotation.x = 0.4;
          events.push({ type: 'pedHit', ped, car });
          break;
        }
      }
      ped.mesh.rotation.y = ped.heading;
      const swing = Math.sin(ped.legPhase) * 0.55;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      ped.mesh.userData.armL.rotation.x = -swing * 0.7;
      ped.mesh.userData.armR.rotation.x = swing * 0.7;
    }
    return events;
  }

  return {
    peds,
    update,
    nearest(x, z, maxD) {
      let best = null;
      let bestD = maxD;
      for (const ped of peds) {
        if (ped.state !== 'walk' && ped.state !== 'flee') continue;
        const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
        if (d < bestD) {
          bestD = d;
          best = ped;
        }
      }
      return best;
    },
  };
}
