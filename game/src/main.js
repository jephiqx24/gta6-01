// Solara City — boot, the one loop, the camera, the screens and every
// collision between the player and the world. Systems do their own work;
// this file wires them together and owns the screens.
//
// ?seed=N fixes the city. ?shot=cover|street|chase|mission stages a scene
// for screenshots instead of the title screen, drives it with an autopilot
// and sets window.__shotReady.

import { createRandom } from './rng.js';
import { buildCity } from './city.js';
import { TrafficManager } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Particles } from './particles.js';
import { AudioEngine } from './audio.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Missions, MISSION_DEFS } from './missions.js';
import { HUD } from './hud.js';
import { readSave, writeSave, clearSave } from './save.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_PUNCH, ACTION_MUTE } from './input.js';
import { shoot, punch, policeShoot } from './combat.js';
import { stageShot } from './shots.js';
import { CAR, PLAYER, streetAt } from './config.js';

const THREE = window.THREE;
const MAX_DT = 0.05;
const SHOT_FRAMES = 60;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;
const random = createRandom(seed);

// --- Renderer / scene -------------------------------------------------------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Systems ----------------------------------------------------------------
const city = buildCity(scene, random);
const traffic = new TrafficManager(scene, city, random);
const peds = new Pedestrians(scene, city, random);
const particles = new Particles(scene);
const audio = new AudioEngine();
const player = new Player(scene, city, random);
const police = new Police(scene, city, random);
const missions = new Missions(scene, city, random);
const hud = new HUD();
const input = createInput(canvas);

traffic.spawn();
peds.spawn();
player.place(streetAt(3) + 4, streetAt(3) + 4, Math.PI / 2);

// --- Game facade (what the systems read) ------------------------------------
const game = {
  scene, camera, renderer, city, traffic, peds, particles, audio, player, police, missions, hud,
  random,
  time: 0,
  screen: 'title',
  camYaw: Math.PI,
  camPitch: 0.32,
  camDist: 9,
  lastMouseAt: -99,
  shotAutopilot: null,
  shotFrames: 0,
  policeShootTimer: 0,
  crimeCooldown: 0,
  saveTimer: 0,
  celebratedDebt: false,
  onCrash(x, z, impact) {
    particles.crash(x, z);
    audio.thud(Math.min(1, impact / 18));
    particles.addShake(Math.min(0.6, impact / 30));
  },
};

police.onBusted = (reason) => {
  endGame('BUSTED', reason === 'arrested'
    ? 'An officer cuffed you on the sidewalk.'
    : 'The precinct boxed your car in.');
};
police.onWantedChange = (level) => {
  if (level > 0) audio.radio();
};
missions.onStart = (mission) => {
  hud.toast(`${mission.title} — ${mission.brief}`);
  announce(`Mission started: ${mission.title}.`);
};
missions.onStep = (mission, step) => {
  hud.toast(step.text);
};
missions.onComplete = (mission) => {
  hud.toast(`${mission.title} complete — +$${mission.reward}`);
  announce(`Mission complete: ${mission.title}. Earned $${mission.reward}.`);
  writeSave(game);
  if (missions.debtPaid && !game.celebratedDebt) {
    game.celebratedDebt = true;
    hud.showBanner('DEBT PAID — SOLARA CITY IS YOURS');
    announce('Debt paid. Solara City is yours.');
  }
};
missions.onFail = (mission, reason) => {
  hud.toast(`${mission.title} failed (${reason}) — return to the marker to retry`);
  announce(`Mission failed: ${reason}.`);
};

// --- Screens ----------------------------------------------------------------
const statusEl = document.getElementById('status');
const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const overEl = document.getElementById('over');
const btnStart = document.getElementById('btn-start');
const btnContinue = document.getElementById('btn-continue');

function announce(message) {
  statusEl.textContent = message;
}

function showOnly(el) {
  for (const other of [menuEl, pauseEl, overEl]) other.classList.add('hidden');
  if (el) el.classList.remove('hidden');
  hud.el.hud.classList.toggle('hidden', el !== null);
}

function startNewGame() {
  clearSave();
  missions.cash = 0;
  missions.debt = 5000;
  missions.done = [];
  missions.index = 0;
  missions.active = null;
  game.celebratedDebt = false;
  player.health = PLAYER.health;
  police.setWanted(0);
  player.place(streetAt(3) + 4, streetAt(3) + 4, Math.PI / 2);
  game.camYaw = Math.PI;
  game.screen = 'play';
  showOnly(null);
  hud.show();
  audio.ensure();
  announce('Playing. Reach the yellow marker to start your first job.');
}

