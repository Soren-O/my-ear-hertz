import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import LTLevels from '../long-term-levels.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const section = (from, to) => script.slice(script.indexOf(from), script.indexOf(to, script.indexOf(from)));
const at = +new Date(2026, 9, 11, 7), MIN = 60000;
function app(tone = LTLevels.createTone(1047, at)) {
  let now = at, timerId = 0;
  const pending = new Map();
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({Date: Clock, LTLevels, initialTone: tone,
    schedule(fn, delay) { const id = ++timerId; pending.set(id, {fn, at: now + delay}); return id; },
    clearTimeout(id) { pending.delete(id); }
  });
  vm.runInContext(`
    let lt = {on: true, tones: [initialTone], checks: []}, round = null, trial = null, last = null, lastRound = null, phase = 'idle';
    let ltSessionTone = null, ltPulseTimer = null, ltWake = null, ltWakeToken = 0, timers = [], ctx = {currentTime: 0}, calls = [], saved = null, screen = 'train';
    const SINE = {id: 'sine'}, input = {blur() {}}, elements = new Map(), reduceMotion = {matches:true};
    const $ = id => { if (!elements.has(id)) elements.set(id, {hidden: true, textContent: '', dataset:{}, style:{}, focus(){}, setAttribute(){}}); return elements.get(id); };
    ${section('const textFades =', 'let pageGhost =')}
    const document = {activeElement: null}, sfx = step => calls.push(['cue', step]);
    ${section('let introActive = false', "$('countInCancel').addEventListener")}
    const setInterval = () => 1, clearInterval = () => {}, setTimeout = (fn, delay) => { calls.push(['timer', delay]); return schedule(fn, delay); };
    const saveLT = () => { saved = JSON.stringify(lt); }, ltSchedule = () => {};
    const ltArm = () => null, fmtSpan = n => n / 60000 + ' min';
    ${section('const NOTE =', 'const FMIN =')}
    ${section('const pad2 =', 'function renderLTRow()')}
    const stopAll = () => { calls.push(['stop']); timers.forEach(clearTimeout); timers = []; if (round?.ladder) delete round.playingPitch; }, noteAnchor = () => {}, setAudio = s => calls.push(['audio', s]);
    const audio = () => true, voiceReady = () => false, ampFor = () => 0;
    const tone = (f, t, dur) => calls.push(['tone', f, t, dur]), pips = (t, dur) => calls.push(['notes', t, dur]);
    const render = () => {}, go = name => calls.push(['go', name]);
    const nextQuestion = () => { calls.push(['next']); phase = 'listening'; round.tuneCount++; round.challengeLevel = lt.tones[0].ladder.level; trial = {f: 1047, voice: SINE}; };
    ${section('function appendLadderCheck(', "document.addEventListener('visibilitychange', () => { if (document.visibilityState")}
    globalThis.api = {lt, calls, refreshLadders, tickLadder, abortLadder,
      clock() { renderLadderClock(); return ['ltChallengeLevel', 'ltChallengeInstruction', 'ltChallengeTime'].map(id => $(id).textContent); },
      get cue() { return {hidden: $('countIn').hidden, word: $('countInWord').textContent, inert: $('app').inert}; },
      start() { LTLevels.begin(lt.tones[0], Date.now()); ltSessionTone = lt.tones[0].ladder.level <= 6 ? 1047 : null;
        round = {lt: 1047, ladder: true, tuneCount: 1, challengeLevel: lt.tones[0].ladder.level, items: []}; trial = {f: 1047, voice: SINE}; phase = 'listening'; saveLT(); },
      answer(ok, g = ok ? 1047 : 523) { recordLadder({task: 'find', t: Date.now(), f: 1047, g, cents: 1200 * Math.log2(g / 1047), ok: Number(ok)}); },
      replay: hearLadderPitch,
      pitches() { renderLadderPitches(); return ['ltTargetPitch', 'ltGuessPitch'].map(id => ({disabled: $(id).disabled, playing: $(id).dataset.playing, hidden: $(id).hidden, note: $(id === 'ltTargetPitch' ? 'ltTargetNote' : 'ltGuessNote').textContent})); },
      get pairHidden() { return $('ltPitchPair').hidden; },
      get hintVisible() { return !$('ltSwipeHint').hidden; },
      reload() { lt = JSON.parse(saved); round = null; trial = null; ltSessionTone = null; refreshLadders(); },
      get state() { return {lt, round, phase, lastRound, ltSessionTone, saved}; }
    };
  `, context);
  return {api: context.api, time(t) { now = t; },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at; pending.delete(next[0]); next[1].fn();
      }
      now = end;
    }
  };
}

