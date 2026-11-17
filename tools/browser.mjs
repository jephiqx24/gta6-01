// Shared headless-browser helper for Solara City tests. Launches Playwright's
// Chromium, opens the game over file:// (ES modules need the file-access flag),
// and records console errors plus any network request that is not a local file.
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const GAME_URL =
  'file://' + join(dirname(fileURLToPath(import.meta.url)), '..', 'game', 'index.html');

export async function launchGame(url = GAME_URL, width = 1280, height = 720) {
  const browser = await chromium.launch({
    // The headless shell does not drive requestAnimationFrame; use full Chromium.
    executablePath: process.env.CHROME_PATH || '/home/hatch/.cache/ms-playwright/chromium-1148/chrome-linux/chrome',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-angle=swiftshader',
      '--allow-file-access-from-files',
      '--mute-audio',
    ],
  });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  const requests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('request', (req) => requests.push(req.url()));
  page.on('requestfailed', (req) => errors.push(`request failed: ${req.url()} ${req.failure()?.errorText || ''}`));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  return { browser, page, errors, requests };
}

export function foreignRequests(requests) {
  return requests.filter((u) => !u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('blob:'));
}

export async function waitFor(fn, timeoutMs = 15000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timed out waiting for ${label}`);
}

export function summarize(name, errors, requests) {
  const foreign = foreignRequests(requests);
  console.log(`--- ${name} ---`);
  console.log(`console errors: ${errors.length}`);
  for (const e of errors) console.log(`  ERR ${e}`);
  console.log(`network requests: ${requests.length}, foreign: ${foreign.length}`);
  for (const u of foreign) console.log(`  FOREIGN ${u}`);
  return { errors: errors.length, foreign: foreign.length };
}
