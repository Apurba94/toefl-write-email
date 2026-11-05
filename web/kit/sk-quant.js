/* sk-quant.js: generated GRE Quant questions. Every question is built from random numbers chosen so the answer is
   exact, and keeps its numbers in item.params so the tests can work the answer out a second, independent way. */
(function (root) {
  'use strict';
  const SK = root.SK || require('./sk-core.js');
  const { Frac, randInt: ri, pick, shuffle } = SK;
  const fmt = (x) => (x instanceof Frac ? x.toString() : Number.isInteger(x) ? String(x) : String(SK.round(x, 4)));
  const money = (x) => '$' + (Number.isInteger(x) ? x.toLocaleString('en-US') : x.toFixed(2));

  // Five choices: the answer first, then likely mistakes, topped up with nearby values; all different.
  function mc(answer, mistakes, filler) {
    const out = [String(answer)];
    for (const m of mistakes) { const s = String(m); if (!out.includes(s) && s !== 'NaN' && s !== 'undefined') out.push(s); }
    let k = 1;
    while (out.length < 5 && k < 60) { const s = String(filler(k)); if (!out.includes(s)) out.push(s); k++; }
    return out.slice(0, 5);
  }
  // Nearby wrong values for an answer that is a whole number or a fraction.
  const near = (text) => {
    const f = Frac.parse(text);
    if (!f) return (k) => String(text) + ' (' + k + ')';
    return (k) => fmt(f.add(new Frac(k % 2 ? Math.ceil(k / 2) : -Math.ceil(k / 2), f.d === 1 ? 1 : f.d)));
  };
  function item(key, topic, stem, answerText, mistakes, explanation, extra) {
    const it = Object.assign({ id: 'q-' + key, type: 'single', topic, stem, choices: mc(answerText, mistakes, (extra && extra.filler) || near(answerText)), answer: 0, explanation }, extra || {});
    delete it.filler;
    return it;
  }
  function numeric(key, topic, stem, answer, explanation, extra) {
    return Object.assign({ id: 'q-' + key, type: 'numeric', topic, stem, answer: fmt(answer), explanation }, extra || {});
  }
  function qc(key, topic, given, a, b, answer, explanation, extra) {
    return Object.assign({ id: 'q-' + key, type: 'qc', topic, given, stem: given ? '' : '', quantities: [a, b], answer, explanation }, extra || {});
  }
  const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [20, 21, 29]];
  const primesUpTo = (n) => SK.range(n + 1).filter((x) => x > 1 && SK.range(x).every((d) => d < 2 || x % d !== 0));
  const factorCount = (n) => SK.range(n).filter((d) => d > 0 && n % d === 0).length + 1;

  const T = {};
  // ---------- arithmetic ----------
  T.fracAdd = (r) => {
    const b = ri(r, 2, 9), d = pick(r, [3, 4, 5, 6, 8, 10, 12].filter((x) => x !== b)), a = ri(r, 1, b - 1), c = ri(r, 1, d - 1);
    const ans = new Frac(a, b).add(new Frac(c, d));
    return numeric('fracAdd-' + [a, b, c, d], 'Fractions', 'What is ' + a + '/' + b + ' + ' + c + '/' + d + '? Give your answer as a fraction.', ans,
      'Use a common denominator of ' + SK.lcm(b, d) + ': ' + new Frac(a * (SK.lcm(b, d) / b), 1) + '/' + SK.lcm(b, d) + ' + ' + c * (SK.lcm(b, d) / d) + '/' + SK.lcm(b, d) + ' = ' + ans + '.', { params: { a, b, c, d } });
  };
  T.percentOf = (r) => {
    const p = pick(r, [5, 12, 15, 20, 25, 35, 40, 45, 60, 75, 120, 150]), n = ri(r, 2, 40) * 20;
    const ans = (p * n) / 100;
    return item('percentOf-' + [p, n], 'Percents', 'What is ' + p + '% of ' + n + '?', fmt(ans), [fmt(n / p), fmt((p * n) / 10), fmt(n - ans), fmt(ans * 2)],
      p + '% of ' + n + ' = ' + p + '/100 × ' + n + ' = ' + fmt(ans) + '.', { params: { p, n } });
  };
  T.percentChange = (r) => {
    const old = ri(r, 2, 20) * 10, pct = pick(r, [10, 20, 25, 30, 40, 50, 60, 75, -10, -20, -25, -40, -50]);
    const nw = old + (old * pct) / 100;
    if (!Number.isInteger(nw)) return T.percentChange(r);
    const wrong = Math.round(((nw - old) / nw) * 1000) / 10;
    return item('percentChange-' + [old, nw], 'Percents', 'A price changed from ' + money(old) + ' to ' + money(nw) + '. What was the percent change?', (pct > 0 ? 'An increase of ' : 'A decrease of ') + Math.abs(pct) + '%',
      [(pct > 0 ? 'An increase of ' : 'A decrease of ') + Math.abs(wrong) + '%', (pct > 0 ? 'A decrease of ' : 'An increase of ') + Math.abs(pct) + '%', (pct > 0 ? 'An increase of ' : 'A decrease of ') + Math.abs(nw - old) + '%', (pct > 0 ? 'An increase of ' : 'A decrease of ') + Math.abs(pct * 2) + '%'],
      'Percent change = (new − old) ÷ old = ' + (nw - old) + ' ÷ ' + old + ' = ' + pct + '%. Dividing by the new value is the classic mistake.', { params: { old, nw }, filler: (k) => 'An increase of ' + (Math.abs(pct) + 5 * k) + '%' });
  };
  T.orderOps = (r) => {
    const a = ri(r, 2, 20), b = ri(r, 2, 9), c = ri(r, 2, 9), e = ri(r, 2, 6), d = e * ri(r, 1, 6);
    const ans = a + b * c - d / e;
    return item('orderOps-' + [a, b, c, d, e], 'Order of operations', 'What is ' + a + ' + ' + b + ' × ' + c + ' − ' + d + ' ÷ ' + e + '?', fmt(ans), [fmt((a + b) * c - d / e), fmt(((a + b) * c - d) / e), fmt(a + b * (c - d) / e), fmt(a + b * c - d)],
      'Multiply and divide before adding and subtracting: ' + b + ' × ' + c + ' = ' + b * c + ' and ' + d + ' ÷ ' + e + ' = ' + d / e + ', so ' + a + ' + ' + b * c + ' − ' + d / e + ' = ' + ans + '.', { params: { a, b, c, d, e } });
  };
  // ---------- algebra ----------
  T.linear = (r) => {
    const x = ri(r, -12, 12), a = pick(r, [2, 3, 4, 5, 6, 7, -2, -3, -4]), b = ri(r, -20, 20), c = a * x + b;
    return item('linear-' + [a, b, c], 'Linear equations', 'If ' + a + 'x ' + (b < 0 ? '− ' + -b : '+ ' + b) + ' = ' + c + ', what is x?', String(x), [String(-x), fmt(new Frac(c + b, a)), fmt(new Frac(c, a)), String(x + 1)],
      'Subtract ' + b + ' from both sides: ' + a + 'x = ' + (c - b) + '. Divide by ' + a + ': x = ' + x + '.', { params: { a, b, c } });
  };
  T.system = (r) => {
    const x = ri(r, -8, 12), y = ri(r, -8, 12);
    return item('system-' + [x, y], 'Systems of equations', 'If x + y = ' + (x + y) + ' and x − y = ' + (x - y) + ', what is the value of xy?', String(x * y), [String(x + y), String(x - y), String(x * x - y * y), String(-x * y)],
      'Add the equations: 2x = ' + 2 * x + ', so x = ' + x + ' and y = ' + y + '. Then xy = ' + x * y + '.', { params: { x, y }, filler: (k) => String(x * y + (k % 2 ? k : -k)) });
  };
  T.quadratic = (r) => {
    const p = ri(r, -9, 9), q = ri(r, -9, 9);
    if (p === q) return T.quadratic(r);
    const b = -(p + q), c = p * q;
    const poly = 'x^{2} ' + (b === 0 ? '' : (b < 0 ? '− ' + -b : '+ ' + b) + 'x ') + (c === 0 ? '' : (c < 0 ? '− ' + -c : '+ ' + c) + ' ') + '= 0';
    return item('quadratic-' + [p, q], 'Quadratics', 'What is the greater of the two solutions of ' + poly + '?', String(Math.max(p, q)), [String(Math.min(p, q)), String(-Math.max(p, q)), String(p + q), String(p * q)],
      'Factor: (x ' + (p < 0 ? '+ ' + -p : '− ' + p) + ')(x ' + (q < 0 ? '+ ' + -q : '− ' + q) + ') = 0, so x = ' + p + ' or x = ' + q + '. The greater is ' + Math.max(p, q) + '.', { params: { b, c } });
  };
  T.evaluate = (r) => {
    const x = ri(r, -5, 6), a = ri(r, 1, 4), b = ri(r, -6, 6), c = ri(r, -9, 9), v = a * x * x + b * x + c;
    return item('evaluate-' + [a, b, c, x], 'Expressions', 'If x = ' + x + ', what is ' + a + 'x^{2} ' + (b < 0 ? '− ' + -b : '+ ' + b) + 'x ' + (c < 0 ? '− ' + -c : '+ ' + c) + '?', String(v), [String(a * x * 2 + b * x + c), String(-a * x * x + b * x + c), String((a * x) * (a * x) + b * x + c), String(v + 2 * b * x)],
      'Substitute: ' + a + '(' + x + ')^{2} + ' + b + '(' + x + ') + ' + c + ' = ' + a * x * x + ' + ' + b * x + ' + ' + c + ' = ' + v + '. Square the x before multiplying by ' + a + ', and remember a negative squared is positive.', { params: { a, b, c, x } });
  };
  T.compose = (r) => {
    const a = ri(r, 2, 5), b = ri(r, -6, 6), k = ri(r, -3, 4), f = (t) => a * t + b;
    return item('compose-' + [a, b, k], 'Functions', 'If f(x) = ' + a + 'x ' + (b < 0 ? '− ' + -b : '+ ' + b) + ', what is f(f(' + k + '))?', String(f(f(k))), [String(f(k)), String(f(k) * f(k)), String(a * a * k + b), String(f(f(k)) + b)],
      'First f(' + k + ') = ' + f(k) + '. Then f(' + f(k) + ') = ' + f(f(k)) + '.', { params: { a, b, k } });
  };
  // ---------- geometry ----------
  T.hypotenuse = (r) => {
    const [p, q, h] = pick(r, triples), m = pick(r, [1, 1, 2, 3]);
    return item('hyp-' + [p * m, q * m], 'Triangles', 'In the right triangle shown, the legs have lengths ' + p * m + ' and ' + q * m + '. What is the length of the hypotenuse?', String(h * m), [String((p + q) * m), String(Math.round(Math.sqrt(p * m * q * m))), String(h * m + 1), String(Math.abs(q - p) * m)],
      'By the Pythagorean theorem, c^{2} = ' + p * m + '^{2} + ' + q * m + '^{2} = ' + (p * p + q * q) * m * m + ', so c = ' + h * m + '.', { params: { a: p * m, b: q * m }, figure: { kind: 'rightTriangle', a: String(p * m), b: String(q * m), c: '?' } });
  };
  T.circle = (r) => {
    const rad = ri(r, 2, 12), ask = pick(r, ['area', 'circumference']);
    const ans = ask === 'area' ? rad * rad + 'π' : 2 * rad + 'π';
    return item('circle-' + [ask, rad], 'Circles', 'A circle has radius ' + rad + '. What is its ' + ask + '?', ans, ask === 'area' ? [2 * rad + 'π', 4 * rad * rad + 'π', rad + 'π', rad * rad + ''] : [rad * rad + 'π', rad + 'π', 4 * rad + 'π', 2 * rad + ''],
      ask === 'area' ? 'Area = πr^{2} = π × ' + rad + '^{2} = ' + ans + '.' : 'Circumference = 2πr = 2π × ' + rad + ' = ' + ans + '.', { params: { rad, ask }, figure: { kind: 'circle', r: String(rad) }, filler: (k) => (ask === 'area' ? rad * rad + k : 2 * rad + k) + 'π' });
  };
  T.thirdAngle = (r) => {
    const a = ri(r, 25, 80), b = ri(r, 25, 175 - a - 20), c = 180 - a - b;
    return item('angle-' + [a, b], 'Triangles', 'Two angles of a triangle measure ' + a + '° and ' + b + '°. What is the measure of the third angle, in degrees?', String(c), [String(360 - a - b), String(a + b), String(90 - Math.min(a, b)), String(c + 10)],
      'The angles of a triangle add to 180°: 180 − ' + a + ' − ' + b + ' = ' + c + '.', { params: { a, b }, figure: { kind: 'triangle', A: a + '°', B: b + '°', C: '?' } });
  };
  T.polygon = (r) => {
    const n = ri(r, 5, 12), names = { 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 11: '11-sided polygon', 12: 'dodecagon' };
    return item('polygon-' + n, 'Polygons', 'What is the sum of the interior angles of a ' + names[n] + ', in degrees?', String((n - 2) * 180), [String(n * 180), String(360), String((n - 1) * 180), String((n - 3) * 180)],
      'A polygon with n sides has interior angles that sum to (n − 2) × 180. Here (' + n + ' − 2) × 180 = ' + (n - 2) * 180 + '.', { params: { n }, filler: (k) => String((n - 2) * 180 + 90 * k) });
  };
  T.rectangle = (r) => {
    const w = ri(r, 2, 15), l = w + ri(r, 1, 12), per = 2 * (w + l);
    return item('rect-' + [w, l], 'Polygons', 'A rectangle has perimeter ' + per + ' and length ' + l + '. What is its area?', String(w * l), [String(per * l), String((per / 2) * l), String(l * l), String(w * w)],
      'Perimeter 2(l + w) = ' + per + ' gives l + w = ' + per / 2 + ', so w = ' + w + '. Area = ' + l + ' × ' + w + ' = ' + w * l + '.', { params: { w, l }, figure: { kind: 'rect', l: String(l), w: 'w' } });
  };
  T.cylinder = (r) => {
    const rad = ri(r, 1, 6), h = ri(r, 2, 10);
    return item('cyl-' + [rad, h], 'Solids', 'A cylinder has radius ' + rad + ' and height ' + h + '. What is its volume?', rad * rad * h + 'π', [2 * rad * h + 'π', rad * h + 'π', rad * rad * h * 2 + 'π', 2 * rad * rad + 'π'],
      'Volume = πr^{2}h = π × ' + rad * rad + ' × ' + h + ' = ' + rad * rad * h + 'π.', { params: { rad, h }, filler: (k) => rad * rad * h + k + 'π' });
  };
  // ---------- number properties ----------
  T.factors = (r) => {
    const n = pick(r, [12, 18, 20, 24, 28, 30, 36, 40, 45, 48, 50, 60, 72, 84, 90, 96, 100, 120, 144]);
    const c = factorCount(n);
    return item('factors-' + n, 'Factors and primes', 'How many positive factors does ' + n + ' have?', String(c), [String(c - 1), String(c + 1), String(c - 2), String(Math.floor(c / 2))],
      'Write ' + n + ' as a product of primes; add one to each exponent and multiply. Counting directly also works: ' + SK.range(n + 1).filter((d) => d > 0 && n % d === 0).join(', ') + '.', { params: { n } });
  };
  T.remainder = (r) => {
    const d = ri(r, 5, 12), q = ri(r, 5, 40), rem = ri(r, 1, d - 1), n = d * q + rem;
    return item('rem-' + [n, d], 'Remainders', 'What is the remainder when ' + n + ' is divided by ' + d + '?', String(rem), [String(q), String(d - rem), String(rem + 1), String(0)],
      d + ' × ' + q + ' = ' + d * q + ', and ' + n + ' − ' + d * q + ' = ' + rem + '.', { params: { n, d }, filler: (k) => String(k < d ? (rem + k) % d : d + k) });
  };
  T.lcmGcd = (r) => {
    const g = ri(r, 2, 9), a = g * ri(r, 2, 9), b = g * ri(r, 2, 9);
    if (a === b) return T.lcmGcd(r);
    const ask = pick(r, ['least common multiple', 'greatest common factor']);
    const ans = ask[0] === 'l' ? SK.lcm(a, b) : SK.gcd(a, b);
    return item('lcm-' + [a, b, ask[0]], 'Factors and primes', 'What is the ' + ask + ' of ' + a + ' and ' + b + '?', String(ans), [String(ask[0] === 'l' ? SK.gcd(a, b) : SK.lcm(a, b)), String(a * b), String(Math.min(a, b)), String(Math.abs(a - b))],
      'Using gcd × lcm = a × b: gcd(' + a + ', ' + b + ') = ' + SK.gcd(a, b) + ' and lcm = ' + SK.lcm(a, b) + '.', { params: { a, b, ask: ask[0] }, filler: (k) => String(ans + g * k) });
  };
  T.multiples = (r) => {
    const k = ri(r, 3, 13), a = ri(r, 10, 99), b = a + ri(r, 40, 300);
    const ans = Math.floor(b / k) - Math.floor((a - 1) / k);
    return item('mult-' + [k, a, b], 'Integers', 'How many multiples of ' + k + ' are there from ' + a + ' to ' + b + ', inclusive?', String(ans), [String(ans + 1), String(ans - 1), String(Math.round((b - a) / k)), String(Math.floor(b / k))],
      'Multiples of ' + k + ' up to ' + b + ': ' + Math.floor(b / k) + '. Up to ' + (a - 1) + ': ' + Math.floor((a - 1) / k) + '. The difference is ' + ans + '.', { params: { k, a, b } });
  };
  T.primeSum = (r) => {
    const n = pick(r, [30, 42, 60, 66, 70, 78, 84, 90, 105, 110, 126, 130, 154, 165, 210]);
    const ps = primesUpTo(n).filter((p) => n % p === 0);
    return item('psum-' + n, 'Factors and primes', 'What is the sum of the distinct prime factors of ' + n + '?', String(SK.sum(ps)), [String(SK.sum(ps) - ps[0]), String(ps[ps.length - 1]), String(SK.sum(ps) + 1), String(ps.length)],
      n + ' = ' + ps.join(' × ') + (ps.reduce((x, y) => x * y, 1) === n ? '' : ' × …') + ', and ' + ps.join(' + ') + ' = ' + SK.sum(ps) + '.', { params: { n } });
  };
  // ---------- word problems ----------
  T.roundTrip = (r) => {
    const [a, b] = pick(r, [[30, 60], [40, 60], [20, 30], [60, 90], [45, 90], [36, 45], [48, 80]]), d = SK.lcm(a, b) * ri(r, 1, 3);
    const avg = new Frac(2 * a * b, a + b);
    return item('trip-' + [a, b, d], 'Rates', 'A driver goes ' + d + ' kilometers to a town at ' + a + ' km per hour and returns the same way at ' + b + ' km per hour. What is the average speed for the whole trip, in km per hour?', fmt(avg), [String((a + b) / 2), String(b - a), String(a + b), fmt(avg.add(4))],
      'Average speed = total distance ÷ total time = ' + 2 * d + ' ÷ (' + d / a + ' + ' + d / b + ') = ' + fmt(avg) + '. Averaging the two speeds gives the trap answer ' + (a + b) / 2 + '.', { params: { a, b, d } });
  };
  T.work = (r) => {
    const [a, b] = pick(r, [[3, 6], [4, 12], [6, 12], [2, 3], [5, 20], [10, 15], [12, 24], [4, 6]]);
    const t = new Frac(a * b, a + b);
    return numeric('work-' + [a, b], 'Work', 'One pump fills a tank in ' + a + ' hours and a second pump fills it in ' + b + ' hours. Working together, how many hours do they take to fill the tank?', t,
      'Rates add: 1/' + a + ' + 1/' + b + ' = ' + new Frac(1, a).add(new Frac(1, b)) + ' of a tank per hour, so the time is ' + t + ' hours.', { params: { a, b } });
  };
  T.mixture = (r) => {
    const x = ri(r, 1, 6) * 10, y = ri(r, 1, 6) * 10, p = pick(r, [10, 20, 30, 40]), q = pick(r, [50, 60, 70, 80]);
    const c = new Frac(x * p + y * q, x + y);
    return numeric('mix-' + [x, p, y, q], 'Mixtures', x + ' liters of a ' + p + '% salt solution are mixed with ' + y + ' liters of a ' + q + '% salt solution. What percent of the mixture is salt? Round to one decimal place.', SK.round(c.value(), 1),
      'Salt: ' + x * p / 100 + ' + ' + y * q / 100 + ' = ' + (x * p + y * q) / 100 + ' liters in ' + (x + y) + ' liters, which is ' + SK.round(c.value(), 2) + '%.', { places: 1, params: { x, p, y, q } });
  };
  T.interest = (r) => {
    const P = ri(r, 2, 40) * 500, rate = pick(r, [2, 3, 4, 5, 6, 8]), t = ri(r, 2, 6);
    const I = (P * rate * t) / 100;
    return item('int-' + [P, rate, t], 'Interest', 'How much simple interest does ' + money(P) + ' earn in ' + t + ' years at ' + rate + '% per year?', money(I), [money(P + I), money((P * rate) / 100), money(Math.round(P * (Math.pow(1 + rate / 100, t) - 1))), money(I * 2)],
      'Simple interest = principal × rate × time = ' + P + ' × ' + rate / 100 + ' × ' + t + ' = ' + money(I) + '.', { params: { P, rate, t }, filler: (k) => money(I + 50 * k) });
  };
  T.ages = (r) => {
    const b = ri(r, 4, 20), k = ri(r, 2, 10), a = 2 * (b + k) - k;
    return item('age-' + [a, b, k], 'Word problems', 'Ana is ' + (a - b) + ' years older than her brother. In ' + k + ' years she will be twice as old as he will be then. How old is her brother now?', String(b), [String(b + k), String(a), String(2 * b), String(a - b)],
      'Let the brother be x. Then x + ' + (a - b) + ' + ' + k + ' = 2(x + ' + k + '), so x = ' + (a - b) + ' − ' + k + ' = ' + b + '.', { params: { diff: a - b, k } });
  };
  // ---------- statistics ----------
  const randList = (r, n, lo, hi) => SK.range(n).map(() => ri(r, lo, hi));
  T.mean = (r) => {
    const xs = randList(r, ri(r, 5, 8), 2, 40), s = SK.sum(xs);
    const ans = new Frac(s, xs.length);
    return numeric('mean-' + xs.join('_'), 'Mean', 'What is the average (arithmetic mean) of ' + xs.join(', ') + '? Give an exact answer.', ans, 'Sum ' + s + ' ÷ ' + xs.length + ' values = ' + ans + '.', { params: { xs } });
  };
  T.median = (r) => {
    const xs = randList(r, ri(r, 5, 8), 1, 50), s = xs.slice().sort((a, b) => a - b), n = s.length;
    const med = n % 2 ? new Frac(s[(n - 1) / 2]) : new Frac(s[n / 2 - 1] + s[n / 2], 2);
    return numeric('median-' + xs.join('_'), 'Median', 'What is the median of ' + xs.join(', ') + '?', med, 'In order: ' + s.join(', ') + '. ' + (n % 2 ? 'The middle value is ' + med + '.' : 'The mean of the two middle values is ' + med + '.'), { params: { xs } });
  };
  T.newMean = (r) => {
    const n = ri(r, 4, 9), m = ri(r, 50, 90), x = ri(r, 40, 100), total = n * m + x;
    if (total % (n + 1)) return T.newMean(r);
    return item('newmean-' + [n, m, x], 'Mean', 'The average of ' + n + ' test scores is ' + m + '. A new score of ' + x + ' is added. What is the new average?', String(total / (n + 1)), [String((m + x) / 2), String(m + (x - m) / n), String(m), String(total / n)].map((v) => fmt(Number(v))),
      'The old total is ' + n + ' × ' + m + ' = ' + n * m + '. Add ' + x + ' to get ' + total + ', and divide by ' + (n + 1) + ': ' + total / (n + 1) + '.', { params: { n, m, x } });
  };
  T.range = (r) => {
    const xs = randList(r, ri(r, 6, 9), -10, 60);
    const rg = Math.max(...xs) - Math.min(...xs);
    return item('range-' + xs.join('_'), 'Spread', 'What is the range of ' + xs.join(', ') + '?', String(rg), [String(Math.max(...xs)), String(xs[xs.length - 1] - xs[0]), String(Math.max(...xs) + Math.min(...xs)), String(rg + 1)],
      'Range = greatest − least = ' + Math.max(...xs) + ' − (' + Math.min(...xs) + ') = ' + rg + '.', { params: { xs } });
  };
  T.sdCompare = (r) => {
    const c = ri(r, 10, 40), d = ri(r, 2, 6), tight = [c - d, c, c + d], wide = [c - 3 * d, c, c + 3 * d];
    const swap = r() < 0.5;
    const A = swap ? wide : tight, B = swap ? tight : wide;
    return qc('sd-' + [c, d, swap], 'Spread', 'Set S: ' + A.join(', ') + '\nSet T: ' + B.join(', '), 'The standard deviation of set S', 'The standard deviation of set T', swap ? 0 : 1,
      'Both sets have mean ' + c + ', but one spreads ' + 3 * d + ' from the center and the other only ' + d + '. The wider set has the larger standard deviation.', { params: { A, B } });
  };
  // ---------- counting and probability ----------
  T.dice = (r) => {
    const k = ri(r, 3, 11), ways = SK.range(6).flatMap((a) => SK.range(6).map((b) => a + b + 2)).filter((s) => s === k).length;
    return item('dice-' + k, 'Probability', 'Two fair six-sided dice are rolled. What is the probability that the sum is ' + k + '?', fmt(new Frac(ways, 36)), [fmt(new Frac(1, 11)), fmt(new Frac(ways, 12)), fmt(new Frac(ways + 1, 36)), fmt(new Frac(1, 6))],
      'There are 36 equally likely outcomes, and ' + ways + ' of them sum to ' + k + ', so the probability is ' + new Frac(ways, 36) + '.', { params: { k }, filler: (j) => fmt(new Frac(ways + j + 1, 36)) });
  };
  const C = (n, k) => { let x = 1; for (let i = 0; i < k; i++) x = (x * (n - i)) / (i + 1); return Math.round(x); };
  const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
  T.choose = (r) => {
    const n = ri(r, 5, 10), k = ri(r, 2, Math.min(4, n - 1));
    return item('choose-' + [n, k], 'Counting', 'A committee of ' + k + ' is to be chosen from ' + n + ' people. How many different committees are possible?', String(C(n, k)), [String(fact(n) / fact(n - k)), String(n * k), String(C(n, k - 1)), String(Math.pow(n, k))],
      'Order does not matter, so use combinations: ' + n + '! ÷ (' + k + '! × ' + (n - k) + '!) = ' + C(n, k) + '. Using permutations gives the larger trap answer.', { params: { n, k } });
  };
  T.arrange = (r) => {
    const word = pick(r, ['LEVEL', 'BANANA', 'APPLE', 'CANAL', 'RADAR', 'TOOTH', 'COFFEE', 'LETTER', 'GRE', 'TEST', 'STAT']);
    const counts = {}; for (const ch of word) counts[ch] = (counts[ch] || 0) + 1;
    const ans = Object.values(counts).reduce((x, c) => x / fact(c), fact(word.length));
    return item('arr-' + word, 'Counting', 'How many different arrangements of the letters in ' + word + ' are possible?', String(ans), [String(fact(word.length)), String(ans * 2), String(word.length * word.length), String(ans / 2)].map(String),
      word.length + '! ÷ (' + Object.values(counts).filter((c) => c > 1).map((c) => c + '!').join(' × ') + (Object.values(counts).some((c) => c > 1) ? '' : '1') + ') = ' + ans + ', dividing out the repeated letters.', { params: { word } });
  };
  T.atLeastOne = (r) => {
    const n = ri(r, 2, 5);
    return item('alo-' + n, 'Probability', 'A fair coin is tossed ' + n + ' times. What is the probability of getting at least one head?', fmt(new Frac(Math.pow(2, n) - 1, Math.pow(2, n))), [fmt(new Frac(1, 2)), fmt(new Frac(n, Math.pow(2, n))), fmt(new Frac(1, Math.pow(2, n))), fmt(new Frac(n, n + 1))],
      'The only way to get no heads is all tails, with probability 1/' + Math.pow(2, n) + '. So P(at least one head) = 1 − 1/' + Math.pow(2, n) + '.', { params: { n } });
  };
  T.noReplace = (r) => {
    const red = ri(r, 2, 6), blue = ri(r, 2, 6), t = red + blue;
    const ans = new Frac(red * (red - 1), t * (t - 1));
    return item('norep-' + [red, blue], 'Probability', 'A bag holds ' + red + ' red and ' + blue + ' blue marbles. Two marbles are drawn without replacement. What is the probability that both are red?', fmt(ans), [fmt(new Frac(red * red, t * t)), fmt(new Frac(red, t)), fmt(new Frac(red * (red - 1), t * t)), fmt(new Frac(2 * red, t * (t - 1)))],
      red + '/' + t + ' × ' + (red - 1) + '/' + (t - 1) + ' = ' + ans + '. Without replacement, the second draw has one fewer red and one fewer marble.', { params: { red, blue } });
  };
  // ---------- exponents and roots ----------
  T.expRules = (r) => {
    const a = ri(r, 2, 9), b = ri(r, 2, 9), c = ri(r, 1, 6), base = pick(r, [2, 3, 5, 7, 10]);
    return item('exp-' + [base, a, b, c], 'Exponents', 'Which of the following equals (' + base + '^{' + a + '} × ' + base + '^{' + b + '}) ÷ ' + base + '^{' + c + '}?', base + '^{' + (a + b - c) + '}', [base + '^{' + (a * b - c) + '}', base + '^{' + ((a + b) / c === Math.floor((a + b) / c) ? (a + b) / c : a + b + c) + '}', base + '^{' + (a * b) / Math.max(1, c) + '}', base * base + '^{' + (a + b - c) + '}'],
      'Multiplying adds exponents and dividing subtracts them: ' + a + ' + ' + b + ' − ' + c + ' = ' + (a + b - c) + '.', { params: { a, b, c, base }, filler: (k) => base + '^{' + (a + b - c + k) + '}' });
  };
  T.expSolve = (r) => {
    const base = pick(r, [2, 3, 5]), x = ri(r, 2, 6), m = ri(r, 1, 3);
    const rhs = Math.pow(base, x + m);
    return item('exps-' + [base, x, m], 'Exponents', 'If ' + base + '^{x + ' + m + '} = ' + rhs + ', what is x?', String(x), [String(x + m), String(rhs / base), String(x - 1), String(m)],
      rhs + ' = ' + base + '^{' + (x + m) + '}, so x + ' + m + ' = ' + (x + m) + ' and x = ' + x + '.', { params: { base, x, m } });
  };
  T.rootSimplify = (r) => {
    const a = pick(r, [2, 3, 5, 6, 7, 10]), b = ri(r, 2, 9), n = a * b * b;
    return item('root-' + n, 'Roots', 'Which of the following equals sqrt{' + n + '}?', b + 'sqrt{' + a + '}', [a + 'sqrt{' + b + '}', b * b + 'sqrt{' + a + '}', String(SK.round(Math.sqrt(n), 0)), b + 'sqrt{' + a * 2 + '}'],
      n + ' = ' + b * b + ' × ' + a + ', and sqrt{' + b * b + '} = ' + b + ', so sqrt{' + n + '} = ' + b + 'sqrt{' + a + '}.', { params: { a, b }, filler: (k) => (b + k) + 'sqrt{' + a + '}' });
  };
  T.sciNotation = (r) => {
    const a = ri(r, 2, 9), b = ri(r, 2, 9), p = ri(r, 2, 8), q = ri(r, -6, 6);
    const prod = a * b, mant = prod >= 10 ? prod / 10 : prod, ex = p + q + (prod >= 10 ? 1 : 0);
    return item('sci-' + [a, b, p, q], 'Exponents', 'What is (' + a + ' × 10^{' + p + '}) × (' + b + ' × 10^{' + q + '}) in scientific notation?', mant + ' × 10^{' + ex + '}', [prod + ' × 10^{' + (p + q) + '}', mant + ' × 10^{' + (p * q) + '}', mant + ' × 10^{' + (ex - 1) + '}', (a + b) + ' × 10^{' + (p + q) + '}'],
      'Multiply ' + a + ' × ' + b + ' = ' + prod + ' and add exponents: ' + (p + q) + '. ' + (prod >= 10 ? 'Then ' + prod + ' = ' + mant + ' × 10, so the exponent becomes ' + ex + '.' : ''), { params: { a, b, p, q }, filler: (k) => mant + ' × 10^{' + (ex + k + 1) + '}' });
  };
  // ---------- inequalities ----------
  T.ineq = (r) => {
    const a = pick(r, [2, 3, 4, 5, -2, -3, -4]), x = ri(r, -6, 8), b = ri(r, -10, 10), c = a * x + b;
    const sign = a > 0 ? '<' : '>';
    return item('ineq-' + [a, b, c], 'Inequalities', 'Which of the following describes all solutions of ' + a + 'x ' + (b < 0 ? '− ' + -b : '+ ' + b) + ' < ' + c + '?', 'x ' + sign + ' ' + x, ['x ' + (a > 0 ? '>' : '<') + ' ' + x, 'x ' + sign + ' ' + -x, 'x ' + sign + ' ' + fmt(new Frac(c + b, a)), 'x = ' + x],
      'Subtract ' + b + ': ' + a + 'x < ' + (c - b) + '. Divide by ' + a + (a < 0 ? ', and flip the sign because ' + a + ' is negative' : '') + ': x ' + sign + ' ' + x + '.', { params: { a, b, c }, filler: (k) => 'x ' + sign + ' ' + (x + k) });
  };
  T.absCount = (r) => {
    const a = ri(r, -5, 6), b = ri(r, 2, 7);
    const strict = r() < 0.5;
    const count = strict ? 2 * b - 1 : 2 * b + 1;
    return item('abs-' + [a, b, strict], 'Absolute value', 'How many integers x satisfy |x ' + (a < 0 ? '+ ' + -a : '− ' + a) + '| ' + (strict ? '<' : '≤') + ' ' + b + '?', String(count), [String(strict ? 2 * b + 1 : 2 * b - 1), String(2 * b), String(b), String(b + 1)],
      'The inequality means ' + (a - b) + ' ' + (strict ? '<' : '≤') + ' x ' + (strict ? '<' : '≤') + ' ' + (a + b) + '. Count the integers: ' + count + '.', { params: { a, b, strict } });
  };
  // ---------- coordinate geometry ----------
  T.slope = (r) => {
    const x1 = ri(r, -6, 6), y1 = ri(r, -6, 6), x2 = x1 + pick(r, [1, 2, 3, 4, -2, -3]), y2 = ri(r, -8, 8);
    const m = new Frac(y2 - y1, x2 - x1);
    return item('slope-' + [x1, y1, x2, y2], 'Coordinate geometry', 'What is the slope of the line through (' + x1 + ', ' + y1 + ') and (' + x2 + ', ' + y2 + ')?', fmt(m), [fmt(new Frac(x2 - x1, (y2 - y1) || 1)), fmt(m.mul(-1)), fmt(new Frac(y2 + y1, (x2 + x1) || 1)), fmt(m.add(1))],
      'Slope = (y_{2} − y_{1}) ÷ (x_{2} − x_{1}) = (' + y2 + ' − ' + y1 + ') ÷ (' + x2 + ' − ' + x1 + ') = ' + m + '.', { params: { x1, y1, x2, y2 }, figure: { kind: 'plane', points: [[x1, y1], [x2, y2]], line: true }, filler: (k) => fmt(m.add(new Frac(k, 2))) });
  };
  T.distance = (r) => {
    // Both points must fit on the drawn plane, which runs from -10 to 10 on each axis.
    const [p, q] = pick(r, [[3, 4], [4, 3], [6, 8], [8, 6], [5, 12], [12, 5], [8, 15], [15, 8]]), h = Math.round(Math.hypot(p, q));
    const sx = pick(r, [1, -1]), sy = pick(r, [1, -1]);
    const x1 = sx > 0 ? ri(r, -10, 10 - p) : ri(r, -10 + p, 10), y1 = sy > 0 ? ri(r, -10, 10 - q) : ri(r, -10 + q, 10);
    const x2 = x1 + sx * p, y2 = y1 + sy * q;
    return item('dist-' + [x1, y1, x2, y2], 'Coordinate geometry', 'What is the distance between (' + x1 + ', ' + y1 + ') and (' + x2 + ', ' + y2 + ')?', String(h), [String(p + q), String(Math.abs(x2 + x1) + Math.abs(y2 + y1)), String(h * h), String(h + 1)],
      'The horizontal change is ' + p + ' and the vertical change is ' + q + ', so the distance is sqrt{' + p + '^{2} + ' + q + '^{2}} = ' + h + '.', { params: { x1, y1, x2, y2 }, figure: { kind: 'plane', points: [[x1, y1], [x2, y2]], line: true } });
  };
  T.perpendicular = (r) => {
    const n = pick(r, [1, 2, 3, 4, -1, -2, -3]), d = pick(r, [1, 2, 3, 5]);
    const m = new Frac(n, d), perp = new Frac(-d, n);
    return item('perp-' + [n, d], 'Coordinate geometry', 'Line k has slope ' + m + '. What is the slope of a line perpendicular to k?', fmt(perp), [fmt(m), fmt(m.mul(-1)), fmt(new Frac(d, n)), '0'],
      'Perpendicular slopes multiply to −1, so take the negative reciprocal: ' + perp + '.', { params: { n, d }, filler: (k) => fmt(perp.add(k)) });
  };
  T.intercept = (r) => {
    const m = ri(r, -4, 4) || 2, x0 = ri(r, -5, 5), y0 = ri(r, -9, 9), b = y0 - m * x0;
    return item('icept-' + [m, x0, y0], 'Coordinate geometry', 'A line with slope ' + m + ' passes through (' + x0 + ', ' + y0 + '). What is its y-intercept?', String(b), [String(y0 + m * x0), String(y0), String(-b), String(x0 - m * y0)],
      'y = mx + b gives ' + y0 + ' = ' + m + '(' + x0 + ') + b, so b = ' + b + '.', { params: { m, x0, y0 }, figure: { kind: 'plane', points: [[x0, y0]], slope: m, b } });
  };
  // ---------- ratios and percents ----------
  T.ratioSplit = (r) => {
    const a = ri(r, 1, 7), b = ri(r, 1, 7), k = ri(r, 3, 20), total = (a + b) * k;
    if (a === b) return T.ratioSplit(r);
    return item('ratio-' + [a, b, total], 'Ratios', 'The ratio of cats to dogs at a shelter is ' + a + ':' + b + '. There are ' + total + ' cats and dogs in all. How many are dogs?', String(b * k), [String(a * k), String(Math.round(total / b)), String(total - b), String((b * total) / a).split('.')[0]],
      'There are ' + (a + b) + ' parts, each worth ' + total + ' ÷ ' + (a + b) + ' = ' + k + '. Dogs: ' + b + ' × ' + k + ' = ' + b * k + '.', { params: { a, b, total } });
  };
  T.successive = (r) => {
    const up = pick(r, [10, 20, 25, 30, 40, 50]), down = pick(r, [10, 20, 25, 30, 40, 50]);
    const net = SK.round(((1 + up / 100) * (1 - down / 100) - 1) * 100, 2);
    const say = (v) => (v > 0 ? 'A ' + v + '% increase' : v < 0 ? 'A ' + -v + '% decrease' : 'No change');
    return item('succ-' + [up, down], 'Percents', 'A price rises ' + up + '% and then falls ' + down + '%. What is the overall change?', say(net), [say(up - down), say(-net), say(up + down), say(SK.round(net / 2, 2))],
      (1 + up / 100) + ' × ' + (1 - down / 100) + ' = ' + SK.round((1 + up / 100) * (1 - down / 100), 4) + ', which is ' + say(net).toLowerCase() + '. The percents do not simply cancel or subtract.', { params: { up, down }, filler: (k) => say(net + k) });
  };
  T.reversePercent = (r) => {
    const orig = ri(r, 4, 40) * 10, p = pick(r, [10, 20, 25, 50]), nw = orig * (1 + p / 100);
    return item('revp-' + [orig, p], 'Percents', 'After a ' + p + '% increase, a jacket costs ' + money(nw) + '. What was the price before the increase?', money(orig), [money(nw * (1 - p / 100)), money(nw - p), money(nw / (1 - p / 100)), money(nw)],
      'If x is the old price, then ' + (1 + p / 100) + 'x = ' + nw + ', so x = ' + nw + ' ÷ ' + (1 + p / 100) + ' = ' + orig + '. Taking ' + p + '% off the new price gives the trap answer, because the percent was of the old price.', { params: { orig, p }, filler: (k) => money(orig + 5 * k) });
  };
  // ---------- sets ----------
  T.overlap = (r) => {
    const both = ri(r, 3, 20), onlyA = ri(r, 2, 30), onlyB = ri(r, 2, 30), neither = ri(r, 0, 15);
    const A = onlyA + both, B = onlyB + both, total = onlyA + onlyB + both + neither;
    return item('venn-' + [A, B, both, neither], 'Sets', 'Of ' + total + ' students, ' + A + ' study French, ' + B + ' study Spanish and ' + neither + ' study neither. How many study both?', String(both), [String(A + B - total), String(total - A - B + neither), String(A + B - total + neither * 2), String(Math.min(A, B))],
      'Total = French + Spanish − both + neither, so ' + total + ' = ' + A + ' + ' + B + ' − both + ' + neither + ', giving both = ' + both + '.', { params: { A, B, total, neither }, figure: { kind: 'venn', a: 'French ' + A, b: 'Spanish ' + B, mid: '?', out: 'Neither ' + neither } });
  };
  T.overlapPct = (r) => {
    const a = pick(r, [40, 45, 50, 55, 60, 65, 70]), b = pick(r, [30, 35, 40, 45, 50, 55]), neither = pick(r, [5, 10, 15, 20]);
    const both = a + b + neither - 100;
    if (both <= 0 || both >= Math.min(a, b)) return T.overlapPct(r);
    return item('vennp-' + [a, b, neither], 'Sets', 'In a survey, ' + a + '% of people own a bicycle, ' + b + '% own a car and ' + neither + '% own neither. What percent own both?', both + '%', [(a + b - 100) + '%', (100 - a - b + neither) + '%', (a - b) + '%', neither + '%'],
      '100% = bicycle + car − both + neither, so both = ' + a + ' + ' + b + ' + ' + neither + ' − 100 = ' + both + '%.', { params: { a, b, neither }, filler: (k) => (both + 5 * k) + '%' });
  };
  T.exactlyOne = (r) => {
    const both = ri(r, 2, 15), onlyA = ri(r, 3, 25), onlyB = ri(r, 3, 25), neither = ri(r, 0, 12);
    const A = onlyA + both, B = onlyB + both, total = onlyA + onlyB + both + neither;
    return item('one-' + [A, B, both, total], 'Sets', 'A club has ' + total + ' members. ' + A + ' play chess, ' + B + ' play go, and ' + both + ' play both. How many members play exactly one of the two games?', String(onlyA + onlyB), [String(A + B), String(A + B - both), String(total - both), String(onlyA)],
      'Chess only: ' + A + ' − ' + both + ' = ' + onlyA + '. Go only: ' + B + ' − ' + both + ' = ' + onlyB + '. Exactly one: ' + (onlyA + onlyB) + '.', { params: { A, B, both, total }, figure: { kind: 'venn', a: 'Chess ' + A, b: 'Go ' + B, mid: String(both), out: 'Total ' + total } });
  };
  // ---------- sequences and functions ----------
  T.arithSeq = (r) => {
    const a1 = ri(r, -10, 20), d = pick(r, [2, 3, 4, 5, 6, 7, -3, -4]), n = ri(r, 8, 40);
    const an = a1 + (n - 1) * d;
    return item('aseq-' + [a1, d, n], 'Sequences', 'In a sequence, the first term is ' + a1 + ' and each term is ' + (d > 0 ? d + ' more' : -d + ' less') + ' than the one before. What is term number ' + n + '?', String(an), [String(a1 + n * d), String(n * d), String(an - d * 2), String(a1 * n)],
      'Term n = first + (n − 1) × difference = ' + a1 + ' + ' + (n - 1) + ' × ' + d + ' = ' + an + '.', { params: { a1, d, n } });
  };
  T.geoSeq = (r) => {
    const a1 = ri(r, 1, 5), q = pick(r, [2, 3]), n = ri(r, 4, 7), an = a1 * Math.pow(q, n - 1);
    return item('gseq-' + [a1, q, n], 'Sequences', 'The first term of a sequence is ' + a1 + ', and each term after it is ' + q + ' times the term before. What is term number ' + n + '?', String(an), [String(a1 * Math.pow(q, n)), String(a1 * q * n), String(a1 + q * (n - 1)), String(an / q * (q + 1))],
      'Term n = first × ratio^{n − 1} = ' + a1 + ' × ' + q + '^{' + (n - 1) + '} = ' + an + '.', { params: { a1, q, n } });
  };
  T.arithSum = (r) => {
    const n = ri(r, 10, 60), a = ri(r, 1, 20), l = a + (n - 1) * ri(r, 1, 3);
    if ((l - a) % (n - 1)) return T.arithSum(r);
    const sum = (n * (a + l)) / 2;
    return item('asum-' + [a, l, n], 'Sequences', 'An arithmetic sequence has ' + n + ' terms. The first is ' + a + ' and the last is ' + l + '. What is the sum of all the terms?', fmt(sum), [fmt(n * (a + l)), fmt(((n - 1) * (a + l)) / 2), fmt((a + l) / 2), fmt(n * l)],
      'Sum = number of terms × average of first and last = ' + n + ' × ' + (a + l) / 2 + ' = ' + sum + '.', { params: { a, l, n } });
  };
  T.operation = (r) => {
    const p = ri(r, 1, 4), q = ri(r, 1, 5), x = ri(r, 1, 6), y = ri(r, 1, 6), val = p * x * y - q * (x + y);
    return item('op-' + [p, q, x, y], 'Functions', 'For all numbers a and b, a ◆ b = ' + (p === 1 ? '' : p) + 'ab − ' + (q === 1 ? '' : q) + '(a + b). What is ' + x + ' ◆ ' + y + '?', String(val), [String(p * x * y + q * (x + y)), String(p * x * y - q * x + y), String(x * y - (x + y)), String(val + q)],
      'Substitute a = ' + x + ' and b = ' + y + ': ' + p * x * y + ' − ' + q * (x + y) + ' = ' + val + '.', { params: { p, q, x, y } });
  };
  // ---------- quantitative comparison ----------
  T.qcSwap = (r) => {
    const n = pick(r, [12, 15, 20, 25, 30, 40, 60]), m = pick(r, [8, 18, 35, 45, 70, 80]);
    return qc('qcswap-' + [n, m], 'Percents', '', n + '% of ' + m, m + '% of ' + n, 2, 'Both equal ' + n + ' × ' + m + ' ÷ 100 = ' + (n * m) / 100 + '. Multiplication does not care about order.', { params: { n, m } });
  };
  T.qcSquare = (r) => {
    const kind = pick(r, ['int', 'frac', 'big']);
    if (kind === 'int') return qc('qcsq-int', 'Number properties', 'x is an integer.', 'x^{2}', 'x', 3, 'If x is 0 or 1, the quantities are equal; if x is 2 or −1, Quantity A is greater. So the relationship cannot be determined.', { params: { kind } });
    if (kind === 'frac') return qc('qcsq-frac', 'Number properties', '0 < x < 1', 'x^{2}', 'x', 1, 'Squaring a number between 0 and 1 makes it smaller, so Quantity B is greater. Try x = 1/2: 1/4 < 1/2.', { params: { kind } });
    return qc('qcsq-big', 'Number properties', 'x > 1', 'x^{2}', 'x', 0, 'For x greater than 1, x^{2} = x × x is greater than x.', { params: { kind } });
  };
  T.qcFraction = (r) => {
    const b = pick(r, [7, 9, 11, 13, 17]), a = ri(r, 1, b - 1), dec = SK.round(a / b + pick(r, [-0.01, 0.01, 0.002, -0.002]), 3);
    const cmp = a / b > dec ? 0 : a / b < dec ? 1 : 2;
    return qc('qcfrac-' + [a, b, dec], 'Fractions', '', a + '/' + b, String(dec), cmp, a + '/' + b + ' ≈ ' + SK.round(a / b, 5) + ', which is ' + (cmp === 0 ? 'greater than' : cmp === 1 ? 'less than' : 'equal to') + ' ' + dec + '.', { params: { a, b, dec } });
  };
  T.qcAverage = (r) => {
    const n = ri(r, 5, 99);
    return qc('qcavg-' + n, 'Mean', '', 'The average of the integers from 1 to ' + n, String((n + 1) / 2), 2, 'For evenly spaced numbers, the average is the average of the first and last: (1 + ' + n + ') ÷ 2 = ' + (n + 1) / 2 + '.', { params: { n } });
  };
  T.qcNegative = (r) => {
    const k = ri(r, 2, 9);
    return qc('qcneg-' + k, 'Number properties', 'xy < 0', 'x', '0', 3, 'xy < 0 means x and y have opposite signs, but either one could be the negative one. x could be ' + k + ' or −' + k + '.', { params: { k } });
  };
  SK.QUANT = T;
  SK.QUANT_TOPICS = {
    arithmetic: ['fracAdd', 'percentOf', 'orderOps', 'percentChange'], algebra: ['linear', 'system', 'quadratic', 'evaluate', 'compose'],
    geometry: ['hypotenuse', 'circle', 'thirdAngle', 'polygon', 'rectangle', 'cylinder'], numprop: ['factors', 'remainder', 'lcmGcd', 'multiples', 'primeSum'],
    word: ['roundTrip', 'work', 'mixture', 'interest', 'ages'], stats: ['mean', 'median', 'newMean', 'range', 'sdCompare'],
    prob: ['dice', 'choose', 'arrange', 'atLeastOne', 'noReplace'], exp: ['expRules', 'expSolve', 'rootSimplify', 'sciNotation'], ineq: ['ineq', 'absCount'],
    coord: ['slope', 'distance', 'perpendicular', 'intercept'], ratio: ['ratioSplit', 'successive', 'reversePercent', 'percentOf'], sets: ['overlap', 'overlapPct', 'exactlyOne'],
    seq: ['arithSeq', 'geoSeq', 'arithSum', 'operation'], qc: ['qcSwap', 'qcSquare', 'qcFraction', 'qcAverage', 'qcNegative', 'sdCompare'],
  };
  // Make n questions from the named templates, with no repeated question.
  SK.makeQuant = function (names, n, seed) {
    const r = SK.rng(seed === undefined ? SK.seedNow() : seed);
    const out = [], seen = new Set();
    const order = shuffle(r, names);
    let guard = 0;
    while (out.length < n && guard++ < n * 40) {
      // Go through the templates in a shuffled round so a set covers every kind before repeating one.
      const name = order[(out.length + Math.floor(guard / (n + 1))) % order.length];
      const q = T[name](r);
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      q.template = name;
      out.push(q.type === 'single' ? SK.shuffleItem(r, q) : q);
    }
    return out;
  };

  // ---------- data interpretation: a generated table and chart with questions ----------
  SK.makeDataSet = function (seed) {
    const r = SK.rng(seed);
    const theme = pick(r, [
      { title: 'Bicycles sold by a shop', unit: 'bicycles', cats: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
      { title: 'Visitors to five museums (thousands)', unit: 'thousand visitors', cats: ['Art', 'History', 'Science', 'Maritime', 'Modern'] },
      { title: 'Rainfall in a city (mm)', unit: 'mm', cats: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
      { title: 'Students enrolled by subject', unit: 'students', cats: ['Biology', 'Chemistry', 'Physics', 'Math', 'History'] }]);
    const values = theme.cats.map(() => ri(r, 4, 30) * 5);
    const total = SK.sum(values);
    const qs = [];
    const i = ri(r, 0, values.length - 2), j = i + 1;
    const ch = new Frac((values[j] - values[i]) * 100, values[i]);
    qs.push({ id: 'di-chg-' + values.join('_'), type: 'numeric', topic: 'Percent change', stem: 'By what percent did the value change from ' + theme.cats[i] + ' to ' + theme.cats[j] + '? Use a negative number for a decrease, rounded to the nearest whole percent.', answer: String(Math.round(ch.value())), places: 0, explanation: '(' + values[j] + ' − ' + values[i] + ') ÷ ' + values[i] + ' × 100 ≈ ' + SK.round(ch.value(), 1) + '%.' });
    const k = ri(r, 0, values.length - 1);
    qs.push({ id: 'di-share-' + values.join('_') + k, type: 'numeric', topic: 'Share of total', stem: 'What percent of the total does ' + theme.cats[k] + ' account for? Round to the nearest whole percent.', answer: String(Math.round((values[k] * 100) / total)), places: 0, explanation: values[k] + ' ÷ ' + total + ' × 100 ≈ ' + SK.round((values[k] * 100) / total, 1) + '%.' });
    const mean = new Frac(total, values.length);
    qs.push({ id: 'di-mean-' + values.join('_'), type: 'numeric', topic: 'Average', stem: 'What is the average value per category? Round to one decimal place.', answer: String(SK.round(mean.value(), 1)), places: 1, explanation: 'Total ' + total + ' ÷ ' + values.length + ' = ' + SK.round(mean.value(), 2) + '.' });
    const above = values.filter((v) => v > mean.value()).length;
    qs.push(SK.shuffleItem(r, { id: 'di-above-' + values.join('_'), type: 'single', topic: 'Comparison', stem: 'How many categories are above the average?', choices: mc(String(above), [String(values.length - above), String(above + 1), String(Math.max(0, above - 1))], (k2) => String(above + k2 + 1)), answer: 0, explanation: 'The average is ' + SK.round(mean.value(), 2) + '; ' + above + ' values are above it.' }));
    const mx = values.indexOf(Math.max(...values)), mn = values.indexOf(Math.min(...values));
    qs.push({ id: 'di-ratio-' + values.join('_'), type: 'numeric', topic: 'Ratio', stem: 'What is the ratio of the largest value to the smallest? Give it as a fraction or a decimal rounded to two places.', answer: String(SK.round(values[mx] / values[mn], 2)), places: 2, explanation: values[mx] + ' ÷ ' + values[mn] + ' ≈ ' + SK.round(values[mx] / values[mn], 3) + '.' });
    const figure = { kind: 'bars', title: theme.title, labels: theme.cats, values };
    return { title: theme.title, cats: theme.cats, values, items: qs.map((q) => Object.assign(q, { figure, table: { head: ['Category'].concat(theme.cats), rows: [['Value'].concat(values.map(String))] } })) };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SK;
})(typeof window !== 'undefined' ? window : globalThis);
