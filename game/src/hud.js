// HUD: the DOM overlay (wanted stars, cash, health, debt, objective, speed,
// toasts) and the 2D canvas minimap — streets, the player arrow, cars,
// police and the mission marker, all from the same city data as the 3D world.

import { STREET_COUNT, streetAt, WATER_X } from './config.js';

const MAP_SIZE = 200;
const WORLD = 520; // -260..260

function toMap(v) {
  return ((v + WORLD / 2) / WORLD) * MAP_SIZE;
}

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      stars: document.getElementById('stars'),
      cash: document.getElementById('cash'),
      debt: document.getElementById('debt'),
      healthFill: document.getElementById('health-fill'),
      objective: document.getElementById('objective'),
      speed: document.getElementById('speed'),
      toast: document.getElementById('toast'),
      crosshair: document.getElementById('crosshair'),
      vignette: document.getElementById('vignette'),
      banner: document.getElementById('banner'),
    };
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.toastTimer = null;
    this.lastStars = -1;
  }

  show() {
    this.el.hud.classList.remove('hidden');
  }

  hide() {
    this.el.hud.classList.add('hidden');
  }

  toast(text, ms = 3500) {
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.add('hidden'), ms);
  }

  flashDamage() {
    this.el.vignette.style.opacity = '0.85';
    setTimeout(() => { this.el.vignette.style.opacity = '0'; }, 120);
  }

  showBanner(text) {
    this.el.banner.textContent = text;
    this.el.banner.classList.remove('hidden');
    setTimeout(() => this.el.banner.classList.add('hidden'), 6000);
  }

  update(game) {
    const player = game.player;
    const wanted = game.police.wanted;
    if (wanted !== this.lastStars) {
      this.lastStars = wanted;
      this.el.stars.textContent = '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
      this.el.stars.classList.toggle('hot', wanted > 0);
    }
    this.el.cash.textContent = `$${game.missions.cash.toLocaleString('en-US')}`;
    this.el.debt.textContent = game.missions.debt > 0
      ? `Debt: $${game.missions.debt.toLocaleString('en-US')}`
      : 'Debt paid!';
    this.el.healthFill.style.width = `${Math.max(0, player.health)}%`;
    this.el.healthFill.classList.toggle('low', player.health < 35);
    this.el.objective.textContent = game.missions.objectiveText();
    const dist = game.missions.objectiveDistance(player);
    if (dist > 0) this.el.objective.textContent += `  •  ${Math.round(dist)} m`;
    if (player.car) {
      const kmh = Math.round(Math.abs(player.car.speed) * 3.6);
      this.el.speed.textContent = `${kmh} km/h`;
      this.el.speed.classList.remove('hidden');
    } else {
      this.el.speed.classList.add('hidden');
    }
    this.el.crosshair.classList.toggle('hidden', !player.onFoot || !player.hasPistol);
    this.drawMinimap(game);
  }

  drawMinimap(game) {
    const ctx = this.mapCtx;
    const S = MAP_SIZE;
    ctx.clearRect(0, 0, S, S);
    // Sea on the east edge.
    ctx.fillStyle = '#2e6f8e';
    ctx.fillRect(toMap(WATER_X - 16), 0, S - toMap(WATER_X - 16), S);
    ctx.fillStyle = '#8f8271';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#2e6f8e';
    ctx.fillRect(toMap(WATER_X - 16), 0, S - toMap(WATER_X - 16), S);
    // Streets.
    ctx.fillStyle = '#3a3f47';
    for (let i = 0; i < STREET_COUNT; i++) {
      const c = toMap(streetAt(i));
      ctx.fillRect(c - 2.5, 0, 5, S);
      ctx.fillRect(0, c - 2.5, S, 5);
    }
    // Mission marker (pulsing).
    const marker = game.missions.markerPos();
    if (marker) {
      const pulse = 5 + Math.sin(performance.now() / 300) * 1.5;
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.arc(toMap(marker.x), toMap(marker.z), pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a5a00';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Pedestrians (a few, faint).
    ctx.fillStyle = 'rgba(220,220,220,0.7)';
    for (let i = 0; i < game.peds.peds.length; i += 2) {
      const ped = game.peds.peds[i];
      ctx.fillRect(toMap(ped.x) - 1, toMap(ped.z) - 1, 2, 2);
    }
    // Traffic (white) and parked cars (grey).
    ctx.fillStyle = '#ffffff';
    for (const car of game.traffic.cars) {
      ctx.fillRect(toMap(car.x) - 1.5, toMap(car.z) - 1.5, 3, 3);
    }
    ctx.fillStyle = '#9a9aa2';
    for (const car of game.traffic.parked) {
      ctx.fillRect(toMap(car.x) - 1, toMap(car.z) - 1, 2, 2);
    }
    // Police (flashing red/blue).
    const flash = Math.floor(performance.now() / 250) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3030' : '#3050ff';
    for (const car of game.police.cars) {
      ctx.beginPath();
      ctx.arc(toMap(car.x), toMap(car.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const officer of game.police.officers) {
      ctx.fillRect(toMap(officer.x) - 1.5, toMap(officer.z) - 1.5, 3, 3);
    }
    // Player arrow.
    const px = toMap(game.player.x);
    const pz = toMap(game.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.PI - game.player.heading);
    ctx.fillStyle = '#ff7a30';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText('N', S - 12, 12);
  }
}
