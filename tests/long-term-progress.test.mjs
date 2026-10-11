import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function section(from, to) {
  const start = script.indexOf(from), end = script.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Missing app section: ${from}`);
  return script.slice(start, end);
}
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const now = new Date(2026, 9, 10, 14).getTime();
function app(tones = [], checks = []) {
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const context = vm.createContext({Date: Clock, tones, checks});
  vm.runInContext(`
    const MIN = ${MIN}, HOUR = ${HOUR}, DAY = ${DAY};
    const lt = {on: true, tones, checks, started: Date.now() - DAY};
    let progMode = 'lt', progTone = null, history = [], rounds = [], calls = [];
    const settings = {level: 1}, LEVELS = [{short: 'Name', task: 'pick'}], CHOICE_TASKS = ['pick'];
    const modeOf = r => r.m === 'match' ? 'match' : 'pick', lvOf = () => 1, levelTitle = () => 'Name';
    const fmtPct = p => p + '%', pctFromOct = o => (2 ** o - 1) * 100, fit = () => null;
    const EXAMPLE = {pick: Array.from({length: 5}, () => ({f: 1047, g: 1047, ok: 1})), match: []};
    const drawProgress = () => calls.push('drawProgress'), drawScatter = () => {}, renderClear = () => {}, renderMemory = () => {};
    const elements = new Map();
    const $ = id => {
      if (!elements.has(id)) elements.set(id, {hidden: false, innerHTML: '', textContent: '', clientWidth: 340,
        attrs: {}, setAttribute(k, v) { this.attrs[k] = v; },
        toggleAttribute(k, on) { if (on) this.attrs[k] = ''; else delete this.attrs[k]; }});
      return elements.get(id);
    };
    const modes = ['pick', 'match', 'lt'].map(mode => ({dataset: {mode}, setAttribute(k, v) { this[k] = v; }}));
    const document = {querySelectorAll() { return modes; }};
    const hueOf = () => 100, noteName = f => ({523: 'C5', 1047: 'C6', 2093: 'C7'})[f];
    const ltPracticeLabel = t => t.retune?.streak ? 'Re-tune' : 'Practice';
    ${section('const fmtHz =', 'const fmtFreq =')}
    ${section('const oct =', 'const pctFromOct =')}
    ${section('const median =', 'const clamp =')}
    ${section('function fmtWhen(', 'function parseGuess(')}
    ${section('const centsTxt =', 'const dayKey =')}
    ${section('const fmtSpan =', 'function ltBegin()')}
    ${section('const tileHtml =', '/* ---------- results ----------')}
    ${section('function drawLTChart(', 'let ltStopping =')}
    ${section('function renderProgress()', '// Pull:')}
    globalThis.api = {lt, stats: ltProgressStats, render: renderProgress, element: $, calls, modes,
      select(f) { progTone = f; renderLTProgress(); },
      mode(m) { progMode = m; renderProgress(); },
      drawAll() { drawLTChart(); },
      get selected() { return progTone; }, setHistory(rs) { history = rs; }
    };
  `, context);
  return context.api;
}
const plain = value => JSON.parse(JSON.stringify(value));
const sample = () => [
  {f: 1047, g: 1035, t: now - 2 * HOUR, cents: -20, ok: 1, gap: 2 * MIN, card: {ok: 0}},
  {f: 523, g: 600, t: now - 3 * HOUR, cents: 200, ok: 0, gap: 5 * DAY, card: {ok: 1}},
  {f: 1047, g: 1100, t: now - HOUR, cents: 100, ok: 0, gap: DAY, card: {ok: 1}},
  {f: 1047, g: 1047, t: now - 4 * HOUR, cents: 0, ok: 1, gap: HOUR},
];

test('per-note statistics use only that note’s initial checks and successful remembered gaps', () => {
  const checks = sample(), before = plain(checks), api = app([], checks);
  api.setHistory(Array.from({length: 20}, () => ({f: 1047, g: 1047, ok: 1, m: 'match'})));
  const stats = api.stats(1047);
  assert.equal(stats.checks.length, 3);
  assert.equal(stats.hits, 2);
  assert.equal(stats.miss, 20);
  assert.equal(stats.held, HOUR); // the failed one-day gap cannot count as held
  assert.equal(stats.cards, 2);
  assert.equal(stats.cardHits, 1);
  assert.deepEqual(plain(stats.checks.map(c => c.t)), [now - 4 * HOUR, now - 2 * HOUR, now - HOUR]);
  assert.deepEqual(checks, before); // viewing statistics must not reorder saved check-ins
});

test('switching notes changes the statistics, chart, flashcards, and current schedule together', () => {
  const api = app([{f: 1047, wait: DAY, due: now + DAY}, {f: 523, wait: 2 * MIN, due: now}], sample());
  api.render();
  assert.equal(api.element('trainingProgress').hidden, true);
  assert.equal(api.modes[2]['aria-pressed'], 'true');
  assert.match(api.element('ltProgressTiles').innerHTML, /67%/);
  assert.match(api.element('ltProgressTiles').innerHTML, /20¢/);
  assert.match(api.element('ltProgressCardTiles').innerHTML, /50%/);
  assert.equal((api.element('ltProgressChart').innerHTML.match(/<circle/g) || []).length, 3);
  api.select(523);
  assert.match(api.element('ltProgressTitle').innerHTML, /C5/);
  assert.match(api.element('ltProgressTiles').innerHTML, />0%</);
  assert.match(api.element('ltProgressTiles').innerHTML, /200¢/);
  assert.match(api.element('ltProgressCardTiles').innerHTML, /100%/);
  assert.match(api.element('ltProgressSchedule').innerHTML, /2 min/);
  assert.equal(api.element('ltProgressStatus').textContent, 'Next check: due now');
  assert.equal((api.element('ltProgressChart').innerHTML.match(/<circle/g) || []).length, 1);
  api.lt.on = false;
  api.render();
  assert.equal(api.selected, 523);
  assert.equal(api.element('ltProgressStatus').textContent, 'Training paused');
  api.drawAll();
  assert.equal((api.element('ltChart').innerHTML.match(/<circle/g) || []).length, 4);
});

test('an empty long-term bank shows an honest empty state and switching back restores training progress', () => {
  const api = app();
  api.lt.on = false;
  api.render();
  assert.equal(api.element('ltProgressEmpty').hidden, false);
  assert.equal(api.element('ltProgressResults').hidden, true);
  assert.equal(api.element('ltProgressDetail').hidden, true);
  assert.equal(api.calls.length, 0); // no example charts in long-term mode
  api.mode('pick');
  assert.equal(api.element('trainingMemory').hidden, false);
  assert.equal(api.element('trainingProgress').hidden, false);
  assert.equal(api.element('ltProgressBank').hidden, true);
  assert.equal(api.element('ltProgressResults').hidden, true);
  assert.ok(api.calls.includes('drawProgress'));
});

test('notes without checks and historical notes remain selectable without NaN or sample statistics', () => {
  const api = app([{f: 2093, wait: 2 * MIN, due: now + 2 * MIN, practice: ['find'], retune: {streak: 1}}], sample());
  api.render();
  assert.equal(api.selected, 2093);
  assert.match(api.element('ltProgressNotes').innerHTML, /C7/);
  assert.match(api.element('ltProgressNotes').innerHTML, /C6/);
  assert.match(api.element('ltProgressNotes').innerHTML, /C5/);
  assert.equal(api.element('ltProgressStatus').textContent, 'Re-tune pending');
  assert.equal(api.element('ltProgressNoChecks').hidden, false);
  assert.ok('hidden' in api.element('ltProgressChart').attrs);
  assert.equal(api.element('ltProgressCards').hidden, true);
  assert.equal(api.element('ltProgressRecent').hidden, true);
  assert.doesNotMatch(api.element('ltProgressTiles').innerHTML, /NaN|Infinity|undefined/);
  api.select(1047);
  assert.equal(api.element('ltProgressStatus').textContent, 'Saved check-ins');
  assert.equal(api.element('ltProgressNoChecks').hidden, true);
  const legacy = api.stats(1047).checks[0];
  delete legacy.cents;
  api.render();
  assert.doesNotMatch(api.element('ltProgressChart').innerHTML, /NaN|Infinity|undefined/);
});
