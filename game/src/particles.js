// Particles: a pooled THREE.Points burst system (crashes, sparks, muzzle)
// plus fading skid-mark quads for hard cornering.
import { THREE } from './three.js';

const MAX = 320;

export function createParticles(scene) {
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAX; i++) {
    parts.push({ life: 0, vx: 0, vy: 0, vz: 0, x: 0, y: -100, z: 0 });
    positions[i * 3 + 1] = -100;
  }
  let cursor = 0;

  // Skid marks: a pool of dark quads on the road that fade out.
  const skidGeo = new THREE.PlaneGeometry(0.5, 1.6);
  const skids = [];
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(
      skidGeo,
      new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.07;
    m.visible = false;
    scene.add(m);
    skids.push({ mesh: m, life: 0 });
  }
  let skidCursor = 0;

  function burst(x, y, z, colorHex, count, speed, up = 3) {
    const c = new THREE.Color(colorHex);
    for (let n = 0; n < count; n++) {
      const p = parts[cursor];
      cursor = (cursor + 1) % MAX;
      p.life = 0.5 + Math.random() * 0.5;
      p.x = x;
      p.y = y;
      p.z = z;
      const a = Math.random() * Math.PI * 2;
      const r = (0.3 + Math.random() * 0.7) * speed;
      p.vx = Math.cos(a) * r;
      p.vz = Math.sin(a) * r;
      p.vy = Math.random() * up;
      const i = parts.indexOf(p);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.attributes.color.needsUpdate = true;
  }

  function addSkid(x, z, heading) {
    const s = skids[skidCursor];
    skidCursor = (skidCursor + 1) % skids.length;
    s.mesh.position.set(x, 0.07, z);
    s.mesh.rotation.z = -heading;
    s.mesh.visible = true;
    s.mesh.material.opacity = 0.55;
    s.life = 4;
  }

  function update(dt) {
    for (let i = 0; i < MAX; i++) {
      const p = parts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        positions[i * 3 + 1] = -100;
        continue;
      }
      p.vy -= 12 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) {
        p.y = 0.05;
        p.vy *= -0.3;
      }
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
    geo.attributes.position.needsUpdate = true;
    for (const s of skids) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.material.opacity = Math.max(0, s.life / 4) * 0.55;
      if (s.life <= 0) s.mesh.visible = false;
    }
  }

  return { burst, addSkid, update };
}
