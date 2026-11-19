(async function () {
  'use strict';
  const DH = window.DH;
  const $ = (id) => document.getElementById(id);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab && tab.url ? safeUrl(tab.url) : null;
  const scriptable = !!url && /^https?:$/.test(url.protocol);
  const host = scriptable ? DH.normalizeHost(url.hostname) : '';

  function safeUrl(u) { try { return new URL(u); } catch (e) { return null; } }

  async function load() {
    const r = await chrome.storage.local.get('dh');
    return DH.mergeSettings(r.dh);
  }
  async function save(s) { await chrome.storage.local.set({ dh: s }); }
  function toast(t) {
    const el = $('toast');
    el.textContent = t; el.style.display = 'block';
    setTimeout(() => (el.style.display = 'none'), 2200);
  }

  let s = await load();

  function render() {
    document.body.classList.toggle('off', !s.enabled);
    $('pauseAll').checked = !s.enabled;
    $('host').textContent = scriptable ? host : (url ? url.protocol.replace(':', '') + ' page' : 'This page');
    const allowed = scriptable && DH.isAllowlisted(host, s.allowlist);
    $('siteToggle').checked = scriptable && !allowed;
    $('siteToggle').disabled = !scriptable || !s.enabled;
    $('siteState').textContent = !scriptable ? 'Not available on this page' : !s.enabled ? 'Paused everywhere' : allowed ? 'Paused on this site' : 'Protected';
    $('zap').disabled = $('unfreeze').disabled = !scriptable || allowed || !s.enabled;

    const siteZaps = Object.entries(s.zaps).reduce((n, [h, l]) => (host && (host === h || host.endsWith('.' + h)) ? n + l.length : n), 0);
    $('siteZaps').textContent = siteZaps;
    $('totalZaps').textContent = Object.values(s.zaps).reduce((n, l) => n + l.length, 0);

    const cats = $('cats');
    cats.innerHTML = '';
    const meta = Object.assign({ trackers: { label: 'Trackers', desc: 'Analytics, pixels, session replay' } }, DH.CATEGORIES);
    const order = ['ads', 'trackers', 'cookies', 'nags', 'chat'];
    for (const key of order) {
      const m = meta[key];
      const row = document.createElement('div');
      row.className = 'cat';
      row.innerHTML = `<div><div class="t">${m.label}</div><div class="d">${m.desc}</div></div>
        <label class="switch"><input type="checkbox" ${s.categories[key] ? 'checked' : ''}><span></span></label>`;
      row.querySelector('input').addEventListener('change', async (e) => {
        s = await load();
        s.categories[key] = e.target.checked;
        await save(s);
        toast('Reload the page to apply');
      });
      cats.appendChild(row);
    }
  }

  async function blockedCount() {
    if (!tab || !scriptable) return;
    try {
      const r = await chrome.declarativeNetRequest.getMatchedRules({ tabId: tab.id });
      $('blocked').textContent = r.rulesMatchedInfo.filter((x) => x.rule.rulesetId !== '_dynamic').length;
    } catch (e) { /* feedback permission unavailable */ }
  }

  $('siteToggle').addEventListener('change', async (e) => {
    s = await load();
    const list = new Set(s.allowlist);
    if (e.target.checked) {
      for (const h of Array.from(list)) if (host === h || host.endsWith('.' + h)) list.delete(h);
    } else list.add(host);
    s.allowlist = Array.from(list);
    await save(s);
    render();
    setTimeout(() => chrome.tabs.reload(tab.id), 350); // let the background worker update DNR first
  });

  $('pauseAll').addEventListener('change', async (e) => {
    s = await load();
    s.enabled = !e.target.checked;
    await save(s);
    render();
    if (tab && scriptable) setTimeout(() => chrome.tabs.reload(tab.id), 350);
  });

  $('zap').addEventListener('click', async () => {
    const r = await chrome.runtime.sendMessage({ type: 'zap', tabId: tab.id });
    if (r && r.ok) window.close(); else toast('Cannot zap this page');
  });

  $('unfreeze').addEventListener('click', async () => {
    const r = await chrome.runtime.sendMessage({ type: 'unfreeze', tabId: tab.id });
    if (r && r.ok) window.close(); else toast('Cannot unfreeze this page');
  });

  $('dash').addEventListener('click', () => { chrome.runtime.openOptionsPage(); window.close(); });

  render();
  blockedCount();
})();
