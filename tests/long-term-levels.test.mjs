import assert from 'node:assert/strict';
import test from 'node:test';
import LT from '../long-term-levels.js';

process.env.TZ = 'America/Chicago';
const MIN = 60000, HOUR = 60 * MIN;
const morning = (day = 11) => +new Date(2026, 9, day, 7);
const copy = x => JSON.parse(JSON.stringify(x));

function opening(t, at) {
  assert.equal(LT.begin(t, at), true);
  const slots = [];
  for (let level = t.ladder.level; level <= 6; level++) {
    const l = LT.spec(level), anchor = t.ladder.anchor;
    for (let i = 0; i < l.count; i++) {
      const due = t.due;
      if (i) LT.update(t, due);
      slots.push(due - at);
      assert.equal(t.ladder.mode, 'guess');
      assert.equal(LT.answer(t, due + 19000, true).type, 'correct');
    }
    assert.equal(t.ladder.mode, 'boundary');
    assert.equal(t.due, anchor + 10 * MIN);
    assert.equal(LT.update(t, t.due - 1), null);
    assert.equal(LT.update(t, t.due).type, 'advanced');
  }
  return slots;
}
function afternoon(t) {
  for (let level = 7; level <= 10; level++) {
    assert.equal(t.ladder.level, level);
    const start = t.due;
    for (let i = 0; i < LT.spec(level).count; i++) {
      const due = t.due;
      assert.equal(LT.begin(t, due), true);
      LT.answer(t, due + 19000, true);
    }
    assert.equal(t.due, start + HOUR);
    LT.update(t, t.due);
  }
}
function dailyTone(at) {
  const t = {f: 1047, start: at - HOUR, last: at - HOUR, wait: 24 * HOUR, ready: true};
  LT.migrate(t, at);
  return t;
}

test('25 successes at fixed guess slots finish the opening at exactly one hour', () => {
  const at = morning(), t = LT.createTone(1047, at), slots = opening(t, at);
  assert.deepEqual(slots, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18,
    20, 22.5, 25, 27.5, 30, 30 + 10 / 3, 30 + 20 / 3, 40, 45, 50].map(m => Math.round(m * MIN)));
  assert.equal(t.ladder.level, 7);
  assert.equal(t.ladder.running, false);
  assert.equal(t.due, at + HOUR);
});

test('an early answer cannot shorten the next slot or skip the last spacing interval', () => {
  const at = morning(), t = LT.createTone(1047, at);
  LT.begin(t, at); LT.answer(t, at + 1, true);
  assert.equal(t.due, at + MIN);
  assert.equal(LT.begin(t, at + 2), false);
  assert.equal(t.ladder.count, 1);
  const saved = copy(t);
  assert.equal(LT.update(saved, at + MIN - 1), null);
  LT.update(saved, at + MIN);
  assert.equal(saved.ladder.deadline, at + MIN + 20000);
});

test('a deadline is enforced at 20 seconds and missed slots never merge into successes', () => {
  const at = morning(), t = LT.createTone(1047, at);
  LT.begin(t, at);
  assert.equal(LT.answer(t, at + 20000, true).reason, 'timeout');
  assert.equal(t.ladder.count, 0);
  assert.equal(t.ladder.running, false);
  LT.begin(t, at + MIN); LT.answer(t, at + MIN + 1000, true);
  assert.equal(LT.update(t, at + 10 * MIN).reason, 'timeout');
  assert.equal(t.ladder.level, 1);
});

test('misses end the attempt and use the requested level 1/2/3 fallback rules', () => {
  for (let level = 1; level <= 16; level++) {
    const at = morning(), t = LT.createTone(1047, at);
    Object.assign(t.ladder, {level, mode: 'guess', deadline: at + 20000, running: level <= 6, count: 2});
    const result = LT.answer(t, at + 1000, false);
    assert.equal(result.level, level === 16 ? 11 : level === 2 ? 2 : Math.max(1, level - 1));
    assert.equal(t.ladder.count, 0);
    assert.equal(t.ladder.mode, 'failed');
    assert.equal(t.ladder.running, false);
  }
});

test('levels 7–10 each fill an hour and keep all 10/15/20/30/45-minute intervals', () => {
  const at = morning(), t = LT.createTone(1047, at);
  opening(t, at); afternoon(t);
  assert.equal(t.due, at + 5 * HOUR);
  assert.equal(t.ladder.level, 11);
  assert.deepEqual(t.ladder.days, [LT.key(at)]);
  assert.equal(t.ladder.badge, false);
});

test('late later check-ins cannot schedule an immediate second test at the same gap', () => {
  const at = morning(), t = LT.createTone(1047, at);
  Object.assign(t.ladder, {level: 7, mode: 'ready'});
  LT.begin(t, at + HOUR); LT.answer(t, at + HOUR + 1000, true);
  assert.equal(t.due, at + HOUR + 1000 + 10 * MIN);
});

