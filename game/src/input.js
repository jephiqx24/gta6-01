// Keyboard and mouse: held keys, edge-triggered presses, and camera drag
// deltas. The game loop consumes the edge state once a frame.
export function createInput() {
  const keys = {};
  const pressedSet = new Set();
  let dragDX = 0;
  let dragDY = 0;
  let dragging = false;
  let clicked = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressedSet.add(e.code);
    keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });
  const canvas = () => document.getElementById('game-canvas');
  window.addEventListener('mousedown', (e) => {
    if (e.target === canvas()) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      clicked = true;
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    dragDX += e.clientX - lastX;
    dragDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });

  return {
    keys,
    pressed(code) {
      return pressedSet.has(code);
    },
    get clicked() {
      return clicked;
    },
    consumeDrag() {
      const d = { dx: dragDX, dy: dragDY };
      dragDX = 0;
      dragDY = 0;
      return d;
    },
    endFrame() {
      pressedSet.clear();
      clicked = false;
    },
  };
}
