// DHBlocker cosmetic engine. Runs at document_start in every frame.
// Builds one <style> from: enabled categories + focus presets for this host + user zaps for this host.
(function () {
  'use strict';
  if (window.__dhCosmetic) return;
  window.__dhCosmetic = true;

  const DH = self.DH;
  const host = DH.normalizeHost(location.hostname);
  const isTop = window.top === window;
  const STYLE_ID = 'dhblocker-style';
  const ADLIKE = /(^|[\s_-])(ad|ads|advert|advertisement|adslot|sponsor|sponsored)([\s_-]|$)/i;

  let settings = null;
  let styleEl = null;
  let unlockSelector = '';
  let adSelector = '';
  let observer = null;
  let timer = 0;

  function safe(selectors) {
    return selectors.filter((s) => {
      try { return CSS.supports('selector(' + s + ')'); } catch (e) { return false; }
    });
  }

  function rulesFor(selectors) {
    // one rule per selector so a single unsupported selector can never invalidate the rest
    return safe(selectors).map((s) => s + '{display:none!important}').join('\n');
  }

  function build() {
    const s = settings;
    const css = [];
    const unlock = [];
    const ads = [];

    for (const [key, cat] of Object.entries(DH.CATEGORIES)) {
      if (!s.categories[key]) continue;
      css.push(rulesFor(cat.selectors));
      if (cat.unlock) unlock.push(...safe(cat.selectors));
      if (key === 'ads') ads.push(...safe(cat.selectors));
    }

    for (const [id, preset] of Object.entries(DH.FOCUS_PRESETS)) {
      if (s.focus[id] && DH.hostMatches(host, preset.hosts)) css.push(rulesFor(preset.selectors));
    }

    const zaps = collectZaps(s);
    if (zaps.length) css.push(rulesFor(zaps.map((z) => z.selector)));

    css.push('[data-dh-collapsed]{display:none!important}');
    unlockSelector = unlock.join(',');
    adSelector = ads.join(',');
    return css.join('\n');
  }

  function collectZaps(s) {
    const out = [];
    for (const [h, list] of Object.entries(s.zaps || {})) {
      if (host === h || host.endsWith('.' + h)) out.push(...list.filter((z) => !z.disabled));
    }
    return out;
  }

  function ensureStyle(css) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
    }
    if (styleEl.textContent !== css) styleEl.textContent = css;
    const parent = document.documentElement;
    if (parent && !styleEl.isConnected) parent.appendChild(styleEl);
  }

  function removeStyle() {
    if (styleEl) styleEl.remove();
    document.querySelectorAll('[data-dh-collapsed]').forEach((e) => e.removeAttribute('data-dh-collapsed'));
    stopObserver();
  }

  // --- DOM clean-up (top frame only): collapse empty ad wrappers, free consent-locked scrolling ---

  function isHidden(el) {
    if (el.hasAttribute('data-dh-collapsed')) return true;
    if (/^(SCRIPT|STYLE|LINK|META|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) return true;
    return getComputedStyle(el).display === 'none';
  }

  function collapseWrappers() {
    if (!adSelector) return;
    let nodes;
    try { nodes = document.querySelectorAll(adSelector); } catch (e) { return; }
    for (const el of nodes) {
      let p = el.parentElement;
      for (let depth = 0; p && depth < 3; depth++, p = p.parentElement) {
        if (p === document.body || p === document.documentElement || /^(MAIN|ARTICLE|SECTION|FORM|NAV|HEADER|FOOTER)$/.test(p.tagName)) break;
        const label = (p.id || '') + ' ' + (typeof p.className === 'string' ? p.className : '');
        if (!ADLIKE.test(label)) continue;
        const kids = Array.from(p.children);
        if (kids.every(isHidden) && !(p.textContent || '').trim().replace(/advertisement|sponsored/gi, '').trim()) {
          p.setAttribute('data-dh-collapsed', '');
        }
      }
    }
  }

  function unlockScroll() {
    if (!unlockSelector) return;
    let found = false;
    try { found = !!document.querySelector(unlockSelector); } catch (e) { return; }
    if (!found) return;
    for (const el of [document.documentElement, document.body]) {
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.overflow === 'hidden' || cs.overflowY === 'hidden') el.style.setProperty('overflow', 'auto', 'important');
      if (cs.position === 'fixed' && el === document.body) el.style.setProperty('position', 'static', 'important');
    }
  }

  function tick() {
    timer = 0;
    if (!settings) return;
    collapseWrappers();
    unlockScroll();
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(tick, 250);
  }

  function startObserver() {
    if (!isTop || observer) return;
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    schedule();
  }

  function stopObserver() {
    if (observer) observer.disconnect();
    observer = null;
    clearTimeout(timer);
    timer = 0;
  }

  function apply(stored) {
    settings = DH.mergeSettings(stored);
    if (!settings.enabled || DH.isAllowlisted(host, settings.allowlist)) {
      removeStyle();
      return;
    }
    ensureStyle(build());
    startObserver();
  }

  // Keep our <style> alive if a page nukes <html> children.
  document.addEventListener('DOMContentLoaded', () => {
    if (styleEl && settings && !styleEl.isConnected && document.documentElement) document.documentElement.appendChild(styleEl);
    if (styleEl) startObserver();
  });

  chrome.storage.local.get('dh', (r) => apply(r && r.dh));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.dh) apply(changes.dh.newValue);
  });
})();
