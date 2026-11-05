/* sk-core.js: the logic of the GRE and TOEFL Study Suite, with no page code, so Node can test it.
   Loaded in the page as a plain script (window.SK) and in tests with require(). */
(function (root) {
  'use strict';
  const SK = root.SK || {};

  // ---------- random numbers that repeat for a seed ----------
  SK.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  SK.randInt = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  SK.pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  SK.shuffle = function (r, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  SK.sample = (r, arr, n) => SK.shuffle(r, arr).slice(0, Math.min(n, arr.length));
  SK.seedNow = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  SK.range = (n) => Array.from({ length: n }, (_, i) => i);
  SK.sum = (a) => a.reduce((s, x) => s + x, 0);
  SK.round = (x, d) => { const p = Math.pow(10, d || 0); return Math.round(x * p) / p; };

  // ---------- exact fractions ----------
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
  SK.gcd = gcd;
  SK.lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
  class Frac {
    constructor(n, d) {
      if (d === undefined) d = 1;
      if (d === 0) throw new Error('zero denominator');
      if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error('fractions need whole numbers');
      if (d < 0) { n = -n; d = -d; }
      const g = gcd(n, d) || 1;
      this.n = n / g; this.d = d / g;
    }
    static of(x) { return x instanceof Frac ? x : new Frac(x, 1); }
    add(o) { o = Frac.of(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Frac.of(o); return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Frac.of(o); return new Frac(this.n * o.n, this.d * o.d); }
    div(o) { o = Frac.of(o); return new Frac(this.n * o.d, this.d * o.n); }
    eq(o) { o = Frac.of(o); return this.n === o.n && this.d === o.d; }
    cmp(o) { o = Frac.of(o); return Math.sign(this.n * o.d - o.n * this.d); }
    value() { return this.n / this.d; }
    toString() { return this.d === 1 ? String(this.n) : this.n + '/' + this.d; }
    // Parse what a student types: "3/4", "-2", "0.75", "1,200".
    static parse(s) {
      s = String(s).trim().replace(/,/g, '').replace(/−/g, '-');
      let m = s.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
      if (m) return Number(m[2]) === 0 ? null : new Frac(Number(m[1]), Number(m[2]));
      m = s.match(/^(-?)(\d*)\.?(\d*)$/);
      if (!m || (m[2] === '' && m[3] === '')) return null;
      const den = Math.pow(10, m[3].length);
      const num = Number((m[2] || '0') + m[3]);
      return new Frac(m[1] ? -num : num, den);
    }
  }
  SK.Frac = Frac;

  // Numeric entry, as on the GRE: equivalent fractions and exact decimals count as the same answer.
  // tolerance is for answers that ask for rounding: the answer must match after rounding to that many places.
  SK.checkNumeric = function (input, answer, places) {
    const got = Frac.parse(input);
    if (!got) return false;
    if (places !== undefined && places !== null) return SK.round(got.value(), places) === SK.round(Number(answer), places);
    const want = answer instanceof Frac ? answer : Frac.parse(answer);
    return !!want && got.eq(want);
  };

  // ---------- marking any question ----------
  // item.type: single | multi | se | tc | numeric | qc | order | gaps | text
  SK.isCorrect = function (item, resp) {
    if (resp === undefined || resp === null) return false;
    switch (item.type) {
      case 'single': case 'qc': return resp === item.answer;
      case 'multi': case 'se': {
        const a = [...item.answer].sort().join(','), b = [...resp].sort().join(',');
        return a === b;
      }
      case 'tc': return Array.isArray(resp) && item.answer.every((x, i) => resp[i] === x);
      case 'numeric': return SK.checkNumeric(resp, item.answer, item.places);
      case 'order': return Array.isArray(resp) && resp.join(' ') === item.answer.join(' ');
      case 'gaps': return Array.isArray(resp) && item.answer.every((x, i) => SK.norm(resp[i]) === SK.norm(x));
      case 'text': return SK.norm(resp) === SK.norm(item.answer);
      default: return false;
    }
  };
  // Banks list the right answer first, which makes them easy to check by eye. Shuffle before showing, keeping
  // the answer pointing at the same option text.
  SK.shuffleItem = function (r, item) {
    const it = JSON.parse(JSON.stringify(item));
    if ((it.type === 'single' && !it.fixedOrder) || it.type === 'multi' || it.type === 'se') {
      const order = SK.shuffle(r, SK.range(it.choices.length));
      it.choices = order.map((k) => item.choices[k]);
      it.answer = Array.isArray(item.answer) ? item.answer.map((a) => order.indexOf(a)).sort((a, b) => a - b) : order.indexOf(item.answer);
    } else if (it.type === 'tc') {
      it.blanks = item.blanks.map((opts, b) => {
        const order = SK.shuffle(r, SK.range(opts.length));
        it.answer[b] = order.indexOf(item.answer[b]);
        return order.map((k) => opts[k]);
      });
    } else if (it.type === 'order' && !it.tiles) {
      let tiles = SK.shuffle(r, item.answer);
      if (tiles.join(' ') === item.answer.join(' ')) tiles = tiles.slice(1).concat(tiles.slice(0, 1));
      it.tiles = tiles;
    }
    return it;
  };
  // Partial credit for gaps, used in Complete the Words style feedback.
  SK.gapScore = (item, resp) => item.answer.filter((x, i) => resp && SK.norm(resp[i]) === SK.norm(x)).length;
  SK.norm = (s) => String(s === undefined || s === null ? '' : s).trim().toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
  SK.QC_CHOICES = ['Quantity A is greater.', 'Quantity B is greater.', 'The two quantities are equal.', 'The relationship cannot be determined from the information given.'];

  // A question bank checks itself: every item must be markable, with one right answer where the type needs one.
  SK.validateItem = function (it) {
    const errs = [];
    const need = (c, m) => { if (!c) errs.push((it.id || '?') + ': ' + m); };
    need(it.id, 'no id');
    need(typeof it.stem === 'string' || it.type === 'gaps', 'no question text');
    switch (it.type) {
      case 'single':
        need(Array.isArray(it.choices) && it.choices.length >= 2, 'needs choices');
        need(Number.isInteger(it.answer) && it.answer >= 0 && it.answer < (it.choices || []).length, 'answer out of range');
        need(new Set((it.choices || []).map(SK.norm)).size === (it.choices || []).length, 'repeated choice');
        break;
      case 'multi': case 'se':
        need(Array.isArray(it.choices) && it.choices.length >= 3, 'needs choices');
        need(Array.isArray(it.answer) && it.answer.length >= 1 && it.answer.every((x) => x >= 0 && x < it.choices.length), 'answer out of range');
        need(new Set(it.answer).size === it.answer.length, 'answer repeats');
        need(new Set((it.choices || []).map(SK.norm)).size === (it.choices || []).length, 'repeated choice');
        if (it.type === 'se') { need(it.choices.length === 6, 'sentence equivalence has six choices'); need(it.answer.length === 2, 'sentence equivalence has two answers'); }
        break;
      case 'tc':
        need(Array.isArray(it.blanks) && it.blanks.length >= 1 && it.blanks.length <= 3, 'one to three blanks');
        need(Array.isArray(it.answer) && it.answer.length === (it.blanks || []).length, 'one answer per blank');
        (it.blanks || []).forEach((b, i) => {
          need(b.length === (it.blanks.length === 1 ? 5 : 3), 'blank ' + (i + 1) + ' has the wrong number of options');
          need(it.answer[i] >= 0 && it.answer[i] < b.length, 'blank ' + (i + 1) + ' answer out of range');
          need(new Set(b.map(SK.norm)).size === b.length, 'blank ' + (i + 1) + ' repeats an option');
        });
        need((it.stem.match(/_{3,}/g) || []).length === (it.blanks || []).length, 'blank marks do not match blanks');
        break;
      case 'numeric': need(Frac.parse(it.answer) !== null || typeof it.answer === 'number', 'answer is not a number'); break;
      case 'qc': need(Array.isArray(it.quantities) && it.quantities.length === 2, 'needs two quantities'); need(it.answer >= 0 && it.answer <= 3, 'answer out of range'); break;
      case 'order': need(Array.isArray(it.answer) && it.answer.length >= 3, 'needs words'); break;
      case 'gaps': need(Array.isArray(it.parts) && Array.isArray(it.answer), 'needs parts'); break;
      case 'text': need(typeof it.answer === 'string' && it.answer.length > 0, 'needs an answer'); break;
      default: errs.push((it.id || '?') + ': unknown type ' + it.type);
    }
    return errs;
  };
  SK.validateBank = (items) => {
    const errs = items.flatMap(SK.validateItem);
    const ids = items.map((x) => x.id);
    if (new Set(ids).size !== ids.length) errs.push('repeated ids');
    return errs;
  };

  // ---------- spaced repetition (SM-2, the method behind most flashcard apps) ----------
  const DAY = 86400000;
  SK.srs = {
    fresh: (id) => ({ id, reps: 0, ease: 2.5, interval: 0, due: 0, lapses: 0, seen: 0 }),
    // grade: 1 again, 3 hard, 4 good, 5 easy
    review(card, grade, now) {
      const c = Object.assign({}, card);
      now = now || Date.now();
      c.seen = (c.seen || 0) + 1;
      if (grade < 3) {
        c.reps = 0; c.interval = 0; c.lapses = (c.lapses || 0) + 1;
        c.due = now + 10 * 60000;            // see it again in ten minutes
      } else {
        c.reps += 1;
        if (c.reps === 1) c.interval = grade === 5 ? 3 : 1;
        else if (c.reps === 2) c.interval = grade === 3 ? 3 : 6;
        else c.interval = Math.round(c.interval * (grade === 3 ? 1.2 : c.ease) * (grade === 5 ? 1.3 : 1));
        c.due = now + c.interval * DAY;
      }
      c.ease = Math.max(1.3, c.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
      return c;
    },
    // Cards to study now: everything due, then new cards up to the daily limit.
    queue(ids, deck, now, newLimit) {
      now = now || Date.now();
      const due = ids.filter((id) => deck[id] && deck[id].due <= now).sort((a, b) => deck[a].due - deck[b].due);
      const fresh = ids.filter((id) => !deck[id]).slice(0, newLimit === undefined ? 20 : newLimit);
      return due.concat(fresh);
    },
    stats(ids, deck, now) {
      now = now || Date.now();
      let fresh = 0, learning = 0, mature = 0, due = 0;
      for (const id of ids) {
        const c = deck[id];
        if (!c) { fresh++; continue; }
        if (c.due <= now) due++;
        if (c.interval >= 21) mature++; else learning++;
      }
      return { fresh, learning, mature, due, total: ids.length };
    },
  };

  // ---------- writing analysis ----------
  const TRANSITIONS = ['however', 'therefore', 'moreover', 'furthermore', 'in addition', 'for example', 'for instance', 'consequently', 'as a result',
    'on the other hand', 'in contrast', 'nevertheless', 'nonetheless', 'similarly', 'likewise', 'in conclusion', 'to conclude', 'first', 'second',
    'third', 'finally', 'meanwhile', 'thus', 'hence', 'although', 'even though', 'whereas', 'admittedly', 'indeed', 'in fact', 'specifically',
    'in particular', 'because', 'since', 'despite', 'instead', 'otherwise', 'ultimately', 'overall', 'to illustrate', 'by contrast', 'conversely'];
  const STOP = new Set('a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those i you he she we they them his her their our my your not no so do does did have has had will would can could should may might must than then there here which who whom what when where why how all any some more most such also into about over very just only own same other each both few many much'.split(' '));
  const IRREGULAR = new Set('been born built bought brought caught chosen done drawn driven eaten fallen felt found forgotten given gone grown held hidden hit hurt kept known laid led left lent lost made meant met paid put read ridden risen run said seen sent set shown shut spent spoken spread stood stolen struck sung taken taught thought thrown told understood won worn written'.split(' '));
  SK.text = {
    words: (s) => (String(s).match(/[A-Za-zÀ-ɏ]+(?:['’-][A-Za-z]+)*|\d+(?:[.,]\d+)*/g) || []),
    wordCount: (s) => SK.text.words(s).length,
    sentences: (s) => String(s).replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=["'(“]?[A-Z0-9])/).map((x) => x.trim()).filter((x) => /[A-Za-z]/.test(x)),
    paragraphs: (s) => String(s).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean),
    // "is believed", "were taken": a be-verb followed by a past participle.
    passive(s) {
      const out = [];
      const re = /\b(am|is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?([a-z]+)\b/gi;
      let m;
      while ((m = re.exec(s))) {
        const w = m[2].toLowerCase();
        if ((/ed$/.test(w) && w.length > 3 && !/(need|seed|feed|bleed|speed|ted)$/.test(w)) || IRREGULAR.has(w)) out.push(m[0]);
      }
      return out;
    },
    transitions(s) {
      const low = ' ' + String(s).toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
      return TRANSITIONS.filter((t) => low.includes(' ' + t + ' '));
    },
    repeated(s, min) {
      const counts = {};
      for (const w of SK.text.words(s)) { const k = w.toLowerCase(); if (k.length > 3 && !STOP.has(k)) counts[k] = (counts[k] || 0) + 1; }
      return Object.entries(counts).filter(([, n]) => n >= (min || 4)).sort((a, b) => b[1] - a[1]);
    },
    analyse(s) {
      const sents = SK.text.sentences(s);
      const lens = sents.map((x) => SK.text.wordCount(x));
      const mean = lens.length ? SK.sum(lens) / lens.length : 0;
      const sd = lens.length ? Math.sqrt(SK.sum(lens.map((x) => (x - mean) * (x - mean))) / lens.length) : 0;
      const words = SK.text.words(s);
      const uniq = new Set(words.map((w) => w.toLowerCase())).size;
      return {
        words: words.length, sentences: sents.length, paragraphs: SK.text.paragraphs(s).length,
        meanSentence: SK.round(mean, 1), sentenceSpread: SK.round(sd, 1), longest: lens.length ? Math.max(...lens) : 0,
        passive: SK.text.passive(s), transitions: SK.text.transitions(s), repeated: SK.text.repeated(s),
        variety: words.length ? SK.round(uniq / words.length, 2) : 0,
      };
    },
    // Word-by-word comparison for dictation: which words were missed, added or kept.
    diff(expected, actual) {
      const a = SK.text.words(expected).map((w) => w.toLowerCase()), b = SK.text.words(actual).map((w) => w.toLowerCase());
      const n = a.length, m = b.length;
      const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      const out = [];
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (a[i] === b[j]) { out.push(['same', a[i]]); i++; j++; }
        else if (L[i + 1][j] >= L[i][j + 1]) { out.push(['missed', a[i]]); i++; }
        else { out.push(['extra', b[j]]); j++; }
      }
      while (i < n) out.push(['missed', a[i++]]);
      while (j < m) out.push(['extra', b[j++]]);
      const same = out.filter((x) => x[0] === 'same').length;
      return { parts: out, accuracy: n ? SK.round(same / n, 3) : 1 };
    },
    syllables(word) {
      const w = word.toLowerCase().replace(/[^a-z]/g, '');
      if (w.length <= 3) return 1;
      const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
      return Math.max(1, groups ? groups.length : 1);
    },
  };

  // ---------- Complete the Words: blank the second half of every second word ----------
  // The first sentence stays whole, as in the classic C-test design; short words and numbers are skipped.
  SK.cTest = function (passage, maxGaps) {
    const sents = SK.text.sentences(passage);
    if (!sents.length) return { parts: [], answer: [] };
    const parts = [sents[0] + ' '];
    const answer = [];
    let count = 0, k = 0;
    const rest = sents.slice(1).join(' ');
    const tokens = rest.split(/(\s+)/);
    for (const tok of tokens) {
      const m = tok.match(/^([("“]*)([A-Za-z]+)([^A-Za-z]*)$/);
      if (!m || m[2].length < 3 || count >= (maxGaps || 10)) { parts.push(tok); continue; }
      k++;
      if (k % 2 === 0) {
        const w = m[2];
        const keep = Math.ceil(w.length / 2) === w.length / 2 ? w.length / 2 : Math.floor(w.length / 2);
        parts.push(m[1] + w.slice(0, keep));
        parts.push({ gap: answer.length, len: w.length - keep });
        parts.push(m[3]);
        answer.push(w.slice(keep));
        count++;
      } else parts.push(tok);
    }
    return { parts, answer };
  };

  // ---------- dates and study plans ----------
  SK.dayKey = (t) => { const d = new Date(t === undefined ? Date.now() : t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  SK.parseDay = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
  SK.daysBetween = (a, b) => Math.round((SK.parseDay(b) - SK.parseDay(a)) / DAY);
  SK.addDays = (k, n) => { const t = new Date(SK.parseDay(k)); t.setDate(t.getDate() + n); return SK.dayKey(t.getTime()); };
  // Streak: consecutive days with practice, counting back from today (or yesterday, if today is still empty).
  SK.streak = function (dayKeys, today) {
    const set = new Set(dayKeys);
    today = today || SK.dayKey();
    let d = set.has(today) ? today : SK.addDays(today, -1);
    let n = 0;
    while (set.has(d)) { n++; d = SK.addDays(d, -1); }
    return n;
  };
  // Split the days until a test date across topics, weighted by how weak each topic is.
  SK.planWeeks = function (startKey, testKey, topics, hoursPerWeek) {
    const days = SK.daysBetween(startKey, testKey);
    if (days < 1) return [];
    const weeks = Math.max(1, Math.ceil(days / 7));
    const review = weeks >= 3 ? 1 : 0;
    const teach = weeks - review;
    const total = SK.sum(topics.map((t) => t.weight));
    const plan = [];
    // largest remainder: weeks of focus per topic in proportion to weight
    const raw = topics.map((t) => (t.weight / total) * teach);
    const base = raw.map(Math.floor);
    let left = teach - SK.sum(base);
    raw.map((x, i) => [x - base[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { base[i]++; left--; } });
    const order = topics.map((t, i) => [t, base[i]]).filter((x) => x[1] > 0).sort((a, b) => b[0].weight - a[0].weight);
    let w = 0;
    for (const [t, n] of order) for (let k = 0; k < n; k++) {
      plan.push({ week: w + 1, start: SK.addDays(startKey, w * 7), focus: t.name, hours: hoursPerWeek, tasks: t.tasks || [] });
      w++;
    }
    for (let k = 0; k < review; k++) { plan.push({ week: w + 1, start: SK.addDays(startKey, w * 7), focus: 'Full practice tests and review', hours: hoursPerWeek, tasks: ['Take a full practice test', 'Redo every question in your error log'] }); w++; }
    return plan;
  };

  // The same number all day for one app, so a daily set does not change when you reopen it.
  SK.daySeed = function (name, day) {
    const str = (day || SK.dayKey()) + '|' + name;
    let x = 2166136261;
    for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
    return x >>> 0;
  };
  // ---------- results ----------
  SK.summarise = function (items, responses, seconds) {
    const byTopic = {};
    let correct = 0;
    items.forEach((it, i) => {
      const ok = SK.isCorrect(it, responses[i]);
      if (ok) correct++;
      const t = it.topic || 'General';
      byTopic[t] = byTopic[t] || { right: 0, total: 0 };
      byTopic[t].total++;
      if (ok) byTopic[t].right++;
    });
    return { correct, total: items.length, seconds: seconds || 0, byTopic, pct: items.length ? Math.round((100 * correct) / items.length) : 0 };
  };
  // Weakest topics first, from logged sessions: needs at least a few answers to say anything.
  SK.weakAreas = function (sessions, minAnswers) {
    const t = {};
    for (const s of sessions) for (const [k, v] of Object.entries(s.byTopic || {})) {
      const key = (s.exam ? s.exam + ' ' : '') + k;
      t[key] = t[key] || { topic: key, right: 0, total: 0 };
      t[key].right += v.right; t[key].total += v.total;
    }
    return Object.values(t).filter((x) => x.total >= (minAnswers || 5)).map((x) => Object.assign(x, { pct: Math.round((100 * x.right) / x.total) })).sort((a, b) => a.pct - b.pct || b.total - a.total);
  };
  // A round step for chart axes: 1, 2 or 5 times a power of ten.
  SK.niceStep = (raw) => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))); const m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
  SK.formatTime = (s) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };

  if (typeof module !== 'undefined' && module.exports) module.exports = SK; else root.SK = SK;
})(typeof window !== 'undefined' ? window : globalThis);
