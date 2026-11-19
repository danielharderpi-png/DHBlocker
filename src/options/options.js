(async function () {
  'use strict';
  const DH = window.DH;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let s;
  async function load() { const r = await chrome.storage.local.get('dh'); s = DH.mergeSettings(r.dh); return s; }
  async function save() { await chrome.storage.local.set({ dh: s }); }
  function status(t) { $('status').textContent = t; }

  function toggleItem(label, desc, checked, onChange) {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `<div><div>${esc(label)}</div><div class="d">${esc(desc || '')}</div></div>
      <label class="switch"><input type="checkbox" ${checked ? 'checked' : ''}><span></span></label>`;
    el.querySelector('input').addEventListener('change', (e) => onChange(e.target.checked));
    return el;
  }

  function render() {
    // categories
    const cats = $('cats'); cats.innerHTML = '';
    const meta = Object.assign({ trackers: { label: 'Trackers', desc: 'Analytics, pixels, session replay' } }, DH.CATEGORIES);
    for (const key of ['ads', 'trackers', 'cookies', 'nags', 'chat']) {
      cats.appendChild(toggleItem(meta[key].label, meta[key].desc, s.categories[key], async (v) => { s.categories[key] = v; await save(); }));
    }

    // focus
    const focus = $('focus'); focus.innerHTML = '';
    for (const [id, p] of Object.entries(DH.FOCUS_PRESETS)) {
      focus.appendChild(toggleItem(p.label, p.hosts.join(', '), !!s.focus[id], async (v) => { if (v) s.focus[id] = true; else delete s.focus[id]; await save(); }));
    }

    // zaps
    const zaps = $('zaps'); zaps.innerHTML = '';
    const hosts = Object.keys(s.zaps).sort();
    if (!hosts.length) zaps.innerHTML = '<div class="empty">No saved zaps yet. Press Alt+Z on any page to start.</div>';
    for (const h of hosts) {
      const block = document.createElement('div');
      block.className = 'site-block';
      block.innerHTML = `<h3>${esc(h)}</h3>`;
      for (const z of s.zaps[h]) {
        const row = document.createElement('div');
        row.className = 'zap';
        row.innerHTML = `<label class="switch"><input type="checkbox" ${z.disabled ? '' : 'checked'}><span></span></label><code title="${esc(z.label || '')}">${esc(z.selector)}</code><button class="btn small danger">Delete</button>`;
        row.querySelector('input').addEventListener('change', async (e) => { z.disabled = !e.target.checked; await save(); });
        row.querySelector('button').addEventListener('click', async () => {
          s.zaps[h] = s.zaps[h].filter((x) => x !== z);
          if (!s.zaps[h].length) delete s.zaps[h];
          await save(); render();
        });
        block.appendChild(row);
      }
      zaps.appendChild(block);
    }

    // allowlist
    const allow = $('allow'); allow.innerHTML = '';
    if (!s.allowlist.length) allow.innerHTML = '<div class="empty">No paused sites.</div>';
    for (const h of s.allowlist) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `${esc(h)}<button title="Remove">×</button>`;
      chip.querySelector('button').addEventListener('click', async () => { s.allowlist = s.allowlist.filter((x) => x !== h); await save(); render(); });
      allow.appendChild(chip);
    }
  }

  $('addHost').addEventListener('click', async () => {
    let h = $('newHost').value.trim();
    try { if (/^https?:/i.test(h)) h = new URL(h).hostname; } catch (e) { /* ignore */ }
    h = DH.normalizeHost(h.replace(/\/.*$/, ''));
    if (!h || !/^[a-z0-9.-]+\.[a-z]{2,}$|^localhost$/.test(h)) return status('Enter a valid domain like example.com');
    if (!s.allowlist.includes(h)) s.allowlist.push(h);
    $('newHost').value = '';
    await save(); render(); status('');
  });

  $('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ dhblocker: 2, settings: s }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dhblocker-settings.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('import').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const incoming = DH.mergeSettings(data.settings || data);
      // merge zaps & allowlist; take incoming toggles
      for (const [h, list] of Object.entries(incoming.zaps)) {
        const cur = (s.zaps[h] = s.zaps[h] || []);
        for (const z of list) if (z && typeof z.selector === 'string' && !cur.some((c) => c.selector === z.selector)) cur.push(z);
      }
      s.allowlist = Array.from(new Set([...s.allowlist, ...incoming.allowlist]));
      s.categories = incoming.categories;
      s.focus = incoming.focus;
      await save(); render(); status('Imported ✔');
    } catch (err) { status('Import failed: not a valid DHBlocker file'); }
    e.target.value = '';
  });

  $('reset').addEventListener('click', async () => {
    if (!confirm('Reset all DHBlocker settings, zaps and paused sites?')) return;
    s = DH.mergeSettings(null);
    await save(); render(); status('Reset to defaults');
  });

  await load();
  render();
  chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.dh) { s = DH.mergeSettings(c.dh.newValue); render(); } });
})();
