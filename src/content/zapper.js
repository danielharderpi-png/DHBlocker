// DHBlocker Zapper: point-and-click element remover with container stepping, undo,
// "hide similar" and per-site persistence. Injected on demand; calling again toggles it off.
(function () {
  'use strict';
  if (window.__dhZapper) { window.__dhZapper.stop(); return; }

  const S = window.__dhSelector;
  const host = location.hostname.toLowerCase().replace(/^www\./, '');

  let hovered = null;      // element under the cursor
  let target = null;       // locked element
  let downStack = [];      // path for stepping back down
  const undo = [];         // {type, el(s), selector}
  let raf = 0;
  let lastX = 0, lastY = 0;

  // ---------- UI (shadow DOM so the page's CSS can never touch it) ----------
  const hostEl = document.createElement('dh-zapper-root');
  hostEl.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const shadow = hostEl.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      *{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      .box{position:fixed;display:none;pointer-events:none;border:2px dashed #4da3ff;background:rgba(77,163,255,.14);border-radius:3px;transition:all .06s}
      .box.locked{border:2px solid #ff4d6a;background:rgba(255,77,106,.18)}
      .chip{position:fixed;display:none;pointer-events:none;background:#10131a;color:#e8ecf4;font-size:11px;padding:3px 7px;border-radius:5px;white-space:nowrap;max-width:60vw;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,.4)}
      .bar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);pointer-events:auto;display:flex;flex-direction:column;gap:6px;background:#10131a;color:#e8ecf4;padding:10px 12px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.5);border:1px solid #2a3142;min-width:340px;max-width:92vw}
      .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
      .title{font-weight:600;font-size:12px;letter-spacing:.3px;color:#9fb4d6;display:flex;justify-content:space-between;gap:12px}
      .sel{font:11px ui-monospace,Consolas,monospace;color:#9fb4d6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:480px}
      button{all:unset;cursor:pointer;background:#1b2130;color:#e8ecf4;font-size:12px;padding:6px 10px;border-radius:7px;border:1px solid #2a3142}
      button:hover{background:#252d42}
      button[disabled]{opacity:.35;cursor:default}
      button.primary{background:#e23d5b;border-color:#e23d5b;color:#fff}
      button.primary:hover{background:#f04a68}
      .keys{font-size:10.5px;color:#7283a3}
      kbd{background:#1b2130;border:1px solid #2a3142;border-radius:4px;padding:0 4px;font:10px ui-monospace,Consolas,monospace}
    </style>
    <div class="box" id="box"></div>
    <div class="chip" id="chip"></div>
    <div class="bar" id="bar">
      <div class="title"><span>\u26a1 DHBlocker Zapper</span><span id="msg"></span></div>
      <div class="sel" id="sel">Hover an element and click it to select</div>
      <div class="row">
        <button id="up" title="Select parent (\u2191 / Alt+wheel up)">\u25b2 Parent</button>
        <button id="down" title="Select child (\u2193 / Alt+wheel down)">\u25bc Child</button>
        <button id="once" title="Hide until the page reloads (Delete)">Hide once</button>
        <button id="always" class="primary" title="Hide & remember on this site (Enter)">Hide always</button>
        <button id="similar" title="Hide all similar elements & remember (S)">Hide similar</button>
        <button id="undo" title="Undo (Ctrl+Z)">Undo</button>
        <button id="done" title="Exit (Esc)">Done</button>
      </div>
      <div class="keys"><kbd>\u2191</kbd><kbd>\u2193</kbd>/<kbd>Alt</kbd>+wheel step container \u00b7 <kbd>Enter</kbd> always \u00b7 <kbd>Del</kbd> once \u00b7 <kbd>S</kbd> similar \u00b7 <kbd>Ctrl+Z</kbd> undo \u00b7 <kbd>Esc</kbd> exit</div>
    </div>`;
  const $ = (id) => shadow.getElementById(id);
  const box = $('box'), chip = $('chip'), bar = $('bar'), selEl = $('sel'), msg = $('msg');
  const btn = { up: $('up'), down: $('down'), once: $('once'), always: $('always'), similar: $('similar'), undo: $('undo'), done: $('done') };
  document.documentElement.appendChild(hostEl);

  let msgTimer = 0;
  function say(text) {
    msg.textContent = text;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => (msg.textContent = ''), 2500);
  }

  // ---------- helpers ----------
  const ours = (e) => e.composedPath && e.composedPath().includes(hostEl);
  const isRoot = (el) => !el || el === document.documentElement || el === document.body;

  function pick(x, y) {
    const el = document.elementFromPoint(x, y);
    return el && el !== hostEl && !isRoot(el) ? el : null;
  }

  function render() {
    raf = 0;
    const el = target || hovered;
    if (!el || !el.isConnected) { box.style.display = chip.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    box.style.cssText = `display:block;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    box.className = 'box' + (target ? ' locked' : '');
    chip.textContent = S.describe(el);
    const top = r.top > 26 ? r.top - 24 : r.bottom + 4;
    chip.style.cssText = `display:block;left:${Math.max(4, Math.min(r.left, innerWidth - 200))}px;top:${top}px`;
  }
  const requestRender = () => { if (!raf) raf = requestAnimationFrame(render); };

  function refreshBar() {
    btn.up.disabled = !target || isRoot(target.parentElement);
    btn.down.disabled = !target || !(downStack.length || target.firstElementChild);
    for (const k of ['once', 'always']) btn[k].disabled = !target;
    btn.similar.disabled = !target || !S.similar(target);
    const sim = target && S.similar(target);
    btn.similar.textContent = sim ? `Hide similar (${sim.count})` : 'Hide similar';
    btn.undo.disabled = !undo.length;
    selEl.textContent = target ? S.forElement(target) : 'Hover an element and click it to select';
    requestRender();
  }

  function select(el, keepStack) {
    target = el;
    if (!keepStack) downStack = [];
    refreshBar();
  }

  // ---------- actions ----------
  function hideInline(els) {
    for (const el of els) {
      undoable.set(el, el.getAttribute('style'));
      el.style.setProperty('display', 'none', 'important');
    }
  }
  const undoable = new WeakMap();
  function restoreInline(els) {
    for (const el of els) {
      const prev = undoable.get(el);
      if (prev === null || prev === undefined) el.removeAttribute('style'); else el.setAttribute('style', prev);
    }
  }

  function mutateSettings(fn) {
    return new Promise((resolve) => {
      chrome.storage.local.get('dh', (r) => {
        const dh = (r && r.dh) || {};
        dh.zaps = dh.zaps || {};
        dh.stats = dh.stats || {};
        fn(dh);
        chrome.storage.local.set({ dh }, resolve);
      });
    });
  }

  function remember(selector, label) {
    return mutateSettings((dh) => {
      const list = (dh.zaps[host] = dh.zaps[host] || []);
      if (!list.some((z) => z.selector === selector)) list.push({ selector, label: label || selector, added: Date.now() });
      dh.stats.zapped = (dh.stats.zapped || 0) + 1;
    });
  }
  function forget(selector) {
    return mutateSettings((dh) => {
      dh.zaps[host] = (dh.zaps[host] || []).filter((z) => z.selector !== selector);
      if (!dh.zaps[host].length) delete dh.zaps[host];
    });
  }

  function zapOnce() {
    if (!target) return;
    const el = target;
    hideInline([el]);
    undo.push({ type: 'once', els: [el] });
    say('Hidden for this visit');
    target = null; hovered = null; downStack = [];
    refreshBar();
  }

  function zapAlways() {
    if (!target) return;
    const el = target, selector = S.forElement(el);
    if (!selector) return say('Could not build a selector');
    const matches = S.count(selector);
    hideInline([el]);
    undo.push({ type: 'always', els: [el], selector });
    remember(selector, S.describe(el));
    say(matches > 1 ? `Saved (matches ${matches})` : 'Saved for this site');
    target = null; hovered = null; downStack = [];
    refreshBar();
  }

  function zapSimilar() {
    if (!target) return;
    const sim = S.similar(target);
    if (!sim) return say('No similar elements');
    const els = Array.from(document.querySelectorAll(sim.selector));
    hideInline(els);
    undo.push({ type: 'always', els, selector: sim.selector });
    remember(sim.selector, 'similar: ' + sim.selector);
    say(`Saved ${sim.count} similar`);
    target = null; hovered = null; downStack = [];
    refreshBar();
  }

  function doUndo() {
    const last = undo.pop();
    if (!last) return;
    restoreInline(last.els);
    if (last.type === 'always') forget(last.selector);
    say('Undone');
    refreshBar();
  }

  function stepUp() {
    if (!target) return;
    const p = target.parentElement;
    if (isRoot(p)) return;
    downStack.push(target);
    select(p, true);
  }
  function stepDown() {
    if (!target) return;
    const next = downStack.length ? downStack.pop() : target.firstElementChild;
    if (next) select(next, true);
  }

  function stop() {
    for (const [t, fn, opt] of listeners) window.removeEventListener(t, fn, opt);
    cancelAnimationFrame(raf);
    hostEl.remove();
    window.__dhZapper = null;
  }

  // ---------- events ----------
  function onMove(e) {
    lastX = e.clientX; lastY = e.clientY;
    if (ours(e) || target) return;
    const el = pick(e.clientX, e.clientY);
    if (el !== hovered) { hovered = el; requestRender(); }
  }

  function swallow(e) {
    if (ours(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function onClick(e) {
    if (ours(e)) return;
    swallow(e);
    const el = pick(e.clientX, e.clientY);
    if (el) select(el);
  }

  function onWheel(e) {
    if (ours(e)) return;
    if (!e.altKey) return; // plain wheel keeps scrolling the page; Alt+wheel steps containers
    const active = target || hovered;
    if (!active) return;
    e.preventDefault();
    if (!target) select(hovered);
    if (e.deltaY < 0) stepUp(); else stepDown();
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (target) { target = null; refreshBar(); } else stop();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopImmediatePropagation(); return doUndo(); }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!target && hovered && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) select(hovered);
    const handled = {
      ArrowUp: stepUp, ArrowDown: stepDown, Enter: zapAlways, Delete: zapOnce, Backspace: zapOnce,
      s: zapSimilar, S: zapSimilar
    }[e.key];
    if (handled && (target || hovered)) { e.preventDefault(); e.stopImmediatePropagation(); handled(); }
  }

  const listeners = [
    ['mousemove', onMove, true], ['click', onClick, true],
    ['mousedown', swallow, true], ['mouseup', swallow, true], ['pointerdown', swallow, true], ['pointerup', swallow, true],
    ['auxclick', swallow, true], ['dblclick', swallow, true], ['contextmenu', swallow, true],
    ['wheel', onWheel, { capture: true, passive: false }], ['keydown', onKey, true],
    ['scroll', requestRender, true], ['resize', requestRender, true]
  ];
  for (const [t, fn, opt] of listeners) window.addEventListener(t, fn, opt);

  btn.up.onclick = stepUp; btn.down.onclick = stepDown; btn.once.onclick = zapOnce;
  btn.always.onclick = zapAlways; btn.similar.onclick = zapSimilar; btn.undo.onclick = doUndo; btn.done.onclick = stop;

  window.__dhZapper = { stop };
  refreshBar();
})();
