/* sk-figures.js: figures for quant questions, drawn as SVG from a small description. Not drawn to scale unless
   stated, as on the GRE. Labels come from generated numbers and are set as text. */
(function () {
  'use strict';
  const SK = window.SK, s = SK.s;
  const frame = (w, h, label, ...kids) => s('svg', { viewBox: '0 0 ' + w + ' ' + h, class: 'sk-figure', role: 'img', 'aria-label': label, width: w, height: h }, kids);
  const text = (x, y, t, anchor) => s('text', { x, y, 'text-anchor': anchor || 'middle', 'dominant-baseline': 'middle' }, String(t));
  const note = (w, h) => text(w - 6, h - 8, 'Not drawn to scale', 'end');

  SK.figures.rightTriangle = (f) => frame(260, 190, 'Right triangle with legs ' + f.a + ' and ' + f.b,
    s('polygon', { points: '40,160 220,160 40,30', class: 'shape' }),
    s('polyline', { points: '40,145 55,145 55,160', class: 'shape' }),
    text(130, 176, f.b), text(22, 95, f.a), text(142, 86, f.c), note(260, 190));
  SK.figures.triangle = (f) => frame(280, 190, 'Triangle with angles ' + [f.A, f.B, f.C].join(', '),
    s('polygon', { points: '30,160 250,160 110,30', class: 'shape' }),
    text(62, 146, f.A), text(222, 146, f.B), text(112, 56, f.C), note(280, 190));
  SK.figures.circle = (f) => frame(220, 200, 'Circle with radius ' + f.r,
    s('circle', { cx: 110, cy: 95, r: 70, class: 'shape' }), s('circle', { cx: 110, cy: 95, r: 3, class: 'mark' }),
    s('line', { x1: 110, y1: 95, x2: 180, y2: 95, class: 'shape' }), text(145, 84, 'r = ' + f.r));
  SK.figures.rect = (f) => frame(260, 170, 'Rectangle with length ' + f.l,
    s('rect', { x: 30, y: 30, width: 200, height: 100, class: 'soft' }), text(130, 146, f.l), text(16, 80, f.w), note(260, 170));
  // Group names and totals sit above the circles, so a total is never read as the count of one region.
  SK.figures.venn = (f) => frame(300, 214, 'Two overlapping groups',
    s('rect', { x: 6, y: 30, width: 288, height: 178, class: 'shape', rx: 8 }),
    s('circle', { cx: 115, cy: 116, r: 62, class: 'shape' }), s('circle', { cx: 185, cy: 116, r: 62, class: 'shape' }),
    text(95, 16, f.a), text(205, 16, f.b), text(150, 116, f.mid), text(150, 196, f.out));
  // A coordinate plane from -10 to 10 with optional points, a segment between the first two, or a line y = mx + b.
  SK.figures.plane = (f) => {
    const W = 260, M = 10, U = (W - 2 * M) / 20, X = (x) => M + (x + 10) * U, Y = (y) => W - M - (y + 10) * U;
    const kids = [];
    for (let i = -10; i <= 10; i += 2) { kids.push(s('line', { x1: X(i), y1: Y(-10), x2: X(i), y2: Y(10), class: 'grid' }), s('line', { x1: X(-10), y1: Y(i), x2: X(10), y2: Y(i), class: 'grid' })); }
    kids.push(s('line', { x1: X(-10), y1: Y(0), x2: X(10), y2: Y(0), class: 'axis' }), s('line', { x1: X(0), y1: Y(-10), x2: X(0), y2: Y(10), class: 'axis' }), text(X(9.4), Y(0.8), 'x'), text(X(0.8), Y(9.4), 'y'));
    if (f.slope !== undefined) {
      const ys = (x) => f.slope * x + f.b;
      kids.push(s('line', { x1: X(-10), y1: Y(ys(-10)), x2: X(10), y2: Y(ys(10)), class: 'line' }));
    } else if (f.line && f.points.length >= 2) kids.push(s('line', { x1: X(f.points[0][0]), y1: Y(f.points[0][1]), x2: X(f.points[1][0]), y2: Y(f.points[1][1]), class: 'line' }));
    // Keep each point's label inside the plane: put it on the left near the right edge, and below near the top.
    for (const [x, y] of f.points || []) {
      const right = X(x) > W - 80, top = Y(y) < 24;
      kids.push(s('circle', { cx: X(x), cy: Y(y), r: 4, class: 'mark' }), text(X(x) + (right ? -6 : 6), Y(y) + (top ? 14 : -10), '(' + x + ', ' + y + ')', right ? 'end' : 'start'));
    }
    return frame(W, W, 'Coordinate plane', kids);
  };
  SK.figures.bars = (f) => {
    const W = 520, H = 230, L = 46, B = 34, T = 22, max = Math.max(...f.values) * 1.1, bw = (W - L - 10) / f.values.length;
    const y = (v) => H - B - (v / max) * (H - B - T);
    const kids = [text(W / 2, 10, f.title)];
    const step = SK.niceStep(Math.max(...f.values) / 4);
    for (let v = 0; v <= max; v += step) kids.push(s('line', { x1: L, y1: y(v), x2: W - 6, y2: y(v), class: 'grid' }), text(L - 6, y(v), v, 'end'));
    f.values.forEach((v, i) => kids.push(s('rect', { x: L + i * bw + bw * 0.18, y: y(v), width: bw * 0.64, height: H - B - y(v), class: 'mark', rx: 2 }), text(L + i * bw + bw / 2, H - B + 14, f.labels[i])));
    return frame(W, H, f.title, kids);
  };
})();