function continueGame(save) {
  missions.cash = save.cash;
  missions.debt = save.debt;
  missions.done = save.done || [];
  missions.index = save.index || 0;
  player.health = save.health ?? PLAYER.health;
  player.place(save.x, save.z, save.heading || 0);
  game.camYaw = Math.PI;
  game.screen = 'play';
  showOnly(null);
  hud.show();
  audio.ensure();
  announce(`Welcome back. Debt remaining: $${missions.debt}.`);
}

function endGame(title, text) {
  game.screen = 'over';
  audio.setEngine(0);
  audio.setSiren(false);
  document.getElementById('over-title').textContent = title;
  document.getElementById('over-text').textContent = text;
  document.getElementById('over-stats').textContent =
    `Cash $${missions.cash.toLocaleString('en-US')}  •  Jobs done ${missions.done.length} of 5  •  Debt left $${missions.debt.toLocaleString('en-US')}`;
  showOnly(overEl);
  writeSave(game);
  announce(`${title}. ${text}`);
}

function respawn() {
  player.health = PLAYER.health;
  police.setWanted(0);
  for (const car of police.cars) {
    car.dead = true;
    scene.remove(car.mesh);
  }
  police.cars = [];
  for (const officer of police.officers) scene.remove(officer.mesh);
  police.officers = [];
  if (player.car) {
    player.exitCar();
  }
  player.place(streetAt(1), streetAt(6), 0);
  game.camYaw = Math.PI;
  game.screen = 'play';
  showOnly(null);
  hud.show();
  hud.toast('Back on the streets. Vera is still waiting.');
  announce('Playing.');
}

function pauseGame() {
  if (game.screen !== 'play') return;
  game.screen = 'paused';
  showOnly(pauseEl);
  writeSave(game);
  audio.setEngine(0);
  audio.setSiren(false);
  announce('Paused.');
}

function resumeGame() {
  if (game.screen !== 'paused') return;
  game.screen = 'play';
  showOnly(null);
  hud.show();
  announce('Playing.');
}

btnStart.addEventListener('click', () => {
  audio.ensure();
  startNewGame();
});
btnContinue.addEventListener('click', () => {
  audio.ensure();
  const save = readSave();
  if (save) continueGame(save);
});
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-quit').addEventListener('click', () => {
  game.screen = 'title';
  showOnly(menuEl);
  refreshTitleButtons();
});
document.getElementById('btn-retry').addEventListener('click', respawn);
document.getElementById('btn-over-quit').addEventListener('click', () => {
  game.screen = 'title';
  showOnly(menuEl);
  refreshTitleButtons();
});

function refreshTitleButtons() {
  btnContinue.classList.toggle('hidden', !readSave());
}
refreshTitleButtons();

// --- Camera -----------------------------------------------------------------
function updateCamera(dt) {
  const mouse = input.takeMouse();
  if (mouse.dx !== 0 || mouse.dy !== 0) {
    game.camYaw -= mouse.dx * 0.0045;
    game.camPitch = Math.max(0.06, Math.min(1.0, game.camPitch + mouse.dy * 0.0028));
    game.lastMouseAt = game.time;
  }
  const wheel = input.takeWheel();
  if (wheel !== 0) {
    game.camDist = Math.max(5, Math.min(16, game.camDist * (1 + wheel * 0.001)));
  }
  // In a car, the camera eases back behind the car when the mouse is idle.
  if (player.car && game.time - game.lastMouseAt > 1.5) {
    let diff = player.heading - game.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    game.camYaw += diff * Math.min(1, dt * 1.4);
  }
  const target = player.cameraTarget();
  const cp = Math.cos(game.camPitch);
  const sp = Math.sin(game.camPitch);
  const fx = Math.sin(game.camYaw);
  const fz = Math.cos(game.camYaw);
  const shake = particles.shakeOffset(dt);
  camera.position.set(
    target.x - fx * cp * game.camDist + shake.x,
    target.y + sp * game.camDist + shake.y,
    target.z - fz * cp * game.camDist,
  );
  camera.lookAt(target.x, target.y, target.z);
  // The sun's shadows follow the player.
  city.sun.position.set(player.x + 320, 130, player.z + 90);
  city.sun.target.position.set(player.x, 0, player.z);
}

