// Save: cash, debt, missions completed and the player's spot, in localStorage.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      debt: state.debt,
      missionsDone: state.missionsDone,
      x: state.x,
      z: state.z,
      heading: state.heading,
      wanted: state.wanted,
      savedAt: Date.now(),
    }));
  } catch {
    // Storage full or unavailable: the game keeps running unsaved.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
