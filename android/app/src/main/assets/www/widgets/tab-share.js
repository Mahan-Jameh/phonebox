import { api, bridge, h } from '../main.js';
import { W } from '../registry.js';

W.truetrade_remote = {
  needs: [],
  create(box) {
    box.classList.add('tt-remote');
    const bar = h('div', 'tt-remote-bar');
    const title = h('strong', '', 'TrueTrade · ویندوز');
    const status = h('span', 'tt-remote-status', 'افزونه را روی تب TrueTrade در Chrome باز کن.');
    status.setAttribute('aria-live', 'polite');
    const pairing = h('form', 'tt-remote-bar');
    const code = h('input', '');
    code.inputMode = 'numeric';
    code.maxLength = 8;
    code.placeholder = 'کد ۸ رقمی';
    code.setAttribute('aria-label', 'کد یک‌بارمصرف تبلت');
    const join = h('button', '', 'اتصال');
    pairing.append(code, join);
    const view = h('img', 'tt-remote-view');
    view.alt = 'نمای زندهٔ تب TrueTrade روی ویندوز';
    view.draggable = false;
    view.hidden = true;
    const tools = h('form', 'tt-remote-bar');
    tools.hidden = true;
    const amount = h('input', '');
    amount.inputMode = 'decimal';
    amount.maxLength = 32;
    amount.placeholder = 'عدد برای فیلد انتخاب‌شده';
    amount.setAttribute('aria-label', 'عدد برای فیلد انتخاب‌شده در Chrome');
    const send = h('button', '', 'ارسال عدد');
    const erase = h('button', '', '⌫');
    erase.type = 'button';
    erase.setAttribute('aria-label', 'پاک کردن یک رقم');
    const close = h('button', '', 'قطع نمایش');
    close.type = 'button';
    tools.append(amount, send, erase, close);
    bar.append(title, status);
    box.append(bar, pairing, view, tools);
    if (!bridge) {
      pairing.hidden = true;
      status.textContent = 'نمای زنده و لمس روی دستگاه جفت‌شده فعال می‌شود.';
      return {};
    }

    const path = '/tab-share/viewer';
    let token = '', sequence = 0, at = 0, timer = 0, down = null, destroyed = false, busy = false;
    function reset(message) {
      token = ''; sequence = 0; at = 0;
      view.removeAttribute('src');
      view.hidden = tools.hidden = true;
      pairing.hidden = false;
      status.textContent = message;
    }

    pairing.addEventListener('submit', async event => {
      event.preventDefault();
      if (!/^\d{8}$/.test(code.value) || join.disabled) return;
      join.disabled = true;
      try {
        const pair = await api(path + '/claim?code=' + encodeURIComponent(code.value), 'POST');
        if (destroyed) return;
        token = pair.token;
        code.value = '';
        pairing.hidden = true;
        status.textContent = 'منتظر تصویر ویندوز…';
        clearTimeout(timer);
        tick();
      } catch {
        status.textContent = 'کد معتبر نیست یا اشتراک روی ویندوز قطع شده است.';
      } finally { join.disabled = false; }
    });

    async function tick() {
      if (!token || destroyed) return;
      const session = token;
      try {
        const rect = box.getBoundingClientRect();
        if (!document.hidden && rect.right > 0 && rect.left < innerWidth) {
          const frame = await api(path + '/frame?token=' + token + '&after=' + sequence, 'GET', 2200);
          if (token !== session || destroyed) return;
          if (frame.image) {
            const source = 'data:image/jpeg;base64,' + frame.image;
            const staged = new Image();
            staged.src = source;
            await staged.decode();
            if (token !== session || destroyed) return;
            view.src = source;
            sequence = frame.sequence;
            at = performance.now();
            view.hidden = tools.hidden = false;
          }
          status.textContent = at && performance.now() - at < 1600 ? 'زنده' : 'منتظر تصویر تازه…';
        }
      } catch (e) {
        if (token !== session || destroyed) return;
        if (e.status === 404 || e.status === 403) { reset('اشتراک پایان یافت. کد تازه بگیر.'); return; }
        at = 0;
        status.textContent = 'در انتظار اتصال دوباره…';
      }
      if (token === session && !destroyed) timer = setTimeout(tick, 280);
    }

    async function input(kind, point = { x: .5, y: .5 }, delta = 0, text = '', frameSequence = sequence) {
      if (!token || !sequence || performance.now() - at > 1500 || busy) return;
      busy = true;
      try {
        const q = new URLSearchParams({ token, sequence: frameSequence, kind, ...point, delta, ...(text ? { text } : {}) });
        await api(path + '/input?' + q, 'POST');
        return true;
      } catch { status.textContent = 'فرمان ارسال نشد. تصویر تازه را بررسی کن.'; }
      finally { busy = false; }
    }

    const point = e => {
      const r = view.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };
    view.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0) return;
      down = { ...point(e), id: e.pointerId, sequence, ypx: e.clientY, xpx: e.clientX };
      view.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });
    view.addEventListener('pointercancel', () => { down = null; });
    view.addEventListener('pointerup', e => {
      const first = down;
      down = null;
      if (!first || e.pointerId !== first.id || sequence - first.sequence > 1) return;
      e.stopPropagation();
      const p = point(e);
      if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return;
      const dy = first.ypx - e.clientY;
      if (Math.abs(dy) > 12) input('scroll', p, Math.max(-900, Math.min(900, dy * 2)), '', first.sequence);
      else if (Math.abs(e.clientX - first.xpx) < 12) input('tap', p, 0, '', first.sequence);
    });
    tools.addEventListener('submit', async e => {
      e.preventDefault();
      const text = amount.value;
      if (/^[0-9.,-]{1,32}$/.test(text) && await input('text', undefined, 0, text) && amount.value === text) amount.value = '';
    });
    erase.addEventListener('click', () => input('key', undefined, 0, 'Backspace'));
    close.addEventListener('click', () => {
      if (token) api(path + '/leave?token=' + token, 'POST').catch(() => {});
      clearTimeout(timer);
      reset('نمایش قطع شد.');
    });
    return { destroy() { destroyed = true; clearTimeout(timer); token = ''; } };
  },
};
