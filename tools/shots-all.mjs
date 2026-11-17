// Take all four Solara City screenshots in order.
// Usage: node tools/shots-all.mjs [outDir]
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] || '/tmp/shots';
mkdirSync(outDir, { recursive: true });
const base = 'file:///home/hatch/workspace/makefun/gta6-01/game/index.html';
const shots = [
  ['cover', '1-cover.png'],
  ['street', '2-street.png'],
  ['chase', '3-chase.png'],
  ['mission', '4-mission.png'],
];
for (const [shot, file] of shots) {
  console.log(`--- ${shot} -> ${file}`);
  try {
    const out = execSync(
      `node tools/shot.mjs "${base}?shot=${shot}&seed=7" "${outDir}/${file}"`,
      { cwd: '/home/hatch/workspace/makefun/gta6-01', timeout: 300000, encoding: 'utf8' },
    );
    console.log(out);
  } catch (e) {
    console.log(`FAILED ${shot}:`, (e.stdout || '') + (e.stderr || e.message));
  }
}
console.log('done');
