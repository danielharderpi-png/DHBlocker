// Resilient CSS selector generator. Prefers stable ids / test attributes / semantic classes
// and avoids hashed CSS-in-JS or Tailwind-style utility classes.
(function () {
  'use strict';
  if (window.__dhSelector) return;

  const UTILITY = /^(-?(m|p|w|h|mx|my|px|py|mt|mb|ml|mr|pt|pb|pl|pr|gap|z|top|left|right|bottom|text|bg|border|rounded|flex|grid|items|justify|font|min-w|max-w|min-h|max-h|space|overflow|opacity|shadow|leading|tracking|col|row|order|self|place|content|cursor|transition|duration|ease)-[\w./%]+|flex|grid|block|inline|inline-block|hidden|relative|absolute|fixed|sticky|container|clearfix|row|col|active|open|visible|show|hide|selected|hover|focus|disabled|loaded|loading)$/;

  function stableToken(t) {
    if (!t || t.length < 2 || t.length > 40) return false;
    if (!/^[A-Za-z][\w-]*$/.test(t)) return false;
    if (/\d{3,}/.test(t)) return false;
    if (/^(css|sc|jsx|svelte|styled|emotion|chakra|MuiBox|makeStyles|ember|ng|_|js-?)[-_\d]/i.test(t)) return false;
    if (/^[a-z0-9]{6,}$/i.test(t) && /\d/.test(t) && /[a-z]/i.test(t)) return false; // hashed mix
    if (/^[A-Za-z0-9]{8,}$/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t) && !/^[A-Z][a-z]+([A-Z][a-z]+)+$/.test(t)) return false; // random camel-ish hash
    if (UTILITY.test(t)) return false;
    return true;
  }

  const esc = (s) => CSS.escape(s);

  function count(sel) {
    try { return document.querySelectorAll(sel).length; } catch (e) { return -1; }
  }
  function isUnique(sel, el) {
    try { const m = document.querySelectorAll(sel); return m.length === 1 && m[0] === el; } catch (e) { return false; }
  }

  function stableId(el) {
    return el.id && stableToken(el.id) ? '#' + esc(el.id) : '';
  }

  function attrSel(el) {
    for (const a of ['data-testid', 'data-test', 'data-test-id', 'data-qa', 'data-cy', 'aria-label', 'role', 'name', 'itemprop']) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v && v.length < 60 && !/\d{4,}/.test(v)) {
        if ((a === 'role' || a === 'name' || a === 'itemprop') && ['BODY', 'HTML'].includes(el.tagName)) continue;
        return '[' + a + '="' + v.replace(/(["\\])/g, '\\$1') + '"]';
      }
    }
    return '';
  }

  function classes(el, max) {
    const cl = typeof el.className === 'string' ? el.className.split(/\s+/).filter(stableToken) : [];
    return cl.slice(0, max || 2).map((c) => '.' + esc(c)).join('');
  }

  function piece(el) {
    const tag = el.tagName.toLowerCase();
    const id = stableId(el);
    if (id) return { text: id, strong: true };
    const attr = attrSel(el);
    if (attr && !/^\[(role|name|itemprop)/.test(attr)) return { text: tag + attr, strong: true };
    return { text: tag + classes(el, 2) + (attr ? attr : ''), strong: false };
  }

  function nthPath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      const tag = cur.tagName.toLowerCase();
      const sameTag = cur.parentElement ? Array.from(cur.parentElement.children).filter((c) => c.tagName === cur.tagName) : [cur];
      parts.unshift(sameTag.length > 1 ? tag + ':nth-of-type(' + (sameTag.indexOf(cur) + 1) + ')' : tag);
      if (cur.id && stableToken(cur.id)) { parts[0] = '#' + esc(cur.id); break; }
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function forElement(el) {
    if (!el || el.nodeType !== 1) return '';
    const own = piece(el);
    if (isUnique(own.text, el)) return own.text;

    let sel = own.text;
    let cur = el;
    for (let depth = 0; depth < 6; depth++) {
      cur = cur.parentElement;
      if (!cur || cur === document.body || cur === document.documentElement) break;
      const p = piece(cur);
      sel = p.text + ' > ' + sel;
      if (isUnique(sel, el)) return sel;
      if (p.strong) break;
    }
    // descendant-only variant is more tolerant of wrapper changes; try it before nth-of-type paths
    const chain = [];
    cur = el;
    for (let i = 0; i < 3 && cur && cur !== document.body; i++, cur = cur.parentElement) chain.unshift(piece(cur).text);
    const loose = chain.join(' ');
    if (isUnique(loose, el)) return loose;

    const np = nthPath(el);
    return isUnique(np, el) ? np : sel;
  }

  // Selector matching el and its structural twins (same tag + same stable classes / test id).
  function similar(el) {
    if (!el || el.nodeType !== 1) return null;
    const tag = el.tagName.toLowerCase();
    const attr = attrSel(el);
    const candidates = [];
    const cls = classes(el, 3);
    if (cls) candidates.push(tag + cls);
    if (attr && !/^\[(role|name)/.test(attr) && !/aria-label/.test(attr)) candidates.push(tag + attr);
    if (cls) {
      const p = el.parentElement;
      if (p) candidates.push(piece(p).text + ' > ' + tag + cls);
    }
    for (const sel of candidates) {
      const n = count(sel);
      if (n > 1 && n < 200) return { selector: sel, count: n };
    }
    return null;
  }

  function describe(el) {
    if (!el) return '';
    const r = el.getBoundingClientRect();
    return el.tagName.toLowerCase() + classes(el, 2) + ' ' + Math.round(r.width) + '\u00d7' + Math.round(r.height);
  }

  window.__dhSelector = { forElement, similar, describe, count };
})();
