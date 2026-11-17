// Missions and the story. Rio owes Vera, the crew boss, $5,000 — five jobs
// pay it off. Each mission is a chain of steps (go to, pick up, deliver,
// survive a chase); the marker beacon, the HUD objective and the minimap
// all read the same active step.

import { DEBT_TOTAL } from './config.js';
import { streetAt } from './config.js';

const THREE = window.THREE;

const MISSIONS = [  {
    id: 'first-fare',
    title: 'The First Fare',
    brief: 'Vera needs a package from the docks delivered to the Velvet Palm. No questions, no stops.',
    reward: 700,
    steps: [
      { type: 'goto', at: 'docks', radius: 7, time: 75, text: 'Pick up the package at Docks 7' },
      { type: 'goto', at: 'club', radius: 7, time: 90, text: 'Deliver the package to the Velvet Palm' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    brief: 'The chop shop needs a fresh ride. Take any car on the street and get it to the safehouse — the cops will notice.',
    reward: 800,
    steps: [
      { type: 'steal', radius: 0, time: 90, text: 'Steal any car (walk up to one and press E)' },
      { type: 'goto', at: 'safehouse', radius: 8, time: 75, text: 'Reach the safehouse — the heat is on', wanted: 2 },
    ],
  },
  {
    id: 'cabbie',
    title: 'Cabbie',
    brief: 'A high roller at the Hotel Marina needs a ride to the marina. Keep it smooth — and fast.',
    reward: 900,
    steps: [
      { type: 'pickup', at: 'hotel', radius: 6, time: 60, text: 'Pick up the fare at the Hotel Marina' },
      { type: 'goto', at: 'marina', radius: 8, time: 120, text: 'Drop the fare at the marina' },
    ],
  },
  {
    id: 'three-stops',
    title: 'Three Stops',
    brief: 'Three drops, three corners of the city, one van full of "imported goods". Then the warehouse.',
    reward: 1100,
    steps: [
      { type: 'goto', at: { x: streetAt(1), z: streetAt(1) }, radius: 7, time: 60, text: 'Pick up drop 1 of 3 — north-west corner' },
      { type: 'goto', at: { x: streetAt(6), z: streetAt(6) }, radius: 7, time: 60, text: 'Pick up drop 2 of 3 — south-east corner' },
      { type: 'goto', at: { x: streetAt(2), z: streetAt(5) }, radius: 7, time: 60, text: 'Pick up drop 3 of 3 — west side' },
      { type: 'goto', at: 'warehouse', radius: 8, time: 90, text: 'Deliver everything to the warehouse' },
    ],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    brief: 'The last job. Vera set the whole precinct on you — survive the chase, then vanish at the hideout. Do this and the debt is gone.',
    reward: 1500,
    steps: [
      { type: 'survive', radius: 0, time: 60, text: 'Survive the 4-star chase — 60 seconds', wanted: 4 },
      { type: 'goto', at: 'hideout', radius: 8, time: 60, text: 'Lose them and reach the hideout' },
    ],
  },
];

export { MISSIONS as MISSION_DEFS };

export class Missions {
  constructor(scene, city, random) {
    this.scene = scene;
    this.city = city;
    this.random = random;
    this.index = 0; // next mission to run
    this.active = null; // { def, step, timer, started }
    this.done = []; // completed mission ids
    this.cash = 0;
    this.debt = DEBT_TOTAL;
    this.onComplete = null; // (mission) => void
    this.onFail = null; // (mission, reason) => void
    this.onStart = null; // (mission) => void
    this.onStep = null; // (mission, step) => void
    this.marker = this.buildMarker();
    this.scene.add(this.marker.group);
    this.marker.group.visible = false;
    this.passenger = null; // the taxi fare ped
  }

  buildMarker() {
    const group = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd24a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 60, 12, 1, true), beamMat);
    beam.position.y = 30;
    group.add(beam);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.4, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    group.add(ring);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.9),
      new THREE.MeshBasicMaterial({ color: 0xffd24a }),
    );
    diamond.position.y = 6;
    group.add(diamond);
    return { group, beam, ring, diamond };
  }

  get current() {
    return MISSIONS[this.index] || null;
  }

  get debtPaid() {
    return this.debt <= 0;
  }

  /** World position of a step target (location key or {x, z}). */
  stepPos(step) {
    if (typeof step.at === 'string') {
      const loc = this.city.locations[step.at];
      return { x: loc.x, z: loc.z, label: loc.label };
    }
    return { x: step.at.x, z: step.at.z, label: 'Drop point' };
  }

  /** Where the next mission starts (its first step's position). */
  startPos() {
    const mission = this.current;
    if (!mission) return null;
    return this.stepPos(mission.steps[0]);
  }

  begin() {
    const mission = this.current;
    if (!mission || this.active) return;
    this.active = { def: mission, step: 0, timer: mission.steps[0].time, started: true };
    if (this.onStart) this.onStart(mission);
    this.showMarkerForStep();
  }

  showMarkerForStep() {
    if (!this.active) {
      this.marker.group.visible = false;
      return;
    }
    const step = this.active.def.steps[this.active.step];
    if (step.type === 'steal' || step.type === 'survive') {
      this.marker.group.visible = false;
      return;
    }
    const pos = this.stepPos(step);
    this.marker.group.position.set(pos.x, 0, pos.z);
    this.marker.group.visible = true;
  }

  advanceStep(game) {
    const mission = this.active.def;
    this.active.step++;
    if (this.active.step >= mission.steps.length) {
      this.complete(game);
      return;
    }
    const step = mission.steps[this.active.step];
    this.active.timer = step.time;
    if (step.wanted) game.police.setWanted(step.wanted);
    if (this.onStep) this.onStep(mission, step);
    this.showMarkerForStep();
    game.audio.pickup();
  }

  complete(game) {
    const mission = this.active.def;
    this.active = null;
    this.done.push(mission.id);
    this.index++;
    this.cash += mission.reward;
    this.debt = Math.max(0, this.debt - mission.reward);
    this.marker.group.visible = false;
    game.audio.jingle();
    game.particles.sparkle(game.player.x, 2, game.player.z);
    if (this.onComplete) this.onComplete(mission);
  }

  fail(game, reason) {
    const mission = this.active.def;
    this.active = null;
    this.marker.group.visible = false;
    if (this.onFail) this.onFail(mission, reason);
  }

  /** Called when the player gets into a car (steal step). */
  onEnterCar(game) {
    if (!this.active) return;
    const step = this.active.def.steps[this.active.step];
    if (step.type === 'steal') this.advanceStep(game);
  }

  update(dt, game) {
    // Animate the marker.
    if (this.marker.group.visible) {
      const t = performance.now() / 1000;
      this.marker.diamond.position.y = 6 + Math.sin(t * 2.5) * 0.5;
      this.marker.diamond.rotation.y = t;
      const pulse = 0.7 + Math.sin(t * 3) * 0.3;
      this.marker.ring.scale.set(pulse, pulse, 1);
    }
    // Auto-begin the next mission when the player reaches its start marker.
    if (!this.active && this.current) {
      const pos = this.startPos();
      const d = Math.hypot(game.player.x - pos.x, game.player.z - pos.z);
      if (d < 8) this.begin();
    }
    if (!this.active) return;
    const step = this.active.def.steps[this.active.step];
    this.active.timer -= dt;
    if (this.active.timer <= 0) {
      if (step.type === 'survive') this.advanceStep(game);
      else this.fail(game, 'Out of time');
      return;
    }
    const player = game.player;
    if (step.type === 'goto' || step.type === 'pickup') {
      const pos = this.stepPos(step);
      const d = Math.hypot(player.x - pos.x, player.z - pos.z);
      if (d < step.radius) {
        if (step.type === 'pickup') {
          // The fare gets in: hide a nearby ped as the passenger.
          game.audio.pickup();
        }
        this.advanceStep(game);
      }
    }
  }

  /** Objective line for the HUD. */
  objectiveText() {
    if (this.active) {
      const step = this.active.def.steps[this.active.step];
      const t = Math.max(0, Math.ceil(this.active.timer));
      const mm = String(Math.floor(t / 60)).padStart(2, '0');
      const ss = String(t % 60).padStart(2, '0');
      return `${this.active.def.title} — ${step.text}  •  ${mm}:${ss}`;
    }
    if (this.current) {
      const pos = this.startPos();
      return `Next job: ${this.current.title} — reach the yellow marker (${pos.label})`;
    }
    return 'Debt paid. Solara City is yours — free roam.';
  }

  /** Distance to the current objective, for the HUD. */
  objectiveDistance(player) {
    if (!this.active) {
      if (!this.current) return 0;
      const pos = this.startPos();
      return Math.hypot(player.x - pos.x, player.z - pos.z);
    }
    const step = this.active.def.steps[this.active.step];
    if (step.type === 'steal' || step.type === 'survive') return 0;
    const pos = this.stepPos(step);
    return Math.hypot(player.x - pos.x, player.z - pos.z);
  }

  /** Marker world position for the minimap (null when none). */
  markerPos() {
    if (this.active) {
      const step = this.active.def.steps[this.active.step];
      if (step.type === 'steal' || step.type === 'survive') return null;
      return this.stepPos(step);
    }
    if (this.current) return this.startPos();
    return null;
  }
}
