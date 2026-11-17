// Particles and camera shake: skid smoke, crash bursts, muzzle flashes,
// pickup sparkles. One Points cloud per burst type, recycled, so no
// allocation happens while playing.

const THREE = window.THREE;
const MAX_PARTICLES = 600;

/** A small pool of point sprites with velocity, life and colour. */
export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.vel = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.45,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.shake = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) this.positions[i * 3 + 1] = -100;
  }

  spawn(x, y, z, count, color, speed, life, up = 0.5) {
    for (let n = 0; n < count; n++) {
      const i = this.head;
      this.head = (this.head + 1) % MAX_PARTICLES;
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.vel[i * 3] = Math.cos(a) * s;
      this.vel[i * 3 + 1] = Math.random() * speed * up;
      this.vel[i * 3 + 2] = Math.sin(a) * s;
      this.colors[i * 3] = ((color >> 16) & 255) / 255;
      this.colors[i * 3 + 1] = ((color >> 8) & 255) / 255;
      this.colors[i * 3 + 2] = (color & 255) / 255;
      this.life[i] = life * (0.6 + Math.random() * 0.4);
      this.maxLife[i] = this.life[i];
    }
  }

  skid(x, z) {
    this.spawn(x, 0.3, z, 2, 0xbbbbbb, 1.2, 0.7, 0.4);
  }

  crash(x, z) {
    this.spawn(x, 1, z, 14, 0xffa040, 7, 0.6, 0.9);
    this.spawn(x, 0.6, z, 8, 0x888888, 3, 1.0, 0.5);
    this.shake = Math.max(this.shake, 0.5);
  }

  muzzle(x, y, z) {
    this.spawn(x, y, z, 6, 0xffe080, 6, 0.18, 0.2);
  }

  sparkle(x, y, z) {
    this.spawn(x, y, z, 18, 0xffd24a, 2.5, 0.9, 1);
  }

  addShake(amount) {
    this.shake = Math.min(1, this.shake + amount);
  }

  /** Camera shake offset for this frame (decays on its own). */
  shakeOffset(dt) {
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const s = this.shake * this.shake * 0.35;
    return {
      x: (Math.random() - 0.5) * s,
      y: (Math.random() - 0.5) * s,
    };
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -100;
        continue;
      }
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 6 * dt;
      const fade = this.life[i] / this.maxLife[i];
      this.colors[i * 3] *= 0.995;
      this.colors[i * 3 + 1] *= 0.995;
      this.colors[i * 3 + 2] *= 0.995;
      void fade;
    }
    if (any) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  }
}