test('a correct opening guess plays target for three seconds, starts random notes with their phase, and keeps the fixed slot', () => {
  const {api, time} = app();
  api.start(); time(at + 5000); api.answer(true);
  assert.equal(api.state.lt.checks.length, 1);
  assert.equal(api.state.lt.tones[0].practice, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(api.calls.filter(c => c[0] === 'tone' || c[0] === 'notes'))),
    [['tone', 1047, 0.03, 3]]);
  time(at + 25000); api.clock();
  assert.deepEqual(JSON.parse(JSON.stringify(api.calls.filter(c => c[0] === 'notes'))), [['notes', 0.03, 20]]);
  time(at + MIN - 1); api.tickLadder();
  assert.equal(api.state.phase, 'revealed');
  time(at + MIN); api.tickLadder();
  assert.equal(api.state.phase, 'listening');
  assert.equal(api.state.lt.tones[0].ladder.deadline, at + MIN + 20000);
});

test('feedback becomes silent after three seconds and does not reveal or replay a guess before submission', () => {
  const {api, advance} = app();
  api.start(); api.clock(); api.replay('true'); api.replay('you');
  assert.equal(api.pitches()[1].hidden, true);
  assert.equal(api.calls.filter(c => c[0] === 'tone').length, 0);
  advance(5000); api.answer(true);
  assert.ok(api.pitches().every(p => p.disabled));
  api.replay('you');
  advance(3050);
  assert.equal(api.calls.at(-1)[1], 'idle');
  assert.ok(api.pitches().every(p => !p.disabled && p.playing === '0'));
  advance(10000); api.clock();
  assert.equal(api.calls.filter(c => c[0] === 'tone').length, 1);
  assert.equal(api.calls.filter(c => c[0] === 'notes').length, 0);
});

test('either pitch can be replayed and switching cancels the previous playback without changing progress', () => {
  const {api, advance} = app(), guess = 1047 * 2 ** (15 / 1200);
  api.start(); advance(5000); api.answer(true, guess); advance(3050);
  assert.deepEqual(Array.from(api.pitches(), p => p.note), ['C6', 'C6 + 15c']);
  const due = api.state.lt.tones[0].due;
  api.replay('you');
  assert.deepEqual(Array.from(api.pitches(), p => p.playing), ['0', '1']);
  advance(1000); api.replay('true');
  assert.deepEqual(Array.from(api.pitches(), p => p.playing), ['1', '0']);
  advance(2050);
  assert.equal(api.pitches()[0].playing, '1');
  advance(1000);
  assert.ok(api.pitches().every(p => p.playing === '0'));
  assert.deepEqual(Array.from(api.calls.filter(c => c[0] === 'tone'), c => [c[1], c[3]]), [[1047, 3], [guess, 3], [1047, 3]]);
  assert.equal(api.state.lt.checks.length, 1);
  assert.equal(api.state.lt.tones[0].due, due);
});

test('a replay near the phase boundary is stopped by random notes and cannot shift or cancel them', () => {
  const {api, advance} = app();
  api.start(); advance(5000); api.answer(true); advance(19000); api.replay('you');
  advance(1000); api.clock();
  assert.equal(api.pairHidden, true);
  assert.equal(api.calls.at(-2)[1], 'interfere');
  assert.ok(api.pitches().every(p => p.disabled && p.playing === '0'));
  const sounds = api.calls.filter(c => c[0] === 'tone' || c[0] === 'notes').length;
  api.replay('true'); advance(4100); api.clock();
  assert.equal(api.calls.filter(c => c[0] === 'tone' || c[0] === 'notes').length, sounds);
  assert.equal(api.calls.filter(c => c[0] === 'audio').at(-1)[1], 'interfere');
  advance(16000); api.clock();
  assert.equal(api.calls.filter(c => c[0] === 'audio').at(-1)[1], 'idle');
  assert.equal(api.state.lt.tones[0].due, at + MIN);
});

test('the displayed timer counts down each phase without moving the next guess off its minute slot', () => {
  const {api, time} = app();
  const clock = () => Array.from(api.clock());
  api.start(); time(at + 5000);
  assert.deepEqual(clock(), ['LEVEL 1', 'FIND', '0:15']);
  api.answer(true);
  time(at + 10000);
  assert.deepEqual(clock(), ['LEVEL 1', 'LISTEN', '0:15']);
  time(at + 25000);
  assert.deepEqual(clock(), ['LEVEL 1', 'RANDOM', '0:20']);
  time(at + 45000);
  assert.deepEqual(clock(), ['LEVEL 1', 'WAIT', '0:15']);
  assert.equal(api.state.lt.tones[0].due, at + MIN);
  time(at + MIN); api.tickLadder();
  assert.deepEqual(clock(), ['LEVEL 1', 'FIND', '0:20']);
});

