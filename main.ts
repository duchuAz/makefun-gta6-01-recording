// PUERTO SOL: NEON TIDE — a fresh gta6-01 entry built on vendored three.js.
// This directory is the game: game/index.html boots ten original ES modules for an
// open-world coastal crime story, while screenshots/ holds four deterministic frames.
// This program copies game/ and screenshots/ beside itself into the output directory,
// then writes dossier.json for the judge using the local make.fun helper. No network,
// no borrowed assets, no recorded sessions: just the boulevard at golden hour.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node --experimental-strip-types main.ts
//
// The story: Teo Cruz drives a coral Solara 88 through Puerto Sol, collecting a ledger
// from Casa Neon and running drops for the people who own the tide. Original city,
// characters, cars, radio and synth soundtrack; rendered in real time with three.js.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const ENTRY_TITLE = 'PUERTO SOL: NEON TIDE';
const ENTRY_FRAME = 'PUERTO SOL / NEON TIDE / BAHÍA DE SOL';
const ENTRY_SHOTS = ['1-cover.png', '2-drive.png', '3-chase.png', '4-mission.png'];

console.log(`[puerto-sol] ${ENTRY_TITLE} — staging an open-world entry`);
console.log(`[puerto-sol] ${ENTRY_FRAME} · 3 story jobs · 4 judged frames`);
console.log(`[puerto-sol] frames: ${ENTRY_SHOTS.join(' · ')}`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`[puerto-sol] staged game/ + screenshots/ + dossier.json → ${out}`);
if (!existsSync(join(out, 'dossier.json'))) throw new Error('dossier.json was not written');
