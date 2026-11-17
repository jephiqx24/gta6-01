// Smoke test: load the game over file://, wait for it to boot, and report
// console errors, failed/foreign requests and basic game state.
// Usage: node tools/smoke.mjs [url] [waitMs]

import { openTab, sleep } from './cdp.mjs';

const url = process.argv[2] || 'file:///home/hatch/workspace/makefun/gta6-01/game/index.html?seed=7';
const waitMs = Number(process.argv[3]) || 6000;
const tab = await openTab(url, 1280, 720);
try {
  await sleep(waitMs);
  const state = await tab.evaluate(`(() => {
    const g = window.__solara && window.__solara.game;
    if (!g) return { booted: false };
    const c = g.renderer.getContext();
    return {
      booted: true,
      screen: g.screen,
      webgl: !c.isContextLost(),
      renderer: c.getParameter(c.VERSION),
      player: { x: +g.player.x.toFixed(1), z: +g.player.z.toFixed(1), onFoot: g.player.onFoot, health: g.player.health },
      traffic: g.traffic.cars.length,
      parked: g.traffic.parked.length,
      peds: g.peds.peds.length,
      drawCalls: g.renderer.info.render.calls,
      triangles: g.renderer.info.render.triangles,
      geometries: g.renderer.info.memory.geometries,
      textures: g.renderer.info.memory.textures,
    };
  })()`);
  console.log(JSON.stringify(state, null, 2));
  const errors = tab.consoleMessages.filter((m) => m.startsWith('error') || m.startsWith('exception'));
  console.log('console errors:', errors.length ? '\n' + errors.join('\n') : 'none');
  const foreign = tab.requests.filter((u) => !u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('chrome'));
  console.log('network requests:', tab.requests.length, '| foreign:', foreign.length ? foreign.join(', ') : 'none');
  console.log('failed requests:', tab.failedRequests.length ? tab.failedRequests.join(' | ') : 'none');
} finally {
  tab.close();
}
process.exit(0);
