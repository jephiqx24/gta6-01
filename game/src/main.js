// Solara City: main entry. Wires the city, traffic, pedestrians, player,
// police, missions, combat, HUD, audio, particles and save together, runs the
// game loop, the camera, the menus and the test hook.
import { THREE } from './three.js';
import { SEED, START_DEBT, CAR } from './config.js';
import { makeRng } from './rng.js';
import { buildCity } from './city.js';
import { createCar, stepCar, collideCars } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer, updatePlayer, respawnPlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { loadSave, saveGame, clearSave } from './save.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// ?fx=low disables shadows for logic tests on software renderers.
if (new URLSearchParams(window.location.search).get('fx') === 'low') {
  renderer.shadowMap.enabled = false;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

const rng = makeRng(SEED);
const city = buildCity(scene, rng);
const traffic = createTraffic(scene, city, rng);
const peds = createPedestrians(scene, rng);
const player = createPlayer(scene, city);
const police = createPolice(scene, city, rng);
const audio = createAudio();
const particles = createParticles(scene);
const hud = createHud();
const input = createInput();
const combat = createCombat(scene);

// The fast car for Hot Wheels: a red sports car parked on 5th.
const fastCar = createCar('parked', 0xd81f1f, city.places.fastCar.x, city.places.fastCar.z, Math.PI / 2, { sport: true });
fastCar.maxSpeed = 38;
scene.add(fastCar.mesh);
const missions = createMissions(scene, city, police, { fastCar });

const game = {
  state: 'title',
  cash: 0,
  debt: START_DEBT,
  missionsDone: 0,
  autoDrive: false,
  bustedT: 0,
  saveT: 0,
  camYaw: Math.PI,
  camPitch: 0.32,
  shotMode: null,
};

// Restore a save, if one exists.
const saved = loadSave();
if (saved) {
  game.cash = saved.cash || 0;
  game.debt = saved.debt ?? START_DEBT;
  game.missionsDone = saved.missionsDone || 0;
  player.pos.set(saved.x ?? city.places.spawn.x, 0, saved.z ?? city.places.spawn.z);
  player.heading = saved.heading ?? city.places.spawn.heading;
  player.mesh.position.copy(player.pos);
  if (saved.wanted) police.wanted = saved.wanted;
}

function stealableCars() {
  return [...traffic.allStealable(), fastCar];
}

function doSave() {
  saveGame({
    cash: game.cash,
    debt: game.debt,
    missionsDone: game.missionsDone,
    x: player.pos.x,
    z: player.pos.z,
    heading: player.heading,
    wanted: police.wanted,
  });
}

function startGame(fresh) {
  if (fresh) {
    clearSave();
    game.cash = 0;
    game.debt = START_DEBT;
    game.missionsDone = 0;
    respawnPlayer(player, city);
    police.clearWanted();
  }
  audio.unlock();
  audio.blip();
  hud.hide('title-screen');
  hud.hide('win-screen');
  game.state = 'playing';
  missions.start();
  missions.setIndex(game.missionsDone);
  doSave();
}

function showBusted() {
  game.state = 'busted';
  game.bustedT = 2.6;
  audio.sting();
  audio.setSiren(false);
  audio.setEngine(0, false);
  hud.show('busted-screen');
}

function respawn() {
  hud.hide('busted-screen');
  respawnPlayer(player, city);
  police.clearWanted();
  game.state = 'playing';
  doSave();
}

function showWin() {
  game.state = 'win';
  audio.chime();
  hud.show('win-screen');
  doSave();
}

document.getElementById('start-btn').addEventListener('click', () => startGame(false));
document.getElementById('newgame-btn').addEventListener('click', () => startGame(true));
document.getElementById('resume-btn').addEventListener('click', () => {
  hud.hide('pause-screen');
  game.state = 'playing';
});
document.getElementById('restart-btn').addEventListener('click', () => {
  hud.hide('busted-screen');
  respawn();
});
document.getElementById('start-btn-win').addEventListener('click', () => {
  hud.hide('win-screen');
  game.state = 'playing';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Shot mode: ?shot=cover|street|chase|mission stages a scene and starts at once.
const shotParam = new URLSearchParams(window.location.search).get('shot');
if (shotParam) {
  game.shotMode = shotParam;
  hud.hide('title-screen');
  audio.unlock();
  applyShot(shotParam, { player, traffic, police, missions, city, state: 'playing', autoDrive: false });
  game.state = 'playing';
  if (shotParam === 'cover' || shotParam === 'chase' || shotParam === 'mission') game.autoDrive = true;
}

let titleAngle = 0;

function updateCamera(dt) {
  const target = new THREE.Vector3();
  const look = new THREE.Vector3();
  if (game.state === 'title') {
    titleAngle += dt * 0.05;
    target.set(Math.sin(titleAngle) * 150, 70, Math.cos(titleAngle) * 150);
    look.set(0, 10, 0);
  } else if (player.inCar && player.car) {
    const car = player.car;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    target.set(car.pos.x - fx * 10.5, 4.6, car.pos.z - fz * 10.5);
    look.set(car.pos.x + fx * 7, 1.4, car.pos.z + fz * 7);
  } else {
    const d = input.consumeDrag();
    game.camYaw -= d.dx * 0.004;
    game.camPitch = Math.max(0.08, Math.min(0.9, game.camPitch + d.dy * 0.003));
    const dist = 7.5;
    const h = 2.2 + Math.sin(game.camPitch) * dist;
    const flat = Math.cos(game.camPitch) * dist;
    target.set(
      player.pos.x + Math.sin(game.camYaw) * flat,
      h,
      player.pos.z + Math.cos(game.camYaw) * flat
    );
    look.set(player.pos.x, 1.6, player.pos.z);
  }
  const k = 1 - Math.exp(-dt * 5);
  camera.position.lerp(target, k);
  camera.lookAt(look);
}

function update(dt) {
  city.update(dt);
  const allCars = [...traffic.cars, ...traffic.parked, fastCar, ...police.policeCars];

  if (game.state === 'title') {
    traffic.update(dt, null, allCars, player.car);
    peds.update(dt, null, []);
    updateCamera(dt);
    input.endFrame();
    return;
  }
  if (game.state === 'paused') {
    input.endFrame();
    return;
  }
  if (game.state === 'busted') {
    game.bustedT -= dt;
    if (game.bustedT <= 0) respawn();
    input.endFrame();
    return;
  }
  if (game.state === 'win') {
    traffic.update(dt, player.pos, allCars, player.car);
    updateCamera(dt);
    input.endFrame();
    return;
  }

  // Playing.
  if (input.pressed('KeyP')) {
    game.state = 'paused';
    hud.show('pause-screen');
    input.endFrame();
    return;
  }
  if (input.pressed('KeyM')) {
    audio.setMuted(!audio.muted);
  }
  if (game.autoDrive && player.inCar && player.car) {
    player.car.input.throttle = 1;
    player.car.input.steer = 0;
  }

  const playerEvents = updatePlayer(player, dt, input, game.camYaw, city, stealableCars());
  for (const e of playerEvents) {
    if (e.type === 'steal') {
      police.addWanted(1);
      audio.blip();
    }
  }

  // Drive the player's car physics (updatePlayer sets its input).
  if (player.inCar && player.car) {
    const impact = stepCar(player.car, dt, city);
    if (impact > 6) {
      particles.burst(player.car.pos.x, 1, player.car.pos.z, 0xffd23f, 14, 5);
      audio.blip();
    }
    // Skid marks on hard cornering.
    if (Math.abs(player.car.input.steer) > 0.85 && Math.abs(player.car.speed) > 14) {
      particles.addSkid(player.car.pos.x, player.car.pos.z, player.car.heading);
    }
  }

  traffic.update(dt, player.pos, allCars, player.inCar ? player.car : null);
  // Car-car collisions (player car vs traffic/police, traffic vs traffic).
  for (let i = 0; i < allCars.length; i++) {
    for (let j = i + 1; j < allCars.length; j++) {
      const closing = collideCars(allCars[i], allCars[j]);
      if (closing > 8) {
        const mx = (allCars[i].pos.x + allCars[j].pos.x) / 2;
        const mz = (allCars[i].pos.z + allCars[j].pos.z) / 2;
        particles.burst(mx, 1, mz, 0xffa040, 10, 4);
      }
    }
  }

  // Danger for pedestrians: the player's fast car, punches, gunshots.
  let danger = null;
  if (player.inCar && player.car && Math.abs(player.car.speed) > 8) {
    danger = { x: player.car.pos.x, z: player.car.pos.z, radius: 14 };
  }
  const pedEvents = peds.update(dt, danger, player.inCar && player.car ? [player.car] : []);
  for (const e of pedEvents) {
    if (e.type === 'pedHit') {
      police.addWanted(1);
      particles.burst(e.ped.pos.x, 1, e.ped.pos.z, 0xff5040, 12, 4);
    }
  }

  // Combat: click or F shoots (or punches up close).
  if ((input.clicked || input.pressed('KeyF')) && !player.inCar) {
    const nearPed = peds.nearest(player.pos.x, player.pos.z, 2.4);
    if (nearPed) {
      const hit = combat.punch(player, peds.peds, police.officers);
      if (hit) {
        police.addWanted(1);
        audio.blip();
      }
    } else if (player.hasPistol) {
      const res = combat.shoot(player, camera, city, peds.peds, police.officers, police.policeCars);
      audio.gunshot();
      police.addWanted(1);
      if (res.hit === 'ped' && res.ped) {
        res.ped.state = 'down';
        res.ped.downT = 6;
        res.ped.mesh.rotation.x = 0.4;
      }
      if (res.point) particles.burst(res.point.x, res.point.y, res.point.z, 0xffe9a8, 6, 3);
    }
  }
  combat.update(dt);

  const policeEvents = police.update(dt, player, allCars);
  for (const e of policeEvents) {
    if (e.type === 'busted') showBusted();
  }

  const missionEvents = missions.update(dt, player);
  for (const e of missionEvents) {
    if (e.type === 'missionComplete' || e.type === 'allComplete') {
      game.cash += e.reward;
      game.debt = Math.max(0, game.debt - e.reward);
      game.missionsDone = Math.min(5, missions.index);
      audio.chime();
      doSave();
      if (e.type === 'allComplete') showWin();
    } else if (e.type === 'missionFailed') {
      audio.blip();
    }
  }

  particles.update(dt);
  updateCamera(dt);

  // Audio follows the drive and the heat.
  const speed01 = player.inCar && player.car ? Math.abs(player.car.speed) / CAR.maxSpeed : 0;
  audio.setEngine(speed01, player.inCar);
  audio.setSiren(police.wanted > 0);

  // HUD.
  const tgt = missions.stageTarget();
  const px = player.inCar ? player.car.pos.x : player.pos.x;
  const pz = player.inCar ? player.car.pos.z : player.pos.z;
  hud.update({
    wanted: police.wanted,
    cash: game.cash,
    debt: game.debt,
    health: player.health,
    speedKmh: player.inCar && player.car ? Math.abs(player.car.speed) * 3.6 : 0,
    inCar: player.inCar,
    missionText: game.state === 'playing' ? missions.objectiveText() : '',
    timeLeft: missions.timeLeft,
    distToTarget: tgt ? Math.hypot(tgt.x - px, tgt.z - pz) : null,
    failFlash: missions.failFlash,
    passengerAboard: missions.passengerAboard,
    missionTarget: tgt,
    policeCars: police.policeCars,
    officers: police.officers,
    trafficCars: traffic.cars,
    playerX: px,
    playerZ: pz,
    playerHeading: player.inCar ? player.car.heading : player.heading,
  });

  // Periodic save.
  game.saveT += dt;
  if (game.saveT > 10) {
    game.saveT = 0;
    doSave();
  }

  input.endFrame();
}

// Game logic on a wall-clock timer (real time even on a slow renderer) and
// rendering on its own rAF loop.
let lastLogic = performance.now();
function logicTick() {
  const now = performance.now();
  // Advance by the full elapsed time (up to half a second) so the game runs
  // in real time even when the renderer is slow.
  const dt = Math.min((now - lastLogic) / 1000, 0.5);
  lastLogic = now;
  update(dt);
  setTimeout(logicTick, 16);
}
function renderLoop() {
  requestAnimationFrame(renderLoop);
  renderer.render(scene, camera);
}

updateCamera(0.016);
logicTick();
renderLoop();

// Test hook: the E2E test reads state and drives the game through this.
window.__solara = {
  game,
  player,
  police,
  missions,
  traffic,
  peds,
  city,
  fastCar,
  start: (fresh) => startGame(!!fresh),
  state() {
    return {
      mode: game.state,
      cash: game.cash,
      debt: game.debt,
      missionsDone: game.missionsDone,
      wanted: police.wanted,
      inCar: player.inCar,
      speed: player.inCar && player.car ? player.car.speed : player.speed,
      health: player.health,
      x: player.pos.x,
      z: player.pos.z,
      missionIndex: missions.index,
      missionStage: missions.stage,
      missionDone: missions.done,
      missionText: missions.objectiveText(),
      timeLeft: missions.timeLeft,
    };
  },
};
