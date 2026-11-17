// Solara City — the procedural city itself: ground texture, buildings,
// streetlights, palms, waterfront, sky and sun. Seeded, so one seed always
// builds the same city. Returns the layout the AI, the minimap and the
// missions all read from.

import {
  BLOCK, STREET, PITCH, STREET_COUNT, STREET_FIRST, CITY_HALF, WATER_X,
  PALETTE, streetAt,
} from './config.js';
import { randomInt, randomPick, randomRange } from './rng.js';

const THREE = window.THREE;

/** Canvas texture with a grid of windows, some lit warm, some dark. */
function makeWindowTexture(random, cols, rows) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  // Light wall so the material colour tints it; windows read as dark or lit.
  ctx.fillStyle = '#b8b0a8';
  ctx.fillRect(0, 0, 128, 256);
  const cw = 128 / cols;
  const ch = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = random() < 0.42;
      ctx.fillStyle = lit ? (random() < 0.7 ? '#ffd27a' : '#9fd8ff') : '#39415a';
      ctx.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Canvas texture with a text sign (club, hotel, marina names). */
function makeSignTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = fg;
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The ground texture: streets, sidewalks, crosswalks, lane dashes, beach. */
function makeGroundTexture() {
  const S = 2048;
  const EXTENT = 520; // world -260..260
  const px = S / EXTENT;
  const toPx = (v) => (v + EXTENT / 2) * px;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = css(PALETTE.blockGround);
  ctx.fillRect(0, 0, S, S);
  // Beach strip on the east edge.
  ctx.fillStyle = css(PALETTE.sand);
  ctx.fillRect(toPx(WATER_X - 16), 0, toPx(EXTENT / 2) - toPx(WATER_X - 16), S);
  // Sidewalk rings around every block.
  ctx.fillStyle = css(PALETTE.sidewalk);
  for (let i = 0; i < STREET_COUNT - 1; i++) {
    for (let j = 0; j < STREET_COUNT - 1; j++) {
      const x0 = streetAt(i) + STREET / 2;
      const z0 = streetAt(j) + STREET / 2;
      ctx.fillRect(toPx(x0 - 2), toPx(z0 - 2), (BLOCK + 4) * px, (BLOCK + 4) * px);
    }
  }
  // Asphalt streets.
  ctx.fillStyle = css(PALETTE.asphalt);
  for (let i = 0; i < STREET_COUNT; i++) {
    const c = streetAt(i);
    ctx.fillRect(toPx(c - STREET / 2), 0, STREET * px, S);
    ctx.fillRect(0, toPx(c - STREET / 2), S, STREET * px);
  }
  // Lane dashes along the centre of every street.
  ctx.fillStyle = '#e8e8e8';
  for (let i = 0; i < STREET_COUNT; i++) {
    const c = streetAt(i);
    for (let d = -CITY_HALF; d < CITY_HALF; d += 12) {
      ctx.fillRect(toPx(c) - 1, toPx(d), 2, 6 * px);
      ctx.fillRect(toPx(d), toPx(c) - 1, 6 * px, 2);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = '#e8e8e8';
  for (let i = 0; i < STREET_COUNT; i++) {
    for (let j = 0; j < STREET_COUNT; j++) {
      const x = streetAt(i);
      const z = streetAt(j);
      for (let k = -3; k <= 3; k++) {
        ctx.fillRect(toPx(x + k * 1.8) - 1, toPx(z - STREET / 2), 2, 2.4 * px);
        ctx.fillRect(toPx(x + k * 1.8) - 1, toPx(z + STREET / 2) - 2.4 * px, 2, 2.4 * px);
        ctx.fillRect(toPx(x - STREET / 2), toPx(z + k * 1.8) - 1, 2.4 * px, 2);
        ctx.fillRect(toPx(x + STREET / 2) - 2.4 * px, toPx(z + k * 1.8) - 1, 2.4 * px, 2);
      }
    }
  }
  // Central plaza: a roundabout ring at the middle intersection.
  ctx.fillStyle = css(PALETTE.sidewalk);
  ctx.beginPath();
  ctx.arc(toPx(0), toPx(0), 11 * px, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a7a4a';
  ctx.beginPath();
  ctx.arc(toPx(0), toPx(0), 7 * px, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Sky dome texture: purple dusk on top, orange sunset at the horizon. */
function makeSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#5a3a7a');
  grad.addColorStop(0.45, '#a85a7a');
  grad.addColorStop(0.62, '#ff8a4a');
  grad.addColorStop(0.72, '#ffc46b');
  grad.addColorStop(0.78, '#e89a5a');
  grad.addColorStop(1, '#7a5a4a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Scale a box geometry's UVs so windows stay a constant size. */
function scaleBoxUVs(geometry, w, h, d) {
  const uv = geometry.attributes.uv;
  const uScale = Math.max(w, d) / 7;
  const vScale = h / 7;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * uScale, uv.getY(i) * vScale);
  }
  return geometry;
}

/** Split a BoxGeometry into side faces (+x,-x,+z,-z) and roof faces (+y,-y). */
function splitBoxSidesRoof(geo) {
  function pick(verts, idxRanges) {
    const pos = geo.attributes.position.array;
    const norm = geo.attributes.normal.array;
    const uvA = geo.attributes.uv.array;
    const index = geo.index.array;
    const remap = new Map();
    verts.forEach((v, i) => remap.set(v, i));
    const p = new Float32Array(verts.length * 3);
    const n = new Float32Array(verts.length * 3);
    const u = new Float32Array(verts.length * 2);
    verts.forEach((v, i) => {
      p[i * 3] = pos[v * 3];
      p[i * 3 + 1] = pos[v * 3 + 1];
      p[i * 3 + 2] = pos[v * 3 + 2];
      n[i * 3] = norm[v * 3];
      n[i * 3 + 1] = norm[v * 3 + 1];
      n[i * 3 + 2] = norm[v * 3 + 2];
      u[i * 2] = uvA[v * 2];
      u[i * 2 + 1] = uvA[v * 2 + 1];
    });
    const idxList = [];
    for (const [start, count] of idxRanges) {
      for (let i = start; i < start + count; i++) idxList.push(remap.get(index[i]));
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(p, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(u, 2));
    out.setIndex(idxList);
    return out;
  }
  // BoxGeometry order: px 0-3, nx 4-7, py 8-11, ny 12-15, pz 16-19, nz 20-23.
  const sides = pick(
    [0, 1, 2, 3, 4, 5, 6, 7, 16, 17, 18, 19, 20, 21, 22, 23],
    [[0, 6], [6, 6], [24, 6], [30, 6]],
  );
  const roof = pick([8, 9, 10, 11, 12, 13, 14, 15], [[12, 6], [18, 6]]);
  return { sides, roof };
}

function mergeBoxes(geoms) {
  let vCount = 0;
  let iCount = 0;
  for (const g of geoms) {
    vCount += g.attributes.position.count;
    iCount += g.index.count;
  }
  const pos = new Float32Array(vCount * 3);
  const norm = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  let vo = 0;
  let io = 0;
  for (const g of geoms) {
    pos.set(g.attributes.position.array, vo * 3);
    norm.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += g.attributes.position.count;
    io += gi.length;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  merged.setIndex(new THREE.BufferAttribute(idx, 1));
  return merged;
}

/**
 * Build the city into the scene.
 * @returns {{group, colliders, locations, sun, hemi, resolveCircle}}
 */
export function buildCity(scene, random) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const locations = {};

  // --- Sky, sun, fog -------------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 3.2);
  sun.position.set(320, 130, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xffb08a, 0x5a4636, 1.5);
  scene.add(hemi);
  scene.fog = new THREE.Fog(PALETTE.fog, 160, 850);

  // Sun disc low over the sea (east).
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }),
  );
  sunDisc.position.set(820, 62, -40);
  sunDisc.lookAt(0, 62, -40);
  group.add(sunDisc);

  // --- Ground + sea --------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(WATER_X + 160, -0.4, 0);
  group.add(sea);
  // Pier reaching into the sea.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(60, 1.2, 8),
    new THREE.MeshLambertMaterial({ color: 0x7a5a42 }),
  );
  pier.position.set(WATER_X + 28, 0.6, -60);
  pier.castShadow = true;
  group.add(pier);

  // --- Buildings (merged per material: a handful of draw calls) -----------
  const winTex = makeWindowTexture(random, 6, 12);
  const winTexTall = makeWindowTexture(random, 8, 18);
  const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.roof });
  const sideGeoms = new Map(); // "color:tall" -> side-face geometries
  const roofGeoms = [];
  const acGeoms = [];

  const parkBlocks = new Set(['2,3', '4,1', '1,5', '5,4', '3,6']);
  const named = {
    club: { block: [3, 3], name: 'VELVET PALM', bg: '#3a0a4a', fg: '#ff6ad8' },
    hotel: { block: [5, 2], name: 'HOTEL MARINA', bg: '#0a2a4a', fg: '#7ad8ff' },
    warehouse: { block: [6, 5], name: 'DOCKS 7', bg: '#2a2a2a', fg: '#ffd27a' },
  };

  for (let bi = 0; bi < STREET_COUNT - 1; bi++) {
    for (let bj = 0; bj < STREET_COUNT - 1; bj++) {
      const bx0 = streetAt(bi) + STREET / 2 + 2;
      const bz0 = streetAt(bj) + STREET / 2 + 2;
      const key = `${bi},${bj}`;
      const cx = bx0 + BLOCK / 2 - 2;
      const cz = bz0 + BLOCK / 2 - 2;
      const downtown = Math.abs(bi - 3) <= 1 && Math.abs(bj - 3) <= 1;
      if (parkBlocks.has(key)) {
        // Park: lawn, a few palms and a bench block.
        const lawn = new THREE.Mesh(
          new THREE.BoxGeometry(BLOCK - 4, 0.4, BLOCK - 4),
          new THREE.MeshLambertMaterial({ color: 0x4a7a4a }),
        );
        lawn.position.set(cx, 0.2, cz);
        lawn.receiveShadow = true;
        group.add(lawn);
        continue;
      }
      const namedHere = Object.entries(named).find(([, n]) => n.block[0] === bi && n.block[1] === bj);
      const lots = downtown || namedHere ? 1 : (random() < 0.5 ? 4 : 2);
      const cols = lots === 4 ? 2 : (lots === 2 ? 2 : 1);
      const rows = lots === 4 ? 2 : 1;
      for (let li = 0; li < cols; li++) {
        for (let lj = 0; lj < rows; lj++) {
          const w = (BLOCK - 4) / cols - 4;
          const d = (BLOCK - 4) / rows - 4;
          const x = bx0 + 2 + (w / 2) + li * (w + 4);
          const z = bz0 + 2 + (d / 2) + lj * (d + 4);
          let h;
          let color;
          if (namedHere) {
            h = 14;
            color = 0x8a4a6a;
          } else if (downtown) {
            h = randomRange(random, 26, 68);
            color = randomPick(random, PALETTE.tower);
          } else {
            h = randomRange(random, 6, 20);
            color = randomPick(random, PALETTE.building);
          }
          const geo = scaleBoxUVs(new THREE.BoxGeometry(w, h, d), w, h, d);
          geo.translate(x, h / 2, z);
          const { sides, roof } = splitBoxSidesRoof(geo);
          const matKey = `${color}:${h > 24}`;
          if (!sideGeoms.has(matKey)) sideGeoms.set(matKey, []);
          sideGeoms.get(matKey).push(sides);
          roofGeoms.push(roof);
          colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
          if (namedHere && li === 0 && lj === 0) {
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(18, 4.5),
              new THREE.MeshBasicMaterial({ map: makeSignTexture(namedHere[1].name, namedHere[1].bg, namedHere[1].fg) }),
            );
            sign.position.set(x, 10.5, z - d / 2 - 0.15);
            sign.rotation.y = Math.PI;
            group.add(sign);
            const entry = namedHere[0];
            locations[entry] = { x, z, label: namedHere[1].name };
          }
          // Rooftop AC box on some buildings (merged later).
          if (random() < 0.4) {
            const ac = new THREE.BoxGeometry(3, 1.4, 2.4);
            ac.translate(x + randomRange(random, -w / 4, w / 4), h + 0.7, z + randomRange(random, -d / 4, d / 4));
            acGeoms.push(ac);
          }
        }
      }
    }
  }

  // Merge the collected building geometry: one mesh per material.
  for (const [key, geoms] of sideGeoms) {
    const [colorStr, tallStr] = key.split(':');
    const mat = new THREE.MeshLambertMaterial({
      color: Number(colorStr),
      map: tallStr === 'true' ? winTexTall : winTex,
    });
    const mesh = new THREE.Mesh(mergeBoxes(geoms), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const roofMesh = new THREE.Mesh(mergeBoxes(roofGeoms), roofMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  group.add(roofMesh);
  if (acGeoms.length > 0) {
    const acMesh = new THREE.Mesh(
      mergeBoxes(acGeoms),
      new THREE.MeshLambertMaterial({ color: 0x6a6a72 }),
    );
    acMesh.castShadow = true;
    group.add(acMesh);
  }

  // Mission locations not tied to a named building.
  locations.safehouse = { x: streetAt(1), z: streetAt(6), label: 'Safehouse' };
  locations.hideout = { x: streetAt(6), z: streetAt(1), label: 'Hideout' };
  locations.chopshop = { x: streetAt(0), z: streetAt(3), label: 'Chop Shop' };
  locations.marina = { x: WATER_X - 8, z: streetAt(5), label: 'Marina' };
  locations.docks = locations.warehouse;
  locations.club = locations.club || { x: 0, z: 0, label: 'Velvet Palm' };

  // --- Streetlights (instanced) --------------------------------------------
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 7, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  const lampGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleCount = STREET_COUNT * STREET_COUNT;
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, poleCount);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, poleCount);
  const m4 = new THREE.Matrix4();
  let pi = 0;
  for (let i = 0; i < STREET_COUNT; i++) {
    for (let j = 0; j < STREET_COUNT; j++) {
      const x = streetAt(i) + STREET / 2 + 0.8;
      const z = streetAt(j) + STREET / 2 + 0.8;
      m4.makeTranslation(x, 3.5, z);
      poles.setMatrixAt(pi, m4);
      m4.makeTranslation(x, 7, z);
      lamps.setMatrixAt(pi, m4);
      pi++;
    }
  }
  poles.castShadow = true;
  group.add(poles);
  group.add(lamps);

  // --- Palm trees along the beach and in parks ------------------------------
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const frondGeo = new THREE.IcosahedronGeometry(2.2, 0);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3a8a4a });
  const palmSpots = [];
  for (let z = -CITY_HALF; z <= CITY_HALF; z += 18) palmSpots.push([WATER_X - 6, z + randomRange(random, -4, 4)]);
  for (const key of parkBlocks) {
    const [bi, bj] = key.split(',').map(Number);
    const cx = streetAt(bi) + STREET / 2 + BLOCK / 2;
    const cz = streetAt(bj) + STREET / 2 + BLOCK / 2;
    palmSpots.push([cx - 12, cz - 12], [cx + 12, cz + 12]);
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length);
  palmSpots.forEach(([x, z], idx) => {
    m4.makeTranslation(x, 3.5, z);
    trunks.setMatrixAt(idx, m4);
    m4.makeTranslation(x, 7.6, z);
    fronds.setMatrixAt(idx, m4);
  });
  trunks.castShadow = true;
  fronds.castShadow = true;
  group.add(trunks);
  group.add(fronds);

  // --- Collision ------------------------------------------------------------
  function resolveCircle(pos, radius) {
    // Push a circle (x, z) out of every building AABB it overlaps.
    let x = pos.x;
    let z = pos.z;
    for (const c of colliders) {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * radius;
          z = nz + (dz / d) * radius;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pl = x - c.minX;
          const pr = c.maxX - x;
          const pt = z - c.minZ;
          const pb = c.maxZ - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.minX - radius;
          else if (m === pr) x = c.maxX + radius;
          else if (m === pt) z = c.minZ - radius;
          else z = c.maxZ + radius;
        }
      }
    }
    // World bounds.
    const m = CITY_HALF + 8;
    x = Math.max(-m, Math.min(WATER_X + 6, x));
    z = Math.max(-m, Math.min(m, z));
    return { x, z };
  }

  return { group, colliders, locations, sun, hemi, resolveCircle };
}
