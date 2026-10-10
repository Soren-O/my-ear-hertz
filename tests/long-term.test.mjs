import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Exercise the real single-file app's functions without the audio engine or DOM.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function section(from, to) {
  const start = script.indexOf(from), end = script.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Missing app section: ${from}`);
  return script.slice(start, end);
}
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const morning = new Date(2026, 9, 10, 7).getTime();

function app(at = morning, persisted = {}) {
  let now = at;
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({Date: Clock, persisted});
  vm.runInContext(`
    let settings = {wake: '07:00', bed: '22:00', auto: true, level: 1, top: 1};
    let lt = persisted['hbe3.lt'] ? JSON.parse(persisted['hbe3.lt']) : {on: true, started: Date.now(), tones: [], checks: []};
    let round = null, lastRound = null, trial = null, last = null, phase = 'idle';
    let rounds = [], calls = [], anchors = [], history = [];
    const LEVELS = [{task: 'find'}], ROUND = 10, UP = 10, DOWN = 5, C6 = 1047, ECHO_N = 5;
    const store = {set(k, v) { persisted[k] = JSON.stringify(v); }}, reduceMotion = {matches: true};
    const input = {value: '', blur() {}}, SINE = {id: 'sine'}, CHOICE_TASKS = [];
    const elements = new Map();
    const $ = id => { if (!elements.has(id)) elements.set(id, {focus() {}, classList: {remove() {}, add() {}}}); return elements.get(id); };
    let CAP = null;
    const ltSchedule = () => calls.push('schedule');
    const ltOfferOnce = () => calls.push('offer');
    const stopAll = () => calls.push('stop');
    const go = name => calls.push(name);
    const sfx = () => {}, saveSettings = () => {}, isFindC6 = () => true;
    const practiceLv = () => 1;
    const ltLevel = f => ({task: 'find', narrow: true, choices: [f]});
    const startRound = (echo, extra) => { calls.push(extra); };
    const render = () => calls.push('render');
    const showError = () => {};
    const COLD_GAP = 600000, modeOf = r => r.m === 'match' ? 'match' : 'pick';
    const noteAnchor = () => {}, startCompare = () => {}, confetti = () => {};
    const closeLTSheet = () => calls.push('closeSheet');
    const levelOf = () => round.L;
    const voiceRange = () => [100, 2000];
    const makeStops = () => ({n: 5, ti: 2});
    const newRove = () => 0;
    const startAdj = () => calls.push('adjust');
    const trainItf = () => null, itfKey = () => null;
    const showTip = () => {};
    const playPreview = () => calls.push('preview');
    ${section('const roundLen =', 'const echoPts =')}
    ${section('const grade =', 'function fmtWhen(')}
    const finishEcho = () => calls.push('echo');
    ${section('const MIN =', 'const LT_NOTE =')}
    ${section('const saveLT =', 'const isFindC6 =')}
    ${section('const practiceTone =', 'const fmtSpan =')}
    ${section('function ltBegin()', 'function ltOffer()')}
    ${section('function nextCardSide()', 'function parseNote(')}
    ${section('function startCheck(', 'function remindAt(')}
    ${section('function nextQuestion()', 'const playPreview =')}
    ${section('function record(rec)', 'function answer(g)')}
    ${section('function quitRound()', 'function showError')}
    ${section('function finishRound()', '/* ---------- Echo:')}
    ${section('async function startLongTerm()', "$('ltStart').addEventListener")}
    ${section('function renderLTReminders()', 'function ltNoteState(')}
    ${section('function howto()', 'function updateHowto()')}
    ${section('function roundProgress()', 'function render()')}
    ${section('const advance =', "$('nextBtn').addEventListener")}
    globalThis.api = {
      blockTone, blkNext, day1Slots, nextCardSide, nextQuestion, startCheck, ltBegin,
      finishCheck, advance, ltSteps, nextTone, dueTone, record, quitRound, startLongTerm, renderLTReminders, ltPracticeLabel, howto, roundLen, roundProgress, nextButtonLabel,
      get state() { return {lt, settings, round, lastRound, trial, last, phase, calls, rounds}; },
      setCheck(t, ok, cardOK = true) {
        lt.tones = [t];
        round = {lt: t.f, items: [
          {task: 'card', side: 'hz', typed: '1047', ok: Number(cardOK), t: Date.now()},
          {task: 'find', f: t.f, g: ok ? t.f : t.f * 2, cents: ok ? 0 : 1200, ok: Number(ok), t: Date.now()}
        ]};
        saveCheckAnswer(round.items[0]);
      },
      setPractice(t, ok) {
        lt.tones = [t];
        round = {id: Date.now(), lv: 1, practice: true, practiceTone: t.f,
          practiceCard: t.practice[0] === 'find' ? null : t.practice[0],
          practiceGoal: t.practice[0] === 'find' && t.retune ? 2 : 1, practiceStreak: t.retune?.streak || 0,
          L: ltLevel(t.f), items: [{task: t.practice[0] === 'find' ? 'find' : 'card', ok: Number(ok)}]};
        last = round.items[0]; trial = {task: round.items[0].task}; phase = 'revealed';
      },
      setRound(r) { round = r; },
      setSettings(s) { Object.assign(settings, s); },
      setCAP(v) { CAP = v; }, element: $,
      loadLT(s) { lt = JSON.parse(s); },
      migrate() { ${section('lt.tones.forEach(t => {', 'if (lt.on && !lt.tones.length)')} }
    };
  `, context);
  return {api: context.api, persisted, time(t) { now = t; }};
}

const offsets = [0, 2, 4, 6, 8, 10, 12.5, 15, 17.5, 20, 20 + 1 / 3 * 10, 27,
  30, 30 + 1 / 3 * 10, 37, 40, 45, 50, 55, 60, 70, 80, 90, 105, 120, 135,
  150, 165, 180, 210, 240, 270, 300, 360, 420, 480, 540, 600, 660, 720, 780, 840];
const plain = value => JSON.parse(JSON.stringify(value));
function beginCheck(api, tone, items = []) {
  api.state.lt.tones = [tone];
  api.setRound({id: morning, lv: 1, lt: tone.f, L: {task: 'find', narrow: true, choices: [tone.f]}, items});
  api.nextQuestion();
}
function submit(api, ok, at) {
  const q = api.state.trial;
  api.record({task: q.task, side: q.side, f: q.f, g: ok ? q.f : q.f * 2,
    typed: String(ok ? q.f : q.f * 2), cents: ok ? 0 : 1200, ok: Number(ok), t: at});
}
function beginPractice(api, tone) {
  api.startCheck(tone.f);
  const opts = api.state.calls.at(-1);
  api.setRound({id: morning, items: [], ...opts});
  api.nextQuestion();
  if (api.state.trial.task === 'preview') api.advance();
}

test('the app JavaScript parses', () => { new vm.Script(script); });

test('Day 1 matches every requested time and continues hourly until bedtime', () => {
  const {api} = app();
  const t = api.blockTone(1047, morning);
  assert.equal(t.due, morning);
  assert.deepEqual(plain(t.blk.slots), offsets.map(m => morning + Math.round(m * MIN)));
  for (let i = 0; i < offsets.length - 1; i++) {
    assert.equal(api.blkNext(t, t.blk.slots[t.blk.k], true), morning + Math.round(offsets[i + 1] * MIN));
  }
  assert.equal(api.blkNext(t, t.blk.slots[t.blk.k], true), morning + DAY + 15 * MIN);
});

test('finishing the immediate check 20 seconds later preserves the 2-minute slot', () => {
  const {api} = app();
  const t = api.blockTone(1047, morning);
  assert.equal(api.blkNext(t, morning + 20_000, true), morning + 2 * MIN);
});

test('each Day 1 miss drops exactly one level and repeats its full run', async t => {
  const cases = [
    [10, 2, [0, 2, 4, 6, 8, 10]],
    [20, 2.5, [0, 2.5, 5, 7.5, 10]],
    [40, 10 / 3, [0, 10 / 3, 7, 10, 10 + 10 / 3, 17, 20]],
    [60, 5, [0, 5, 10, 15, 20]],
    [90, 10, [0, 10, 20, 30]],
    [210, 15, [0, 15, 30, 45, 60, 75, 90, 120]],
    [360, 30, [0, 30, 60, 90, 150]]
  ];
  for (const [missAt, gap, retry] of cases) await t.test(`miss at ${missAt} min`, () => {
    const {api} = app();
    const tone = api.blockTone(1047, morning);
    tone.blk.k = tone.blk.slots.indexOf(morning + missAt * MIN);
    const first = morning + Math.round((missAt + gap) * MIN);
    assert.equal(api.blkNext(tone, morning + missAt * MIN, false), first);
    assert.deepEqual(plain(tone.blk.slots.slice(0, retry.length)), retry.map(m => first + Math.round(m * MIN)));
  });
});

test('repeated misses at the lowest level restart the 2-minute run', () => {
  const {api} = app();
  const t = api.blockTone(1047, morning);
  assert.equal(api.blkNext(t, morning, false), morning + 2 * MIN);
  assert.equal(api.blkNext(t, morning + 2 * MIN, false), morning + 4 * MIN);
  assert.equal(t.blk.k, 0);
  assert.deepEqual(plain(t.blk.slots.slice(0, 5)), [4, 6, 8, 10, 12].map(m => morning + m * MIN));
});

test('an immediate resumed check after the last Day 1 slot can still drop a level', () => {
  const {api} = app();
  const t = api.blockTone(1047, morning);
  t.blk.k = t.blk.slots.length - 1;
  api.blkNext(t, morning + 840 * MIN, true); // leaves the next check for morning
  assert.equal(t.blk.slots.length, 0);
  assert.equal(api.blkNext(t, morning + 841 * MIN, false), morning + 871 * MIN);
  assert.equal(t.blk.levels[0], 6);
});

test('late Day 1 hits merge elapsed slots without shifting the schedule', () => {
  const {api} = app();
  const t = api.blockTone(1047, morning);
  assert.equal(api.blkNext(t, morning + 18 * MIN, true), morning + 20 * MIN);
  assert.equal(api.blkNext(t, morning + 23 * MIN, true), morning + 23 * MIN + 20_000);
});

test('a late Day 1 miss drops from the scheduled level', () => {
  const {api} = app();
  const t = api.blockTone(1047, morning);
  t.blk.k = t.blk.slots.indexOf(morning + 10 * MIN);
  assert.equal(api.blkNext(t, morning + 35 * MIN, false), morning + 37 * MIN);
  assert.equal(t.blk.levels[0], 0);
});

test('starts near bedtime and at night still get an immediate first check', () => {
  for (const hour of [21, 23]) {
    const start = new Date(2026, 9, 10, hour, 59).getTime();
    const {api} = app(start);
    const t = api.blockTone(1047, start);
    assert.equal(t.due, start);
    const next = api.blkNext(t, start + 20_000, true);
    assert.equal(next, morning + DAY + 15 * MIN);
    const day2 = api.blkNext(t, next, true);
    assert.equal(t.blk.day, 2);
    assert.ok(day2 >= next + 10 * MIN);
    assert.equal(t.blk.levels, undefined);
  }
});

test('the fixed block hands off after 36 hours, without lateness credit at the handoff', () => {
  const {api, time} = app();
  const t = api.blockTone(1047, morning);
  time(morning + 36 * HOUR);
  api.setCheck(t, true);
  api.finishCheck();
  assert.equal(t.blk, undefined);
  assert.equal(t.wait, DAY);
});

test('late adaptive check-ins use half credit on hits and misses in every arm', () => {
  for (const arm of [null, 'A', 'B', 'C', 'D', 'E', 'F']) {
    for (const gapDays of [0.5, 1, 4, 13, 1000]) {
      for (const ok of [true, false]) {
        const {api} = app(morning + gapDays * DAY);
        if (arm) api.setSettings({study: true, arm});
        const t = {f: 1047, wait: DAY, last: morning, due: morning + DAY};
        api.setCheck(t, ok);
        api.finishCheck();
        const {up, down} = api.ltSteps();
        const base = Math.sqrt(Math.max(1, gapDays)) * DAY;
        const expected = ok ? base * up : Math.max(2 * MIN, Math.min(DAY, base / down));
        assert.ok(Math.abs(t.wait - expected) < 0.001, `${arm} / ${gapDays} days / ${ok}`);
        assert.equal(api.state.lt.checks[0].gap, gapDays * DAY);
        assert.equal(api.state.lt.checks[0].due, morning + DAY);
        if (!ok) assert.ok(t.wait <= DAY);
      }
    }
  }
});

test('an early probe does not shorten the tested interval and remains recorded', () => {
  const {api} = app(morning + 2 * DAY);
  const t = {f: 1047, wait: 4 * DAY, last: morning, due: morning + 2 * DAY, probe: 14};
  api.setCheck(t, true);
  api.finishCheck();
  assert.equal(t.wait, 6 * DAY);
  assert.equal(api.state.lt.checks[0].probe, 14);
  assert.deepEqual(plain(t.probed), [14]);
});

test('the actual gap is measured from when an added tone joined', () => {
  const {api} = app(morning + 5 * DAY);
  const t = {f: 1047, start: morning + 4 * DAY, wait: DAY, due: morning + 5 * DAY};
  api.setCheck(t, true);
  api.finishCheck();
  assert.equal(api.state.lt.checks[0].gap, DAY);
  assert.equal(t.wait, 1.5 * DAY);
});

test('flashcards alternate and their next direction survives reload', () => {
  const {api} = app();
  assert.equal(api.nextCardSide(), 'hz');
  assert.equal(api.nextCardSide(), 'note');
  const loaded = app().api;
  loaded.loadLT(JSON.stringify(api.state.lt));
  assert.equal(loaded.nextCardSide(), 'hz');
  assert.equal(loaded.nextCardSide(), 'note');
});

test('starting and resuming training makes the first check due immediately', () => {
  const {api} = app();
  api.ltBegin();
  assert.equal(api.dueTone().due, morning);
  api.state.lt.on = false;
  api.state.lt.tones[0].due = morning + DAY;
  api.ltBegin();
  assert.equal(api.dueTone().due, morning);
});

test('a missed card requires card practice before the initial pitch re-tune', () => {
  const {api} = app();
  const t = api.blockTone(1047, morning);
  api.setCheck(t, true, false);
  api.finishCheck();
  assert.equal(t.due, morning + 2 * MIN);
  assert.deepEqual(plain(t.practice), ['hz', 'find']);
  assert.equal(t.retune.streak, 1);
  api.startCheck();
  assert.equal(api.state.calls.at(-1).practiceCard, 'hz');
  assert.equal(api.state.calls.at(-1).practiceTone, 1047);
});

test('both missed questions on the first check require one card correction and two consecutive pitch successes', () => {
  const {api} = app();
  const t = api.blockTone(1047, morning);
  api.setCheck(t, false, false);
  api.finishCheck();
  assert.deepEqual(plain(t.practice), ['hz', 'find']);
  const due = t.due;
  api.setPractice(t, true);
  api.advance();
  assert.deepEqual(plain(t.practice), ['find']);
  assert.equal(api.state.calls.at(-1).practiceCard, null);
  api.setPractice(t, true);
  api.advance();
  assert.deepEqual(plain(t.practice), ['find']);
  assert.equal(t.retune.streak, 1);
  api.setPractice(t, true);
  api.advance();
  assert.equal(t.practice, undefined);
  assert.equal(api.state.calls.at(-1), 'lt');
  assert.equal(t.due, due);
  assert.equal(api.state.settings.level, 1);
});

test('practice repeats after a miss and stops after one success', () => {
  const {api} = app();
  const t = {f: 1047, due: morning + DAY, wait: DAY, practice: ['find']};
  api.setPractice(t, false);
  api.advance();
  assert.equal(api.state.trial.task, 'preview');
  assert.deepEqual(plain(t.practice), ['find']);
  api.setPractice(t, true);
  api.advance();
  assert.equal(t.practice, undefined);
  assert.equal(api.state.calls.at(-1), 'lt');
  assert.equal(t.wait, DAY);
  assert.equal(t.due, morning + DAY);
});

test('unfinished practice survives reload and gates the next long-term check', () => {
  const {api} = app();
  const t = {f: 1047, due: morning + DAY, practice: ['note']};
  api.setPractice(t, false);
  const loaded = app().api;
  loaded.loadLT(JSON.stringify(api.state.lt));
  assert.equal(loaded.dueTone().f, 1047);
  loaded.startCheck(523);
  assert.equal(loaded.state.calls.at(-1).practiceTone, 1047);
  assert.equal(loaded.state.calls.at(-1).practiceCard, 'note');
});

test('existing Day 1 data migrates without replaying completed checks', () => {
  const {api} = app();
  const t = {f: 1047, due: morning + 9 * MIN, last: morning + 5 * MIN,
    blk: {day: 1, at: morning, end: morning + 15 * HOUR, slots: [], k: 0, x: 0}};
  api.state.lt.tones.push(t);
  api.migrate();
  assert.equal(t.due, morning + 10 * MIN);
  assert.equal(t.blk.levels[t.blk.k], 1);
});

test('a wrong Find is saved before Results and survives quitting and reload', () => {
  const {api, persisted} = app(morning + DAY);
  const tone = {f: 1047, wait: DAY, last: morning, due: morning + DAY};
  beginCheck(api, tone);
  submit(api, true, morning + DAY);
  api.advance();
  submit(api, false, morning + DAY);
  assert.equal(api.state.lt.checks.length, 1);
  assert.ok(tone.wait < DAY);
  api.quitRound();
  const loaded = app(morning + DAY, persisted).api;
  assert.equal(loaded.state.lt.checks.length, 1);
  assert.equal(loaded.state.lt.tones[0].wait, tone.wait);
  assert.deepEqual(plain(loaded.state.lt.tones[0].practice), ['find']);
  loaded.startCheck();
  assert.equal(loaded.state.calls.at(-1).practiceTone, 1047);
});

test('a missed flashcard survives quitting, requires practice, and resumes its Find without repeating the card', () => {
  const {api, persisted} = app();
  const tone = api.blockTone(1047, morning);
  beginCheck(api, tone);
  const side = api.state.trial.side;
  submit(api, false, morning);
  api.quitRound();
  const loaded = app(morning, persisted).api, restored = loaded.state.lt.tones[0];
  assert.deepEqual(plain(restored.practice), [side]);
  assert.equal(restored.due, morning); // a card never moves the pitch schedule
  loaded.startCheck();
  assert.equal(loaded.state.calls.at(-1).practiceCard, side);
  loaded.setPractice(restored, true);
  loaded.advance();
  loaded.startCheck();
  const opts = loaded.state.calls.at(-1), nextSide = loaded.state.lt.cardSide;
  assert.equal(opts.items.length, 1);
  beginCheck(loaded, restored, opts.items);
  assert.equal(loaded.state.trial.task, 'find');
  assert.equal(loaded.state.lt.cardSide, nextSide);
  submit(loaded, true, morning);
  assert.deepEqual(plain(restored.practice), ['find']); // the corrected card must not be required again
  assert.equal(restored.retune.streak, 1);
  assert.equal(restored.card, undefined);
  assert.equal(loaded.state.lt.checks[0].card.ok, 0);
});

test('a correct flashcard survives reload and proceeds straight to its Find', () => {
  const {api, persisted} = app();
  beginCheck(api, api.blockTone(1047, morning));
  submit(api, true, morning);
  const loaded = app(morning, persisted).api;
  loaded.startCheck();
  const opts = loaded.state.calls.at(-1), nextSide = loaded.state.lt.cardSide;
  assert.equal(opts.items.length, 1);
  beginCheck(loaded, loaded.state.lt.tones[0], opts.items);
  assert.equal(loaded.state.trial.task, 'find');
  assert.equal(loaded.state.lt.cardSide, nextSide);
});

test('feedback delay cannot earn lateness credit or postpone the next adaptive check', () => {
  const {api, time, persisted} = app(morning + 2 * MIN);
  const tone = {f: 1047, wait: 2 * MIN, last: morning, due: morning + 2 * MIN};
  beginCheck(api, tone);
  submit(api, true, morning + 2 * MIN);
  api.advance();
  submit(api, true, morning + 2 * MIN);
  assert.equal(tone.wait, 3 * MIN);
  assert.equal(tone.due, morning + 5 * MIN);
  time(morning + 12 * MIN);
  api.advance();
  assert.equal(api.state.lt.checks.length, 1);
  assert.equal(api.state.lt.checks[0].t, morning + 2 * MIN);
  assert.equal(api.state.lt.checks[0].gap, 2 * MIN);
  assert.equal(tone.last, morning + 2 * MIN);
  assert.equal(tone.due, morning + 5 * MIN);
  assert.equal(app(morning + 12 * MIN, persisted).api.state.lt.checks.length, 1);
});

test('viewing feedback does not skip Day 1 check-in slots', () => {
  const {api, time} = app();
  const tone = api.blockTone(1047, morning);
  beginCheck(api, tone);
  submit(api, true, morning);
  api.advance();
  submit(api, true, morning + 20_000);
  time(morning + 12 * MIN);
  api.advance();
  assert.equal(tone.due, morning + 2 * MIN);
  assert.equal(tone.blk.k, 1);
  assert.equal(api.state.lt.checks.length, 1);
});

test('one practice success is saved before Results without clearing the next required correction', () => {
  const {api, persisted} = app();
  const tone = {f: 1047, wait: DAY, due: morning + DAY, practice: ['hz', 'find']};
  api.setPractice(tone, false);
  api.advance();
  submit(api, true, morning);
  assert.deepEqual(plain(tone.practice), ['find']);
  const loaded = app(morning, persisted).api;
  assert.deepEqual(plain(loaded.state.lt.tones[0].practice), ['find']);
  api.advance();
  assert.deepEqual(plain(tone.practice), ['find']);
  assert.equal(tone.wait, DAY);
  assert.equal(tone.due, morning + DAY);
});

test('the website starts immediately without a browser notification permission', async () => {
  const {api} = app();
  api.state.lt.on = false;
  await api.startLongTerm();
  assert.equal(api.state.lt.on, true);
  assert.equal(api.dueTone().due, morning);
  assert.equal(api.state.calls.at(-1).lt, 1047);
  api.renderLTReminders();
  assert.match(api.element('ltReminderStatus').textContent, /no reminders when it is closed/);
});

test('the native app requests notification permission and starts after it is granted', async () => {
  const {api} = app(), permissions = [];
  api.state.lt.on = false;
  api.setCAP({LocalNotifications: {
    async checkPermissions() { permissions.push('check'); return {display: 'prompt'}; },
    async requestPermissions() { permissions.push('request'); return {display: 'granted'}; }
  }});
  await api.startLongTerm();
  assert.deepEqual(permissions, ['check', 'request']);
  assert.equal(api.state.lt.on, true);
  assert.equal(api.state.calls.at(-1).lt, 1047);
  api.renderLTReminders();
  assert.match(api.element('ltReminderStatus').textContent, /silent reminders/);
});

test('denied native notification permission keeps training stopped with a useful message', async () => {
  const {api} = app();
  api.state.lt.on = false;
  api.setCAP({LocalNotifications: {
    async checkPermissions() { return {display: 'denied'}; },
    async requestPermissions() { return {display: 'denied'}; }
  }});
  await api.startLongTerm();
  assert.equal(api.state.lt.on, false);
  assert.equal(api.element('ltMsg').hidden, false);
  assert.match(api.element('ltMsg').textContent, /Notifications are off/);
});

test('a correct first check counts as the first success and needs just one Re-tune', () => {
  const {api} = app();
  const tone = api.blockTone(1047, morning);
  beginCheck(api, tone);
  submit(api, true, morning);
  api.advance();
  submit(api, true, morning);
  assert.deepEqual(plain(tone.practice), ['find']);
  assert.equal(tone.retune.streak, 1);
  const due = tone.due, wait = tone.wait;
  api.advance();
  assert.equal(tone.retune.streak, 1); // entering Re-tune cannot add another success
  assert.equal(api.ltPracticeLabel(tone), 'Re-tune');
  beginPractice(api, tone);
  assert.equal(api.roundLen(), 3);
  assert.equal(api.state.round.practiceStreak, 1);
  assert.match(api.howto(), /^Re-tune:/);
  submit(api, true, morning + 30_000);
  assert.equal(tone.practice, undefined);
  assert.equal(tone.retune, undefined);
  api.advance();
  assert.equal(api.state.round, null);
  assert.equal(tone.due, due);
  assert.equal(tone.wait, wait);
  assert.equal(api.state.lt.checks.length, 1); // re-tunes are practice, not interval updates
});

test('a failed first check needs two consecutive successes and a failed Re-tune resets the streak', () => {
  const {api} = app();
  const tone = api.blockTone(1047, morning);
  beginCheck(api, tone);
  submit(api, true, morning);
  api.advance();
  submit(api, false, morning);
  api.advance();
  const due = tone.due;
  beginPractice(api, tone);
  assert.match(api.howto(), /^Practice: get two/);
  submit(api, true, morning + 10_000);
  assert.equal(tone.retune.streak, 1);
  assert.equal(api.state.round.practiceSaved, undefined);
  api.advance();
  assert.equal(tone.retune.streak, 1); // advancing the same answer cannot count it twice
  assert.match(api.howto(), /^Re-tune:/);
  submit(api, false, morning + 20_000);
  assert.equal(tone.retune.streak, 0);
  api.advance();
  assert.match(api.howto(), /^Practice: get two/);
  submit(api, true, morning + 30_000);
  api.advance();
  assert.match(api.howto(), /^Re-tune:/);
  submit(api, true, morning + 40_000);
  assert.equal(tone.practice, undefined);
  assert.equal(tone.retune, undefined);
  api.advance();
  assert.equal(api.state.round, null);
  assert.equal(tone.due, due);
  assert.equal(api.state.lt.checks.length, 1);
});

test('an unfinished Re-tune and a reset streak both survive quitting and reload', () => {
  const {api, persisted} = app();
  const tone = api.blockTone(1047, morning);
  beginCheck(api, tone);
  submit(api, true, morning);
  api.advance();
  submit(api, false, morning);
  api.advance();
  beginPractice(api, tone);
  submit(api, true, morning + 10_000);
  api.quitRound();
  const loaded = app(morning + 10_000, persisted).api, restored = loaded.state.lt.tones[0];
  assert.equal(restored.retune.streak, 1);
  assert.equal(loaded.ltPracticeLabel(restored), 'Re-tune');
  beginPractice(loaded, restored);
  assert.match(loaded.howto(), /^Re-tune:/);
  submit(loaded, false, morning + 20_000);
  loaded.quitRound();
  const reset = app(morning + 20_000, persisted).api;
  assert.equal(reset.state.lt.tones[0].retune.streak, 0);
  assert.equal(reset.ltPracticeLabel(reset.state.lt.tones[0]), 'Practice');
  assert.deepEqual(plain(reset.state.lt.tones[0].practice), ['find']);
});

test('each new note gets the initial Re-tune even when another note has completed checks', () => {
  const {api} = app();
  api.state.lt.checks.push({f: 1047, t: morning, ok: 1});
  const tone = api.blockTone(523, morning);
  beginCheck(api, tone);
  submit(api, true, morning);
  api.advance();
  submit(api, true, morning);
  assert.equal(tone.retune.streak, 1);
  assert.deepEqual(plain(tone.practice), ['find']);
});

test('later check-ins require two consecutive pitch successes, counting a correct initial tune', () => {
  for (const ok of [true, false]) {
    const {api} = app(morning + DAY);
    const tone = {f: 1047, wait: DAY, last: morning, due: morning + DAY};
    api.state.lt.checks.push({f: tone.f, t: morning, ok: 1});
    beginCheck(api, tone);
    submit(api, true, morning + DAY);
    api.advance();
    submit(api, ok, morning + DAY);
    assert.equal(tone.retune.streak, ok ? 1 : 0);
    assert.deepEqual(plain(tone.practice), ['find']);
    const due = tone.due, wait = tone.wait;
    api.advance();
    assert.equal(api.roundLen(), 3);
    assert.equal(api.state.calls.includes('summary'), false);
    if (!ok) {
      submit(api, true, morning + DAY + 10_000);
      assert.equal(tone.retune.streak, 1);
      assert.deepEqual(plain(tone.practice), ['find']);
      assert.equal(api.nextButtonLabel(), 'Re-tune');
      api.advance();
    }
    assert.match(api.howto(), /^Re-tune:/);
    submit(api, true, morning + DAY + 20_000);
    assert.equal(tone.retune, undefined);
    assert.equal(tone.practice, undefined);
    assert.equal(api.nextButtonLabel(), 'Results');
    api.advance();
    assert.equal(api.state.round, null);
    assert.equal(tone.wait, wait);
    assert.equal(tone.due, due);
    assert.equal(api.state.lt.checks.length, 2); // one previous check, one new check; no warm interval updates
  }
});

test('the first check displays flashcard, tune, and Re-tune as one three-step flow', () => {
  const {api} = app(), tone = api.blockTone(1047, morning);
  beginCheck(api, tone);
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 1, marks: ['cur', '', '']});
  submit(api, true, morning);
  assert.equal(api.nextButtonLabel(), 'Next');
  api.advance();
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 2, marks: ['y', 'cur', '']});
  submit(api, true, morning + 10_000);
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 2, marks: ['y', 'y', '']});
  assert.equal(api.nextButtonLabel(), 'Re-tune');
  const due = tone.due, wait = tone.wait, check = api.state.lt.checks[0];
  api.advance();
  assert.equal(api.state.lastRound, null);
  assert.equal(api.state.calls.includes('summary'), false);
  assert.match(api.howto(), /^Re-tune:/);
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 3, marks: ['y', 'y', 'cur']});
  submit(api, true, morning + 20_000);
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 3, marks: ['y', 'y', 'y']});
  assert.equal(api.nextButtonLabel(), 'Results');
  api.advance();
  assert.equal(api.state.round, null);
  assert.equal(api.state.lastRound.lt, check);
  assert.equal(api.state.calls.includes('summary'), true);
  assert.equal(api.state.rounds[0].n, 1); // only the warm re-tune is filed as practice
  assert.equal(api.state.rounds[0].score, 1);
  assert.equal(tone.due, due);
  assert.equal(tone.wait, wait);
  assert.equal(api.state.lt.checks.length, 1);
});

test('failed tune and Re-tune attempts reset the pitch steps within the three-segment bar', () => {
  const {api} = app(), tone = api.blockTone(1047, morning);
  beginCheck(api, tone);
  submit(api, true, morning);
  api.advance();
  submit(api, false, morning);
  assert.equal(api.nextButtonLabel(), 'Practice');
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 2, marks: ['y', 'n', '']});
  api.advance();
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 2, marks: ['y', 'cur', '']});
  submit(api, true, morning + 10_000);
  assert.equal(api.nextButtonLabel(), 'Re-tune');
  api.advance();
  submit(api, false, morning + 20_000);
  assert.equal(api.nextButtonLabel(), 'Try again');
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 3, marks: ['y', '', 'n']});
  api.advance();
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 2, marks: ['y', 'cur', '']});
  submit(api, true, morning + 30_000);
  api.advance();
  submit(api, true, morning + 40_000);
  assert.equal(api.nextButtonLabel(), 'Results');
  assert.equal(tone.practice, undefined);
  assert.equal(api.state.lt.checks.length, 1);
});

test('a missed flashcard is corrected in the same flow before Re-tune without an intermediate Results screen', () => {
  const {api} = app(), tone = api.blockTone(1047, morning);
  beginCheck(api, tone);
  submit(api, false, morning);
  api.advance();
  submit(api, true, morning);
  assert.equal(api.nextButtonLabel(), 'Practice');
  api.advance();
  assert.equal(api.state.trial.task, 'card');
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 1, marks: ['cur', 'y', '']});
  submit(api, true, morning + 10_000);
  assert.equal(api.nextButtonLabel(), 'Re-tune');
  api.advance();
  assert.match(api.howto(), /^Re-tune:/);
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 3, marks: ['y', 'y', 'cur']});
  submit(api, true, morning + 20_000);
  assert.equal(api.nextButtonLabel(), 'Results');
  api.advance();
  assert.equal(api.state.lt.checks[0].card.ok, 0); // preserve the original check's result
  assert.equal(api.state.rounds[0].n, 2); // both corrections, excluding the cold questions
  assert.equal(tone.practice, undefined);
});

test('reloading an existing note after a correct tune restores the third step and original check Results', () => {
  const {api, persisted} = app(morning + DAY), tone = {f: 1047, wait: DAY, last: morning, due: morning + DAY};
  api.state.lt.checks.push({f: tone.f, t: morning, ok: 1});
  beginCheck(api, tone);
  submit(api, true, morning + DAY);
  api.advance();
  submit(api, true, morning + DAY);
  api.quitRound();
  const loaded = app(morning + DAY + 10_000, persisted).api, restored = loaded.state.lt.tones[0];
  beginPractice(loaded, restored);
  assert.deepEqual(plain(loaded.roundProgress()), {n: 3, k: 3, marks: ['y', 'y', 'cur']});
  submit(loaded, true, morning + DAY + 20_000);
  assert.equal(loaded.nextButtonLabel(), 'Results');
  loaded.advance();
  assert.equal(loaded.state.lastRound.lt.t, morning + DAY);
  assert.equal(loaded.state.lt.checks.length, 2);
});

test('an existing C6 check-in shows 2/3 at Tune and 3/3 at Re-tune', () => {
  const {api} = app(morning + DAY), tone = {f: 1047, wait: DAY, last: morning, due: morning + DAY};
  api.state.lt.checks.push({f: tone.f, t: morning, ok: 1});
  beginCheck(api, tone);
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 1, marks: ['cur', '', '']});
  submit(api, true, morning + DAY);
  api.advance();
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 2, marks: ['y', 'cur', '']});
  submit(api, true, morning + DAY);
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 2, marks: ['y', 'y', '']});
  assert.equal(api.nextButtonLabel(), 'Re-tune');
  api.advance();
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 3, marks: ['y', 'y', 'cur']});
  submit(api, true, morning + DAY + 10_000);
  assert.deepEqual(plain(api.roundProgress()), {n: 3, k: 3, marks: ['y', 'y', 'y']});
  assert.equal(api.nextButtonLabel(), 'Results');
  api.advance();
  assert.equal(api.state.round, null);
});
