// HUD: wanted stars, cash, debt, health, speed, the mission banner, and a
// 2D minimap drawn on a canvas (streets, player arrow, mission marker, police).
import { WORLD } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const stars = el('stars');
  const cash = el('cash');
  const debt = el('debt');
  const healthFill = el('health-fill');
  const speed = el('speed');
  const banner = el('banner');
  const bannerText = el('banner-text');
  const bannerMeta = el('banner-meta');
  const minimap = el('minimap');
  const ctx = minimap.getContext('2d');
  const size = minimap.width;
  const scale = size / (WORLD.half * 2 + 20);

  function toMap(x, z) {
    return [(x + WORLD.half + 10) * scale, (z + WORLD.half + 10) * scale];
  }

  function drawMinimap(state) {
    ctx.fillStyle = '#10131a';
    ctx.fillRect(0, 0, size, size);
    // Sea on the east edge.
    const [seaX] = toMap(WORLD.seaX, 0);
    ctx.fillStyle = '#1d4e6b';
    ctx.fillRect(seaX, 0, size - seaX, size);
    // Streets.
    ctx.strokeStyle = '#3a3f4a';
    ctx.lineWidth = 5;
    for (const line of WORLD.lines) {
      const [x1, y1] = toMap(line, -WORLD.half);
      const [x2, y2] = toMap(line, WORLD.half);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [x3, y3] = toMap(-WORLD.half, line);
      const [x4, y4] = toMap(WORLD.half, line);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }
    // Mission marker.
    if (state.missionTarget) {
      const [mx, my] = toMap(state.missionTarget.x, state.missionTarget.z);
      const pulse = 4 + Math.sin(performance.now() / 250) * 1.5;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(mx, my, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(mx, my, pulse + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Police as red dots.
    ctx.fillStyle = '#ff3344';
    for (const p of state.policeCars) {
      const [px, py] = toMap(p.pos.x, p.pos.z);
      ctx.beginPath();
      ctx.arc(px, py, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const o of state.officers) {
      const [px, py] = toMap(o.pos.x, o.pos.z);
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Traffic as small grey dots.
    ctx.fillStyle = '#9aa0aa';
    for (const c of state.trafficCars) {
      const [px, py] = toMap(c.pos.x, c.pos.z);
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }
    // Player arrow, rotated by heading (north is -z, up on the map).
    const [px, py] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-state.playerHeading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North marker.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('N', size - 12, 12);
  }

  function update(state) {
    stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    stars.className = state.wanted > 0 ? 'hot' : '';
    cash.textContent = `$${state.cash.toLocaleString('en-US')}`;
    debt.textContent = `Debt: $${state.debt.toLocaleString('en-US')}`;
    healthFill.style.width = `${Math.max(0, state.health)}%`;
    healthFill.style.background = state.health > 50 ? '#4fc25a' : state.health > 25 ? '#e8a13a' : '#e83a3a';
    if (state.inCar) {
      speed.style.display = 'block';
      speed.textContent = `${Math.round(state.speedKmh)} km/h`;
    } else {
      speed.style.display = 'none';
    }
    if (state.missionText) {
      banner.style.display = 'block';
      bannerText.textContent = state.missionText;
      const parts = [];
      if (state.timeLeft !== null) parts.push(fmtTime(state.timeLeft));
      if (state.distToTarget !== null) parts.push(`${Math.round(state.distToTarget)} m`);
      if (state.passengerAboard) parts.push('Passenger aboard');
      bannerMeta.textContent = parts.join(' • ');
      banner.className = state.failFlash > 0 ? 'fail' : '';
    } else {
      banner.style.display = 'none';
    }
    drawMinimap(state);
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function show(id) {
    const e = el(id);
    if (e) e.style.display = 'flex';
  }
  function hide(id) {
    const e = el(id);
    if (e) e.style.display = 'none';
  }

  return { update, show, hide };
}