// --- Player <-> world collisions --------------------------------------------
function collidePlayerCar(dt) {
  const car = player.car;
  if (!car) return;
  const before = { x: car.x, z: car.z };
  const fixed = city.resolveCircle({ x: car.x, z: car.z }, 1.9);
  const moved = Math.hypot(fixed.x - before.x, fixed.z - before.z);
  car.x = fixed.x;
  car.z = fixed.z;
  if (moved > 0.12 && Math.abs(car.speed) > 6) {
    car.speed *= 0.4;
    game.onCrash(car.x, car.z, Math.abs(car.speed) + 6);
  }
  // Other cars.
  const others = [...traffic.cars, ...traffic.parked, ...police.cars];
  for (const other of others) {
    if (other === car || other.dead) continue;
    const dx = car.x - other.x;
    const dz = car.z - other.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.1 && d > 0.01) {
      const push = (4.1 - d) / 2;
      const nx = dx / d;
      const nz = dz / d;
      car.x += nx * push;
      car.z += nz * push;
      const rel = Math.abs(car.speed - other.speed);
      car.speed *= 0.65;
      if (other.driver === 'traffic' || other.driver === 'parked') other.speed *= 0.5;
      if (rel > 7) {
        game.onCrash(car.x, car.z, rel);
        if (other.kind === 'police' && game.crimeCooldown <= 0) {
          police.commitCrime(1);
          game.crimeCooldown = 1.5;
        }
      }
      car.syncMesh(dt);
    }
  }
  // Pedestrians (and officers) in the way.
  for (const ped of peds.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(car.x - ped.x, car.z - ped.z);
    if (d < 2.1 && Math.abs(car.speed) > 1.5) {
      peds.knockDown(ped.x, ped.z, 0.5);
      police.commitCrime(1);
      peds.scare(ped.x, ped.z, 25);
      game.onCrash(car.x, car.z, 5);
      car.speed *= 0.8;
    }
  }
  for (const officer of [...police.officers]) {
    const d = Math.hypot(car.x - officer.x, car.z - officer.z);
    if (d < 2.1 && Math.abs(car.speed) > 1.5) {
      police.damageOfficer(officer, 3);
      police.commitCrime(1);
      game.onCrash(car.x, car.z, 5);
      car.speed *= 0.8;
    }
  }
  // Skid smoke when cornering hard.
  if (Math.abs(car.steer) > 0.45 && Math.abs(car.speed) > 12) {
    const back = { x: -Math.sin(car.heading) * 1.8, z: -Math.cos(car.heading) * 1.8 };
    particles.skid(car.x + back.x, car.z + back.z);
  }
}

function collidePlayerOnFoot(dt) {
  // Cars must not drive through the player on foot.
  const allCars = [...traffic.cars, ...police.cars];
  for (const car of allCars) {
    if (car.dead) continue;
    const d = car.distanceTo(player.x, player.z);
    if (d < 2.4) {
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const len = Math.hypot(dx, dz) || 1;
      player.x = car.x + (dx / len) * 2.4;
      player.z = car.z + (dz / len) * 2.4;
      if (Math.abs(car.speed) > 5 && game.crimeCooldown <= 0) {
        player.damage(20, game.time);
        hud.flashDamage();
        game.onCrash(player.x, player.z, 8);
        game.crimeCooldown = 1;
      }
      player.syncMesh();
    }
  }
}

// --- Actions ----------------------------------------------------------------
function tryEnterExitCar() {
  if (player.onFoot) {
    const car = traffic.nearestStealable(player.x, player.z, 3.4);
    if (!car) {
      // Maybe a police car is the closest stealable thing.
      let best = null;
      let bestD = 3.4;
      for (const pc of police.cars) {
        const d = pc.distanceTo(player.x, player.z);
        if (d < bestD) {
          bestD = d;
          best = pc;
        }
      }
      if (!best) return;
      player.enterCar(best);
      police.cars.splice(police.cars.indexOf(best), 1);
      police.commitCrime(1);
      peds.scare(player.x, player.z, 20);
      hud.toast('You stole a police cruiser. Bold.');
      return;
    }
    const wasParked = car.driver === 'parked';
    if (car.driver === 'traffic') {
      // The driver bails and runs.
      peds.scare(car.x, car.z, 12);
      traffic.remove(car);
    } else {
      traffic.remove(car);
    }
    player.enterCar(car);
    scene.add(car.mesh);
    police.commitCrime(1);
    peds.scare(car.x, car.z, 20);
    hud.toast(wasParked ? 'Hot-wired. The owner will notice.' : 'Carjacked. The driver ran for it.');
    missions.onEnterCar(game);
    audio.ensure();
  } else if (Math.abs(player.car.speed) < 3) {
    const car = player.exitCar();
    if (car) {
      traffic.parked.push(car);
      audio.setEngine(0);
    }
  } else {
    hud.toast('Slow down to get out.');
  }
}

