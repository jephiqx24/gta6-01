// Solara City: seeded procedural city. Grid streets, downtown towers, houses,
// parks, a waterfront with sea and pier. All meshes are code-built boxes and
// canvas textures; nothing is loaded from disk.
import { THREE } from './three.js';
import { WORLD, PALETTE } from './config.js';

// A lit-window texture drawn on a canvas, deterministic per variant.
function windowTexture(rng, base, variant) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = `#${base.toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 14;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng.chance(variant === 0 ? 0.45 : 0.3);
      g.fillStyle = lit ? '#ffd27a' : '#1c2733';
      g.fillRect(8 + x * 20, 10 + y * 17, 12, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05, ...opts })
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const lamps = [];
  const trafficLights = [];
  const parks = [];
  const group = new THREE.Group();
  scene.add(group);

  // Sunset sky: a big inverted sphere with a vertical gradient (vertex colors).
  const skyGeo = new THREE.SphereGeometry(900, 24, 12);
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true });
  const pos = skyGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(PALETTE.skyTop);
  const mid = new THREE.Color(PALETTE.skyMid);
  const low = new THREE.Color(0xff7a3c);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 900;
    const c = y > 0.25 ? top.clone().lerp(mid, 1 - (y - 0.25) / 0.75) : mid.clone().lerp(low, 1 - y / 0.25);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  group.add(new THREE.Mesh(skyGeo, skyMat));

  // Sun disc low on the western horizon.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false })
  );
  sun.position.set(-520, 95, -260);
  sun.lookAt(0, 60, 0);
  group.add(sun);

  // Lights and fog.
  const sunLight = new THREE.DirectionalLight(0xffb070, 3.0);
  sunLight.position.set(-260, 190, -140);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -260;
  sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260;
  sunLight.shadow.camera.bottom = -260;
  sunLight.shadow.camera.far = 700;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0x8a7ab8, 0x3a2f28, 1.4));
  scene.fog = new THREE.Fog(0xe88a5a, 220, 780);

  // Ground slab for the whole map.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 260, WORLD.half * 2 + 60),
    new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(60, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // Sea plane on the east side.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.seaFar - WORLD.seaX, WORLD.half * 2 + 60),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.35 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((WORLD.seaX + WORLD.seaFar) / 2, 0.12, 0);
  sea.receiveShadow = true;
  group.add(sea);

  // Roads: dark strips along every street line, both axes.
  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.road, roughness: 1 });
  const sideMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
  for (const line of WORLD.lines) {
    const rX = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.street, WORLD.half * 2), roadMat);
    rX.rotation.x = -Math.PI / 2;
    rX.position.set(line, 0.02, 0);
    rX.receiveShadow = true;
    group.add(rX);
    const rZ = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.half * 2, WORLD.street), roadMat);
    rZ.rotation.x = -Math.PI / 2;
    rZ.position.set(0, 0.02, line);
    rZ.receiveShadow = true;
    group.add(rZ);
    // Sidewalk strips flanking each road.
    for (const off of [-WORLD.street / 2 - 2.5, WORLD.street / 2 + 2.5]) {
      const sX = new THREE.Mesh(new THREE.PlaneGeometry(5, WORLD.half * 2), sideMat);
      sX.rotation.x = -Math.PI / 2;
      sX.position.set(line + off, 0.04, 0);
      sX.receiveShadow = true;
      group.add(sX);
      const sZ = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.half * 2, 5), sideMat);
      sZ.rotation.x = -Math.PI / 2;
      sZ.position.set(0, 0.04, line + off);
      sZ.receiveShadow = true;
      group.add(sZ);
    }
    // Dashed centre line.
    const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.line });
    for (let d = -WORLD.half + 12; d < WORLD.half; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 6), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(line, 0.05, d);
      group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.5), dashMat);
      dash2.rotation.x = -Math.PI / 2;
      dash2.position.set(d, 0.05, line);
      group.add(dash2);
    }
  }

  // Crosswalks at every intersection.
  const crossMat = new THREE.MeshBasicMaterial({ color: PALETTE.crosswalk });
  for (const lx of WORLD.lines) {
    for (const lz of WORLD.lines) {
      for (let k = -3; k <= 3; k++) {
        const s1 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 5), crossMat);
        s1.rotation.x = -Math.PI / 2;
        s1.position.set(lx + k * 2.2, 0.06, lz + WORLD.street / 2 + 1);
        group.add(s1);
        const s2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.4), crossMat);
        s2.rotation.x = -Math.PI / 2;
        s2.position.set(lx + WORLD.street / 2 + 1, 0.06, lz + k * 2.2);
        group.add(s2);
      }
    }
  }

  // Blocks: towers downtown, houses outside, a few parks. The waterfront
  // blocks are low warehouses. Special blocks get their landmark building.
  const winTex = [windowTexture(rng, 0x2e3e55, 0), windowTexture(rng, 0x4a3a5a, 1), windowTexture(rng, 0x3a4a6b, 2)];
  const blockCenters = [];
  for (const lx of WORLD.lines) {
    for (const lz of WORLD.lines) {
      const cx = lx + WORLD.pitch / 2;
      const cz = lz + WORLD.pitch / 2;
      if (cx > WORLD.seaX - 10) continue;
      blockCenters.push([cx, cz]);
    }
  }
  const safehouseBlock = [-175, -150];
  const clubBlock = [25, 175];
  for (const [cx, cz] of blockCenters) {
    const downtown = Math.abs(cx) < WORLD.downtown && Math.abs(cz) < WORLD.downtown;
    const waterfront = cx > 150;
    const isPark = !downtown && !waterfront && rng.chance(0.16);
    const isSafehouse = cx === safehouseBlock[0] && cz === safehouseBlock[1];
    const isClub = cx === clubBlock[0] && cz === clubBlock[1];
    if (isPark) {
      const grass = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD.block, WORLD.block),
        new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 1 })
      );
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(cx, 0.07, cz);
      grass.receiveShadow = true;
      group.add(grass);
      const nTrees = rng.int(4, 7);
      for (let i = 0; i < nTrees; i++) {
        const tx = cx + rng.range(-14, 14);
        const tz = cz + rng.range(-14, 14);
        const trunk = box(0.7, 3, 0.7, PALETTE.trunk, tx, 1.5, tz);
        const top = new THREE.Mesh(
          new THREE.IcosahedronGeometry(rng.range(2.2, 3.4), 0),
          new THREE.MeshStandardMaterial({ color: PALETTE.tree, roughness: 1 })
        );
        top.position.set(tx, 4.6, tz);
        top.castShadow = true;
        group.add(trunk, top);
      }
      parks.push({ x: cx, z: cz });
      continue;
    }
    if (downtown) {
      const w = rng.range(20, 26);
      const d = rng.range(20, 26);
      const h = rng.range(30, 72);
      const tex = rng.pick(winTex);
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.1 })
      );
      tower.position.set(cx, h / 2, cz);
      tower.castShadow = true;
      tower.receiveShadow = true;
      group.add(tower);
      // Roof rim.
      group.add(box(w + 1.2, 1, d + 1.2, 0x222222, cx, h + 0.5, cz));
      colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    } else if (waterfront) {
      const w = rng.range(22, 30);
      const d = rng.range(16, 22);
      const h = rng.range(7, 11);
      group.add(box(w, h, d, rng.pick(PALETTE.building), cx, h / 2, cz));
      colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    } else {
      // One or two houses.
      const n = rng.chance(0.5) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const hx = cx + (n === 2 ? (i === 0 ? -9 : 9) : 0);
        const hz = cz + rng.range(-6, 6);
        const w = rng.range(11, 15);
        const d = rng.range(10, 13);
        const h = rng.range(7, 15);
        const color = isSafehouse ? 0xd8b23a : isClub ? 0x8a2a5a : rng.pick(PALETTE.building);
        const house = box(w, h, d, color, hx, h / 2, hz);
        group.add(house);
        // Pitched roof.
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(Math.max(w, d) * 0.72, 3.2, 4),
          new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 1 })
        );
        roof.position.set(hx, h + 1.6, hz);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);
        colliders.push({ minX: hx - w / 2, maxX: hx + w / 2, minZ: hz - d / 2, maxZ: hz + d / 2 });
      }
    }
  }

  // Pier reaching into the sea at z = 0.
  for (let x = WORLD.seaX; x < WORLD.seaX + 70; x += 7) {
    group.add(box(7, 1, 10, PALETTE.pier, x + 3.5, 0.6, 0));
    group.add(box(0.8, 3, 0.8, PALETTE.trunk, x + 1, 0.4, -4.4));
    group.add(box(0.8, 3, 0.8, PALETTE.trunk, x + 1, 0.4, 4.4));
  }

  // Street lamps at intersections.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.6 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: PALETTE.lamp });
  for (const lx of WORLD.lines) {
    for (const lz of WORLD.lines) {
      if ((lx + lz) % 100 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7, 6), lampMat);
      pole.position.set(lx + 8.5, 3.5, lz + 8.5);
      pole.castShadow = true;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), bulbMat);
      bulb.position.set(lx + 8.5, 7.2, lz + 8.5);
      group.add(pole, bulb);
      lamps.push({ x: lx + 8.5, z: lz + 8.5 });
    }
  }

  // Traffic lights at downtown intersections (cycle red/green).
  for (const lx of WORLD.lines) {
    for (const lz of WORLD.lines) {
      if (Math.abs(lx) >= WORLD.downtown || Math.abs(lz) >= WORLD.downtown) continue;
      if ((lx + lz) % 100 !== 0) continue;
      const post = box(0.35, 4.4, 0.35, 0x1a1a1a, lx - 8.5, 2.2, lz - 8.5);
      const head = box(0.9, 2.2, 0.9, 0x111111, lx - 8.5, 5, lz - 8.5);
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      red.position.set(lx - 8.5, 5.6, lz - 8.5);
      const green = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshBasicMaterial({ color: 0x222222 }));
      green.position.set(lx - 8.5, 4.5, lz - 8.5);
      group.add(post, head, red, green);
      trafficLights.push({ x: lx, z: lz, red, green, phase: rng.range(0, 8) });
    }
  }

  // Named places the missions and spawn use (all on streets, never inside a block).
  const places = {
    spawn: { x: 0, z: 0, heading: Math.PI },
    docks: { x: 200, z: -60 },
    drop1: { x: -150, z: 150 },
    fastCar: { x: 107, z: -100 },
    safehouse: { x: -150, z: -150 },
    cabPickup: { x: 50, z: 100 },
    marina: { x: 200, z: 80 },
    getaway: { x: -100, z: -180 },
    hideout: { x: 150, z: 150 },
    club: { x: 25, z: 175 },
    northGate: { x: 0, z: -200 },
    pierEnd: { x: WORLD.seaX + 62, z: 0 },
  };

  let t = 0;
  return {
    group,
    colliders,
    lamps,
    parks,
    places,
    trafficLights,
    update(dt) {
      t += dt;
      for (const tl of trafficLights) {
        const on = ((t + tl.phase) % 8) < 4;
        tl.red.material.color.setHex(on ? 0xff2222 : 0x441111);
        tl.green.material.color.setHex(on ? 0x113311 : 0x22ff44);
        tl.greenOn = !on;
      }
    },
    lightAt(x, z) {
      // Green when the nearest downtown light is green; true (go) outside downtown.
      let best = null;
      let bestD = 1e9;
      for (const tl of trafficLights) {
        const d = Math.hypot(tl.x - x, tl.z - z);
        if (d < bestD) {
          bestD = d;
          best = tl;
        }
      }
      if (!best || bestD > 30) return true;
      return best.greenOn !== false;
    },
  };
}
