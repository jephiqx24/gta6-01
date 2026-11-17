// E2E play test: title -> start -> walk -> steal a car -> drive -> mission 1
// -> wanted/police -> BUSTED -> respawn -> save. Runs at low FX and a small
// viewport (software renderer); the game logic still runs in real time.
// Exits non-zero on failure.
import { launchGame, summarize, waitFor, GAME_URL } from './browser.mjs';

const { browser, page, errors, requests } = await launchGame(GAME_URL + '?fx=low', 800, 450);
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`);
  if (!ok) failed += 1;
};
const state = () => page.evaluate(() => window.__solara.state());
const sleep = (ms) => page.waitForTimeout(ms);

try {
  await waitFor(() => page.evaluate(() => !!window.__solara), 20000, '__solara hook');

  // 1. Title -> Start (click the real button).
  await page.click('#start-btn');
  await sleep(500);
  let s = await state();
  check('title -> playing', s.mode === 'playing', JSON.stringify(s.mode));
  check('mission 1 active', s.missionIndex === 0 && s.missionText.length > 0, s.missionText);

  // 2. Walk: hold W, the player must move.
  const p0 = await page.evaluate(() => ({ x: window.__solara.player.pos.x, z: window.__solara.player.pos.z }));
  await page.keyboard.down('KeyW');
  await sleep(2000);
  await page.keyboard.up('KeyW');
  const p1 = await page.evaluate(() => ({ x: window.__solara.player.pos.x, z: window.__solara.player.pos.z }));
  const walked = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  check('walk moves the player', walked > 5, `moved ${walked.toFixed(1)} m`);

  // 3. Steal a car: teleport next to a parked car, press E.
  await page.evaluate(() => {
    const g = window.__solara;
    const car = g.traffic.parked[0];
    g.player.pos.set(car.pos.x + 2, 0, car.pos.z);
    g.player.mesh.position.copy(g.player.pos);
  });
  await page.keyboard.press('KeyE');
  await sleep(400);
  s = await state();
  check('E steals a car', s.inCar === true, JSON.stringify(s.inCar));
  check('stealing raises wanted', s.wanted >= 1, `wanted=${s.wanted}`);

  // 4. Drive: hold W, the car must move and gain speed.
  const d0 = await page.evaluate(() => ({ x: window.__solara.player.car.pos.x, z: window.__solara.player.car.pos.z }));
  await page.keyboard.down('KeyW');
  await sleep(3000);
  await page.keyboard.up('KeyW');
  const d1 = await page.evaluate(() => ({ x: window.__solara.player.car.pos.x, z: window.__solara.player.car.pos.z }));
  const driven = Math.hypot(d1.x - d0.x, d1.z - d0.z);
  s = await state();
  check('drive moves the car', driven > 20, `drove ${driven.toFixed(1)} m, speed ${s.speed.toFixed(1)}`);

  // 5. Mission 1: teleport the car to each stage target and let it complete.
  await page.evaluate(() => {
    const g = window.__solara;
    const t = g.missions.stageTarget();
    g.player.car.pos.set(t.x, 0, t.z);
  });
  await sleep(600);
  s = await state();
  check('mission 1 stage 1 completes', s.missionStage === 1, `stage=${s.missionStage}`);
  await page.evaluate(() => {
    const g = window.__solara;
    const t = g.missions.stageTarget();
    g.player.car.pos.set(t.x, 0, t.z);
  });
  await sleep(600);
  s = await state();
  check('mission 1 completes and pays', s.missionsDone === 1 && s.cash === 600, `done=${s.missionsDone} cash=${s.cash}`);
  check('debt drops by the reward', s.debt === 4400, `debt=${s.debt}`);
  check('mission 2 starts', s.missionIndex === 1, `index=${s.missionIndex}`);

  // 6. Wanted/police: raise wanted, police cars must spawn and chase.
  await page.evaluate(() => {
    window.__solara.police.wanted = 3;
  });
  await sleep(1500);
  const policeCount = await page.evaluate(() => window.__solara.police.policeCars.length + window.__solara.police.officers.length);
  check('wanted 3 spawns police', policeCount >= 3, `units=${policeCount}`);

  // 7. BUSTED: get out, stand next to an officer, wait for the arrest.
  await page.keyboard.press('KeyE');
  await sleep(300);
  await page.evaluate(() => {
    const g = window.__solara;
    const off = g.police.officers[0];
    if (off) {
      g.player.pos.set(off.pos.x + 1, 0, off.pos.z);
      g.player.mesh.position.copy(g.player.pos);
    }
  });
  await waitFor(async () => (await state()).mode === 'busted', 12000, 'BUSTED');
  s = await state();
  check('officer arrest shows BUSTED', s.mode === 'busted');

  // 8. Respawn: wanted cleared, health restored, playing again.
  await waitFor(async () => (await state()).mode === 'playing', 8000, 'respawn');
  s = await state();
  check('respawn clears wanted', s.wanted === 0, `wanted=${s.wanted}`);
  check('respawn restores health', s.health === 100, `health=${s.health}`);
  check('respawn keeps progress', s.missionsDone === 1 && s.cash === 600, `done=${s.missionsDone} cash=${s.cash}`);

  // 9. Save exists in localStorage.
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('solara-city-save-v1');
    return raw ? JSON.parse(raw) : null;
  });
  check('save written to localStorage', !!saved && saved.missionsDone === 1 && saved.cash === 600, JSON.stringify(saved));

  const sum = summarize('e2e', errors, requests);
  check('0 console errors', sum.errors === 0);
  check('0 foreign network requests', sum.foreign === 0);
} catch (e) {
  console.log('FAIL e2e threw:', e.message);
  failed += 1;
} finally {
  await browser.close();
}
console.log(failed === 0 ? 'E2E: ALL PASS' : `E2E: ${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
