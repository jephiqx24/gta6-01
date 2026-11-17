# Solara City

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/jephiqx24/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/jephiqx24/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01).

Rio owes $5,000 to crew boss Vera. Five jobs stand between him and a clean slate: run the fares, steal the fast car, drive the cabbie, pull the getaway, and deliver the final payoff — while the Solara PD hunts him down.

## Play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static server, e.g. `node serve.ts` and visit http://localhost:8080).

- **WASD** move / drive, **Shift** run
- **E** enter / exit a car (any traffic or parked car is yours for the taking — the police will notice)
- **Click / F** shoot the pistol, punch up close
- **Mouse drag** orbit the camera, **P** pause, **M** mute

## The city

A seeded procedural city at sunset: downtown towers, houses, parks, a waterfront with a sea and a pier. Traffic drives the grid and stops for lights, pedestrians walk the sidewalks and run from danger, and the wanted level brings police cars and foot officers after you. Five story missions pay the debt off, one at a time. Progress saves automatically in your browser.

## Tech

- Three.js 0.160.0, vendored under `game/vendor/`
- All art is procedural and code-drawn; all sound is synthesised with WebAudio
- Static files only — zero network requests at runtime
- `main.ts` hands the entry in with the kit's `buildDossier`
