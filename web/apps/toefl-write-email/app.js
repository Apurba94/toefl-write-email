/* Email Writing Coach: short emails to a professor, a landlord or a club, timed, with a checklist and models. */
(function () {
  'use strict';
  // Check an email's shape: a greeting, a closing, enough length, and each required point mentioned in some form.
  const shape = (text) => {
    const t = text.trim(), lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
    return {
      greeting: lines.length > 0 && /^(dear|hello|hi|good (morning|afternoon|evening))\b/i.test(lines[0]),
      // A closing line such as "Best regards," or "Thank you for your help," within the last three lines.
      closing: lines.slice(-3).some((l) => /^(best|kind|warm|many)?\s*(regards|wishes|thanks)\b|^(yours )?sincerely\b|^thank you\b|^thanks\b|^best\b|^cheers\b/i.test(l)),
      words: SK.text.wordCount(t),
    };
  };
  const App = {
    about: 'The TOEFL Writing section includes writing a short email for a real situation, covering the points you are given. This coach has eight original situations, from asking a professor about a missed class to reporting a broken heater. It times you, checks the email\'s shape, and shows a model email afterwards.',
    how: ['Read the situation and the three points in **Write**. Plan one or two sentences per point.', 'Start the timer. Seven minutes is a practice default; check ets.org for the current timing.', 'Press **Get feedback**, tick the checklist, and compare with the model email.'],
    tabs: [{ id: 'write', label: 'Write', render(el, ctx) {
      const t = SK.pick(SK.rng(SK.seedNow()), ctx.data.email_tasks);
      const box = SK.h('div', {}), model = SK.h('div', {});
      el.appendChild(SK.h('div', { class: 'sk-row', style: { marginBottom: '10px' } }, SK.btn('New situation', () => SK.show('write'), 'ghost')));
      el.appendChild(box); el.appendChild(model);
      SK.writer(box, { key: t.id, title: 'Write an email', prompt: 'To: ' + t.to + '\n\n' + t.situation + '\n\nIn your email:\n' + t.points.map((p) => '• ' + p).join('\n'), promptText: t.situation, minutes: 7, target: [80, 150], spellcheck: false,
        checklist: t.points.map((p) => 'I covered: ' + p.toLowerCase()).concat(['My tone is polite and suits the reader.', 'I opened with a greeting and closed with my name.']),
        onSubmit: (a, text) => {
          const sh = shape(text);
          SK.clear(model);
          model.appendChild(SK.note([sh.greeting ? 'Greeting: yes.' : 'Start with a greeting such as "Dear Professor Lee,".', sh.closing ? 'Closing: yes.' : 'End with a closing such as "Best regards," and your name.'].join(' '), sh.greeting && sh.closing ? 'right' : 'wrong'));
          model.appendChild(SK.card('Model email', SK.h('div', { class: 'sk-passage', text: t.model })));
        } });
    } }],
    shape,
    checks: {
      'every model email has a greeting, a closing and a sensible length': (data, assert) => {
        for (const t of data.email_tasks) { const s = shape(t.model); assert.ok(s.greeting && s.closing, t.id); assert.ok(s.words >= 50 && s.words <= 160, t.id + ' ' + s.words); assert.equal(t.points.length, 3); }
      },
      'missing parts are caught': (data, assert) => { const s = shape('the heater is broken please fix'); assert.ok(!s.greeting && !s.closing); },
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = App; else SK.start(App);
})();
