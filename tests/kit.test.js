// Tests for the shared kit: node --test "tests/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const KIT = process.env.SK_KIT || path.join(__dirname, '..', 'web', 'kit');
const SK = require(path.join(KIT, 'sk-core.js'));
require(path.join(KIT, 'sk-quant.js'));
require(path.join(KIT, 'sk-apps.js'));
const { Frac } = SK;

test('fractions parse what students type and compare exactly', () => {
  assert.equal(Frac.parse('3/4').toString(), '3/4');
  assert.equal(Frac.parse('6/8').toString(), '3/4');
  assert.equal(Frac.parse('0.75').toString(), '3/4');
  assert.equal(Frac.parse('-2').toString(), '-2');
  assert.equal(Frac.parse('1,200').toString(), '1200');
  assert.equal(Frac.parse('−5/10').toString(), '-1/2');
  assert.equal(Frac.parse('abc'), null);
  assert.equal(Frac.parse('3/0'), null);
  assert.equal(Frac.parse('.'), null);
  assert.ok(new Frac(1, 3).add(new Frac(1, 6)).eq(new Frac(1, 2)));
  assert.throws(() => new Frac(1, 0));
});

test('numeric entry accepts equivalent answers and honors rounding', () => {
  assert.ok(SK.checkNumeric('2/4', '1/2'));
  assert.ok(SK.checkNumeric('0.5', '1/2'));
  assert.ok(!SK.checkNumeric('0.33', '1/3'));
  assert.ok(SK.checkNumeric('33.3', 33.33, 1));
  assert.ok(!SK.checkNumeric('33.4', 33.33, 1));
  assert.ok(!SK.checkNumeric('', '1'));
});

test('every question type marks right and wrong answers', () => {
  assert.ok(SK.isCorrect({ type: 'single', answer: 2 }, 2));
  assert.ok(!SK.isCorrect({ type: 'single', answer: 2 }, 1));
  assert.ok(SK.isCorrect({ type: 'se', answer: [1, 4] }, [4, 1]));
  assert.ok(!SK.isCorrect({ type: 'se', answer: [1, 4] }, [1]));
  assert.ok(SK.isCorrect({ type: 'tc', answer: [0, 2] }, [0, 2]));
  assert.ok(!SK.isCorrect({ type: 'tc', answer: [0, 2] }, [0, 1]));
  assert.ok(SK.isCorrect({ type: 'order', answer: ['a', 'b', 'c'] }, ['a', 'b', 'c']));
  assert.ok(SK.isCorrect({ type: 'gaps', answer: ['on', 'ter'] }, [' ON', 'ter ']));
  assert.ok(!SK.isCorrect({ type: 'single', answer: 0 }, undefined));
  assert.equal(SK.gapScore({ answer: ['a', 'b', 'c'] }, ['a', 'x', 'c']), 2);
});

test('shuffling keeps the right answer on the same text', () => {
  const r = SK.rng(1);
  const tc = { id: 't', type: 'tc', stem: 'a ___ b ___', blanks: [['x', 'y', 'z'], ['p', 'q', 'r']], answer: [0, 0] };
  const se = { id: 's', type: 'se', stem: 'a ___', choices: ['a', 'b', 'c', 'd', 'e', 'f'], answer: [0, 1] };
  for (let i = 0; i < 50; i++) {
    const a = SK.shuffleItem(r, tc);
    assert.deepEqual(a.blanks.map((b, k) => b[a.answer[k]]), ['x', 'p']);
    const b = SK.shuffleItem(r, se);
    assert.deepEqual(b.answer.map((k) => b.choices[k]).sort(), ['a', 'b']);
  }
  const o = SK.shuffleItem(r, { id: 'o', type: 'order', stem: '', answer: ['I', 'like', 'tea'] });
  assert.notDeepEqual(o.tiles, o.answer);
  assert.deepEqual([...o.tiles].sort(), ['I', 'like', 'tea'].sort());
});

