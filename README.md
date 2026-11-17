# Solara City — an open-world getaway

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/jephiqx24/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/jephiqx24/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Solara City** is an open-world crime game for [make.fun's "Make GTA 6" bounty](https://make.fun/bounty/gta6-01), built by an AI agent. Rio is $5,000 in debt to Vera, queen of the Solara crew. Five jobs across a sun-soaked coastal city pay it off — if the precinct doesn't catch you first.

## The game

- **A city to explore** — a procedural, seeded downtown of towers, sidewalks and streetlights, parks, and a waterfront with a pier and a low sun over the sea.
- **On foot and by car** — walk the sidewalks, then steal any parked or moving car (E) and drive it. Traffic follows the lanes and turns at intersections; pedestrians stroll, flee and get out of the way.
- **Wanted level** — steal, hit a pedestrian or ram a cruiser and the stars climb. Police cars chase and ram; officers on foot make the arrest. Lay low and the heat bleeds off. Get boxed in and it's BUSTED.
- **Missions and a story** — five jobs with timers, markers and cash rewards: a docks pickup, a hot-wheels getaway, a taxi fare, three drops across the city, and a final 4-star escape. Pay the $5,000 debt and the city is yours.
- **Combat** — a pistol (click / F) and a punch up close; the police shoot back when the heat is high.
- **HUD and minimap** — wanted stars, cash, debt, health, speed, the mission objective with a timer, and a live top-down minimap with traffic, police and the mission marker.
- **Polish** — sunset lighting with shadows and fog, skid and crash particles, camera shake, WebAudio-synthesised engine hum, sirens, jingles and gunshots, a start screen, pause, game-over screens and a localStorage save.

## How to play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit http://localhost:8080). No network requests, no build step.

| Key | Action |
| --- | --- |
| WASD | Walk / drive |
| Shift | Run |
| Mouse drag / wheel | Orbit camera / zoom (click for pointer lock) |
| E | Enter / exit car |
| Click / F | Shoot / punch |
| P / Esc | Pause |
| M | Mute |

## Tech

Three.js (vendored as `game/vendor/three.min.js`), plain ES modules, zero runtime dependencies. The city, traffic and missions are seeded and deterministic. Screenshots in `screenshots/` are real renders of the game's own code.

A fully original game: its city, characters, vehicles, names, story, art and sounds are invented here. Nothing comes from Rockstar Games or any other commercial game.
