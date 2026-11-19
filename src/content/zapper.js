// DHBlocker Zapper (multi-select): toggle it on, click everything you want gone, press Done and
// all of it is hidden (and remembered for this site) at once. Calling again toggles it off (cancel).
(function () {
  'use strict';
  if (window.__dhZapper) { window.__dhZapper.stop(); return; }

  const S = window.__dhSelector;
  const host = location.hostname.toLowerCase().replace(/^www\./, '');

  let raw = null;          // element physically under the cursor
  let hovered = null;      // what a click would select (raw, or a stepped parent/child of it)
  let downStack = [];
  const picks = [];        // [{ els: Element[], selector, label }]
  let raf = 0;

  // ---------- UI (shadow DOM so page CSS can never touch it) ----------
  const hostEl = document.createElement('dh-zapper-root');
  hostEl.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const shadow = hostEl.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      *{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      .hover{position:fixed;display:none;pointer-events:none;border:2px dashed #4da3ff;background:rgba(77,163,255,.14);border-radius:3px}
      .sel{position:fixed;pointer-events:none;border:2px solid #ff4d6a;background:rgba(255,77,106,.22);border-radius:3px}
      .chip{position:fixed;display:none;pointer-events:none;background:#10131a;color:#e8ecf4;font-size:11px;padding:3px 7px;border-radius:5px;white-space:nowrap;max-width:60vw;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,.4)}
      .bar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);pointer-events:auto;display:flex;flex-direction:column;gap:7px;background:#10131a;color:#e8ecf4;padding:10px 12px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.5);border:1px solid #2a3142;min-width:360px;max-width:92vw}
      .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
      .title{font-weight:600;font-size:12px;letter-spacing:.3px;color:#9fb4d6;display:flex;justify-content:space-between;gap:12px}
      #count{color:#fff}
      button{all:unset;cursor:pointer;background:#1b2130;color:#e8ecf4;font-size:12px;padding:6px 10px;border-radius:7px;border:1px solid #2a3142}
      button:hover{background:#252d42}
      button[disabled]{opacity:.35;cursor:default}
      button.primary{background:#e23d5b;border-color:#e23d5b;color:#fff;font-weight:600}
      button.primary:hover{background:#f04a68}
      .sp{flex:1}
      label{font-size:12px;color:#c5d0e6;display:flex;gap:5px;align-items:center;cursor:pointer}
      input{accent-color:#e23d5b}
      .keys{font-size:10.5px;color:#7283a3}
      kbd{background:#1b2130;border:1px solid #2a3142;border-radius:4px;padding:0 4px;font:10px ui-monospace,Consolas,monospace}
    </style>
    <div id="marks"></div>
    <div class="hover" id="hover"></div>
    <div class="chip" id="chip"></div>
    <div class="bar">
      <div class="title"><span>\u26a1 DHBlocker Zapper \u2014 click everything you want gone</span><span id="count">0 selected</span></div>
      <div class="row">
        <button id="up" title="Hovered element \u2192 parent (\u2191 or Alt+wheel up)">\u25b2 Parent</button>
        <button id="down" title="Hovered element \u2192 child (\u2193 or Alt+wheel down)">\u25bc Child</button>
        <button id="similar" title="Also select all similar elements (S)">+ Similar</button>
        <button id="remove" title="Remove last pick (Backspace / Ctrl+Z)">\u21b6 Undo pick</button>
        <span class="sp"></span>
        <label title="Keep these hidden on future visits"><input type="checkbox" id="remember" checked> Remember</label>
      </div>
      <div class="row">
        <button id="cancel" title="Discard and exit (Esc)">Cancel</button>
        <span class="sp"></span>
        <button id="done" class="primary" title="Hide all selected (Enter)">Done \u2014 hide selected</button>
      </div>
      <div class="keys">Click = select / unselect \u00b7 <kbd>\u2191</kbd><kbd>\u2193</kbd> or <kbd>Alt</kbd>+wheel = parent / child \u00b7 <kbd>S</kbd> similar \u00b7 <kbd>Enter</kbd> done \u00b7 <kbd>Esc</kbd> cancel</div>
    </div>`;
  const $ = (id) => shadow.getElementById(id);
  const hoverBox = $('hover'), chip = $('chip'), marks = $('marks'), countEl = $('count');
  const btn = { up: $('up'), down: $('down'), similar: $('similar'), remove: $('remove'), cancel: $('cancel'), done: $('done') };
  document.documentElement.appendChild(hostEl);

  // ---------- helpers ----------
  const ours = (e) => e.composedPath && e.composedPath().includes(hostEl);
  const isRoot = (el) => !el || el === document.documentElement || el === document.body;
  const allPicked = () => picks.flatMap((p) => p.els);
  const isPicked = (el) => picks.findIndex((p) => p.els.length === 1 && p.els[0] === el);

  function pick(x, y) {
    const el = document.elementFromPoint(x, y);
    return el && el !== hostEl && !isRoot(el) ? el : null;
  }

  function render() {
    raf = 0;
    // selected marks
    marks.innerHTML = '';
    let n = 0;
    for (const el of allPicked()) {
      if (!el.isConnected || n++ > 400) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const d = document.createElement('div');
      d.className = 'sel';
      d.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
      marks.appendChild(d);
    }
    // hover preview
    const el = hovered;
    if (!el || !el.isConnected) { hoverBox.style.display = chip.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    hoverBox.style.cssText = `display:block;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    chip.textContent = S.describe(el) + (isPicked(el) >= 0 ? '  (click to unselect)' : '');
    const top = r.top > 26 ? r.top - 24 : r.bottom + 4;
    chip.style.cssText = `display:block;left:${Math.max(4, Math.min(r.left, innerWidth - 220))}px;top:${top}px`;
  }
  const requestRender = () => { if (!raf) raf = requestAnimationFrame(render); };

  function refreshBar() {
    const total = picks.reduce((n, p) => n + p.els.length, 0);
    countEl.textContent = total + ' selected';
    btn.done.textContent = total ? `Done \u2014 hide ${total}` : 'Done';
    btn.done.disabled = !total;
    btn.remove.disabled = !picks.length;
    btn.up.disabled = !hovered || isRoot(hovered.parentElement);
    btn.down.disabled = !hovered || !(downStack.length || hovered.firstElementChild);
    const sim = hovered && S.similar(hovered);
    btn.similar.disabled = !sim;
    btn.similar.textContent = sim ? `+ Similar (${sim.count})` : '+ Similar';
    requestRender();
  }

  // ---------- selection ----------
  function toggle(el) {
    const i = isPicked(el);
    if (i >= 0) { picks.splice(i, 1); return refreshBar(); }
    const selector = S.forElement(el);
    if (!selector) return;
    picks.push({ els: [el], selector, label: S.describe(el) });
    refreshBar();
  }

  function addSimilar() {
    if (!hovered) return;
    const sim = S.similar(hovered);
    if (!sim) return;
    const els = Array.from(document.querySelectorAll(sim.selector)).filter((e) => !isRoot(e));
    // replace singles already covered by the group
    for (let i = picks.length - 1; i >= 0; i--) if (picks[i].els.length === 1 && els.includes(picks[i].els[0])) picks.splice(i, 1);
    picks.push({ els, selector: sim.selector, label: 'similar: ' + sim.selector });
    refreshBar();
  }

  function undoPick() {
    if (picks.pop()) refreshBar();
  }

  function stepUp() {
    if (!hovered || isRoot(hovered.parentElement)) return;
    downStack.push(hovered);
    hovered = hovered.parentElement;
    refreshBar();
  }
  function stepDown() {
    if (!hovered) return;
    const next = downStack.length ? downStack.pop() : hovered.firstElementChild;
    if (next) { hovered = next; refreshBar(); }
  }

  // ---------- commit ----------
  function toast(text) {
    const t = document.createElement('dh-toast');
    t.style.cssText = 'all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647;pointer-events:none';
    const sh = t.attachShadow({ mode: 'closed' });
    sh.innerHTML = '<div style="font:13px system-ui,sans-serif;background:#10131a;color:#e8ecf4;padding:9px 14px;border-radius:10px;border:1px solid #2a3142;box-shadow:0 6px 24px rgba(0,0,0,.45)">\u26a1 ' + text + '</div>';
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }

  function done() {
    if (!picks.length) return;
    const remember = $('remember').checked;
    const batch = picks.slice();
    let hiddenCount = 0;
    for (const p of batch) for (const el of p.els) { el.style.setProperty('display', 'none', 'important'); hiddenCount++; }
    if (remember) {
      chrome.storage.local.get('dh', (r) => {
        const dh = (r && r.dh) || {};
        dh.zaps = dh.zaps || {};
        dh.stats = dh.stats || {};
        const list = (dh.zaps[host] = dh.zaps[host] || []);
        for (const p of batch) {
          if (!list.some((z) => z.selector === p.selector)) list.push({ selector: p.selector, label: p.label, added: Date.now() });
        }
        dh.stats.zapped = (dh.stats.zapped || 0) + batch.length;
        chrome.storage.local.set({ dh });
      });
    }
    stop();
    toast(`Zapped ${hiddenCount} element${hiddenCount === 1 ? '' : 's'}` + (remember ? ' \u00b7 saved for this site' : ''));
  }

  function stop() {
    for (const [t, fn, opt] of listeners) window.removeEventListener(t, fn, opt);
    cancelAnimationFrame(raf);
    hostEl.remove();
    window.__dhZapper = null;
  }

  // ---------- events ----------
  function onMove(e) {
    if (ours(e)) return;
    const el = pick(e.clientX, e.clientY);
    if (el !== raw) { raw = el; hovered = el; downStack = []; refreshBar(); }
  }

  function swallow(e) {
    if (ours(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function onClick(e) {
    if (ours(e)) return;
    swallow(e);
    if (!hovered || raw !== pick(e.clientX, e.clientY)) { raw = pick(e.clientX, e.clientY); hovered = raw; downStack = []; }
    if (hovered) toggle(hovered);
  }

  function onWheel(e) {
    if (ours(e) || !e.altKey || !hovered) return;
    e.preventDefault();
    if (e.deltaY < 0) stepUp(); else stepDown();
  }

  function onKey(e) {
    const k = e.key;
    if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); return stop(); }
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); e.stopImmediatePropagation(); return undoPick(); }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const act = { ArrowUp: stepUp, ArrowDown: stepDown, Enter: done, Backspace: undoPick, Delete: undoPick, s: addSimilar, S: addSimilar }[k];
    if (act) { e.preventDefault(); e.stopImmediatePropagation(); act(); }
  }

  const listeners = [
    ['mousemove', onMove, true], ['click', onClick, true],
    ['mousedown', swallow, true], ['mouseup', swallow, true], ['pointerdown', swallow, true], ['pointerup', swallow, true],
    ['auxclick', swallow, true], ['dblclick', swallow, true], ['contextmenu', swallow, true],
    ['wheel', onWheel, { capture: true, passive: false }], ['keydown', onKey, true],
    ['scroll', requestRender, true], ['resize', requestRender, true]
  ];
  for (const [t, fn, opt] of listeners) window.addEventListener(t, fn, opt);

  btn.up.onclick = stepUp; btn.down.onclick = stepDown; btn.similar.onclick = addSimilar;
  btn.remove.onclick = undoPick; btn.cancel.onclick = stop; btn.done.onclick = done;

  window.__dhZapper = { stop };
  refreshBar();
})();
