(enabled => {
  // Run only in the top-level TrueTrade exchange document. Never read account or form data.
  if (window.top !== window || location.origin !== 'https://www.thetruetrade.io') return;
  const path = /^\/(?:[a-z]{2}\/)?trade\/(?:futures\/)?([A-Z0-9]{3,30})\/?$/;
  const id = 'phonebox-truetrade-layout';
  const selector = 'main > .grid:has(> .order-3 > form [data-testid="order-form"]):has(> .order-4 [role="tablist"] [role="tab"])';
  if (typeof window.phoneBoxTrueTradeLayout === 'function') {
    window.phoneBoxTrueTradeLayout(enabled);
    return;
  }
  if (!CSS.supports('selector(:has(*))')) return;

  const style = document.createElement('style');
  style.id = id;
  const scope = 'main > [data-phonebox-trade-pair]';
  const screen = '.min-h-screen:has(> .pb-8 > ' + scope + ')';
  const footer = 'main:has(> [data-phonebox-trade-pair]) + footer.fixed:has(> .min-w-10)';
  style.textContent = `
    ${screen} > header.h-14 { display: none !important; }
    ${screen} > .pb-8 { padding-bottom: 0 !important; }
    main:has(> [data-phonebox-trade-pair]) { min-height: 0 !important; }
    ${footer} {
      position: static !important;
      min-height: 24px;
      height: auto !important;
      border: 0 !important;
      padding-inline: 8px;
    }
    ${footer} > .flex-1 { display: none !important; }
    ${scope} {
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 8px !important;
      padding: 6px;
      background: var(--background) !important;
    }
    ${scope} > :is(.order-1, .order-2) { display: none !important; }
    ${scope} > :is(.order-3, .order-4) {
      grid-area: auto !important;
      min-width: 0;
      align-self: start;
      border-radius: 12px !important;
      border: 1px solid var(--border);
    }
    ${scope} > .order-3::before {
      content: attr(data-phonebox-trade-pair);
      display: block;
      padding: 12px 16px 0;
      font-weight: 600;
      direction: ltr;
      text-align: start;
    }
    @media (min-width: 880px) {
      ${scope} { grid-template-columns: minmax(300px, 360px) minmax(0, 1fr) !important; }
      ${scope} > .order-4 { align-self: stretch; }
    }
  `;

  let active = false;
  let grid = null;
  let form = null;
  let scheduled = false;
  const update = () => {
    scheduled = false;
    const pair = active ? location.pathname.match(path)?.[1] : null;
    const next = pair ? document.querySelector(selector) : null;
    const nextForm = next?.querySelector(':scope > .order-3') ?? null;
    if (grid !== next) grid?.removeAttribute('data-phonebox-trade-pair');
    if (form !== nextForm) form?.removeAttribute('data-phonebox-trade-pair');
    grid = next;
    form = nextForm;
    if (!grid || !form) return;
    if (grid.getAttribute('data-phonebox-trade-pair') !== pair) grid.setAttribute('data-phonebox-trade-pair', pair);
    if (form.getAttribute('data-phonebox-trade-pair') !== pair) form.setAttribute('data-phonebox-trade-pair', pair);
  };
  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  };
  const observer = new MutationObserver(schedule);
  window.phoneBoxTrueTradeLayout = value => {
    active = value === true;
    if (active) {
      if (!style.isConnected) document.head.append(style);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      window.addEventListener('popstate', schedule);
    } else {
      observer.disconnect();
      window.removeEventListener('popstate', schedule);
      style.remove();
    }
    update();
  };
  window.phoneBoxTrueTradeLayout(enabled);
})
