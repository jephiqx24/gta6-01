// Five missions that pay off Rio's $5,000 debt to Vera, one at a time.
// A stage is a target to reach, a car to steal, or a passenger to pick up.
import { THREE } from './three.js';
import { MISSION_REWARDS } from './config.js';

export const MISSIONS = [
  {
    id: 'first-fare',
    name: 'The First Fare',
    reward: MISSION_REWARDS[0],
    timer: 0,
    stages: [
      { kind: 'goto', label: 'Pick up the package at Docks 7', target: 'docks', radius: 9 },
      { kind: 'goto', label: 'Deliver the package to the drop point', target: 'drop1', radius: 9 },
    ],
  },
  {
    id: 'hot-wheels',
    name: 'Hot Wheels',
    reward: MISSION_REWARDS[1],
    timer: 150,
    setWanted: 0,
    stages: [
      { kind: 'steal', label: 'Steal the red Comet parked on 5th', target: 'fastCar', radius: 4 },
      { kind: 'goto', label: 'Reach the safehouse — the heat is on', target: 'safehouse', radius: 9 },
    ],
  },
  {
    id: 'cabbie',
    name: 'Cabbie',
    reward: MISSION_REWARDS[2],
    timer: 120,
    stages: [
      { kind: 'pickup', label: 'Pick up the fare on Marina Blvd', target: 'cabPickup', radius: 7 },
      { kind: 'goto', label: 'Drive the fare to the Marina', target: 'marina', radius: 9 },
    ],
  },
  {
    id: 'getaway',
    name: 'Getaway',
    reward: MISSION_REWARDS[3],
    timer: 150,
    setWanted: 3,
    stages: [
      { kind: 'goto', label: 'Grab the package — police are already on you', target: 'getaway', radius: 8 },
      { kind: 'goto', label: 'Lose the heat and reach the hideout', target: 'hideout', radius: 9 },
    ],
  },
  {
    id: 'final-payoff',
    name: 'The Final Payoff',
    reward: MISSION_REWARDS[4],
    timer: 180,
    setWanted: 4,
    stages: [
      { kind: 'goto', label: "Collect Vera's money at the club", target: 'club', radius: 8 },
      { kind: 'goto', label: 'Deliver it to the North Gate — this clears the debt', target: 'northGate', radius: 9 },
    ],
  },
];

function makeMarkerMesh() {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 30;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23f })
  );
  diamond.position.y = 7;
  g.add(beam, ring, diamond);
  g.userData = { ring, diamond };
  return g;
}

function makePassengerMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), new THREE.MeshStandardMaterial({ color: 0x4f7ad8, roughness: 0.9 }));
  body.position.y = 1.12;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.8 }));
  head.position.y = 1.68;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 1 }));
  legL.position.set(-0.14, 0.38, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(body, head, legL, legR);
  return g;
}

export function createMissions(scene, city, police, refs) {
  const marker = makeMarkerMesh();
  scene.add(marker);
  const passenger = makePassengerMesh();
  passenger.visible = false;
  scene.add(passenger);
  let index = 0;
  let stage = 0;
  let timer = 0;
  let active = false;
  let done = false;
  let failFlash = 0;
  let passengerAboard = false;

  function current() {
    return MISSIONS[index];
  }

  function stageTarget() {
    const m = current();
    if (!m) return null;
    const s = m.stages[stage];
    if (!s) return null;
    if (s.kind === 'steal') {
      const car = refs.fastCar;
      return car ? { x: car.pos.x, z: car.pos.z, radius: s.radius, car } : null;
    }
    const p = city.places[s.target];
    return p ? { x: p.x, z: p.z, radius: s.radius } : null;
  }

  function start() {
    active = true;
    done = false;
    index = 0;
    stage = 0;
    const m = current();
    timer = m.timer;
    if (m.setWanted) police.wanted = m.setWanted;
    placePassenger();
  }

  function placePassenger() {
    const m = current();
    if (!m) return;
    const s = m.stages[stage];
    passengerAboard = false;
    if (s && s.kind === 'pickup') {
      const p = city.places[s.target];
      passenger.position.set(p.x, 0, p.z);
      passenger.visible = true;
    } else {
      passenger.visible = false;
    }
  }

  function advanceStage() {
    const m = current();
    stage += 1;
    if (stage >= m.stages.length) {
      return true;
    }
    placePassenger();
    return false;
  }

  function restartMission() {
    stage = 0;
    const m = current();
    timer = m.timer;
    failFlash = 3;
    placePassenger();
  }

  // Returns events: missionComplete, allComplete, missionFailed.
  function update(dt, player) {
    const events = [];
    if (!active || done) return events;
    const m = current();
    if (!m) return events;
    if (m.timer > 0) {
      timer -= dt;
      if (timer <= 0) {
        events.push({ type: 'missionFailed', mission: m });
        restartMission();
        return events;
      }
    }
    if (failFlash > 0) failFlash -= dt;
    const t = stageTarget();
    if (!t) return events;
    const px = player.inCar ? player.car.pos.x : player.pos.x;
    const pz = player.inCar ? player.car.pos.z : player.pos.z;
    const s = m.stages[stage];
    let complete = false;
    if (s.kind === 'steal') {
      complete = player.inCar && player.car === t.car;
      if (complete && police.wanted < 2) police.wanted = 2;
    } else if (s.kind === 'pickup') {
      complete = Math.hypot(px - t.x, pz - t.z) < t.radius;
      if (complete) {
        passengerAboard = true;
        passenger.visible = false;
      }
    } else {
      complete = Math.hypot(px - t.x, pz - t.z) < t.radius;
    }
    if (complete) {
      const finished = advanceStage();
      if (finished) {
        const reward = m.reward;
        index += 1;
        if (index >= MISSIONS.length) {
          done = true;
          active = false;
          marker.visible = false;
          events.push({ type: 'allComplete', mission: m, reward });
        } else {
          stage = 0;
          const next = current();
          timer = next.timer;
          if (next.setWanted) police.wanted = next.setWanted;
          placePassenger();
          events.push({ type: 'missionComplete', mission: m, reward });
        }
      }
    }
    // Marker follows the current target.
    const tgt = stageTarget();
    if (tgt && !done) {
      marker.visible = true;
      marker.position.set(tgt.x, 0, tgt.z);
      const pulse = 1 + Math.sin(performance.now() / 300) * 0.15;
      marker.userData.ring.scale.set(pulse, pulse, 1);
      marker.userData.diamond.rotation.y += dt * 2;
      marker.userData.diamond.position.y = 7 + Math.sin(performance.now() / 400) * 0.6;
    } else {
      marker.visible = false;
    }
    return events;
  }

  return {
    get index() {
      return index;
    },
    get stage() {
      return stage;
    },
    get active() {
      return active;
    },
    get done() {
      return done;
    },
    get failFlash() {
      return failFlash;
    },
    get passengerAboard() {
      return passengerAboard;
    },
    get timeLeft() {
      const m = current();
      return m && m.timer > 0 ? Math.max(0, timer) : null;
    },
    current,
    stageTarget,
    start,
    update,
    objectiveText() {
      const m = current();
      if (!m) return '';
      const s = m.stages[stage];
      return s ? `${m.name} — ${s.label}` : m.name;
    },
    setIndex(i) {
      index = i;
      stage = 0;
      const m = current();
      timer = m ? m.timer : 0;
      placePassenger();
    },
    setStage(s) {
      const m = current();
      if (!m) return;
      stage = Math.max(0, Math.min(m.stages.length - 1, s));
      if (m.stages[stage].kind === 'goto' && stage > 0) passengerAboard = true;
      placePassenger();
    },
  };
}