test('the bank validator catches broken questions', () => {
  assert.equal(SK.validateItem({ id: 'a', type: 'single', stem: 'x', choices: ['a', 'b'], answer: 0 }).length, 0);
  assert.ok(SK.validateItem({ id: 'a', type: 'single', stem: 'x', choices: ['a', 'a'], answer: 0 }).length);
  assert.ok(SK.validateItem({ id: 'a', type: 'single', stem: 'x', choices: ['a', 'b'], answer: 5 }).length);
  assert.ok(SK.validateItem({ id: 'a', type: 'se', stem: 'x', choices: ['a', 'b', 'c', 'd', 'e', 'f'], answer: [0] }).length);
  assert.ok(SK.validateItem({ id: 'a', type: 'tc', stem: 'x ___', blanks: [['a', 'b', 'c']], answer: [0] }).length, 'one blank needs five options');
  assert.ok(SK.validateBank([{ id: 'a', type: 'text', stem: '', answer: 'x' }, { id: 'a', type: 'text', stem: '', answer: 'y' }]).length);
});

test('spaced repetition spaces reviews out and resets on a miss', () => {
  const now = Date.UTC(2026, 0, 1);
  let c = SK.srs.fresh('w');
  c = SK.srs.review(c, 4, now); assert.equal(c.interval, 1);
  c = SK.srs.review(c, 4, now); assert.equal(c.interval, 6);
  c = SK.srs.review(c, 4, now); assert.ok(c.interval > 6);
  const before = c.interval;
  c = SK.srs.review(c, 5, now); assert.ok(c.interval > before);
  c = SK.srs.review(c, 1, now); assert.equal(c.interval, 0); assert.equal(c.reps, 0); assert.equal(c.lapses, 1);
  assert.ok(c.ease >= 1.3);
  const deck = { a: Object.assign(SK.srs.fresh('a'), { due: now - 1 }), b: Object.assign(SK.srs.fresh('b'), { due: now + 1e9 }) };
  assert.deepEqual(SK.srs.queue(['a', 'b', 'c', 'd'], deck, now, 1), ['a', 'c']);
  for (let i = 0; i < 30; i++) c = SK.srs.review(c, 1, now);
  assert.equal(SK.round(c.ease, 2), 1.3, 'ease never drops below 1.3');
});

test('writing analysis counts what it should', () => {
  const s = 'The test was taken by many students. However, the results were surprising. For example, scores rose.\n\nIn conclusion, practice helps.';
  const a = SK.text.analyse(s);
  assert.equal(a.paragraphs, 2);
  assert.equal(a.sentences, 4);
  assert.ok(a.passive.some((p) => /was taken/i.test(p)));
  assert.ok(a.transitions.includes('however') && a.transitions.includes('for example') && a.transitions.includes('in conclusion'));
  assert.equal(SK.text.passive('She is in need of help. He was speeding.').length, 0, 'no false passives');
  assert.equal(SK.text.wordCount("It's a well-known fact: 3,000 people came."), 7);
  const d = SK.text.diff('the cat sat on the mat', 'the cat on a mat');
  assert.equal(d.parts.filter((p) => p[0] === 'missed').map((p) => p[1]).join(' '), 'sat the');
  assert.equal(d.accuracy, SK.round(4 / 6, 3));
});

test('Complete the Words blanks the second half of every second word after the first sentence', () => {
  const c = SK.cTest('Bees find flowers by color. They also use scent to find the nectar inside.', 10);
  assert.equal(c.parts[0], 'Bees find flowers by color. ');
  const filled = c.parts.map((p) => (typeof p === 'string' ? p : c.answer[p.gap])).join('');
  assert.equal(filled, 'Bees find flowers by color. They also use scent to find the nectar inside.');
  assert.ok(c.answer.length >= 3);
  for (const a of c.answer) assert.ok(a.length >= 1);
});

test('streaks and study plans', () => {
  assert.equal(SK.streak(['2026-03-01', '2026-03-02', '2026-03-03'], '2026-03-03'), 3);
  assert.equal(SK.streak(['2026-03-01', '2026-03-02'], '2026-03-03'), 2, 'today not done yet still counts yesterday');
  assert.equal(SK.streak(['2026-03-01'], '2026-03-05'), 0);
  assert.equal(SK.addDays('2026-02-27', 3), '2026-03-02');
  const plan = SK.planWeeks('2026-01-01', '2026-02-26', [{ name: 'Weak', weight: 4 }, { name: 'Strong', weight: 1 }], 8);
  assert.equal(plan.length, 8);
  assert.ok(plan.filter((w) => w.focus === 'Weak').length > plan.filter((w) => w.focus === 'Strong').length);
  assert.equal(plan[plan.length - 1].focus, 'Full practice tests and review');
  assert.deepEqual(SK.planWeeks('2026-01-05', '2026-01-01', [{ name: 'x', weight: 1 }], 5), []);
});

