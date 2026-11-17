// End-to-end play test: title -> start -> walk -> steal a car -> drive ->
// wanted rises -> mission begins -> busted -> respawn. The simulation is
// advanced with the game's stepSim hook (headless software rendering runs
// far below 60 fps, so wall-clock key holds would under-advance the game);
// keys are still sent through real CDP input events.
// Usage: node tools/e2e.mjs [url]
// Default URL is SOLARA_BASE (or http://localhost:8080) + /index.html?seed=7;
// pass a file:// URL to test over file:// instead. Requests to the game's
// own origin (localhost server or file://) are not foreign.

import { openTab, sleep } from './cdp.mjs';

const base = process.env.SOLARA_BASE || 'http://localhost:8080';
const url = process.argv[2] || `${base.replace(/\/$/, '')}/index.html?seed=7`;
const origin = new URL(url).origin;
const tab = await openTab(url, 1280, 720);
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
async function pressKey(code, keyName) {
  await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code });
  await sleep(800);
  await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code });
  await sleep(400);
}
async function stepSim(seconds, move) {
  await tab.evaluate(`window.__solara.stepSim(${seconds}, ${JSON.stringify(move || { x: 0, y: 0 })})`);
  await sleep(300);
}
async function state() {
  return tab.evaluate(`(() => {
    const g = window.__solara.game;
    return {
      screen: g.screen,
      x: +g.player.x.toFixed(1), z: +g.player.z.toFixed(1),
      onFoot: g.player.onFoot, health: Math.round(g.player.health),
      wanted: g.police.wanted,
      speed: g.player.car ? +g.player.car.speed.toFixed(1) : 0,
      mission: g.missions.active ? g.missions.active.def.id + ':' + g.missions.active.step : 'none',
      cash: g.missions.cash, debt: g.missions.debt,
      policeCars: g.police.cars.length, officers: g.police.officers.length,
      traffic: g.traffic.cars.length, parked: g.traffic.parked.length,
    };
  })()`);
}

try {
  await tab.waitFor('window.__solara !== undefined', 20000);
  await sleep(2000);
  let s = await state();
  check('boots to title screen', s.screen === 'title', JSON.stringify(s));

  await tab.evaluate(`document.getElementById('btn-start').click()`);
  await sleep(800);
  s = await state();
  check('start button begins play', s.screen === 'play', JSON.stringify(s));

  // Walk forward (2 s of game time).
  const x0 = s.x;
  const z0 = s.z;
  await stepSim(2, { x: 0, y: 1 });
  s = await state();
  check('WASD walks the player', Math.hypot(s.x - x0, s.z - z0) > 2, `moved ${Math.hypot(s.x - x0, s.z - z0).toFixed(1)}m`);

  // Stand beside a parked car and steal it with a real E keypress.
  await tab.evaluate(`(() => {
    const g = window.__solara.game;
    const car = g.traffic.parked[0];
    g.player.place(car.x + 2.5, car.z + 1, 0);
  })()`);
  await pressKey('KeyE', 'e');
  await stepSim(0.5);
  s = await state();
  check('E steals the car', !s.onFoot, JSON.stringify(s));
  check('stealing raises wanted to 1', s.wanted === 1, `wanted=${s.wanted}`);

  // Drive forward (3 s of game time), sampling speed along the way: a
  // police ram or a traffic knock at the end of the window can stop the
  // car, so the check is the peak speed and the distance covered, not the
  // instantaneous speed at the last frame.
  const dx0 = s.x;
  const dz0 = s.z;
  let maxSpeed = 0;
  for (let i = 0; i < 6; i++) {
    await stepSim(0.5, { x: 0, y: 1 });
    s = await state();
    maxSpeed = Math.max(maxSpeed, Math.abs(s.speed));
  }
  check('car drives and gains speed', maxSpeed > 5 && Math.hypot(s.x - dx0, s.z - dz0) > 20, `peak speed=${maxSpeed} m/s, moved ${Math.hypot(s.x - dx0, s.z - dz0).toFixed(1)}m`);

  // Mission 1 auto-begins at its start marker (the club).
  await tab.evaluate(`(() => {
    const g = window.__solara.game;
    const pos = g.missions.startPos();
    g.player.car.x = pos.x + 4;
    g.player.car.z = pos.z + 4;
    g.player.car.speed = 0;
    g.player.car.syncMesh(0);
    g.player.x = pos.x + 4;
    g.player.z = pos.z + 4;
  })()`);
  await stepSim(1);
  s = await state();
  check('mission 1 begins at its marker', s.mission.startsWith('first-fare'), s.mission);

  // Wanted 3 spawns police.
  await tab.evaluate(`window.__solara.game.police.setWanted(3)`);
  await stepSim(2);
  s = await state();
  check('wanted 3 brings police cars', s.policeCars >= 3, `policeCars=${s.policeCars}, officers=${s.officers}`);

  // Busted: get out and let an officer stand on the player.
  await tab.evaluate(`(() => {
    const g = window.__solara.game;
    if (g.player.car) g.player.exitCar();
    g.police.spawnOfficer(g.player.x + 0.5, g.player.z + 0.5);
  })()`);
  await stepSim(4);
  s = await state();
  check('officer arrest ends in BUSTED', s.screen === 'over', `screen=${s.screen}`);

  // Respawn through the real button.
  await tab.evaluate(`document.getElementById('btn-retry').click()`);
  await sleep(800);
  s = await state();
  check('respawn returns to play, wanted cleared', s.screen === 'play' && s.wanted === 0 && s.health === 100, JSON.stringify(s));

  const saved = await tab.evaluate(`!!localStorage.getItem('solara-city-save-v1')`);
  check('save written to localStorage', saved === true);

  const errors = tab.consoleMessages.filter((m) => m.startsWith('error') || m.startsWith('exception'));
  check('zero console errors', errors.length === 0, errors.join(' | '));
  const foreign = tab.requests.filter((u) => {
    if (u.startsWith('data:') || u.startsWith('chrome')) return false;
    if (u.startsWith(origin)) return false;
    if (origin === 'null' && u.startsWith('file://')) return false; // file:// pages
    return true;
  });
  check('zero foreign network requests', foreign.length === 0, foreign.join(', '));
} finally {
  tab.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? 'ALL E2E CHECKS PASSED' : `${failed} E2E CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