test('swipe instructions occupy the guess slot only before the first answer and do not return for later checks', () => {
  const {api,time}=app(); api.start(); api.clock();
  assert.equal(api.hintVisible,true); assert.equal(api.pitches()[1].hidden,true);
  time(at+5000); api.answer(true);
  assert.equal(api.hintVisible,false); assert.equal(api.pitches()[1].hidden,false);
  time(at+MIN); api.tickLadder(); api.clock();
  assert.equal(api.hintVisible,false); assert.equal(api.pitches()[1].hidden,true);
  const later=LTLevels.createTone(1047,at); Object.assign(later.ladder,{level:7,mode:'ready'});
  const next=app(later).api; next.start(); next.clock(); assert.equal(next.hintVisible,false);
});

test('a deadline creates one failed check without a fabricated pitch error, saves it and ends the game', () => {
  const {api, time} = app();
  api.start(); time(at + 20000); api.tickLadder(); api.tickLadder();
  const checks = api.state.lt.checks;
  assert.equal(checks.length, 1);
  assert.equal(checks[0].ok, 0);
  assert.equal(checks[0].reason, 'timeout');
  assert.equal(checks[0].g, null);
  assert.equal(checks[0].cents, null);
  assert.equal(api.state.round, null);
  assert.equal(api.state.ltSessionTone, null);
  assert.match(api.state.saved, /timeout/);
});

test('full-screen cues fill only the final 2.4 seconds of a long-term gap and leave the next deadline intact', () => {
  const {api, time}=app();
  api.start(); time(at+5000); api.answer(true);
  for (const [elapsed,word] of [[57600,'READY'],[58400,'SET'],[59200,'GO!']]) {
    time(at+elapsed); api.clock();
    assert.equal(api.cue.word,word); assert.equal(api.cue.hidden,false); assert.equal(api.cue.inert,true);
    assert.equal(api.state.lt.tones[0].due,at+MIN);
  }
  time(at+MIN); api.tickLadder(); api.clock();
  assert.deepEqual(Array.from(api.calls.filter(c=>c[0]==='cue'),c=>c[1]),['ready','set','go']);
  assert.equal(api.cue.hidden,true); assert.equal(api.cue.inert,false);
  assert.equal(api.state.lt.tones[0].ladder.deadline,at+MIN+20000);
});

test('reload during a timed opening ends the attempt and cannot replay or erase completed checks', () => {
  const {api, time} = app();
  api.start(); time(at + 5000); api.answer(true); api.reload();
  assert.equal(api.state.lt.checks.length, 2);
  assert.equal(api.state.lt.checks[0].ok, 1);
  assert.equal(api.state.lt.checks[1].reason, 'interrupted');
  assert.equal(api.state.lt.tones[0].ladder.mode, 'failed');
  api.refreshLadders();
  assert.equal(api.state.lt.checks.length, 2);
});

test('the final opening interval releases navigation exactly at the hour, not after the last guess', () => {
  const t = LTLevels.createTone(1047, at);
  Object.assign(t.ladder, {level: 6, mode: 'ready'});
  const {api, time} = app(t);
  api.start(); time(at + 1000); api.answer(true);
  time(at + 10 * MIN - 1); api.tickLadder();
  assert.equal(api.state.ltSessionTone, 1047);
  time(at + 10 * MIN); api.tickLadder();
  assert.equal(api.state.ltSessionTone, null);
  assert.equal(api.state.lt.tones[0].ladder.level, 7);
  assert.equal(api.state.round, null);
  assert.equal(api.calls.at(-1)[1], 'lt');
});

test('a missed daily date is saved once and does not play sound on app resume', () => {
  const t = {f: 1047, wait: 86400000, last: at - MIN, ready: true};
  LTLevels.migrate(t, at); LTLevels.begin(t, at); LTLevels.answer(t, at + 1000, true);
  const {api, time} = app(t);
  time(at + 2 * 86400000); api.refreshLadders(); api.refreshLadders();
  assert.equal(api.state.lt.checks.length, 1);
  assert.equal(api.state.lt.checks[0].reason, 'missed-day');
  assert.equal(api.state.lt.tones[0].ladder.level, 11);
  assert.equal(api.calls.length, 0);
});

test('reloading an unanswered daily check cannot restart its decision deadline or strand the note', () => {
  const t = {f: 1047, wait: 86400000, last: at - MIN, ready: true};
  LTLevels.migrate(t, at);
  const {api} = app(t);
  api.start(); api.reload();
  assert.equal(api.state.lt.checks.length, 1);
  assert.equal(api.state.lt.checks[0].reason, 'interrupted');
  assert.equal(api.state.lt.tones[0].ladder.mode, 'failed');
  assert.equal(api.state.lt.tones[0].ladder.level, 11);
});
