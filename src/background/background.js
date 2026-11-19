// DHBlocker service worker: keeps declarativeNetRequest rulesets & allowlist in sync with settings,
// handles keyboard commands and on-demand script injection.
importScripts('../content/data.js');
const DH = self.DH;

async function getSettings() {
  const r = await chrome.storage.local.get('dh');
  return DH.mergeSettings(r.dh);
}

let lastKey = '';

async function syncRules(force) {
  const s = await getSettings();
  const key = JSON.stringify([s.enabled, s.categories, s.allowlist]);
  if (!force && key === lastKey) return;
  lastKey = key;

  // 1. static rulesets from category toggles
  const want = s.enabled ? DH.enabledRulesets(s.categories) : [];
  const all = ['ads', 'trackers', 'annoyances'];
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: want,
    disableRulesetIds: all.filter((id) => !want.includes(id))
  });

  // 2. allowlist -> dynamic allowAllRequests rules (priority above every block rule)
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const rules = s.allowlist.map((host, i) => ({
    id: i + 1,
    priority: 100,
    action: { type: 'allowAllRequests' },
    condition: { requestDomains: [host], resourceTypes: ['main_frame', 'sub_frame'] }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: rules
  });

  chrome.action.setBadgeBackgroundColor({ color: '#c0304a' });
  chrome.action.setTitle({ title: s.enabled ? 'DHBlocker' : 'DHBlocker (paused everywhere)' });
}

chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: true }).catch(() => {});

chrome.runtime.onInstalled.addListener(async (details) => {
  const r = await chrome.storage.local.get('dh');
  if (!r.dh) await chrome.storage.local.set({ dh: DH.mergeSettings(null) });
  await syncRules(true);
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(() => syncRules(true));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.dh) syncRules(false);
});

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function injectable(tab) {
  return tab && tab.id != null && /^https?:/.test(tab.url || '');
}

async function startZapper(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['src/content/selector.js', 'src/content/zapper.js'] });
}

async function unfreeze(tabId) {
  const res = await chrome.scripting.executeScript({ target: { tabId }, files: ['src/content/unfreeze.js'] });
  return res && res[0] ? res[0].result : 0;
}

chrome.commands.onCommand.addListener(async (cmd) => {
  const tab = await activeTab();
  if (!injectable(tab)) return;
  try {
    if (cmd === 'toggle-zapper') await startZapper(tab.id);
    if (cmd === 'unfreeze-page') await unfreeze(tab.id);
  } catch (e) { /* page not scriptable */ }
});

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  (async () => {
    try {
      if (msg.type === 'zap') { await startZapper(msg.tabId); respond({ ok: true }); }
      else if (msg.type === 'unfreeze') respond({ ok: true, fixed: await unfreeze(msg.tabId) });
      else respond({ ok: false });
    } catch (e) {
      respond({ ok: false, error: String(e && e.message || e) });
    }
  })();
  return true;
});
