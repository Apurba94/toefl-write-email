// Checks for this app: node --test "tests/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const WEB = path.join(__dirname, '..', 'web');
const NAME = 'toefl-write-email';
global.SK = require(path.join(WEB, 'kit', 'sk-core.js'));
require(path.join(WEB, 'kit', 'sk-quant.js'));
require(path.join(WEB, 'kit', 'sk-apps.js'));
const META = JSON.parse(fs.readFileSync(path.join(WEB, 'apps', NAME, 'meta.json'), 'utf8'));
const App = require(path.join(WEB, 'apps', NAME, 'app.js'));
const data = {};
for (const f of META.content) data[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(WEB, 'content', f), 'utf8'));

test('the app declares sections that can be drawn', () => {
  assert.ok(Array.isArray(App.tabs) && App.tabs.length >= 1);
  for (const t of App.tabs) { assert.equal(typeof t.render, 'function'); assert.ok(t.id && t.label); }
  assert.equal(new Set(App.tabs.map((t) => t.id)).size, App.tabs.length);
  assert.ok(App.how && App.how.length >= 2, 'the About tab explains how to use it');
});
test('the page loads the kit, its data and the app', () => {
  const page = fs.readFileSync(path.join(WEB, 'apps', NAME, 'index.html'), 'utf8');
  for (const f of ['sk-core.js', 'sk-ui.js', 'sk-apps.js', 'studykit.css', 'meta.js', 'app.js']) assert.ok(page.includes(f), f);
  assert.ok(!/<script>[^<]/.test(page), 'no inline scripts, so the strict content policy holds');
  for (const f of META.content) assert.ok(fs.existsSync(path.join(WEB, 'content', f)), f);
});
for (const [name, fn] of Object.entries(App.checks || {})) test(name, () => fn(data, assert, SK));
