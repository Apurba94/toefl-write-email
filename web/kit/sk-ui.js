/* sk-ui.js: page parts shared by every app in the suite: the shell, saving, questions, flashcards, the
   essay editor, speech, recording and charts. Text from question banks is always set as text, never as HTML. */
(function () {
  'use strict';
  const SK = window.SK;
  const SVGNS = 'http://www.w3.org/2000/svg';

  // ---------- building the page ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    add(el, kids);
    return el;
  }
  function add(el, kids) {
    for (const k of kids.flat(9)) {
      if (k === null || k === undefined || k === false) continue;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  }
  function s(tag, attrs, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v !== undefined && v !== null) el.setAttribute(k, v);
    for (const k of kids.flat(9)) if (k !== null && k !== undefined) el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    return el;
  }
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  SK.h = h; SK.s = s; SK.clear = clear; SK.add = add;

  // Light markup for maths and emphasis, built as nodes: x^{2}, a_{n}, **bold**, *italic*, sqrt{x}.
  SK.rich = function (text) {
    const out = document.createDocumentFragment();
    const re = /\^\{([^}]*)\}|_\{([^}]*)\}|\*\*([^*]+)\*\*|\*([^*]+)\*|sqrt\{([^}]*)\}|\[\[([^\]]+)\]\]/g;
    let last = 0, m;
    const str = String(text === undefined ? '' : text);
    while ((m = re.exec(str))) {
      if (m.index > last) out.appendChild(document.createTextNode(str.slice(last, m.index)));
      if (m[1] !== undefined) out.appendChild(h('sup', { text: m[1] }));
      else if (m[2] !== undefined) out.appendChild(h('sub', { text: m[2] }));
      else if (m[3] !== undefined) out.appendChild(h('strong', { text: m[3] }));
      else if (m[4] !== undefined) out.appendChild(h('em', { text: m[4] }));
      else if (m[5] !== undefined) out.appendChild(h('span', {}, '√', h('span', { style: { borderTop: '1.5px solid currentColor', padding: '0 2px' }, text: m[5] })));
      else if (m[6] !== undefined) out.appendChild(h('mark', { class: 'sk-mark', text: m[6] }));
      last = re.lastIndex;
    }
    if (last < str.length) out.appendChild(document.createTextNode(str.slice(last)));
    return out;
  };

  // ---------- saving: the desktop program keeps data in files; the website uses this browser ----------
  const params = new URLSearchParams(location.search);
  const token = params.get('t') || sessionStorage.getItem('sk-token');
  if (params.get('t')) { sessionStorage.setItem('sk-token', params.get('t')); history.replaceState(null, '', location.pathname); }
  const desktop = !!token;
  const cache = {};
  const pending = {};
  let flushTimer = null;
  SK.store = {
    desktop,
    async load() {
      if (desktop) {
        try {
          const r = await fetch('/api/store', { headers: { 'X-SK-Token': token } });
          if (r.ok) Object.assign(cache, await r.json());
        } catch (e) { SK.warn('Could not read saved data: ' + e.message); }
        setInterval(() => fetch('/api/ping', { headers: { 'X-SK-Token': token } }).catch(() => {}), 15000);
      } else {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k.startsWith('sk:')) cache[k.slice(3)] = JSON.parse(localStorage.getItem(k));
          }
        } catch (e) { /* private mode: data lasts for this visit only */ }
      }
    },
    get(key, dflt) { return key in cache ? JSON.parse(JSON.stringify(cache[key])) : dflt; },
    set(key, value) {
      cache[key] = JSON.parse(JSON.stringify(value));
      if (desktop) { pending[key] = true; clearTimeout(flushTimer); flushTimer = setTimeout(SK.store.flush, 400); }
      else { try { localStorage.setItem('sk:' + key, JSON.stringify(value)); } catch (e) { SK.warn('This browser would not save: ' + e.message); } }
    },
    async flush() {
      for (const key of Object.keys(pending)) {
        delete pending[key];
        try {
          const r = await fetch('/api/store/' + encodeURIComponent(key), { method: 'PUT', headers: { 'X-SK-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify(cache[key]) });
          if (!r.ok) throw new Error('HTTP ' + r.status);
        } catch (e) { SK.warn('Saving failed: ' + e.message); pending[key] = true; }
      }
    },
    keys: () => Object.keys(cache),
    remove(key) { delete cache[key]; if (desktop) { pending[key] = true; SK.store.flush(); } else { try { localStorage.removeItem('sk:' + key); } catch (e) { /* ignore */ } } },
  };
  window.addEventListener('beforeunload', () => { if (desktop && Object.keys(pending).length) SK.store.flush(); });

  // Shared logs, read by the Error Log, Score Tracker and Weak Area apps across the whole suite.
  SK.logSession = function (summary, extra) {
    const all = SK.store.get('suite.sessions', []);
    all.push(Object.assign({ app: SK.APP.name, title: SK.APP.title, exam: SK.APP.exam, at: Date.now(), day: SK.dayKey(), correct: summary.correct, total: summary.total, seconds: Math.round(summary.seconds || 0), byTopic: summary.byTopic || {} }, extra || {}));
    SK.store.set('suite.sessions', all.slice(-3000));
  };
  SK.logMistake = function (item, resp) {
    const all = SK.store.get('suite.mistakes', []);
    all.push({ app: SK.APP.name, title: SK.APP.title, exam: SK.APP.exam, at: Date.now(), id: item.id, topic: item.topic || '', item: JSON.parse(JSON.stringify(item)), resp: resp === undefined ? null : resp });
    SK.store.set('suite.mistakes', all.slice(-1500));
  };
  SK.logPractice = function (minutes, what) {
    const all = SK.store.get('suite.practice', []);
    all.push({ app: SK.APP.name, exam: SK.APP.exam, day: SK.dayKey(), minutes: Math.round(minutes * 10) / 10, what: what || '' });
    SK.store.set('suite.practice', all.slice(-3000));
  };

  SK.load = async function (file) {
    const r = await fetch('../../content/' + file);
    if (!r.ok) throw new Error('Could not load ' + file);
    return r.json();
  };

  SK.warn = function (msg) {
    const box = document.getElementById('sk-warn');
    if (box) { box.textContent = msg; box.classList.remove('sk-hidden'); }
  };
  SK.download = function (name, text, type) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })), download: name });
    document.body.appendChild(a); a.click(); a.remove();
  };

  // ---------- the app shell ----------
  SK.theme = function (t) {
    if (t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('sk-theme', t); } catch (e) { /* ignore */ } }
    return document.documentElement.dataset.theme || '';
  };
  try { const t = localStorage.getItem('sk-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }

  SK.start = async function (App) {
    App = Object.assign({}, window.SK_META || {}, App);
    SK.APP = App;
    // Record where an error happened as well as what it was, so a headless check can point to the line.
    const where = (err) => { const line = err && err.stack ? String(err.stack).split(/\r?\n/)[1] : ''; return line ? ' at ' + line.trim() : ''; };
    SK._where = where;
    window.addEventListener('error', (e) => fail((e.message || String(e)) + where(e.error)));
    window.addEventListener('unhandledrejection', (e) => fail((e.reason && e.reason.message) || String(e.reason)));
    document.title = App.title;
    const body = document.body;
    clear(body);
    const main = h('main', { id: 'main', tabindex: '-1' });
    const tabsEl = h('div', { class: 'sk-tabs', role: 'tablist', 'aria-label': 'Sections' });
    const themeBtn = h('button', { class: 'sk-icon-btn', type: 'button', title: 'Switch light and dark', 'aria-label': 'Switch light and dark',
      onclick: () => { const dark = matchMedia('(prefers-color-scheme: dark)').matches; const cur = SK.theme() || (dark ? 'dark' : 'light'); SK.theme(cur === 'dark' ? 'light' : 'dark'); } }, 'Theme');
    add(body, [
      h('a', { class: 'sk-skip', href: '#main' }, 'Skip to content'),
      h('header', { class: 'sk-top' }, h('div', { class: 'sk-top-in' },
        h('div', { class: 'sk-title-row' }, h('h1', { class: 'sk-title', text: App.title }), h('span', { class: 'sk-chip ' + App.exam.toLowerCase(), text: App.exam === 'BOTH' ? 'GRE + TOEFL' : App.exam }), themeBtn),
        tabsEl)),
      h('div', { style: { maxWidth: '1060px', margin: '0 auto', padding: '0 16px' } }, h('div', { id: 'sk-warn', class: 'sk-banner sk-hidden', role: 'status' })),
      main,
      h('footer', { class: 'sk-foot' }, 'Independent study tool, not endorsed by or affiliated with ETS. GRE and TOEFL are registered trademarks of ETS. Check ets.org for the current test format. ',
        desktopNote()),
    ]);
    await SK.store.load();
    const ctx = { data: {} };
    for (const f of App.content || []) ctx.data[f.replace(/\.json$/, '')] = await SK.load(f);
    if (App.init) await App.init(ctx);
    const tabs = (App.tabs || []).concat([{ id: 'progress', label: 'Progress', render: renderProgress }, { id: 'about', label: 'About', render: renderAbout }]);
    let current = null;
    function show(id) {
      const tab = tabs.find((t) => t.id === id) || tabs[0];
      current = tab.id;
      for (const b of tabsEl.children) b.setAttribute('aria-selected', b.dataset.id === tab.id ? 'true' : 'false');
      SK.speech.stop();
      if (SK._cleanup) { SK._cleanup.forEach((f) => f()); }
      SK._cleanup = [];
      clear(main);
      tab.render(main, ctx);
      try { sessionStorage.setItem('sk-tab:' + App.name, tab.id); } catch (e) { /* ignore */ }
    }
    for (const t of tabs) tabsEl.appendChild(h('button', { class: 'sk-tab', role: 'tab', type: 'button', 'data-id': t.id, onclick: () => show(t.id) }, t.label));
    let first = tabs[0].id;
    try { first = sessionStorage.getItem('sk-tab:' + App.name) || first; } catch (e) { /* ignore */ }
    SK.show = show;
    SK.ctx = ctx;
    show(first);
    body.dataset.ready = '1';
    if (params.get('selftest') === '1') selftest(tabs, show);
    else if (params.get('autostart') === '1') { const b = document.querySelector('main [data-auto]'); if (b) b.click(); }   // for screenshots of a real question
  };
  function desktopNote() { return SK.store.desktop ? 'Your progress is saved on this computer.' : 'Your progress is saved in this browser only.'; }
  function fail(msg) {
    document.body.dataset.error = msg;
    const m = document.getElementById('main') || document.body;
    m.prepend(h('div', { class: 'sk-error', role: 'alert', text: 'Something went wrong: ' + msg }));
  }
  SK.cleanup = (f) => { (SK._cleanup = SK._cleanup || []).push(f); };

  // The self-test visits every section and presses through each started activity, so a build check can open every
  // app in a headless browser and catch a broken page without a person clicking.
  async function selftest(tabs, show) {
    const tick = () => new Promise((r) => setTimeout(r, 0));
    try {
      for (const t of tabs) {
        show(t.id);
        await tick();
        for (let step = 0; step < 250; step++) {
          const b = [...document.querySelectorAll('main [data-auto]')].find((x) => !x.disabled && x.offsetParent !== null && !x.dataset.autoDone);
          if (!b) break;
          if (b.dataset.auto === 'once') b.dataset.autoDone = '1';
          b.click();
          await tick();
          if (document.body.dataset.error) throw new Error(document.body.dataset.error);
          if (params.get('narrow') === '1') narrowCheck(t.label);
        }
        if (params.get('narrow') === '1') narrowCheck(t.label);
      }
      show(tabs[0].id);
      document.body.dataset.selftest = document.body.dataset.error ? 'fail' : 'pass';
    } catch (e) { document.body.dataset.selftest = 'fail'; fail(e.message + SK._where(e)); }
  }
  // On a phone-width screen nothing may stick out sideways, apart from tables and the tab strip, which scroll.
  function narrowCheck(where) {
    const W = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll('main *, header *')].filter((e) => e.getBoundingClientRect().right > W + 1 && !e.closest('.sk-table-wrap, .sk-tabs, .sk-hidden, details:not([open])'));
    if (wide.length) {
      const e = wide[wide.length - 1];
      throw new Error('Too wide for a phone in "' + where + '": ' + e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') + ' reaches ' + Math.round(e.getBoundingClientRect().right) + 'px of ' + W + 'px');
    }
  }
  SK.selftesting = params.get('selftest') === '1';

  // ---------- small parts ----------
  SK.card = (title, ...kids) => h('section', { class: 'sk-card' }, title ? h('h2', { text: title }) : null, kids);
  SK.stats = (pairs) => h('div', { class: 'sk-stats' }, pairs.map(([label, value]) => h('div', { class: 'sk-stat' }, h('b', { text: String(value) }), h('span', { text: label }))));
  SK.btn = (label, onclick, cls, attrs) => h('button', Object.assign({ class: 'sk-btn ' + (cls || ''), type: 'button', onclick }, attrs || {}), label);
  SK.select = (options, value, onchange, label) => {
    const sel = h('select', { onchange: (e) => onchange(e.target.value), 'aria-label': label || 'Choose' }, options.map((o) => {
      const [v, t] = Array.isArray(o) ? o : [o, o];
      return h('option', { value: v, selected: String(v) === String(value) }, t);
    }));
    return label ? h('label', { class: 'sk-field' }, label, sel) : sel;
  };
  // A link to another app of the suite: next door on the website, or the website from a desktop program.
  SK.WEB = 'https://gre-toefl-study-suite.vercel.app';
  SK.appLink = (name, label) => h('a', { href: SK.store.desktop ? SK.WEB + '/apps/' + name + '/' : '../' + name + '/', target: SK.store.desktop ? '_blank' : null, rel: 'noopener' }, label || name);
  SK.field = (label, input) => h('label', { class: 'sk-field' }, label, input);
  SK.table = (head, rows, stack) => h('div', { class: 'sk-table-wrap' }, h('table', { class: 'sk-table' + (stack === false ? '' : ' sk-stack') },
    h('thead', {}, h('tr', {}, head.map((x) => h('th', { text: x })))),
    h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c, i) => h('td', { 'data-label': head[i] }, c instanceof Node ? c : String(c === undefined || c === null ? '' : c))))))));
  SK.bar = (pct) => h('div', { class: 'sk-bar-track', role: 'img', 'aria-label': Math.round(pct) + ' percent' }, h('div', { class: 'sk-bar-fill', style: { width: Math.max(0, Math.min(100, pct)) + '%' } }));
  SK.note = (text, kind) => h('div', { class: 'sk-feedback ' + (kind || 'info') }, SK.rich(text));
  SK.confirmTwice = function (btn, label, action) {
    let armed = false;
    btn.addEventListener('click', () => {
      if (!armed) { armed = true; btn.textContent = 'Press again to ' + label.toLowerCase(); setTimeout(() => { armed = false; btn.textContent = label; }, 3500); return; }
      action();
    });
    return btn;
  };

  // A countdown that can pause; calls onEnd at zero. Returns { el, elapsed(), stop(), remaining() }.
  SK.timer = function (seconds, onEnd, opts) {
    opts = opts || {};
    const el = h('span', { class: 'sk-timer', role: 'timer', 'aria-live': 'off' });
    let left = seconds, startedAt = Date.now(), used = 0, running = true, hidden = !!opts.hidden;
    const tick = () => {
      if (!running) return;
      const now = Date.now();
      used += (now - startedAt) / 1000; startedAt = now;
      left = seconds - used;
      if (seconds) {
        el.textContent = hidden ? 'Time hidden' : SK.formatTime(left);
        el.classList.toggle('low', left <= Math.min(300, seconds * 0.15));
        if (left <= 0) { running = false; clearInterval(iv); el.textContent = '0:00'; if (onEnd) onEnd(); }
      } else el.textContent = SK.formatTime(used);
    };
    const iv = setInterval(tick, 250);
    SK.cleanup(() => clearInterval(iv));
    tick();
    if (seconds) el.addEventListener('click', () => { hidden = !hidden; tick(); });
    if (seconds) el.title = 'Click to hide or show the time';
    return {
      el, elapsed: () => { tick(); return used; }, remaining: () => left,
      stop() { tick(); running = false; clearInterval(iv); },
      pause() { tick(); running = false; }, resume() { startedAt = Date.now(); running = true; },
    };
  };

  // ---------- questions ----------
  const LETTERS = 'ABCDEFGHIJ';
  // Draw one question into el. resp is the current response; onChange(resp) reports a new one.
  // reveal shows right and wrong marks. Returns nothing; draws again when called again.
  SK.drawItem = function (el, item, resp, onChange, reveal) {
    clear(el);
    if (item.passage) {
      const wrap = h('div', { class: 'sk-split' });
      const left = h('div', {}, item.passageTitle ? h('h3', { text: item.passageTitle }) : null, h('div', { class: 'sk-passage', tabindex: '0' }, SK.rich(item.passage)));
      const right = h('div', {});
      wrap.append(left, right);
      el.appendChild(wrap);
      el = right;
    }
    if (item.audio) el.appendChild(SK.audioPlayer(item.audio, item.audioOpts));
    if (item.figure && SK.figures[item.figure.kind]) el.appendChild(SK.figures[item.figure.kind](item.figure));
    if (item.table) el.appendChild(SK.table(item.table.head, item.table.rows, false));
    if (item.type !== 'gaps' && item.type !== 'tc') el.appendChild(h('div', { class: 'sk-stem' }, SK.rich(item.stem)));
    const mark = (i) => (!reveal ? '' : (Array.isArray(item.answer) ? item.answer.includes(i) : item.answer === i) ? ' right' : (Array.isArray(resp) ? resp.includes(i) : resp === i) ? ' wrong' : '');
    const name = 'q' + Math.random().toString(36).slice(2);
    if (item.type === 'single' || item.type === 'qc') {
      if (item.type === 'qc') {
        if (item.given) el.appendChild(h('div', { class: 'sk-stem' }, SK.rich(item.given)));
        el.appendChild(h('table', { class: 'sk-qc' }, h('tr', {}, h('th', { text: 'Quantity A' }), h('th', { text: 'Quantity B' })), h('tr', {}, item.quantities.map((q) => h('td', {}, SK.rich(q))))));
      }
      const choices = item.type === 'qc' ? SK.QC_CHOICES : item.choices;
      el.appendChild(h('div', { class: 'sk-choices', role: 'radiogroup' }, choices.map((c, i) => h('label', { class: 'sk-choice' + mark(i) },
        h('input', { type: 'radio', name, checked: resp === i, disabled: reveal, onchange: () => onChange(i) }), h('span', { class: 'sk-letter', text: LETTERS[i] }), h('span', {}, SK.rich(c))))));
    } else if (item.type === 'multi' || item.type === 'se') {
      const cur = new Set(resp || []);
      el.appendChild(h('div', { class: 'sk-small sk-muted', text: item.type === 'se' ? 'Select exactly two answers that complete the sentence and give it the same meaning.' : 'Select all answers that apply.' }));
      el.appendChild(h('div', { class: 'sk-choices' }, item.choices.map((c, i) => h('label', { class: 'sk-choice' + mark(i) },
        h('input', { type: 'checkbox', checked: cur.has(i), disabled: reveal, onchange: (e) => { if (e.target.checked) cur.add(i); else cur.delete(i); onChange([...cur].sort((a, b) => a - b)); } }),
        h('span', { class: 'sk-letter', text: LETTERS[i] }), h('span', {}, SK.rich(c))))));
    } else if (item.type === 'tc') {
      const labels = ['(i)', '(ii)', '(iii)'];
      let k = 0;
      el.appendChild(h('div', { class: 'sk-stem' }, item.stem.split(/((?:\((?:i|ii|iii)\)\s*)?_{3,})/).map((part) => /_{3,}$/.test(part) ? h('strong', { text: ' Blank ' + labels[k++] + ' ' }) : SK.rich(part))));
      const cur = Array.isArray(resp) ? resp.slice() : item.blanks.map(() => null);
      el.appendChild(h('div', { class: 'sk-blanks' }, item.blanks.map((opts, b) => h('div', { class: 'sk-blank-col' },
        item.blanks.length > 1 ? h('h4', { text: 'Blank ' + labels[b] }) : null,
        opts.map((o, i) => h('button', { type: 'button', class: 'sk-blank-opt' + (reveal ? (item.answer[b] === i ? ' right' : cur[b] === i ? ' wrong' : '') : ''), 'aria-pressed': cur[b] === i ? 'true' : 'false', disabled: reveal,
          onclick: () => { cur[b] = i; onChange(cur.slice()); } }, o))))));
    } else if (item.type === 'numeric') {
      const inp = h('input', { type: 'text', inputmode: 'decimal', value: resp || '', disabled: reveal, 'aria-label': 'Your answer', style: { width: '12ch' }, oninput: (e) => onChange(e.target.value) });
      el.appendChild(h('div', { class: 'sk-row' }, inp, h('span', { class: 'sk-small sk-muted', text: item.places === 0 ? 'Round to the nearest whole number.' : item.places !== undefined ? 'Round to ' + item.places + ' decimal place' + (item.places === 1 ? '' : 's') + '.' : 'Type a whole number, decimal or fraction such as 3/4.' })));
      if (reveal) el.appendChild(h('div', { class: 'sk-small' }, 'Correct answer: ', h('strong', { text: String(item.answer) })));
    } else if (item.type === 'order') {
      const placed = Array.isArray(resp) ? resp.slice() : [];
      const pool = item.tiles || item.answer;
      const used = placed.map(() => true);
      const remaining = pool.map((w, i) => i).filter((i) => { const j = placed.findIndex((p, k) => p === pool[i] && used[k]); if (j >= 0) { used[j] = false; return false; } return true; });
      if (item.frame) el.appendChild(h('div', { class: 'sk-small sk-muted' }, SK.rich(item.frame)));
      el.appendChild(h('div', { class: 'sk-tiles', 'aria-label': 'Your sentence' }, placed.length ? placed.map((w, i) => h('button', { class: 'sk-tile', type: 'button', disabled: reveal, onclick: () => { placed.splice(i, 1); onChange(placed.slice()); } }, w)) : h('span', { class: 'sk-muted sk-small', text: 'Click the words below in order.' })));
      el.appendChild(h('div', { class: 'sk-tiles', style: { borderStyle: 'solid', marginTop: '8px' } }, remaining.map((i) => h('button', { class: 'sk-tile', type: 'button', disabled: reveal, onclick: () => { placed.push(pool[i]); onChange(placed.slice()); } }, pool[i]))));
      if (reveal) el.appendChild(h('div', { class: 'sk-small', style: { marginTop: '8px' } }, 'Correct order: ', h('strong', { text: item.answer.join(' ') })));
    } else if (item.type === 'gaps') {
      const cur = Array.isArray(resp) ? resp.slice() : item.answer.map(() => '');
      if (item.stem) el.appendChild(h('div', { class: 'sk-stem' }, SK.rich(item.stem)));
      el.appendChild(h('div', { class: 'sk-passage', style: { whiteSpace: 'normal' } }, item.parts.map((p) => {
        if (typeof p === 'string') return document.createTextNode(p);
        const ok = reveal && SK.norm(cur[p.gap]) === SK.norm(item.answer[p.gap]);
        return h('input', { class: 'sk-gap' + (reveal ? (ok ? ' right' : ' wrong') : ''), value: reveal && !ok ? (cur[p.gap] || '') + ' → ' + item.answer[p.gap] : cur[p.gap], disabled: reveal,
          style: { width: Math.max(3, p.len + 1 + (reveal && !ok ? item.answer[p.gap].length + 4 : 0)) + 'ch' }, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Missing letters ' + (p.gap + 1),
          oninput: (e) => { cur[p.gap] = e.target.value; onChange(cur.slice()); } });
      })));
    } else if (item.type === 'text') {
      el.appendChild(h('input', { type: 'text', value: resp || '', disabled: reveal, autocomplete: 'off', spellcheck: 'false', style: { width: '100%' }, 'aria-label': 'Your answer', oninput: (e) => onChange(e.target.value) }));
      if (reveal) el.appendChild(h('div', { class: 'sk-small', style: { marginTop: '6px' } }, 'Answer: ', h('strong', { text: item.answer })));
    }
  };

  // A set of questions: practice mode shows the answer after each one; test mode marks at the end, as on test day.
  // opts: { title, mode: 'practice'|'test', seconds, onFinish(summary, responses), review: true, showAudioText }
  SK.quiz = function (el, items, opts) {
    opts = Object.assign({ mode: 'practice' }, opts || {});
    const responses = items.map(() => undefined);
    const marked = items.map(() => false);
    const checked = items.map(() => false);
    let i = 0, done = false;
    const timer = SK.timer(opts.seconds || 0, () => finish(true), { hidden: false });
    const body = h('div', {});
    const head = h('div', { class: 'sk-q-head' }, h('strong', { class: 'pos' }), opts.title ? h('span', { class: 'sk-muted sk-small', text: opts.title }) : null, timer.el);
    const nav = h('div', { class: 'sk-nav' });
    const dots = h('div', { class: 'sk-dots', 'aria-label': 'Questions' });
    clear(el);
    el.append(SK.card(null, head, body, nav, opts.mode === 'test' ? dots : null));
    function draw() {
      head.querySelector('.pos').textContent = 'Question ' + (i + 1) + ' of ' + items.length;
      const it = items[i];
      const reveal = opts.mode === 'practice' && checked[i];
      SK.drawItem(body, it, responses[i], (r) => { responses[i] = r; if (opts.mode === 'test') drawDots(); }, reveal);
      if (reveal) {
        const ok = SK.isCorrect(it, responses[i]);
        body.appendChild(h('div', { class: 'sk-feedback ' + (ok ? 'right' : 'wrong') }, h('strong', { text: ok ? 'Correct. ' : 'Not quite. ' }), it.explanation ? SK.rich(it.explanation) : ''));
        if (it.audio && it.audio.text) body.appendChild(h('details', {}, h('summary', { text: 'Show what was said' }), h('div', { class: 'sk-passage', style: { marginTop: '8px' } }, SK.audioText(it.audio))));
      }
      clear(nav);
      const left = h('div', { class: 'sk-row' }, SK.btn('Back', () => { i--; draw(); }, 'ghost', { disabled: i === 0 }));
      if (opts.mode === 'test') left.appendChild(SK.btn(marked[i] ? 'Unmark' : 'Mark for review', () => { marked[i] = !marked[i]; draw(); }, 'ghost'));
      const right = h('div', { class: 'sk-row' });
      if (opts.mode === 'practice' && !checked[i]) right.appendChild(SK.btn('Check', () => { checked[i] = true; if (!SK.isCorrect(it, responses[i])) SK.logMistake(it, responses[i]); draw(); }, '', { 'data-auto': '1' }));
      else if (i < items.length - 1) right.appendChild(SK.btn('Next', () => { i++; draw(); }, '', { 'data-auto': '1' }));
      if (opts.mode === 'test' || i === items.length - 1) right.appendChild(SK.btn(opts.mode === 'test' ? 'Finish section' : 'See results', () => finish(false), opts.mode === 'test' ? 'ghost' : '', { 'data-auto': opts.mode === 'test' && i < items.length - 1 ? undefined : '1' }));
      nav.append(left, right);
      if (opts.mode === 'test') drawDots();
      if (opts.onDraw) opts.onDraw(it, i);
    }
    function drawDots() {
      clear(dots);
      items.forEach((_, k) => dots.appendChild(h('button', { type: 'button', class: 'sk-dot' + (responses[k] !== undefined ? ' answered' : '') + (marked[k] ? ' marked' : '') + (k === i ? ' current' : ''), 'aria-label': 'Question ' + (k + 1), onclick: () => { i = k; draw(); } }, String(k + 1))));
    }
    function finish(timeUp) {
      if (done) return;
      done = true;
      timer.stop();
      SK.speech.stop();
      const sum = SK.summarise(items, responses, timer.elapsed());
      if (opts.mode === 'test') items.forEach((it, k) => { if (!SK.isCorrect(it, responses[k])) SK.logMistake(it, responses[k]); });
      if (!opts.noLog) SK.logSession(sum, opts.logExtra);
      SK.logPractice(sum.seconds / 60, opts.title || 'Questions');
      clear(el);
      const card = SK.card(timeUp ? 'Time is up' : 'Results', SK.stats([['Correct', sum.correct + ' / ' + sum.total], ['Score', sum.pct + '%'], ['Time', SK.formatTime(sum.seconds)], ['Per question', SK.formatTime(sum.seconds / Math.max(1, sum.total))]]));
      const topics = Object.entries(sum.byTopic);
      if (topics.length > 1) card.appendChild(SK.table(['Topic', 'Right', 'Score'], topics.map(([t, v]) => [t, v.right + ' / ' + v.total, Math.round((100 * v.right) / v.total) + '%'])));
      const again = h('div', { class: 'sk-row', style: { marginTop: '12px' } });
      if (opts.onAgain) again.appendChild(SK.btn('Another set', opts.onAgain, '', { 'data-auto': 'once' }));
      card.appendChild(again);
      el.appendChild(card);
      if (opts.review !== false) {
        const rev = SK.card('Review');
        items.forEach((it, k) => {
          const ok = SK.isCorrect(it, responses[k]);
          const box = h('div', { style: { borderTop: '1px solid var(--line)', paddingTop: '10px', marginTop: '10px' } });
          box.appendChild(h('div', { class: 'sk-row' }, h('strong', { text: (k + 1) + '. ' + (ok ? 'Correct' : responses[k] === undefined ? 'Not answered' : 'Wrong') }), it.topic ? h('span', { class: 'sk-pill', text: it.topic }) : null));
          const inner = h('div', {});
          SK.drawItem(inner, it, responses[k], () => {}, true);
          box.appendChild(inner);
          if (it.explanation) box.appendChild(SK.note(it.explanation));
          rev.appendChild(box);
        });
        el.appendChild(rev);
      }
      if (opts.onFinish) opts.onFinish(sum, responses);
    }
    draw();
    return { finish: () => finish(false) };
  };

  // A start screen for question sets: choose a topic and a number of questions, then go.
  SK.quizStarter = function (el, opts) {
    // opts: { title, intro, topics: [..] or null, sizes: [5,10,20], make(topic, size, seed) -> items, mode, seconds(size) }
    const pref = SK.store.get(SK.APP.name + '.starter', { topic: 'All', size: (opts.sizes || [10])[0], mode: opts.mode || 'practice' });
    const startScreen = () => {
      clear(el);
      const card = SK.card(opts.title || 'Practice', opts.intro ? h('p', { class: 'sk-muted' }, SK.rich(opts.intro)) : null);
      const row = h('div', { class: 'sk-row' });
      if (opts.topics) row.appendChild(SK.select(['All'].concat(opts.topics), pref.topic, (v) => { pref.topic = v; }, 'Topic'));
      if (opts.sizes) row.appendChild(SK.select(opts.sizes.map((n) => [n, n + ' questions']), pref.size, (v) => { pref.size = Number(v); }, 'Length'));
      if (opts.modes !== false) row.appendChild(SK.select([['practice', 'Practice: answer after each'], ['test', 'Test: answers at the end, timed']], pref.mode, (v) => { pref.mode = v; }, 'Mode'));
      card.appendChild(row);
      card.appendChild(h('div', { style: { marginTop: '14px' } }, SK.btn('Start', go, '', { 'data-auto': 'once' })));
      if (opts.extra) card.appendChild(opts.extra());
      el.appendChild(card);
    };
    const go = () => {
      SK.store.set(SK.APP.name + '.starter', pref);
      const items = opts.make(pref.topic, pref.size, SK.seedNow());
      if (!items.length) { el.appendChild(SK.note('No questions match that choice yet.', 'wrong')); return; }
      SK.quiz(el, items, { title: opts.title, mode: pref.mode, seconds: pref.mode === 'test' && opts.seconds ? opts.seconds(items.length) : 0, onAgain: startScreen });
    };
    startScreen();
  };

  // ---------- flashcards with spaced repetition ----------
  // cards: [{ id, front, back, extra, tag }]
  SK.flashcards = function (el, cards, opts) {
    opts = opts || {};
    const key = SK.APP.name + '.srs' + (opts.deck ? '.' + opts.deck : '');
    const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
    const ids = cards.map((c) => c.id);
    let deck = SK.store.get(key, {});
    const settings = SK.store.get(SK.APP.name + '.srsSettings', { newPerDay: opts.newPerDay || 15, tag: 'All', reverse: false });
    const today = SK.dayKey();
    const newToday = SK.store.get(SK.APP.name + '.newToday', { day: today, n: 0 });
    if (newToday.day !== today) { newToday.day = today; newToday.n = 0; }
    const started = Date.now();
    SK.cleanup(() => { const m = (Date.now() - started) / 60000; if (m > 0.2) SK.logPractice(m, 'Flashcards'); });
    function pool() { return settings.tag === 'All' ? ids : ids.filter((id) => byId[id].tag === settings.tag); }
    function draw() {
      clear(el);
      const st = SK.srs.stats(pool(), deck);
      const q = SK.srs.queue(pool(), deck, Date.now(), Math.max(0, settings.newPerDay - newToday.n));
      const tags = [...new Set(cards.map((c) => c.tag).filter(Boolean))];
      const top = SK.card(opts.title || 'Flashcards', SK.stats([['Due now', st.due], ['New left today', Math.max(0, settings.newPerDay - newToday.n)], ['Learning', st.learning], ['Known well', st.mature], ['In deck', st.total]]),
        h('div', { class: 'sk-row' },
          tags.length > 1 ? SK.select(['All'].concat(tags), settings.tag, (v) => { settings.tag = v; save(); draw(); }, 'Set') : null,
          SK.select([[5, '5 new a day'], [10, '10 new a day'], [15, '15 new a day'], [25, '25 new a day'], [40, '40 new a day']], settings.newPerDay, (v) => { settings.newPerDay = Number(v); save(); draw(); }, 'New cards'),
          opts.reversible ? SK.select([['0', 'Show the word'], ['1', 'Show the meaning']], settings.reverse ? '1' : '0', (v) => { settings.reverse = v === '1'; save(); draw(); }, 'Card side') : null));
      el.appendChild(top);
      if (!q.length) { el.appendChild(SK.card('All done for now', h('p', { class: 'sk-muted', text: 'Nothing is due. Come back later, raise the number of new cards, or browse the deck below.' }))); el.appendChild(browse()); return; }
      const c = byId[q[0]];
      let flipped = false;
      const face = h('div', { class: 'sk-flash', tabindex: '0', role: 'button', 'aria-label': 'Card. Press to turn over.' });
      const grades = h('div', { class: 'sk-grades sk-hidden' }, [[1, 'Again', 'bad'], [3, 'Hard', 'ghost'], [4, 'Good', ''], [5, 'Easy', 'good']].map(([g, label, cls]) =>
        SK.btn(label, () => grade(c, g), cls, g === 4 ? { 'data-auto': '1' } : {})));
      const turn = () => { flipped = true; drawFace(); grades.classList.remove('sk-hidden'); };
      function drawFace() {
        clear(face);
        const front = settings.reverse ? c.back : c.front, back = settings.reverse ? c.front : c.back;
        face.appendChild(h('div', { class: 'front' }, SK.rich(front)));
        if (c.say && SK.speech.ok()) face.appendChild(SK.btn('Hear it', (e) => { e.stopPropagation(); SK.speech.say(c.say); }, 'ghost small'));
        if (flipped) {
          face.appendChild(h('div', { class: 'back' }, SK.rich(back)));
          if (c.extra) face.appendChild(h('div', { class: 'sk-muted sk-small', style: { marginTop: '8px' } }, SK.rich(c.extra)));
        } else face.appendChild(h('div', { class: 'sk-muted sk-small', style: { marginTop: '12px' }, text: 'Click or press Space to turn over' }));
      }
      face.addEventListener('click', turn);
      face.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); turn(); } });
      drawFace();
      el.appendChild(SK.card(null, face, h('div', { class: 'sk-row', style: { marginTop: '10px' } }, SK.btn('Turn over', turn, 'ghost', { 'data-auto': '1' })), grades));
      el.appendChild(browse());
    }
    function grade(c, g) {
      if (!deck[c.id]) newToday.n++;
      deck[c.id] = SK.srs.review(deck[c.id] || SK.srs.fresh(c.id), g);
      if (g < 3) SK.logMistake({ id: c.id, type: 'card', stem: c.front, answer: c.back, topic: c.tag || 'Vocabulary' }, null);
      save();
      draw();
    }
    function save() { SK.store.set(key, deck); SK.store.set(SK.APP.name + '.srsSettings', settings); SK.store.set(SK.APP.name + '.newToday', newToday); }
    function browse() {
      const out = h('div', {});
      const q = h('input', { type: 'text', placeholder: 'Search the deck', 'aria-label': 'Search the deck', style: { width: '100%' } });
      const list = h('div', {});
      const run = () => {
        clear(list);
        const term = SK.norm(q.value);
        const hits = cards.filter((c) => !term || SK.norm(c.front).includes(term) || SK.norm(c.back).includes(term)).slice(0, 60);
        list.appendChild(SK.table(['Card', 'Meaning', 'Status'], hits.map((c) => [h('strong', {}, SK.rich(c.front)), h('span', {}, SK.rich(c.back)), deck[c.id] ? (deck[c.id].interval >= 21 ? 'Known well' : 'Learning') : 'New'])));
        if (!term && cards.length > 60) list.appendChild(h('p', { class: 'sk-muted sk-small', text: 'Showing 60 of ' + cards.length + '. Search to find others.' }));
      };
      q.addEventListener('input', run);
      run();
      out.appendChild(h('details', { class: 'sk-card' }, h('summary', { text: 'Browse all ' + cards.length + ' cards' }), h('div', { style: { marginTop: '10px' } }, q, list)));
      return out;
    }
    draw();
  };

  // ---------- essay and email editor ----------
  // opts: { key, prompt (string or node), minutes, target: [min,max] words, checklist: [..], analyse: true }
  SK.writer = function (el, opts) {
    const draftKey = SK.APP.name + '.draft.' + (opts.key || 'main');
    const histKey = SK.APP.name + '.essays';
    const area = h('textarea', { spellcheck: opts.spellcheck ? 'true' : 'false', 'aria-label': 'Your response', placeholder: 'Write here.' });
    area.value = SK.store.get(draftKey, '');
    const count = h('span', { class: 'sk-pill' });
    const update = () => {
      const n = SK.text.wordCount(area.value);
      count.textContent = n + ' words' + (opts.target ? ' (aim for ' + opts.target[0] + ' to ' + opts.target[1] + ')' : '');
      SK.store.set(draftKey, area.value);
    };
    area.addEventListener('input', update);
    let timer = null;
    const timeBox = h('span', {});
    const startBtn = SK.btn(opts.minutes ? 'Start the ' + opts.minutes + ' minute timer' : 'Start', () => { startBtn.remove(); timer = SK.timer(opts.minutes * 60, () => { area.readOnly = true; submit(true); }); timeBox.appendChild(timer.el); area.focus(); }, 'ghost small');
    const result = h('div', {});
    const submit = (timeUp) => {
      // Nothing to judge yet: say so instead of showing a page of zeros and saving an empty response.
      if (!timeUp && SK.text.wordCount(area.value) < 10) { clear(result); result.appendChild(SK.note('Write at least a few sentences first, then ask for feedback.', 'wrong')); return; }
      if (timer) timer.stop();
      const a = SK.text.analyse(area.value);
      const hist = SK.store.get(histKey, []);
      hist.push({ at: Date.now(), prompt: typeof opts.prompt === 'string' ? opts.prompt : opts.promptText || '', text: area.value, words: a.words, minutes: timer ? Math.round(timer.elapsed() / 6) / 10 : null });
      SK.store.set(histKey, hist.slice(-100));
      SK.logPractice(timer ? timer.elapsed() / 60 : 5, 'Writing');
      clear(result);
      result.appendChild(SK.feedbackFor(a, opts, timeUp));
      if (opts.onSubmit) opts.onSubmit(a, area.value);
    };
    clear(el);
    el.appendChild(SK.card(opts.title || 'Write', opts.prompt ? h('div', { class: 'sk-passage', style: { marginBottom: '12px' } }, typeof opts.prompt === 'string' ? SK.rich(opts.prompt) : opts.prompt) : null,
      h('div', { class: 'sk-row', style: { marginBottom: '8px' } }, count, opts.minutes ? startBtn : null, timeBox),
      area,
      h('div', { class: 'sk-row', style: { marginTop: '10px' } },
        SK.btn('Get feedback', () => submit(false), '', { 'data-auto': 'once' }),
        SK.btn('Save as text file', () => SK.download((opts.key || 'response') + '.txt', area.value), 'ghost'),
        SK.confirmTwice(SK.btn('Clear', null, 'ghost'), 'Clear', () => { area.value = ''; update(); }))));
    el.appendChild(result);
    update();
    return { area, submit };
  };
  // Feedback a program can give honestly: counts and patterns, not a score.
  SK.feedbackFor = function (a, opts, timeUp) {
    const notes = [];
    if (opts.target) {
      if (a.words < opts.target[0]) notes.push('This is ' + a.words + ' words, below the ' + opts.target[0] + ' you are aiming for. Develop your points with a reason and an example each.');
      else if (a.words > opts.target[1] * 1.4) notes.push('At ' + a.words + ' words this is long. Check every paragraph still answers the task.');
      else notes.push('Length is in range: ' + a.words + ' words.');
    }
    if (opts.paragraphs && a.paragraphs < opts.paragraphs) notes.push('Only ' + a.paragraphs + ' paragraph' + (a.paragraphs === 1 ? '' : 's') + '. Leave a blank line between paragraphs so each idea has its own.');
    if (a.sentences && a.meanSentence > 30) notes.push('Sentences average ' + a.meanSentence + ' words. Split some of the longest.');
    if (a.sentences > 4 && a.sentenceSpread < 4) notes.push('Your sentences are all about the same length. Mix short and long sentences.');
    if (a.transitions.length < 3 && a.words > 120) notes.push('Few linking words. Signal how ideas connect: however, for example, as a result.');
    if (a.passive.length > Math.max(3, a.sentences / 3)) notes.push(a.passive.length + ' passive phrases, such as "' + a.passive[0] + '". Prefer active verbs where the doer matters.');
    if (a.repeated.length) notes.push('Repeated words: ' + a.repeated.slice(0, 5).map(([w, n]) => w + ' (' + n + ')').join(', ') + '.');
    const box = SK.card(timeUp ? 'Time is up: feedback' : 'Feedback',
      SK.stats([['Words', a.words], ['Sentences', a.sentences], ['Paragraphs', a.paragraphs], ['Words per sentence', a.meanSentence], ['Linking words', a.transitions.length]]),
      h('ul', {}, notes.map((n) => h('li', { text: n }))),
      a.transitions.length ? h('p', { class: 'sk-small sk-muted', text: 'Linking words found: ' + a.transitions.join(', ') }) : null,
      h('p', { class: 'sk-small sk-muted', text: 'This checks length and patterns only. It cannot judge your ideas or grammar the way a trained rater does, so use the checklist too.' }));
    if (opts.checklist) box.appendChild(SK.checklist(opts.checklist, SK.APP.name + '.check.' + (opts.key || 'main')));
    return box;
  };
  SK.checklist = function (items, key) {
    const state = SK.store.get(key, {});
    return h('div', { style: { marginTop: '10px' } }, h('h3', { text: 'Check your own response' }), items.map((t, i) => h('label', { class: 'sk-choice', style: { marginBottom: '6px' } },
      h('input', { type: 'checkbox', checked: !!state[i], onchange: (e) => { state[i] = e.target.checked; SK.store.set(key, state); } }), h('span', { text: t }))));
  };

  // ---------- speech: the computer reads aloud with the voices built into Windows or the browser ----------
  SK.speech = {
    ok: () => typeof speechSynthesis !== 'undefined',
    voices() { return SK.speech.ok() ? speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)) : []; },
    settings() { return SK.store.get('suite.voice', { rate: 0.95, a: '', b: '' }); },
    stop() { if (SK.speech.ok()) speechSynthesis.cancel(); },
    // text may be a string or a list of [speaker, line]; speakers alternate between two voices.
    say(text, opts) {
      opts = opts || {};
      if (!SK.speech.ok()) { if (opts.onend) opts.onend(); return; }
      speechSynthesis.cancel();
      const st = SK.speech.settings();
      const vs = SK.speech.voices();
      const find = (name, fallback) => vs.find((v) => v.name === name) || vs[fallback] || null;
      const lines = Array.isArray(text) ? text : [[null, text]];
      const speakers = [...new Set(lines.map((l) => l[0]).filter(Boolean))];
      lines.forEach(([who, line], k) => {
        const u = new SpeechSynthesisUtterance(line);
        const second = speakers.indexOf(who) % 2 === 1;
        const v = second ? find(st.b, Math.min(1, vs.length - 1)) : find(st.a, 0);
        if (v) u.voice = v;
        u.rate = (opts.rate || st.rate) * (opts.rateScale || 1);
        if (k === lines.length - 1 && opts.onend) u.onend = opts.onend;
        speechSynthesis.speak(u);
      });
    },
  };
  // audio: { text: string, or lines: [[speaker, line]], title }
  SK.audioText = (audio) => (audio.lines ? audio.lines.map(([w, l]) => (w ? w + ': ' : '') + l).join('\n') : audio.text);
  SK.audioPlayer = function (audio, o) {
    o = o || {};
    const plays = { n: 0 };
    const status = h('span', { class: 'sk-small sk-muted' });
    const playBtn = SK.btn('Play', () => {
      if (o.maxPlays && plays.n >= o.maxPlays) { status.textContent = 'On the test you hear it once.'; return; }
      plays.n++;
      status.textContent = 'Playing…';
      SK.speech.say(audio.lines || audio.text, { onend: () => { status.textContent = 'Played ' + plays.n + (plays.n === 1 ? ' time' : ' times'); } });
    }, 'small');
    if (!SK.speech.ok()) return SK.note('This browser cannot read aloud. The words are shown instead:\n' + SK.audioText(audio));
    return h('div', { class: 'sk-row', style: { marginBottom: '10px' } }, h('span', { text: '🔊 ' + (audio.title || 'Listen') }), playBtn, SK.btn('Stop', () => SK.speech.stop(), 'ghost small'), status);
  };
  SK.voicePicker = function () {
    const st = SK.speech.settings();
    const box = h('div', { class: 'sk-row' });
    const draw = () => {
      clear(box);
      const vs = SK.speech.voices();
      if (!vs.length) { box.appendChild(h('span', { class: 'sk-muted sk-small', text: 'No English voices found yet. In Windows, add one under Settings, Time and language, Speech.' })); return; }
      const opts = [['', 'Default']].concat(vs.map((v) => [v.name, v.name + ' (' + v.lang + ')']));
      box.append(SK.select(opts, st.a, (v) => { st.a = v; SK.store.set('suite.voice', st); }, 'Voice 1'),
        SK.select(opts, st.b, (v) => { st.b = v; SK.store.set('suite.voice', st); }, 'Voice 2'),
        SK.select([[0.75, 'Slow'], [0.9, 'A little slow'], [0.95, 'Normal'], [1.1, 'Fast'], [1.25, 'Very fast']], st.rate, (v) => { st.rate = Number(v); SK.store.set('suite.voice', st); }, 'Speed'),
        SK.btn('Test', () => SK.speech.say([['A', 'This is the first voice.'], ['B', 'And this is the second voice.']]), 'ghost small'));
    };
    draw();
    if (SK.speech.ok()) speechSynthesis.addEventListener('voiceschanged', draw);
    return box;
  };

  // ---------- recording your voice, kept in this browser profile ----------
  const DB = 'sk-recordings';
  function db() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('clips', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  SK.clips = {
    async save(clip) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('clips', 'readwrite'); t.objectStore('clips').put(clip); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
    async list() { const d = await db(); return new Promise((res, rej) => { const r = d.transaction('clips').objectStore('clips').getAll(); r.onsuccess = () => res(r.result.sort((a, b) => b.at - a.at)); r.onerror = () => rej(r.error); }); },
    async remove(id) { const d = await db(); return new Promise((res) => { const t = d.transaction('clips', 'readwrite'); t.objectStore('clips').delete(id); t.oncomplete = () => res(); }); },
  };
  // opts: { prep: seconds, seconds: max speaking time, label, onDone(blob, seconds) }
  SK.recorder = function (opts) {
    const box = h('div', {});
    const status = h('div', { class: 'sk-row' });
    const player = h('div', {});
    box.append(status, player);
    let rec = null, stream = null, chunks = [], t0 = 0, iv = null;
    const can = !!(navigator.mediaDevices && window.MediaRecorder);
    const stopAll = () => { clearInterval(iv); if (rec && rec.state !== 'inactive') rec.stop(); if (stream) stream.getTracks().forEach((t) => t.stop()); };
    SK.cleanup(stopAll);
    const idle = () => {
      clear(status);
      if (!can) { status.appendChild(SK.note('Recording needs a microphone and a browser that allows it. You can still practise aloud with the timer.', 'wrong')); return; }
      status.appendChild(SK.btn(opts.prep ? 'Start: ' + opts.prep + ' s to prepare' : 'Start recording', begin, '', {}));
    };
    const begin = async () => {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { clear(status); status.appendChild(SK.note('The microphone could not be used: ' + e.message, 'wrong')); return; }
      let p = opts.prep || 0;
      const go = () => {
        chunks = [];
        rec = new MediaRecorder(stream);
        rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = () => {
          const secs = (Date.now() - t0) / 1000;
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          stream.getTracks().forEach((t) => t.stop());
          clear(player);
          player.appendChild(h('audio', { controls: true, src: URL.createObjectURL(blob), style: { width: '100%', marginTop: '8px' } }));
          idle();
          if (opts.onDone) opts.onDone(blob, secs);
        };
        rec.start();
        t0 = Date.now();
        const tick = () => {
          const used = (Date.now() - t0) / 1000;
          clear(status);
          status.append(h('strong', { text: '● Recording ' + SK.formatTime(used) + (opts.seconds ? ' of ' + SK.formatTime(opts.seconds) : '') }), SK.btn('Stop', () => { clearInterval(iv); rec.stop(); }, 'bad small'));
          if (opts.seconds && used >= opts.seconds) { clearInterval(iv); rec.stop(); }
        };
        iv = setInterval(tick, 250);
        tick();
      };
      if (p > 0) {
        const prepTick = () => { clear(status); status.appendChild(h('strong', { text: 'Prepare: ' + p + ' s' })); if (p-- <= 0) { clearInterval(iv); go(); } };
        prepTick();
        iv = setInterval(prepTick, 1000);
      } else go();
    };
    idle();
    return box;
  };

  // ---------- charts and figures, drawn as SVG ----------
  SK.chart = {
    bars(data, opts) {
      opts = opts || {};
      const W = 640, H = 240, L = 44, B = 36, T = 12;
      const max = Math.max(1, ...data.map((d) => d.value)) * 1.1;
      const bw = (W - L - 10) / Math.max(1, data.length);
      return s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'sk-chart', role: 'img', 'aria-label': opts.label || 'Bar chart', style: 'width:100%;height:auto' },
        s('line', { x1: L, y1: H - B, x2: W - 6, y2: H - B, class: 'axis' }),
        [0, 0.5, 1].map((f) => s('text', { x: L - 6, y: H - B - f * (H - B - T) + 4, 'text-anchor': 'end' }, String(SK.round((max / 1.1) * f, opts.dp || 0)))),
        data.map((d, i) => [s('rect', { x: L + i * bw + bw * 0.15, y: H - B - (d.value / max) * (H - B - T), width: bw * 0.7, height: (d.value / max) * (H - B - T), class: 'mark', rx: 3 }, s('title', {}, d.label + ': ' + d.value)),
          s('text', { x: L + i * bw + bw / 2, y: H - B + 16, 'text-anchor': 'middle' }, String(d.label).slice(0, 10))]));
    },
    line(points, opts) {
      opts = opts || {};
      const W = 640, H = 220, L = 40, B = 30, T = 12;
      if (points.length < 2) return h('p', { class: 'sk-muted sk-small', text: 'A trend line appears after two or more sessions.' });
      const lo = opts.min !== undefined ? opts.min : Math.min(...points.map((p) => p.y)), hi = opts.max !== undefined ? opts.max : Math.max(...points.map((p) => p.y));
      const span = hi - lo || 1;
      const x = (i) => L + (i / (points.length - 1)) * (W - L - 12);
      const y = (v) => H - B - ((v - lo) / span) * (H - B - T);
      return s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'sk-chart', role: 'img', 'aria-label': opts.label || 'Trend', style: 'width:100%;height:auto' },
        s('line', { x1: L, y1: H - B, x2: W - 6, y2: H - B, class: 'axis' }),
        s('text', { x: L - 6, y: y(hi) + 4, 'text-anchor': 'end' }, String(hi)), s('text', { x: L - 6, y: y(lo) + 4, 'text-anchor': 'end' }, String(lo)),
        s('polyline', { points: points.map((p, i) => x(i) + ',' + y(p.y)).join(' '), class: 'line' }),
        points.map((p, i) => s('circle', { cx: x(i), cy: y(p.y), r: 3.5, class: 'mark' }, s('title', {}, (p.label || '') + ': ' + p.y))),
        s('text', { x: L, y: H - 8 }, points[0].label || ''), s('text', { x: W - 8, y: H - 8, 'text-anchor': 'end' }, points[points.length - 1].label || ''));
    },
  };
  SK.figures = {};   // filled by apps that draw figures (geometry, data, coordinate plane)

  // ---------- the two tabs every app has ----------
  function renderProgress(el) {
    const mine = SK.store.get('suite.sessions', []).filter((x) => x.app === SK.APP.name);
    const practice = SK.store.get('suite.practice', []).filter((x) => x.app === SK.APP.name);
    const days = [...new Set(practice.map((p) => p.day).concat(mine.map((m) => m.day)))];
    const minutes = SK.round(SK.sum(practice.map((p) => p.minutes)), 0);
    const right = SK.sum(mine.map((m) => m.correct)), total = SK.sum(mine.map((m) => m.total));
    const card = SK.card('Your progress in this app', SK.stats([['Sessions', mine.length], ['Answers', total], ['Accuracy', total ? Math.round((100 * right) / total) + '%' : '-'], ['Minutes', minutes], ['Day streak', SK.streak(days)]]));
    if (mine.length) {
      card.appendChild(h('h3', { text: 'Accuracy by session' }));
      card.appendChild(SK.chart.line(mine.slice(-30).map((m) => ({ y: m.total ? Math.round((100 * m.correct) / m.total) : 0, label: m.day })), { min: 0, max: 100, label: 'Accuracy by session' }));
      const weak = SK.weakAreas(mine.map((m) => Object.assign({}, m, { exam: '' })), 3);
      if (weak.length) card.appendChild(SK.table(['Topic', 'Answers', 'Accuracy'], weak.slice(0, 8).map((w) => [w.topic.trim(), w.total, w.pct + '%'])));
    } else card.appendChild(h('p', { class: 'sk-muted', text: 'Finish a practice set and your results appear here.' }));
    if (SK.APP.progress) SK.APP.progress(card);
    el.appendChild(card);
    el.appendChild(SK.card('Your data', h('p', { class: 'sk-muted sk-small', text: SK.store.desktop ? 'Saved in your user folder on this computer, shared by every app in the suite. Nothing is sent anywhere.' : 'Saved in this browser on this device, shared by every app in the suite on this site. Nothing is sent anywhere. Clearing browser data deletes it, so save a backup now and then.' }),
      h('div', { class: 'sk-row' },
        SK.btn('Save a backup', () => { const all = {}; SK.store.keys().forEach((k) => { all[k] = SK.store.get(k); }); SK.download('study-suite-backup-' + SK.dayKey() + '.json', JSON.stringify(all, null, 1), 'application/json'); }, 'ghost'),
        restoreButton(),
        SK.confirmTwice(SK.btn('Reset this app', null, 'ghost'), 'Reset this app', () => {
          SK.store.keys().filter((k) => k.startsWith(SK.APP.name + '.')).forEach((k) => SK.store.remove(k));
          ['suite.sessions', 'suite.practice', 'suite.mistakes'].forEach((k) => SK.store.set(k, SK.store.get(k, []).filter((x) => x.app !== SK.APP.name)));
          SK.show('progress');
        }))));
  }
  function restoreButton() {
    const inp = h('input', { type: 'file', accept: '.json,application/json', class: 'sk-hidden', onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const data = JSON.parse(await f.text()); if (typeof data !== 'object' || Array.isArray(data)) throw new Error('not a backup file'); Object.entries(data).forEach(([k, v]) => { if (/^[\w.-]{1,80}$/.test(k)) SK.store.set(k, v); }); SK.show('progress'); }
      catch (err) { SK.warn('That file could not be restored: ' + err.message); }
    } });
    return h('span', {}, inp, SK.btn('Restore a backup', () => inp.click(), 'ghost'));
  }
  function renderAbout(el) {
    const A = SK.APP;
    el.appendChild(SK.card('About ' + A.title, h('p', {}, SK.rich(A.about || A.desc)),
      A.how ? h('div', {}, h('h3', { text: 'How to use it' }), h('ol', {}, A.how.map((x) => h('li', {}, SK.rich(x))))) : null,
      A.sources ? h('div', {}, h('h3', { text: 'Where the content comes from' }), h('p', { class: 'sk-small' }, SK.rich(A.sources))) : null,
      h('h3', { text: 'Good to know' }),
      h('ul', { class: 'sk-small' },
        h('li', { text: 'All practice questions, passages and word definitions in this suite were written for it. None are official ETS questions. For official practice, use the free and paid materials on ets.org.' }),
        h('li', { text: 'Test formats change. This suite follows the GRE General Test as shortened in September 2023 and the TOEFL iBT as updated in January 2026. Check ets.org before your test.' }),
        h('li', { text: 'This app works offline. Speech uses the voices on your computer.' })),
      h('p', { class: 'sk-small sk-muted', text: 'Part of the GRE and TOEFL Study Suite by JANIN A APURBA. MIT licence. Built with AI assistance (Claude Code).' })));
  }
})();
