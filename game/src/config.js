// Solara City — tuning, layout and palette. One place for every number the
// systems share, so the city, the AI and the minimap always agree.

// --- City layout ------------------------------------------------------------
export const BLOCK = 46; // building block side, metres
export const STREET = 14; // street width, metres
export const PITCH = BLOCK + STREET; // 60 m between street centre lines
export const STREET_COUNT = 8; // streets per axis
export const STREET_FIRST = -((STREET_COUNT - 1) * PITCH) / 2; // -210
export const CITY_HALF = STREET_FIRST + (STREET_COUNT - 1) * PITCH + STREET / 2; // 217
export const LANE = 3.5; // lane centre offset from a street centre line
export const WATER_X = 232; // where the beach ends and the sea begins
export const SEA_HALF = 260; // sea plane extends this far east

/** Centre-line coordinate of street i (0..STREET_COUNT-1) on either axis. */
export function streetAt(i) {
  return STREET_FIRST + i * PITCH;
}

/** Nearest street index to a coordinate. */
export function nearestStreetIndex(coord) {
  return Math.max(0, Math.min(STREET_COUNT - 1, Math.round((coord - STREET_FIRST) / PITCH)));
}

/** Is a point on a road (within a street's width, either axis)? */
export function isOnRoad(x, z) {
  const half = STREET / 2 + 0.5;
  for (let i = 0; i < STREET_COUNT; i++) {
    const c = streetAt(i);
    if (Math.abs(x - c) < half || Math.abs(z - c) < half) return true;
  }
  return false;
}

/** Clamp a position inside the drivable city (plus the beach). */
export function clampToCity(x, z) {
  const m = CITY_HALF + 8;
  return [Math.max(-m, Math.min(WATER_X + 6, x)), Math.max(-m, Math.min(m, z))];
}

// --- Palette (sun-soaked coastal city, all original) ------------------------
export const PALETTE = {
  skyTop: 0x7a4a8f,
  skyHorizon: 0xff9a5c,
  sun: 0xffb36b,
  fog: 0xf2a56b,
  asphalt: 0x4a4f58,
  sidewalk: 0xb9a98f,
  blockGround: 0x8f8271,
  sand: 0xe8cf9e,
  sea: 0x2e6f8e,
  seaDeep: 0x1d4e6b,
  building: [0xe8b48a, 0xd99a6c, 0xc98a7a, 0x9fb8a8, 0x7fa8b8, 0xe0cfa8, 0xb08a9a, 0xf0d9b0],
  tower: [0x8a9ab0, 0x6a7a98, 0xa8b8c8, 0x98a8b8, 0xd8c8a8],
  roof: 0x5a4a42,
  car: [0xd83a2e, 0x2e6fd8, 0xf0c030, 0x30b060, 0xe8e8e8, 0x222226, 0x8a4ad8, 0xe07a30, 0x40c8c8, 0xc8c8d0],
  police: 0x1a2a3a,
  taxi: 0xf0c030,
};

// --- Player / driving -------------------------------------------------------
export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 7.2,
  radius: 0.45,
  height: 1.8,
  health: 100,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 38,
  maxReverse: 9,
  steerMax: 0.55,
  grip: 6.5,
};

// --- Wanted / police --------------------------------------------------------
export const WANTED_MAX = 5;
export const WANTED_DECAY_IDLE = 20; // seconds without a crime before decay starts
export const WANTED_DECAY_STEP = 12; // seconds per star lost while hidden
export const POLICE_PER_STAR = [0, 2, 3, 4, 5, 6];
export const BUSTED_HOLD_SECONDS = 3; // police close + player still = busted

// --- Missions ---------------------------------------------------------------
export const DEBT_TOTAL = 5000;

// --- Save -------------------------------------------------------------------
export const SAVE_KEY = 'solara-city-save-v1';