function tryShootOrPunch() {
  if (!player.onFoot || !player.hasPistol) return;
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const dir = { x: camDir.x, z: camDir.z };
  const len = Math.hypot(dir.x, dir.z) || 1;
  dir.x /= len;
  dir.z /= len;
  // A target right in front gets a punch instead of a bullet.
  const hit = punch(game, { x: player.x, z: player.z }, dir);
  if (hit) {
    audio.thud(0.6);
    return;
  }
  audio.gunshot();
  const muzzle = { x: player.x + dir.x * 1.2, y: 1.5, z: player.z + dir.z * 1.2 };
  particles.muzzle(muzzle.x, muzzle.y, muzzle.z);
  shoot(game, { x: player.x, z: player.z }, dir);
}

// --- The update ---------------------------------------------------------------
function update(dt) {
  game.time += dt;
  game.crimeCooldown = Math.max(0, game.crimeCooldown - dt);
  const move = game.shotAutopilot ? game.shotAutopilot(game) : input.move();
  const actions = game.shotAutopilot ? 0 : input.takeActions();

  if (actions & ACTION_MUTE) {
    audio.setMuted(!audio.muted);
    hud.toast(audio.muted ? 'Sound muted' : 'Sound on');
  }
  if (actions & ACTION_PAUSE) {
    pauseGame();
    return;
  }
  if (actions & ACTION_ENTER_CAR) tryEnterExitCar();
  if (actions & ACTION_PUNCH) tryShootOrPunch();

  if (player.onFoot) {
    player.walk(dt, move, input.run(), game.camYaw);
  } else {
    player.driveCar(dt, move);
    collidePlayerCar(dt);
  }
  if (player.onFoot) collidePlayerOnFoot(dt);

  traffic.update(dt, player.car);
  traffic.topUp(player.x, player.z);
  peds.update(dt);
  police.update(dt, game);
  missions.update(dt, game);
  particles.update(dt);
  player.heal(dt, game.time);

  // Police return fire when the heat is high and the player is exposed.
  game.policeShootTimer -= dt;
  if (police.wanted >= 3 && player.onFoot && game.policeShootTimer <= 0) {
    game.policeShootTimer = 1.4;
    for (const car of police.cars) {
      if (car.distanceTo(player.x, player.z) < 30) {
        policeShoot(game, car);
        break;
      }
    }
  }

  // Audio follows the state.
  audio.setEngine(player.car ? Math.abs(player.car.speed) / CAR.maxSpeed : 0);
  const nearestPolice = police.nearestPoliceDist(player.x, player.z);
  audio.setSiren(police.wanted > 0 && nearestPolice < 90, Math.max(0.2, 1 - nearestPolice / 90));

  // Autosave.
  game.saveTimer += dt;
  if (game.saveTimer > 20) {
    game.saveTimer = 0;
    writeSave(game);
  }

  if (player.dead) endGame('WASTED', 'Solara City claims another driver.');
  hud.update(game);
}

// --- Title attract mode -------------------------------------------------------
let attractAngle = 0;
function updateTitle(dt) {
  attractAngle += dt * 0.05;
  const r = 150;
  camera.position.set(Math.sin(attractAngle) * r, 70, Math.cos(attractAngle) * r);
  camera.lookAt(0, 10, 0);
  city.sun.position.set(320, 130, 90);
  city.sun.target.position.set(0, 0, 0);
  traffic.update(dt, null);
  peds.update(dt);
  particles.update(dt);
}

// --- Main loop ----------------------------------------------------------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_DT);
  last = now;
  if (game.screen === 'play') {
    update(dt);
    updateCamera(dt);
    if (shotName) {
      game.shotFrames++;
      if (game.shotFrames >= SHOT_FRAMES) window.__shotReady = true;
    }
  } else if (game.screen === 'title') {
    updateTitle(dt);
  } else {
    updateCamera(dt);
  }
  renderer.render(scene, camera);
}

// --- Shot mode ----------------------------------------------------------------
if (shotName) {
  game.screen = 'play';
  showOnly(null);
  hud.show();
  audio.ensure();
  stageShot(shotName, game);
  announce('Screenshot scene staged.');
} else {
  showOnly(menuEl);
}

window.__solara = { game, startNewGame, respawn };

// Test hook: advance the simulation by `seconds` of game time with a fixed
// move input, independent of the render rate (headless software rendering
// runs far below 60 fps, so wall-clock holds under-advance the game).
function stepSim(seconds, move = { x: 0, y: 0 }) {
  const steps = Math.round(seconds * 60);
  const prev = game.shotAutopilot;
  game.shotAutopilot = () => move;
  for (let i = 0; i < steps; i++) update(1 / 60);
  game.shotAutopilot = prev;
}
window.__solara.stepSim = stepSim;
requestAnimationFrame(frame);
