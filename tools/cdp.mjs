// Solara City — a dependency-free CDP driver for headless Chromium:
// open a page, wait for it to be ready, read the console, send keys,
// screenshot. Node 22+ (global WebSocket, global fetch). Chrome must
// already run with --remote-debugging-port=9222 (see tools/launch-chrome.sh).

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Open a fresh tab and return a handle { send, close, ... }. */
export async function openTab(url, width = 1440, height = 900) {
  const created = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' });
  if (!created.ok) throw new Error('target create failed: ' + created.status);
  const target = await created.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const consoleMessages = [];
  const failedRequests = [];
  const requests = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method === 'Network.requestWillBeSent') {
      requests.push(msg.params.request.url);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      consoleMessages.push(`${msg.params.type}: ${text}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      consoleMessages.push(`exception: ${msg.params.exceptionDetails.text} ${msg.params.exceptionDetails.exception?.description ?? ''}`);
    } else if (msg.method === 'Network.loadingFailed') {
      failedRequests.push(`${msg.params.errorText} ${msg.params.type ?? ''}`);
    } else if (msg.method === 'Network.responseReceived') {
      if (msg.params.response.status >= 400) failedRequests.push(`${msg.params.response.status} ${msg.params.response.url}`);
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  return {
    send,
    consoleMessages,
    failedRequests,
    requests,
    /** Evaluate JS in the page and return its value. */
    async evaluate(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (res.exceptionDetails) throw new Error('page eval failed: ' + JSON.stringify(res.exceptionDetails));
      return res.result.value;
    },
    /** Wait until an expression is truthy (or timeout). */
    async waitFor(expression, timeoutMs = 20000) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        try {
          if (await this.evaluate(expression)) return true;
        } catch {
          // The page may still be loading; keep waiting.
        }
        if (Date.now() > deadline) throw new Error('timeout waiting for: ' + expression);
        await sleep(150);
      }
    },
    /** Click at page coordinates (mouse press + release). */
    async clickAt(x, y, button = 'left') {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount: 1 });
    },
    /** Press and release a key by its key name (e.g. "h", "Enter"). */
    async pressKey(key) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key });
    },
    /** Hold a key down (pair with releaseKey). */
    async holdKey(key) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key });
    },
    /** Release a held key. */
    async releaseKey(key) {
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key });
    },
    /** Save a PNG screenshot of the current viewport. */
    async screenshot(outPath) {
      const { writeFileSync } = await import('node:fs');
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
      return outPath;
    },
    close() {
      ws.close();
    },
  };
}

export { sleep };
