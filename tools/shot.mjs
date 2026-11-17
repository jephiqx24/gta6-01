// Screenshot one URL: node tools/shot.mjs <url> <out.jpg> [width] [height]
// Waits for window.__shotReady (set by the game's shot mode), then captures
// the viewport — 1280x720 by default, the gate's long-side cap — and prints
// the console errors it saw, if any. A .jpg output is captured as JPEG
// (quality 85) so it lands under the 256 KiB screenshot cap.

import { openTab, sleep } from './cdp.mjs';

const [,, url, out, widthArg, heightArg] = process.argv;
if (!url || !out) {
  console.error('usage: node tools/shot.mjs <url> <out.jpg> [width] [height]');
  process.exit(2);
}
const width = Number(widthArg) || 1280;
const height = Number(heightArg) || 720;
const tab = await openTab(url, width, height);
try {
  try {
    await tab.waitFor('window.__shotReady === true', 300000);
  } catch {
    console.log('shot not ready in 120s; capturing anyway');
    await sleep(1500);
  }
  await sleep(300);
  await tab.screenshot(out);
  console.log('wrote', out);
  const errors = tab.consoleMessages.filter((m) => m.startsWith('error') || m.startsWith('exception'));
  if (errors.length > 0) console.log('console errors:\n' + errors.join('\n'));
  if (tab.failedRequests.length > 0) console.log('failed requests:\n' + tab.failedRequests.join('\n'));
} finally {
  tab.close();
}
process.exit(0);
