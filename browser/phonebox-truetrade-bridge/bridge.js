const endpoint = 'http://127.0.0.1:8765/api/tab-share/bridge';
const delay = 400;
let current = null;
let starting = false;

function market(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://www.thetruetrade.io' && !url.username && !url.password &&
      /^\/(?:[a-z]{2}\/)?trade\/(?:futures\/)?[A-Z0-9]{3,30}\/?$/.test(url.pathname);
  } catch { return false; }
}

async function agent(body, json = true) {
  const res = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    cache: 'no-store', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) throw new Error('PhoneBox Agent درخواست را نپذیرفت.');
  return json ? res.json() : null;
}

function protocol(session, method, params) {
  return chrome.debugger.sendCommand({ tabId: session.tabId }, method, params);
}

async function stillSelected(session) {
  if (session !== current) return false;
  const tab = await chrome.tabs.get(session.tabId);
  return session === current && tab.active && tab.url === session.url && !tab.pendingUrl;
}

async function stop(session = current) {
  if (!session || session !== current) return;
  current = null;
  clearTimeout(session.timer);
  await Promise.allSettled([
    agent({ action: 'stop', token: session.token }, false),
    chrome.debugger.detach({ tabId: session.tabId }),
    chrome.action.setBadgeText({ text: '' }),
  ]);
}

async function input(session, cmd) {
  if (!cmd || !(await stillSelected(session))) return;
  const frame = session.frames.get(cmd.sequence);
  if (!frame || performance.now() - frame.at > 1700) return;
  const { cssVisualViewport: view } = await protocol(session, 'Page.getLayoutMetrics');
  if (session !== current || !view || view.clientWidth !== frame.w || view.clientHeight !== frame.h ||
      view.pageX !== frame.left || view.pageY !== frame.top) return;
  const x = Math.min(frame.w - 1, frame.w * cmd.x), y = Math.min(frame.h - 1, frame.h * cmd.y);
  if (cmd.kind === 'tap') {
    const point = { x, y, button: 'left', clickCount: 1 };
    await protocol(session, 'Input.dispatchMouseEvent', { ...point, type: 'mousePressed', buttons: 1 });
    if (session === current) await protocol(session, 'Input.dispatchMouseEvent', { ...point, type: 'mouseReleased', buttons: 0 });
  } else if (cmd.kind === 'scroll') {
    await protocol(session, 'Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: cmd.delta });
  } else if (cmd.kind === 'text') {
    await protocol(session, 'Input.insertText', { text: cmd.text });
  } else if (cmd.kind === 'key' && ['Backspace', 'Tab', 'Escape'].includes(cmd.text)) {
    const code = { Backspace: 8, Tab: 9, Escape: 27 }[cmd.text];
    const key = { key: cmd.text, code: cmd.text, windowsVirtualKeyCode: code };
    await protocol(session, 'Input.dispatchKeyEvent', { ...key, type: 'keyDown' });
    if (session === current) await protocol(session, 'Input.dispatchKeyEvent', { ...key, type: 'keyUp' });
  }
}

async function cycle(session) {
  try {
    if (!(await stillSelected(session))) { await stop(session); return; }
    const { cssVisualViewport: view } = await protocol(session, 'Page.getLayoutMetrics');
    if (!view?.clientWidth || !view.clientHeight) { await stop(session); return; }
    const scale = Math.min(1, 1300 / view.clientWidth, 1000 / view.clientHeight);
    const clip = { x: view.pageX, y: view.pageY, width: view.clientWidth, height: view.clientHeight, scale };
    const at = performance.now();
    const { data: image } = await protocol(session, 'Page.captureScreenshot', {
      format: 'jpeg', quality: 68, clip, fromSurface: true, captureBeyondViewport: false,
    });
    if (!(await stillSelected(session))) { await stop(session); return; }
    const sequence = ++session.sequence;
    session.frames.set(sequence, { w: clip.width, h: clip.height, left: clip.x, top: clip.y, at });
    session.frames.delete(sequence - 4);
    const result = await agent({ action: 'exchange', token: session.token, sequence, image });
    await input(session, result.input);
    if (session === current) session.timer = setTimeout(() => cycle(session), delay);
  } catch {
    await stop(session);
  }
}

async function start() {
  if (starting) throw new Error('در حال راه‌اندازی…');
  if (current) return { code: current.code };
  starting = true;
  let tab;
  let attached = false;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!market(tab?.url) || tab.pendingUrl || tab.incognito) throw new Error('ابتدا تب معاملهٔ TrueTrade را انتخاب کن.');
    await chrome.debugger.attach({ tabId: tab.id }, '1.3');
    attached = true;
    const pair = await agent({ action: 'start' });
    current = { tabId: tab.id, windowId: tab.windowId, url: tab.url, token: pair.token, code: pair.code, sequence: 0, frames: new Map() };
    await chrome.action.setBadgeText({ text: 'LIVE' });
    cycle(current);
    return { code: pair.code };
  } catch (e) {
    if (current) await stop(current);
    else if (attached) await chrome.debugger.detach({ tabId: tab.id }).catch(() => {});
    throw e;
  } finally { starting = false; }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return;
  const work = message === 'start' ? start() : message === 'stop' ? stop() : Promise.resolve({ code: current?.code });
  work.then(r => respond(r || {}), e => respond({ error: e.message }));
  return true;
});
chrome.debugger.onDetach.addListener(({ tabId }) => { if (current?.tabId === tabId) stop(); });
chrome.tabs.onUpdated.addListener((id, change) => {
  if (id === current?.tabId && (change.status === 'loading' || change.url)) stop();
});
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  if (current?.windowId === windowId && current.tabId !== tabId) stop();
});
