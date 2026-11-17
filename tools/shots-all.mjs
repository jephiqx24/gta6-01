// Take all four Solara City screenshots in order, as JPEGs into the repo's
// screenshots/ folder (or the outDir given).
// Usage: node tools/shots-all.mjs [outDir]
// The game URL comes from SOLARA_BASE (default http://localhost:8080);
// set SOLARA_BASE to a file:// URL to capture over file:// instead.
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] || join(repoRoot, 'screenshots');
mkdirSync(outDir, { recursive: true });
const base = (process.env.SOLARA_BASE || 'http://localhost:8080').replace(/\/$/, '') + '/index.html';
const shots = [
  ['cover', '1-cover.jpg'],
  ['street', '2-street.jpg'],
  ['chase', '3-chase.jpg'],
  ['mission', '4-mission.jpg'],
];
for (const [shot, file] of shots) {
  console.log(`--- ${shot} -> ${file}`);
  try {
    const out = execSync(
      `node tools/shot.mjs "${base}?shot=${shot}&seed=7" "${join(outDir, file)}"`,
      { cwd: repoRoot, timeout: 300000, encoding: 'utf8' },
    );
    console.log(out);
  } catch (e) {
    console.log(`FAILED ${shot}:`, (e.stdout || '') + (e.stderr || e.message));
  }
}
console.log('done');
