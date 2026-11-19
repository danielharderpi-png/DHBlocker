// Unfreeze Page: undo scroll locks, remove blocking overlays/backdrops and paywall blur.
// Injected on demand; returns the number of things it fixed.
(function () {
  'use strict';
  const KEYWORD = /modal|overlay|popup|pop-up|consent|cookie|paywall|gate|dialog|interstitial|subscribe|newsletter|backdrop|lightbox|wall|blocker|adblock/i;
  const LOCK_CLASS = /(^|[-_])(modal-open|no-?scroll|scroll-?lock(ed)?|overflow-hidden|is-locked|lock-?scroll|disable-?scroll|prevent-?scroll|has-modal|noscroll|fixed-body|stop-scrolling)([-_]|$)/i;
  let fixed = 0;

  // 1. scroll locks
  for (const el of [document.documentElement, document.body]) {
    if (!el) continue;
    for (const c of Array.from(el.classList)) {
      if (LOCK_CLASS.test(c)) { el.classList.remove(c); fixed++; }
    }
    const cs = getComputedStyle(el);
    if (cs.overflow === 'hidden' || cs.overflowY === 'hidden' || cs.overflow === 'clip') {
      el.style.setProperty('overflow', 'auto', 'important'); fixed++;
    }
    if (el === document.body && cs.position === 'fixed') { el.style.setProperty('position', 'static', 'important'); fixed++; }
    if (cs.touchAction === 'none') el.style.setProperty('touch-action', 'auto', 'important');
    if (cs.filter && cs.filter.includes('blur')) { el.style.setProperty('filter', 'none', 'important'); fixed++; }
  }

  // 2. blocking overlays (user-triggered, so we can afford to scan everything)
  const vw = innerWidth, vh = innerHeight;
  const all = document.body ? document.body.querySelectorAll('*') : [];
  const limit = Math.min(all.length, 25000);
  for (let i = 0; i < limit; i++) {
    const el = all[i];
    if (el.hasAttribute('data-dh-unfrozen')) continue;
    const cs = getComputedStyle(el);
    if (cs.filter && cs.filter.includes('blur') && el.parentElement === document.body) {
      el.style.setProperty('filter', 'none', 'important'); fixed++; continue;
    }
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    const cover = (Math.min(r.right, vw) - Math.max(r.left, 0)) * (Math.min(r.bottom, vh) - Math.max(r.top, 0)) / (vw * vh);
    if (cover <= 0.2) continue;
    const label = (el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '') + ' ' + (el.getAttribute('role') || '');
    const keyword = KEYWORD.test(label) || el.getAttribute('aria-modal') === 'true' || el.getAttribute('role') === 'dialog' || el.getAttribute('role') === 'alertdialog';
    const bg = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
    const alpha = bg ? (bg[1].split(',')[3] !== undefined ? parseFloat(bg[1].split(',')[3]) : 1) : 0;
    const translucent = (alpha > 0 && alpha < 1) || (cs.opacity !== '1' && parseFloat(cs.opacity) > 0) || (cs.backdropFilter && cs.backdropFilter !== 'none');
    const bareBackdrop = cover > 0.8 && translucent && (el.textContent || '').trim().length < 25;
    const protectedEl = el.querySelector('video, canvas, audio') || /^(HEADER|NAV)$/.test(el.tagName);
    if (protectedEl) continue;
    if ((keyword && cover > 0.2) || bareBackdrop) {
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('data-dh-unfrozen', '');
      fixed++;
    }
  }

  // toast
  try {
    const host = document.createElement('dh-toast');
    host.style.cssText = 'all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647;pointer-events:none';
    const sh = host.attachShadow({ mode: 'closed' });
    sh.innerHTML = '<div style="font:13px system-ui,sans-serif;background:#10131a;color:#e8ecf4;padding:9px 14px;border-radius:10px;border:1px solid #2a3142;box-shadow:0 6px 24px rgba(0,0,0,.45)">\ud83d\udd13 Unfroze page' + (fixed ? ' \u00b7 ' + fixed + ' fix' + (fixed > 1 ? 'es' : '') : ' \u00b7 nothing to fix') + '</div>';
    document.documentElement.appendChild(host);
    setTimeout(() => host.remove(), 2200);
  } catch (e) { /* ignore */ }

  return fixed;
})();
