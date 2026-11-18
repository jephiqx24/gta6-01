// Solara City — entrypoint: stage game/ + screenshots/ into the output directory and write dossier.json.
// The grader runs `node /bot/main.ts` with the repo read-only at /bot and a writable /output.
// The output directory may be a mounted volume, so it is never removed itself: only the entries inside it
// are cleared, which is safe for a plain directory and for a mount point alike.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory holding this entrypoint file.
const repoRoot = dirname(fileURLToPath(import.meta.url));
// The output directory comes from the environment, defaulting to /output.
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// Refuse to run when the output directory would wipe the repository or the filesystem root.
if (outputDir === resolve(repoRoot)) {
  throw new Error('refusing: the output directory is the repository root');
}
if (outputDir === resolve(sep)) {
  throw new Error('refusing: the output directory is the filesystem root');
}

// Create the output directory when it does not exist yet.
mkdirSync(outputDir, { recursive: true });

// Clear only the entries inside the output directory, leaving the directory itself in place.
for (const entry of readdirSync(outputDir)) {
  rmSync(join(outputDir, entry), { recursive: true, force: true });
}

// Stage the game and its screenshots from the repository into the output directory.
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });

// Build the dossier from the staged output and write it next to the staged files.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
