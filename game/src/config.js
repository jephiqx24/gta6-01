// World layout, tuning and palette for Solara City. One place for every number.
export const SEED = 1337;

// City grid: streets every PITCH units, PITCH = BLOCK + STREET.
export const WORLD = {
  pitch: 50,
  block: 36,
  street: 14,
  half: 225,
  // Street centre lines (both axes).
  lines: [-200, -150, -100, -50, 0, 50, 100, 150, 200],
  downtown: 110,
  seaX: 210,
  seaFar: 460,
};

export const PALETTE = {
  skyTop: 0x2b3a6e,
  skyMid: 0xff9a5c,
  sun: 0xffd9a0,
  ground: 0x51565f,
  sidewalk: 0x8a8f9a,
  road: 0x454a58,
  line: 0xd8d8c8,
  crosswalk: 0xe8e8e0,
  sea: 0x1d4e6b,
  pier: 0x7a5a38,
  building: [0x8a7a6a, 0x7a8b9a, 0x9a8b7a, 0x6a7a8b, 0xaa9a8a],
  tower: [0x5a6a8b, 0x6a5a7a, 0x4a5e75, 0x7a6a5a],
  windowLit: 0xffd27a,
  windowDark: 0x1c2733,
  tree: 0x2e6b34,
  trunk: 0x5a3a22,
  lamp: 0xffe9a8,
  grass: 0x3f7a3a,
  carColors: [0xc23b2e, 0x2e6bc2, 0xd8a020, 0x3aa84f, 0x8a3aa8, 0xd8d8d8, 0x222222, 0x2e8a8a],
  police: 0x1a1a2e,
  taxi: 0xf2c200,
  marker: 0xffd23f,
  markerBeam: 0xffd23f,
};

export const PLAYER = {
  walkSpeed: 5,
  runSpeed: 9,
  radius: 0.55,
  height: 1.8,
  health: 100,
  punchRange: 2.2,
  punchDamage: 25,
  pistolRange: 60,
  pistolDamage: 34,
};

export const CAR = {
  accel: 16,
  brake: 30,
  maxSpeed: 34,
  maxReverse: 10,
  steerRate: 1.9,
  drag: 0.55,
  grip: 8,
  length: 4.2,
  width: 1.9,
};

export const WANTED = {
  max: 5,
  decaySeconds: 26,
  steal: 1,
  hitPed: 1,
  shoot: 1,
  ramPolice: 1,
};

export const MISSION_REWARDS = [600, 800, 900, 1200, 1500];
export const START_DEBT = 5000;
export const SAVE_KEY = 'solara-city-save-v1';
