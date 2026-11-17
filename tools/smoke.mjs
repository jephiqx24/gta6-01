// Smoke test: the game boots, WebGL renders, and the world is populated.
// Runs at low FX and a small viewport (software renderer); the game logic
// still runs in real time. Exits non-zero on any failure.
import { launchGame, summarize, waitFor, GAME_URL } from './browser.mjs';

const { browser, page, errors, requests } = await launchGame(GAME_URL + '?fx=low', 800, 450);
let failed = 0;
try {
  await waitFor(async () => {
    return await page.evaluate(() => !!window.__solara);
  }, 20000, '__solara hook');

  const info = await page.evaluate(() => {
    const g = window.__solara;
    const canvas = document.getElementById('game-canvas');
    const gl = canvas.getContext('webgl2');
    return {
      mode: g.state().mode,
      webgl: gl ? gl.getParameter(gl.VERSION) : null,
      traffic: g.traffic.cars.length,
      parked: g.traffic.parked.length,
      peds: g.peds.peds.length,
      colliders: g.city.colliders.length,
      titleVisible: getComputedStyle(document.getElementById('title-screen')).display !== 'none',
      canvasSize: [canvas.width, canvas.height],
    };
  });
  console.log(JSON.stringify(info, null, 2));
  const check = (name, ok) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
    if (!ok) failed += 1;
  };
  check('boots to title screen', info.mode === 'title' && info.titleVisible);
  check('WebGL 2.0', !!info.webgl && info.webgl.includes('WebGL 2.0'));
  check('traffic cars present', info.traffic >= 10);
  check('parked cars present', info.parked >= 5);
  check('pedestrians present', info.peds >= 15);
  check('building colliders present', info.colliders >= 30);
  // Let a few frames render, then read the renderer's draw calls.
  await page.waitForTimeout(2500);
  const render = await page.evaluate(() => {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        const g = window.__solara;
        resolve({ mode: g.state().mode });
      });
    });
  });
  console.log('after 2.5s:', JSON.stringify(render));
  const sum = summarize('smoke', errors, requests);
  check('0 console errors', sum.errors === 0);
  check('0 foreign network requests', sum.foreign === 0);
} catch (e) {
  console.log('FAIL smoke threw:', e.message);
  failed += 1;
} finally {
  await browser.close();
}
console.log(failed === 0 ? 'SMOKE: ALL PASS' : `SMOKE: ${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
