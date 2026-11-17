// Seeded RNG (mulberry32) so the city, traffic and missions are deterministic
// for a given seed — the same seed always builds the same Solara City.

/** Create a mulberry32 generator from a 32-bit seed. */
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] inclusive, from a generator. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Pick one element of an array, from a generator. */
export function randomPick(random, array) {
  return array[Math.floor(random() * array.length)];
}

/** Random float in [min, max), from a generator. */
export function randomRange(random, min, max) {
  return min + random() * (max - min);
}

/** Shuffle a copy of an array, from a generator. */
export function shuffle(random, array) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
