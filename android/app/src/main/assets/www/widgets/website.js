import { bridge, h } from '../main.js';
import { W } from '../registry.js';

let nextWebsiteId = 1;

function httpsUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch (_) { return ''; }
}

W.website = {
  needs: [],
  create(box, { o, page, w }) {
    const id = String(w.id || `${page?.id || 'page'}:${w.x ?? 0}:${w.y ?? 0}:${nextWebsiteId++}`).slice(0, 180);
    const bar = h('div', 'ws-bar');
    const title = h('span', 'ws-title', 'Website');
    const action = (name, label, cmd) => {
      const b = h('button', 'ws-btn', label);
      b.type = 'button'; b.title = name; b.setAttribute('aria-label', name);
      b.addEventListener('click', () => {
        if (bridge?.websiteAction) bridge.websiteAction(id, cmd);
        else if (cmd === 'refresh' && frame) frame.src = url;
        else if (cmd === 'fullscreen') frame?.requestFullscreen?.().catch?.(() => {});
      });
      return b;
    };
    const back = action('Back', '‹', 'back');
    const reload = action('Refresh', '↻', 'refresh');
    const zoomOut = action('Zoom out', '−', 'zoomOut');
    const zoomIn = action('Zoom in', '+', 'zoomIn');
    const full = action('Fullscreen', '⛶', 'fullscreen');
    const url = httpsUrl(o.url);
    title.textContent = url ? new URL(url).host : 'Website';
    const frame = bridge ? null : document.createElement('iframe');
    if (frame) {
      frame.className = 'ws-frame'; frame.title = 'Website preview';
      frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      if (url) frame.src = url;
    }
    bar.append(back, reload, zoomOut, zoomIn, full, title);
    const stage = h('div', 'ws-stage');
    if (frame) stage.append(frame);
    else stage.append(h('div', 'ws-native-note', 'Native secure WebView'));
    box.classList.add('w-website');
    box.append(bar, stage);
    if (!url) {
      stage.replaceChildren(h('div', 'empty', 'Enter a valid HTTPS website URL in Settings.'));
      return {};
    }
    if (!bridge?.websiteSet) return { update() {} }; // desktop editor preview uses the isolated sandboxed iframe

    let last = '';
    let dead = false;
    const sync = () => {
      if (dead || !stage.isConnected) return;
      const r = stage.getBoundingClientRect();
      const visible = r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
      const values = [url, r.left, r.top, r.width, r.height, visible, o.javascript !== false, o.cookies !== false, o.zoom !== false];
      const key = values.join('|');
      if (key === last) return;
      last = key;
      bridge.websiteSet(id, url, r.left, r.top, r.width, r.height, visible, o.javascript !== false, o.cookies !== false, o.zoom !== false);
    };
    const resize = new ResizeObserver(sync);
    resize.observe(stage);
    const timer = setInterval(sync, 100); // page swipes and CSS transitions move the native surface without resizing it
    sync();
    return {
      update: sync,
      destroy() {
        dead = true; clearInterval(timer); resize.disconnect();
        bridge.websiteRemove(id);
      },
    };
  },
};
