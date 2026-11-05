/* sk-apps.js: building blocks that many apps share: word quizzes made from a word list, passage and listening sets,
   the error log, the score log and the study planner. Question builders here have no page code, so Node tests them. */
(function (root) {
  'use strict';
  const SK = root.SK || require('./sk-core.js');

  // ---------- questions made from word lists ----------
  // words: [{ id, w, d, e, pos, syn }]. kind: meaning | word | blank | synonym
  SK.blankOut = function (sentence, word) {
    const stem = word.toLowerCase().slice(0, Math.max(3, word.length - (word.length > 6 ? 3 : 2)));
    const re = new RegExp('\\b(' + stem.replace(/[-]/g, '\\-') + '[a-z\\-]*)', 'i');
    const m = sentence.match(re);
    return m ? sentence.slice(0, m.index) + '_____' + sentence.slice(m.index + m[1].length) : null;
  };
  SK.wordItem = function (r, words, target, kind) {
    const others = SK.shuffle(r, words.filter((x) => x.id !== target.id && x.w.toLowerCase() !== target.w.toLowerCase()));
    const samePos = others.filter((x) => x.pos === target.pos);
    const pool = (samePos.length >= 4 ? samePos : others).slice(0, 12);
    const four = (f) => { const out = []; for (const o of pool) { const v = f(o); if (v && v !== f(target) && !out.includes(v)) out.push(v); if (out.length === 4) break; } return out; };
    let it;
    if (kind === 'meaning') it = { stem: 'What does **' + target.w + '** mean?', choices: [target.d].concat(four((o) => o.d)) };
    else if (kind === 'word') it = { stem: 'Which word means: *' + target.d + '*?', choices: [target.w].concat(four((o) => o.w)) };
    else if (kind === 'blank') {
      const s = SK.blankOut(target.e, target.w);
      if (!s) return SK.wordItem(r, words, target, 'word');
      it = { stem: 'Which word, in the right form, completes the sentence?\n' + s, choices: [target.w].concat(four((o) => o.w)) };
    } else if (kind === 'synonym') {
      const syn = (target.syn || []).filter((x) => !x.includes(' '))[0] || (target.syn || [])[0];
      if (!syn) return SK.wordItem(r, words, target, 'meaning');
      const avoid = new Set([target.w].concat(target.syn || []).map((x) => x.toLowerCase()));
      const wrong = [];
      for (const o of pool) for (const x of [o.w].concat(o.syn || [])) { if (!avoid.has(x.toLowerCase()) && !wrong.includes(x) && wrong.length < 4 && !(o.syn || []).some((y) => avoid.has(y.toLowerCase()))) wrong.push(x); }
      it = { stem: 'Which word is closest in meaning to **' + target.w + '**?', choices: [syn].concat(wrong.slice(0, 4)) };
    }
    if (it.choices.length < 5) return null;
    return SK.shuffleItem(r, Object.assign({ id: 'wq-' + kind + '-' + target.id, type: 'single', topic: target.tag || (target.set ? 'Set ' + target.set : 'Vocabulary'), answer: 0,
      explanation: '**' + target.w + '** (' + (target.pos || 'word') + '): ' + target.d + '.' + (target.e ? ' Example: ' + target.e : '') }, it));
  };
  SK.wordItems = function (words, n, seed, kinds) {
    const r = SK.rng(seed);
    const out = [];
    for (const t of SK.shuffle(r, words)) {
      const it = SK.wordItem(r, words, t, kinds[out.length % kinds.length]);
      if (it) out.push(it);
      if (out.length >= n) break;
    }
    return out;
  };
  SK.wordCards = (words) => words.map((x) => ({ id: x.id, front: x.w, back: x.d, extra: (x.pos ? '*' + x.pos + '*. ' : '') + (x.e || '') + (x.syn && x.syn.length ? '\nSimilar: ' + x.syn.join(', ') : ''), tag: x.tag || (x.set ? 'Set ' + x.set : ''), say: x.w }));

  // ---------- passages and listening ----------
  SK.passageItems = (passages) => passages.flatMap((p) => p.questions.map((q) => Object.assign({ stem: '' }, q, { passage: p.text, passageTitle: p.title, group: p.id, topic: q.topic || p.subject || 'Reading' })));
  SK.listeningItems = (sets) => sets.flatMap((p) => p.questions.map((q) => Object.assign({}, q, { group: p.id, audio: { title: p.title, lines: p.lines, text: p.text }, topic: q.topic || p.kind })));
  // Take whole passages (all of their questions together) until about n questions.
  SK.takeGroups = function (r, items, n) {
    const groups = {};
    items.forEach((it) => { (groups[it.group] = groups[it.group] || []).push(it); });
    const out = [];
    for (const g of SK.shuffle(r, Object.keys(groups))) { if (out.length >= n) break; out.push(...groups[g]); }
    return out.map((it) => SK.shuffleItem(r, it));
  };
  SK.fromBank = (r, bank, topic, n) => SK.sample(r, bank.filter((x) => topic === 'All' || !topic || x.topic === topic), n).map((x) => SK.shuffleItem(r, x));
  SK.topicsOf = (bank) => [...new Set(bank.map((x) => x.topic).filter(Boolean))];

  // ---------- planning ----------
  SK.daysLeft = (testDay, today) => SK.daysBetween(today || SK.dayKey(), testDay);

  // Tab makers: plain objects whose render runs only in the page.
  // A practice tab over a fixed bank of questions.
  SK.bankTab = (id, label, bankFn, opts) => ({ id, label, render(el, ctx) {
    const bank = bankFn(ctx);
    SK.quizStarter(el, Object.assign({ title: label, topics: SK.topicsOf(bank).length > 1 ? SK.topicsOf(bank) : null, sizes: [5, 10, 20],
      make: (topic, size, seed) => SK.fromBank(SK.rng(seed), bank, topic, size), seconds: (n) => n * 90 }, opts || {}));
  } });
  // A practice tab over generated quant questions.
  SK.quantTab = (id, label, groups, opts) => ({ id, label, render(el) {
    const names = groups.flatMap((g) => SK.QUANT_TOPICS[g] || [g]);
    SK.quizStarter(el, Object.assign({ title: label, sizes: [5, 10, 15, 20], make: (topic, size, seed) => SK.makeQuant(names, size, seed), seconds: (n) => n * 105,
      intro: 'Questions are generated, so every set is new. Each one comes with a worked solution.' }, opts || {}));
  } });
  SK.cardsTab = (id, label, cardsFn, opts) => ({ id, label, render(el, ctx) { SK.flashcards(el, cardsFn(ctx), Object.assign({ title: label }, opts || {})); } });
  SK.wordQuizTab = (id, label, wordsFn, kinds) => ({ id, label, render(el, ctx) {
    const words = wordsFn(ctx);
    const sets = [...new Set(words.map((w) => (w.tag || (w.set ? 'Set ' + w.set : '')))).values()].filter(Boolean);
    SK.quizStarter(el, { title: label, topics: sets.length > 1 ? sets : null, sizes: [10, 20, 30],
      make: (topic, size, seed) => SK.wordItems(words.filter((w) => topic === 'All' || (w.tag || 'Set ' + w.set) === topic), size, seed, kinds || ['meaning', 'word', 'blank', 'synonym']), seconds: (n) => n * 40 });
  } });

  if (typeof window === 'undefined') { if (typeof module !== 'undefined') module.exports = SK; return; }

  // ---------- page parts below ----------
  const h = SK.h;
  // The suite-wide error log, optionally for one exam.
  SK.mistakesView = function (el, exam) {
    const all = SK.store.get('suite.mistakes', []);
    const mine = all.filter((m) => !exam || m.exam === exam || m.exam === 'BOTH');
    const notes = SK.store.get(SK.APP.name + '.notes', {});
    const apps = [...new Set(mine.map((m) => m.title))];
    let filter = 'All';
    const list = h('div', {});
    const draw = () => {
      SK.clear(list);
      const rows = mine.filter((m) => filter === 'All' || m.title === filter).slice().reverse();
      if (!rows.length) { list.appendChild(h('p', { class: 'sk-muted', text: 'No mistakes logged yet. Wrong answers in any app of the suite appear here.' })); return; }
      const retry = rows.filter((m) => m.item && m.item.type && m.item.type !== 'card').slice(0, 20);
      if (retry.length) list.appendChild(h('div', { class: 'sk-row', style: { marginBottom: '10px' } }, SK.btn('Retry ' + retry.length + ' of these', () => SK.quiz(el, retry.map((m) => m.item), { title: 'Retry mistakes', mode: 'practice', noLog: false }), '', { 'data-auto': 'once' })));
      list.appendChild(SK.table(['When', 'App', 'Topic', 'Question', 'Your note'], rows.slice(0, 80).map((m) => {
        const key = m.app + ':' + m.id;
        const inp = h('input', { type: 'text', value: notes[key] || '', placeholder: 'Why did I miss it?', 'aria-label': 'Note', onchange: (e) => { notes[key] = e.target.value; SK.store.set(SK.APP.name + '.notes', notes); } });
        return [new Date(m.at).toLocaleDateString(), m.title, m.topic || '', h('span', { class: 'sk-small' }, SK.rich(String((m.item && (m.item.stem || m.item.say)) || m.id).slice(0, 140))), inp];
      })));
    };
    SK.clear(el);
    el.appendChild(SK.card('Mistakes' + (exam ? ' in ' + exam + ' apps' : ''), SK.stats([['Logged', mine.length], ['This week', mine.filter((m) => Date.now() - m.at < 7 * 86400000).length], ['Apps', apps.length]]),
      apps.length > 1 ? SK.select(['All'].concat(apps), 'All', (v) => { filter = v; draw(); }, 'From app') : null, list));
    draw();
  };

  // A simple log of practice test scores with a trend chart.
  SK.scoreLog = function (el, opts) {
    const key = SK.APP.name + '.scores';
    const scores = SK.store.get(key, []);
    const form = h('div', { class: 'sk-row' });
    const inputs = {};
    const date = h('input', { type: 'date', value: SK.dayKey(), 'aria-label': 'Date' });
    form.appendChild(SK.field('Date', date));
    for (const f of opts.fields) { inputs[f.key] = h('input', { type: 'number', min: f.min, max: f.max, step: f.step || 1, style: { width: '8ch' }, 'aria-label': f.label }); form.appendChild(SK.field(f.label + ' (' + f.min + '–' + f.max + ')', inputs[f.key])); }
    const source = h('input', { type: 'text', placeholder: 'e.g. official practice test 1', 'aria-label': 'Source' });
    form.appendChild(SK.field('Source', source));
    const msg = h('div', {});
    const add = () => {
      const row = { day: date.value || SK.dayKey(), source: source.value };
      for (const f of opts.fields) {
        const v = Number(inputs[f.key].value);
        if (inputs[f.key].value === '' ) continue;
        if (!(v >= f.min && v <= f.max) || (f.step && Math.round(v / f.step) * f.step !== v && Math.abs(Math.round(v / f.step) * f.step - v) > 1e-9)) { SK.clear(msg).appendChild(SK.note(f.label + ' must be between ' + f.min + ' and ' + f.max + (f.step && f.step !== 1 ? ' in steps of ' + f.step : '') + '.', 'wrong')); return; }
        row[f.key] = v;
      }
      if (Object.keys(row).length <= 2) { SK.clear(msg).appendChild(SK.note('Enter at least one score.', 'wrong')); return; }
      scores.push(row); scores.sort((a, b) => (a.day < b.day ? -1 : 1));
      SK.store.set(key, scores);
      SK.scoreLog(el, opts);
    };
    SK.clear(el);
    const card = SK.card('Add a practice score', form, h('div', { style: { marginTop: '10px' } }, SK.btn('Add score', add)), msg);
    el.appendChild(card);
    const target = SK.store.get(key + '.target', {});
    const tcard = SK.card('Targets', h('div', { class: 'sk-row' }, opts.fields.map((f) => SK.field(f.label + ' target', h('input', { type: 'number', min: f.min, max: f.max, step: f.step || 1, value: target[f.key] || '', style: { width: '8ch' }, onchange: (e) => { target[f.key] = Number(e.target.value) || undefined; SK.store.set(key + '.target', target); } })))));
    el.appendChild(tcard);
    const hist = SK.card('History');
    if (!scores.length) hist.appendChild(h('p', { class: 'sk-muted', text: 'No scores yet.' }));
    else {
      for (const f of opts.fields) {
        const pts = scores.filter((s) => s[f.key] !== undefined).map((s) => ({ y: s[f.key], label: s.day }));
        if (!pts.length) continue;
        const last = pts[pts.length - 1].y;
        hist.appendChild(h('h3', { text: f.label + ': latest ' + last + (target[f.key] ? ', target ' + target[f.key] + ' (' + (last >= target[f.key] ? 'reached' : (SK.round(target[f.key] - last, 1)) + ' to go') + ')' : '') }));
        hist.appendChild(SK.chart.line(pts, { min: f.min, max: f.max, label: f.label + ' over time' }));
      }
      hist.appendChild(SK.table(['Date', 'Source'].concat(opts.fields.map((f) => f.label)), scores.slice().reverse().map((s) => [s.day, s.source || ''].concat(opts.fields.map((f) => (s[f.key] === undefined ? '' : s[f.key]))))));
      hist.appendChild(SK.confirmTwice(SK.btn('Delete the last score', null, 'ghost small'), 'Delete the last score', () => { scores.pop(); SK.store.set(key, scores); SK.scoreLog(el, opts); }));
    }
    el.appendChild(hist);
  };

  // Week-by-week plan from a test date, hours per week and how strong each area feels.
  SK.plannerView = function (el, opts) {
    const key = SK.APP.name + '.plan';
    const st = SK.store.get(key, { test: SK.addDays(SK.dayKey(), 56), hours: 8, conf: Object.fromEntries(opts.areas.map((a) => [a.name, 3])), done: {} });
    const draw = () => {
      SK.clear(el);
      const date = h('input', { type: 'date', value: st.test, onchange: (e) => { st.test = e.target.value; save(); } });
      const hours = h('input', { type: 'number', min: 1, max: 60, value: st.hours, style: { width: '7ch' }, onchange: (e) => { st.hours = Math.max(1, Math.min(60, Number(e.target.value) || 1)); save(); } });
      el.appendChild(SK.card('Your plan', h('div', { class: 'sk-row' }, SK.field('Test date', date), SK.field('Hours a week', hours)),
        h('h3', { text: 'How confident are you in each area?' }),
        h('div', { class: 'sk-grid' }, opts.areas.map((a) => SK.select([[1, '1: very weak'], [2, '2: weak'], [3, '3: okay'], [4, '4: good'], [5, '5: strong']], st.conf[a.name], (v) => { st.conf[a.name] = Number(v); save(); }, a.name)))));
      const days = SK.daysLeft(st.test);
      if (days < 1) { el.appendChild(SK.note('Choose a test date in the future.', 'wrong')); return; }
      const plan = SK.planWeeks(SK.dayKey(), st.test, opts.areas.map((a) => ({ name: a.name, weight: 6 - (st.conf[a.name] || 3), tasks: a.tasks })), st.hours);
      const done = Object.values(st.done).filter(Boolean).length;
      const card = SK.card(days + ' days to go', SK.stats([['Weeks', plan.length], ['Hours planned', plan.length * st.hours], ['Weeks done', done]]));
      plan.forEach((w) => card.appendChild(h('label', { class: 'sk-choice', style: { marginBottom: '6px' } },
        h('input', { type: 'checkbox', checked: !!st.done[w.week], onchange: (e) => { st.done[w.week] = e.target.checked; save(); } }),
        h('span', {}, h('strong', { text: 'Week ' + w.week + ' (from ' + w.start + '): ' + w.focus }), h('br'), h('span', { class: 'sk-small sk-muted', text: w.tasks.join(' · ') + (w.tasks.length ? ' · ' : '') + w.hours + ' hours' })))));
      card.appendChild(h('p', { class: 'sk-small sk-muted', text: 'Weaker areas get more weeks. With three or more weeks, the last one is kept for full practice tests.' }));
      el.appendChild(card);
    };
    const save = () => { SK.store.set(key, st); draw(); };
    draw();
  };

  // A checklist with a countdown to a date, for test day planners.
  SK.countdownChecklist = function (el, opts) {
    const key = SK.APP.name + '.day';
    const st = SK.store.get(key, { test: '', done: {} });
    SK.clear(el);
    const date = h('input', { type: 'date', value: st.test, onchange: (e) => { st.test = e.target.value; SK.store.set(key, st); SK.countdownChecklist(el, opts); } });
    const days = st.test ? SK.daysLeft(st.test) : null;
    el.appendChild(SK.card('Countdown', SK.field('Test date', date), days === null ? h('p', { class: 'sk-muted', text: 'Set your test date to see the countdown.' }) : SK.stats([['Days left', Math.max(0, days)], ['Tasks done', Object.values(st.done).filter(Boolean).length + ' / ' + opts.groups.reduce((n, g) => n + g.items.length, 0)]])));
    for (const g of opts.groups) {
      const due = st.test && g.daysBefore !== undefined ? SK.addDays(st.test, -g.daysBefore) : null;
      el.appendChild(SK.card(g.name + (due ? ' (by ' + due + ')' : ''), g.items.map((t, i) => h('label', { class: 'sk-choice', style: { marginBottom: '6px' } },
        h('input', { type: 'checkbox', checked: !!st.done[g.name + i], onchange: (e) => { st.done[g.name + i] = e.target.checked; SK.store.set(key, st); } }), h('span', { text: t })))));
    }
    if (opts.footer) el.appendChild(SK.note(opts.footer));
  };

  // Timed sections in order, with an optional harder or easier second section based on the first.
  SK.sectionRun = function (el, sections, onDone) {
    const results = [];
    const next = (k) => {
      if (k >= sections.length) { onDone(results); return; }
      const sec = sections[k];
      const items = typeof sec.items === 'function' ? sec.items(results) : sec.items;
      SK.clear(el);
      el.appendChild(SK.card(sec.title, h('p', {}, sec.intro || (items.length + ' questions in ' + Math.round(sec.seconds / 60) + ' minutes.')), SK.btn('Start section', () => {
        SK.quiz(el, items, { title: sec.title, mode: 'test', seconds: sec.seconds, review: false, logExtra: { section: sec.title }, onFinish: (sum) => {
          results.push(Object.assign({ title: sec.title }, sum));
          el.appendChild(h('div', { class: 'sk-row' }, SK.btn(k + 1 < sections.length ? 'Next section' : 'See your results', () => next(k + 1), '', { 'data-auto': 'once' })));
        } });
      }, '', { 'data-auto': 'once' })));
    };
    next(0);
  };
})(typeof window !== 'undefined' ? window : globalThis);
