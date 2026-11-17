// Keyboard and mouse input. Held keys are read every frame; one-shot presses
// (confirm, pause, enter car, punch, mute) are queued as flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.
// The mouse orbits the camera: drag, or click the canvas for pointer lock.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

export function createInput(canvas) {
  let keys = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let wheelDelta = 0;
  let dragging = false;
  let locked = false;

  function press(action) {
    actions |= action;
  }

  window.addEventListener('keydown', (event) => {
    if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON')) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      if (!event.repeat) press(ACTION_CONFIRM);
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      if (!event.repeat) press(ACTION_PAUSE);
    } else if (event.code === 'KeyE') {
      if (!event.repeat) press(ACTION_ENTER_CAR);
    } else if (event.code === 'KeyF') {
      if (!event.repeat) press(ACTION_PUNCH);
    } else if (event.code === 'KeyM') {
      if (!event.repeat) press(ACTION_MUTE);
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (event) => {
    dragging = true;
    if (document.pointerLockElement !== canvas) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Pointer lock is a nicety; drag still works without it.
      }
    }
    if (event.button === 0) press(ACTION_PUNCH);
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  window.addEventListener('mousemove', (event) => {
    if (locked) {
      mouseDX += event.movementX;
      mouseDY += event.movementY;
    } else if (dragging) {
      mouseDX += event.movementX;
      mouseDY += event.movementY;
    }
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    wheelDelta += event.deltaY;
  }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Held movement keys as { x: -1..1 (strafe), y: -1..1 (forward) }. */
    move() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      return { x, y };
    },
    run() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    /** Mouse orbit deltas since the last call, in pixels. */
    takeMouse() {
      const d = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return d;
    },
    /** Wheel delta since the last call (positive = zoom out). */
    takeWheel() {
      const d = wheelDelta;
      wheelDelta = 0;
      return d;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** True while any driving key is held (used to skip the title on keypress). */
    anyKey() {
      return keys.size > 0;
    },
  };
}