test('chart steps are round numbers', () => {
  assert.deepEqual([0.3, 3, 7, 13, 36, 180, 2400].map(SK.niceStep), [0.5, 5, 10, 20, 50, 200, 5000]);
});

test('weak areas rank the lowest accuracy first and ignore thin data', () => {
  const w = SK.weakAreas([{ exam: 'GRE', byTopic: { Algebra: { right: 2, total: 10 }, Geometry: { right: 9, total: 10 }, Sets: { right: 0, total: 1 } } }], 5);
  assert.deepEqual(w.map((x) => x.topic), ['GRE Algebra', 'GRE Geometry']);
});

// ---------- quant: work every answer out a second way ----------
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
const subsets = (n, k) => { let c = 0; for (let m = 0; m < 1 << n; m++) { let b = 0; for (let i = 0; i < n; i++) if (m & (1 << i)) b++; if (b === k) c++; } return c; };
const perms = (s) => (s.length <= 1 ? [s] : [...new Set([...s].flatMap((ch, i) => perms(s.slice(0, i) + s.slice(i + 1)).map((p) => ch + p)))]);
const answerText = (q) => (q.type === 'single' ? q.choices[q.answer] : q.type === 'numeric' ? q.answer : q.answer);
const ORACLE = {
  fracAdd: (p) => new Frac(p.a * p.d + p.c * p.b, p.b * p.d).toString(),
  percentOf: (p) => String(p.p * p.n / 100),
  orderOps: (p) => String(p.a + p.b * p.c - p.d / p.e),
  linear: (p) => String((p.c - p.b) / p.a),
  system: (p) => String(p.x * p.y),
  quadratic: (p) => { const d = Math.sqrt(p.b * p.b - 4 * p.c); return String(Math.max((-p.b + d) / 2, (-p.b - d) / 2)); },
  evaluate: (p) => String(p.a * p.x ** 2 + p.b * p.x + p.c),
  compose: (p) => String(p.a * (p.a * p.k + p.b) + p.b),
  hypotenuse: (p) => String(Math.hypot(p.a, p.b)),
  thirdAngle: (p) => String(180 - p.a - p.b),
  polygon: (p) => String((p.n - 2) * 180),
  rectangle: (p) => String(p.w * p.l),
  factors: (p) => { let c = 0; for (let d = 1; d <= p.n; d++) if (p.n % d === 0) c++; return String(c); },
  remainder: (p) => String(p.n % p.d),
  multiples: (p) => { let c = 0; for (let x = p.a; x <= p.b; x++) if (x % p.k === 0) c++; return String(c); },
  primeSum: (p) => { let s = 0, n = p.n; for (let d = 2; d <= n; d++) if (n % d === 0) { s += d; while (n % d === 0) n /= d; } return String(s); },
  work: (p) => new Frac(p.a * p.b, p.a + p.b).toString(),
  ages: (p) => String(p.diff - p.k),
  mean: (p) => new Frac(p.xs.reduce((a, b) => a + b, 0), p.xs.length).toString(),
  range: (p) => String(Math.max(...p.xs) - Math.min(...p.xs)),
  dice: (p) => { let w = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === p.k) w++; return new Frac(w, 36).toString(); },
  choose: (p) => String(subsets(p.n, p.k)),
  arrange: (p) => String(perms(p.word).length),
  atLeastOne: (p) => new Frac(2 ** p.n - 1, 2 ** p.n).toString(),
  noReplace: (p) => { let w = 0, t = 0; const n = p.red + p.blue; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) { t++; if (i < p.red && j < p.red) w++; } return new Frac(w, t).toString(); },
  expSolve: (p) => String(Math.round(Math.log(p.base ** (p.x + p.m)) / Math.log(p.base)) - p.m),
  absCount: (p) => { let c = 0; for (let x = -100; x <= 100; x++) if (p.strict ? Math.abs(x - p.a) < p.b : Math.abs(x - p.a) <= p.b) c++; return String(c); },
  slope: (p) => new Frac(p.y2 - p.y1, p.x2 - p.x1).toString(),
  distance: (p) => String(Math.hypot(p.x2 - p.x1, p.y2 - p.y1)),
  perpendicular: (p) => new Frac(-p.d, p.n).toString(),
  intercept: (p) => String(p.y0 - p.m * p.x0),
  ratioSplit: (p) => String(p.total * p.b / (p.a + p.b)),
  overlap: (p) => String(p.A + p.B - (p.total - p.neither)),
  overlapPct: (p) => String(p.a + p.b + p.neither - 100) + '%',
  exactlyOne: (p) => String(p.A + p.B - 2 * p.both),
  arithSeq: (p) => { let t = p.a1; for (let i = 1; i < p.n; i++) t += p.d; return String(t); },
  geoSeq: (p) => { let t = p.a1; for (let i = 1; i < p.n; i++) t *= p.q; return String(t); },
  arithSum: (p) => { const d = (p.l - p.a) / (p.n - 1); let s = 0; for (let i = 0; i < p.n; i++) s += p.a + i * d; return String(s); },
  operation: (p) => String(p.p * p.x * p.y - p.q * (p.x + p.y)),
};
test('every generated quant answer matches an independent calculation', () => {
  let checked = 0;
  for (const [name, oracle] of Object.entries(ORACLE)) {
    for (let s = 1; s <= 150; s++) {
      const q = SK.QUANT[name](SK.rng(s * 104729 + name.length));
      const want = oracle(q.params);
      const got = answerText(q);
      assert.ok(Frac.parse(got) && Frac.parse(want) ? Frac.parse(got).eq(Frac.parse(want)) : got === want, name + ': got ' + got + ', expected ' + want + ' for ' + JSON.stringify(q.params));
      checked++;
    }
  }
  assert.ok(checked > 5000);
});
test('quant questions with words or symbols in the answer are right too', () => {
  for (let s = 1; s <= 120; s++) {
    const r = () => SK.rng(s * 31 + 7);
    const c = SK.QUANT.circle(r());
    assert.equal(c.choices[c.answer], (c.params.ask === 'area' ? c.params.rad ** 2 : 2 * c.params.rad) + 'π');
    const pc = SK.QUANT.percentChange(r());
    const pct = Math.round(((pc.params.nw - pc.params.old) / pc.params.old) * 100);
    assert.equal(pc.choices[pc.answer], (pct > 0 ? 'An increase of ' : 'A decrease of ') + Math.abs(pct) + '%');
    const sc = SK.QUANT.sciNotation(r());
    const [m, e] = sc.choices[sc.answer].split(' × 10^{');
    assert.ok(Math.abs(Number(m) * 10 ** parseInt(e, 10) - sc.params.a * sc.params.b * 10 ** (sc.params.p + sc.params.q)) < 1e-6 * 10 ** (sc.params.p + sc.params.q + 2));
    assert.ok(Number(m) >= 1 && Number(m) < 10);
    const iq = SK.QUANT.ineq(r());
    const x0 = (iq.params.c - iq.params.b) / iq.params.a;
    const okAt = (x) => iq.params.a * x + iq.params.b < iq.params.c;
    assert.equal(iq.choices[iq.answer], 'x ' + (okAt(x0 - 1) ? '<' : '>') + ' ' + x0);
    const rs = SK.QUANT.rootSimplify(r());
    const [k, rad] = rs.choices[rs.answer].split('sqrt{');
    assert.equal(Number(k) ** 2 * parseInt(rad, 10), rs.params.a * rs.params.b ** 2);
    const su = SK.QUANT.successive(r());
    const net = SK.round(((1 + su.params.up / 100) * (1 - su.params.down / 100) - 1) * 100, 2);
    assert.ok(su.choices[su.answer].includes(String(Math.abs(net))) || (net === 0 && su.choices[su.answer] === 'No change'));
    const rp = SK.QUANT.reversePercent(r());
    assert.equal(rp.choices[rp.answer], '$' + rp.params.orig.toLocaleString('en-US'));
    const ip = SK.QUANT.interest(r());
    assert.equal(ip.choices[ip.answer], '$' + ((ip.params.P * ip.params.rate * ip.params.t) / 100).toLocaleString('en-US').replace(/(\.\d)$/, '$10'));
  }
});
test('quantitative comparison answers hold for tested values', () => {
  for (let s = 1; s <= 200; s++) {
    const q = SK.QUANT.qcFraction(SK.rng(s));
    const a = q.params.a / q.params.b, b = q.params.dec;
    assert.equal(q.answer, a > b ? 0 : a < b ? 1 : 2);
    const sd = SK.QUANT.sdCompare(SK.rng(s));
    const spread = (xs) => { const m = xs.reduce((x, y) => x + y) / xs.length; return Math.sqrt(xs.reduce((t, x) => t + (x - m) ** 2, 0) / xs.length); };
    assert.equal(sd.answer, spread(sd.params.A) > spread(sd.params.B) ? 0 : 1);
  }
  // x^2 vs x for integers: equal at 0 and 1, greater elsewhere, so it cannot be determined
  const xs = [-3, -1, 0, 1, 2, 5];
  assert.ok(xs.some((x) => x * x === x) && xs.some((x) => x * x > x));
});
test('points in coordinate questions fit on the drawn plane', () => {
  for (const name of ['slope', 'distance', 'intercept']) for (let s = 1; s <= 500; s++) {
    const q = SK.QUANT[name](SK.rng(s));
    for (const [x, y] of q.figure.points) assert.ok(Math.abs(x) <= 10 && Math.abs(y) <= 10, name + ' point (' + x + ', ' + y + ') is off the plane');
  }
});
test('a generated quant set has no repeated question and covers the templates', () => {
  const set = SK.makeQuant(SK.QUANT_TOPICS.algebra, 15, 42);
  assert.equal(set.length, 15);
  assert.equal(new Set(set.map((q) => q.id)).size, 15);
  assert.equal(new Set(set.map((q) => q.template)).size, SK.QUANT_TOPICS.algebra.length);
  for (const q of set) assert.ok(SK.isCorrect(q, q.answer));
});
test('data sets give answers that match the chart', () => {
  for (let s = 1; s <= 100; s++) {
    const d = SK.makeDataSet(s);
    const total = d.values.reduce((a, b) => a + b, 0);
    const mean = d.items.find((i) => i.topic === 'Average');
    assert.ok(SK.checkNumeric(String(total / d.values.length), mean.answer, 1));
    const ab = d.items.find((i) => i.topic === 'Comparison');
    assert.equal(Number(ab.choices[ab.answer]), d.values.filter((v) => v > total / d.values.length).length);
  }
});

