// Screenshot capture: loads each staged shot (?shot=...) and saves a real
// 1280x720 JPEG render into screenshots/. Exits non-zero on failure.
import { launchGame, summarize } from './browser.mjs';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHOTS = [
  { shot: 'cover', file: '1-cover.jpg' },
  { shot: 'street', file: '2-street.jpg' },
  { shot: 'chase', file: '3-chase.jpg' },
  { shot: 'mission', file: '4-mission.jpg' },
];
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'screenshots');
mkdirSync(outDir, { recursive: true });

let failed = 0;
for (const { shot, file } of SHOTS) {
  const url = `file://${join(dirname(fileURLToPath(import.meta.url)), '..', 'game', 'index.html')}?shot=${shot}&seed=1`;
  const { browser, page, errors, requests } = await launchGame(url);
  try {
    await page.waitForFunction(() => !!window.__solara, null, { timeout: 20000 });
    // Let the scene settle and the car drive into frame.
    await page.waitForTimeout(3500);
    const state = await page.evaluate(() => window.__solara.state());
    console.log(`${shot}: mode=${state.mode} wanted=${state.wanted} mission="${state.missionText}"`);
    const outPath = join(outDir, file);
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 82 });
    const size = statSync(outPath).size;
    const ok = size <= 262144;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${file}: ${size} bytes (cap 262144)`);
    if (!ok) failed += 1;
    const sum = summarize(`shot ${shot}`, errors, requests);
    if (sum.errors !== 0 || sum.foreign !== 0) failed += 1;
  } catch (e) {
    console.log(`FAIL shot ${shot} threw:`, e.message);
    failed += 1;
  } finally {
    await browser.close();
  }
}
console.log(failed === 0 ? 'SHOTS: ALL PASS' : `SHOTS: ${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