test('the checkpoint requires two distinct dates, repeats through the day, and starts at level 11 afterward', () => {
  const at = morning(), t = LT.createTone(1047, at);
  opening(t, at); afternoon(t);
  for (let i = 0; i < 3; i++) { const due = t.due; LT.begin(t, due); LT.answer(t, due + 1000, true); }
  assert.equal(t.ladder.days.length, 1);
  assert.equal(t.ladder.level, 11);
  LT.update(t, morning(12));
  assert.equal(t.ladder.level, 1);
  opening(t, morning(12)); afternoon(t);
  assert.equal(t.ladder.badge, true);
  assert.equal(t.ladder.extended, false);
  LT.update(t, morning(13));
  assert.equal(t.ladder.level, 11);
  assert.equal(t.ladder.extended, true);
});

test('the earned checkpoint advances through actual 1/2/4/8-hour waits to daily', () => {
  const at = morning(), t = LT.createTone(1047, at);
  Object.assign(t.ladder, {level: 11, mode: 'ready', badge: true, extended: true});
  LT.begin(t, at); LT.answer(t, at + 1000, true);
  for (let level = 12; level <= 15; level++) {
    assert.equal(t.ladder.level, level);
    assert.equal(LT.begin(t, t.due - 1), false);
    const due = t.due;
    LT.begin(t, due); LT.answer(t, due + 1000, true);
  }
  assert.equal(t.ladder.level, 16);
  assert.equal(t.ready, true);
  assert.equal(t.due, LT.tomorrow(t.last || at + 15 * HOUR + 5000));
});

test('daily checks accept any time today, reject duplicates, and do not impose a rolling 24-hour wait', () => {
  const at = +new Date(2026, 9, 11, 23, 58), t = dailyTone(at);
  assert.equal(LT.begin(t, at), true);
  assert.equal(LT.answer(t, at + 1000, true).type, 'daily-done');
  assert.equal(LT.begin(t, at + 2000), false);
  const next = +new Date(2026, 9, 12, 0, 1);
  LT.update(t, next);
  assert.equal(LT.begin(t, next), true);
  assert.equal(LT.answer(t, next + 1000, true).type, 'daily-done');
  assert.equal(t.ladder.level, 16);
});

test('a whole missed local date drops daily training to level 11; a same-day late check does not', () => {
  const at = morning(), t = dailyTone(at);
  LT.begin(t, at); LT.answer(t, at + 1000, true);
  const saved = copy(t);
  assert.equal(LT.update(saved, +new Date(2026, 9, 12, 23, 59)), null);
  const failed = LT.update(t, morning(13));
  assert.equal(failed.reason, 'missed-day');
  assert.equal(t.ladder.level, 11);
  assert.equal(t.ladder.extended, true);
  assert.equal(t.due, morning(13) + 45 * MIN);
  LT.update(t, morning(14));
  assert.equal(t.ladder.level, 11);
  assert.equal(t.ladder.extended, true);
});

test('daily eligibility handles both daylight saving changes as calendar dates', () => {
  for (const at of [+new Date(2026, 2, 7, 23), +new Date(2026, 9, 31, 23)]) {
    const t = dailyTone(at);
    LT.begin(t, at); LT.answer(t, at + 1000, true);
    const next = new Date(at); next.setDate(next.getDate() + 1); next.setHours(23);
    assert.equal(LT.update(t, +next), null);
    assert.equal(LT.begin(t, +next), true);
    LT.answer(t, +next + 1000, true);
    assert.equal(t.ladder.level, 16);
  }
});

test('starting before midnight does not extend a missed calendar day into the next date', () => {
  const first = morning(), t = dailyTone(first);
  LT.begin(t, first); LT.answer(t, first + 1000, true);
  const start = +new Date(2026, 9, 12, 23, 59, 55);
  LT.begin(t, start);
  assert.equal(LT.answer(t, start + 10000, true).reason, 'missed-day');
  assert.equal(t.ladder.level, 11);
});

test('migration preserves established intervals and saved legacy corrections; a restart resets only one note', () => {
  const at = morning(), t = {f: 1047, wait: 4 * HOUR, due: at + HOUR, last: at - HOUR, blk: {}};
  assert.equal(LT.migrate(t, at), true);
  assert.equal(t.ladder.level, 14);
  assert.equal(t.due, at + HOUR);
  assert.equal(t.blk, undefined);
  const pending = {f: 523, wait: MIN, practice: ['find'], retune: {streak: 1}};
  assert.equal(LT.migrate(pending, at), false);
  const tones = [t, pending], before = copy(pending);
  tones[0] = LT.createTone(t.f, at);
  assert.equal(tones[0].ladder.level, 1);
  assert.equal(tones[0].ladder.badge, false);
  assert.deepEqual(tones[1], before);
});

test('falling back into level 11 does not award a successful-day badge', () => {
  const t = dailyTone(morning());
  LT.begin(t, morning()); LT.answer(t, morning() + 1000, false);
  assert.equal(t.ladder.days.length, 0);
  assert.equal(t.ladder.badge, false);
  Object.assign(t.ladder, {level: 12, mode: 'guess', deadline: morning(12) + 20000});
  LT.answer(t, morning(12) + 1000, false);
  assert.equal(t.ladder.days.length, 0);
  assert.equal(t.ladder.badge, false);
});
