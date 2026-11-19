// Static sanity checks: node scripts/check.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let failed = 0;
const fail = (m) => { failed++; console.error('FAIL', m); };
const ok = (m) => console.log('ok  ', m);

// 1. manifest references exist
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const refs = [
  manifest.background.service_worker, manifest.action.default_popup, manifest.options_page,
  ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon),
  ...manifest.declarative_net_request.rule_resources.map((r) => r.path),
  ...manifest.content_scripts.flatMap((c) => c.js)
];
for (const r of refs) fs.existsSync(path.join(root, r)) ? null : fail('missing ' + r);
ok('manifest references (' + refs.length + ')');

// 2. DNR rulesets valid
for (const rr of manifest.declarative_net_request.rule_resources) {
  const rules = JSON.parse(fs.readFileSync(path.join(root, rr.path), 'utf8'));
  const ids = new Set();
  for (const r of rules) {
    if (ids.has(r.id)) fail(rr.id + ' duplicate id ' + r.id);
    ids.add(r.id);
    if (!r.condition.requestDomains && !r.condition.urlFilter) fail(rr.id + ' rule ' + r.id + ' has no matcher');
    if (r.condition.requestDomains && r.condition.requestDomains.some((d) => /\//.test(d))) fail(rr.id + ' bad domain in ' + r.id);
  }
  ok(rr.id + ': ' + rules.length + ' rules');
}

// 3. syntax check of every js file
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (['node_modules', '.git', 'dist'].includes(e.name) ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
for (const f of walk(root).filter((f) => f.endsWith('.js'))) {
  try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); } catch (e) { fail(f + ': ' + e.message); }
}
ok('JS syntax');

// 4. data.js logic
const ctx = { self: {}, this: {} };
ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'src/content/data.js'), 'utf8'), ctx);
const DH = ctx.DH;
const eq = (a, b, m) => JSON.stringify(a) === JSON.stringify(b) ? null : fail(m + ' got ' + JSON.stringify(a));
eq(DH.normalizeHost('WWW.Example.com'), 'example.com', 'normalizeHost');
eq(DH.hostMatches('m.youtube.com', ['youtube.com']), true, 'hostMatches sub');
eq(DH.hostMatches('notyoutube.com', ['youtube.com']), false, 'hostMatches boundary');
eq(DH.enabledRulesets({ ads: true, trackers: false, chat: false, nags: true }), ['ads', 'annoyances'], 'enabledRulesets');
eq(DH.mergeSettings(null).categories.ads, true, 'mergeSettings defaults');
ok('data.js helpers');

// 5. no overly-broad selectors sneaked back in
const banned = ['.modal', '.overlay', '.modal-backdrop', '.modal-content', '.popup-container', 'iframe'];
for (const c of Object.values(DH.CATEGORIES)) for (const sel of c.selectors) if (banned.includes(sel)) fail('banned selector ' + sel);
ok('selector safety');

process.exit(failed ? 1 : 0);