// ---------- word quizzes ----------
test('word quizzes have one right meaning and blank the word in its sentence', () => {
  const words = [
    { id: 'a', w: 'abate', pos: 'verb', d: 'to lessen', e: 'The storm abated by noon.', syn: ['subside'] },
    { id: 'b', w: 'laud', pos: 'verb', d: 'to praise', e: 'Critics lauded the film.', syn: ['praise'] },
    { id: 'c', w: 'shun', pos: 'verb', d: 'to avoid', e: 'They shunned the press.', syn: ['avoid'] },
    { id: 'd', w: 'mollify', pos: 'verb', d: 'to calm', e: 'An apology mollified her.', syn: ['placate'] },
    { id: 'e', w: 'goad', pos: 'verb', d: 'to provoke', e: 'They goaded him on.', syn: ['prod'] },
    { id: 'f', w: 'heed', pos: 'verb', d: 'to pay attention to', e: 'Heed the warning.', syn: ['mind'] }];
  assert.equal(SK.blankOut('The storm abated by noon.', 'abate'), 'The storm _____ by noon.');
  assert.equal(SK.blankOut('No match here.', 'abate'), null);
  for (const kind of ['meaning', 'word', 'blank', 'synonym']) {
    for (let s = 1; s < 30; s++) {
      const it = SK.wordItem(SK.rng(s), words, words[0], kind);
      assert.equal(it.choices.length, 5);
      assert.equal(new Set(it.choices).size, 5);
      const right = it.choices[it.answer];
      assert.ok({ meaning: 'to lessen', word: 'abate', blank: 'abate', synonym: 'subside' }[kind] === right, kind + ' gave ' + right);
    }
  }
});
