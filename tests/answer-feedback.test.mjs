import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Run the real answer/playback functions with silent voice and timer substitutes.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function section(from, to) {
  const start = script.indexOf(from), end = script.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Missing app section: ${from}`);
  return script.slice(start, end);
}

function app() {
  let now = 0, timerID = 0;
  const pending = new Map(), played = [], audioClock = {currentTime: 0};
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({Date: Clock, played, audioClock,
    setTimeout(fn, delay) { const id = ++timerID; pending.set(id, {fn, at: now + delay}); return id; },
    clearTimeout(id) { pending.delete(id); }
  });
  vm.runInContext(`
    let ctx = audioClock, timers = [], instToken = 0, adjIdle = null, pulseTimer = null, sineTone = null, labActive = null;
    let round, trial, last, phase, history = [], anchors = [];
    const settings = {dur: 2}, SINE = {id: 'sine'}, COLD_GAP = 600000, reduceMotion = {matches: true};
    const elements = new Map();
    const $ = id => {
      if (!elements.has(id)) {
        const classes = new Set();
        elements.set(id, {classes, focus() {}, querySelectorAll() { return []; }, classList: {
          add(...xs) { xs.forEach(x => classes.add(x)); }, remove(...xs) { xs.forEach(x => classes.delete(x)); },
          toggle(x, on) { on ? classes.add(x) : classes.delete(x); }
        }});
      }
      return elements.get(id);
    };
    const document = {querySelectorAll() { return []; }}, input = {blur() {}};
    const audio = () => true, silence = () => {}, setAudio = () => {}, showError = () => {};
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    const voiceNote = (f, at, opts) => { played.push({f, at, dur: opts.dur}); return opts.dur; };
    const noteAnchor = f => anchors.push({f, t: Date.now()}), newRove = () => 0;
    const modeOf = r => r.m === 'match' ? 'match' : 'pick', trainItf = () => null, itfKey = () => null;
    const store = {set() {}}, saveCheckAnswer = () => {}, completeLTPractice = () => {};
    const render = () => {}, sfx = () => {}, showTip = () => {}, confetti = () => {};
    ${section('function stopAll()', 'function setAudio(')}
    ${section('const CMP_BOXES =', '/* ---------- the voice:')}
    ${section('function record(rec)', 'function answer(g)')}
    ${section('function hearOne(which)', "$('hearTrue').addEventListener")}
    globalThis.api = {hearOne, stopAll, lit: id => $(id).classes.has('lit'),
      answer(task, g, f, extra = {}) {
        round = {id: Date.now(), items: [], ...extra}; trial = {task, voice: SINE};
        record({task, g, f, t: Date.now(), ok: g === f ? 1 : 0, m: task === 'find' ? 'match' : 'pick'});
      }
    };
  `, context);
  return {api: context.api, played,
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        pending.delete(next[0]); now = next[1].at; audioClock.currentTime = now / 1000; next[1].fn();
      }
      now = end; audioClock.currentTime = now / 1000;
    }
  };
}

test('every pitch answer immediately plays only the target, for both hits and misses', () => {
  const cases = ['find', 'type', 'pick', 'notes', 'piano'].map(task => [task, {}]);
  cases.push(['find', {lt: 1047}], ['find', {practiceTone: 1047}], ['find', {echo: true}]);
  for (const [task, extra] of cases) for (const guess of [880, 1047]) {
    const {api, played, advance} = app();
    api.answer(task, guess, 1047, extra);
    assert.equal(played.length, 1, `${task}: playback starts without waiting for a timer`);
    assert.equal(played[0].f, 1047);
    assert.ok(played[0].at <= 0.1);
    assert.equal(api.lit('hearTrue'), true);
    assert.equal(api.lit('hearGuess'), false);
    advance(30000);
    assert.equal(played.length, 1, `${task}: no automatic guess playback or loop`);
    assert.equal(api.lit('hearTrue'), false);
  }
});

test('My guess and Actual each replay one tone and cancel the previous playback timer', () => {
  const {api, played, advance} = app();
  api.answer('find', 880, 1047);
  advance(1000);
  api.hearOne('you');
  assert.deepEqual(played.map(x => x.f), [1047, 880]);
  assert.equal(api.lit('hearGuess'), true);
  assert.equal(api.lit('hearTrue'), false);
  advance(1100); // the automatic target's old cleanup must not clear the newer guess highlight
  assert.equal(api.lit('hearGuess'), true);
  advance(20000);
  assert.equal(played.length, 2);
  api.hearOne('true');
  assert.deepEqual(played.map(x => x.f), [1047, 880, 1047]);
  api.stopAll();
  advance(30000);
  assert.equal(played.length, 3);
  assert.equal(api.lit('hearTrue'), false);
});

test('silent flashcards do not reveal a reference pitch before the long-term tune', () => {
  const {api, played, advance} = app();
  api.answer('card', 880, 1047, {lt: 1047});
  advance(30000);
  assert.equal(played.length, 0);
});
