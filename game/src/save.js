// Save / load: cash, missions done and the player's position, kept in
// localStorage (this browser only). A save never blocks play if storage is
// off — it just lasts this visit.

import { SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  try {
    const data = {
      cash: game.missions.cash,
      debt: game.missions.debt,
      done: game.missions.done,
      index: game.missions.index,
      x: game.player.x,
      z: game.player.z,
      heading: game.player.heading,
      health: game.player.health,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be off (private windows): the game still plays.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore.
  }
}
