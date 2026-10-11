/* Calendar dates are local dates. A daily check is due anywhere in that date, not 24 hours after a tap. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LTLevels = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const MIN = 60000, HOUR = 60 * MIN, DEADLINE = 20000;
  const levels = [
    [1, 10, 10], [2, 5, 10], [2.5, 4, 10], [10 / 3, 3, 10], [5, 2, 10], [10, 1, 10],
    [10, 6, 60], [15, 4, 60], [20, 3, 60], [30, 2, 60], [45, 0, 0],
    [60, 1, 0], [120, 1, 0], [240, 1, 0], [480, 1, 0], [1440, 1, 0]
  ].map(([minutes, count, duration], i) => ({level: i + 1, gap: Math.round(minutes * MIN), count, duration: duration * MIN}));
  const spec = n => levels[n - 1];
  const key = at => { const d = new Date(at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const midnight = at => { const d = new Date(at); d.setHours(0, 0, 0, 0); return +d; };
  const tomorrow = at => { const d = new Date(at); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); return +d; };
  const ordinal = day => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  function enter(t, level, at, immediate = true, qualify = false) {
    const s = t.ladder;
    Object.assign(s, {level, count: 0, anchor: at, day: key(at), mode: 'ready', running: false});
    delete s.deadline;
    t.wait = spec(level).gap;
    t.due = immediate ? at : at + t.wait;
    if (level === 11 && qualify) {
      s.days = [...new Set([...s.days, key(at)])];
      if (s.days.length >= 2 && !s.badge) { s.badge = true; s.badgeDay = key(at); }
    }
    if (level === 16) { t.ready = true; s.dailyOn = key(at); t.due = tomorrow(at); }
  }
  function createTone(f, now) {
    const t = {f, start: now, ladder: {version: 1, days: [], badge: false, extended: false}};
    enter(t, 1, now);
    return t;
  }
  function migrate(t, now) {
    if (t.ladder || t.practice?.length || t.card) return false;
    const wait = t.wait || MIN, level = t.ready || wait >= 24 * HOUR ? 16 :
      levels.reduce((n, l) => l.level < 16 && l.gap <= wait ? l.level : n, 1);
    t.ladder = {version: 1, days: [], badge: false, extended: level > 11};
    const due = t.due;
    enter(t, level, now);
    if (level === 16) { t.ladder.dailyOn = null; t.due = midnight(now); }
    else t.due = level <= 6 ? now : due || now;
    delete t.blk; delete t.retune;
    return true;
  }
  function fail(t, now, reason = 'miss') {
    const s = t.ladder, tested = s.level;
    const level = tested === 16 ? 11 : tested === 2 ? 2 : Math.max(1, tested - 1);
    // Failing the daily test keeps the earned checkpoint, but the longer gaps must be earned again.
    if (tested === 16) s.extended = true;
    enter(t, level, now, level <= 6);
    s.mode = 'failed'; s.reason = reason;
    delete s.dailyOn;
    return {type: 'failed', tested, level, reason};
  }
  function update(t, now) {
    const s = t.ladder;
    if (s.mode === 'guess' && now >= s.deadline) return fail(t, now, 'timeout');
    if (s.level === 16) {
      if (s.dailyOn && ordinal(key(now)) - ordinal(s.dailyOn) > 1) return fail(t, now, 'missed-day');
      t.due = s.dailyOn === key(now) ? tomorrow(now) : midnight(now);
      return null;
    }
    if (s.mode === 'boundary' && now >= t.due) {
      const at = t.due, running = s.running, level = s.level + 1;
      enter(t, level, at, true, level === 11);
      if (running && level <= 6) { s.running = true; s.mode = 'guess'; s.deadline = at + DEADLINE; }
      return {type: 'advanced', level};
    }
    if (s.running) {
      if (s.mode === 'wait' && now >= t.due) { s.mode = 'guess'; s.deadline = t.due + DEADLINE; }
      if (s.mode === 'guess' && now >= s.deadline) return fail(t, now, 'timeout');
      return null;
    }
    if (s.level <= 11 && s.day !== key(now)) {
      const checkpoint = s.badge || s.extended;
      s.extended = checkpoint;
      enter(t, checkpoint ? 11 : 1, now);
    }
    return null;
  }
  function begin(t, now) {
    if (t.ladder.mode === 'guess' || t.ladder.running) return false;
    update(t, now);
    const s = t.ladder;
    if (s.level === 16 && s.dailyOn === key(now) || s.level > 6 && t.due > now) return false;
    if (s.level <= 6 && !s.running) { s.anchor = now; s.count = 0; t.due = now; s.day = key(now); }
    s.running = s.level <= 6;
    s.mode = 'guess'; s.deadline = now + DEADLINE;
    return true;
  }
  function answer(t, now, ok) {
    const s = t.ladder;
    if (s.mode !== 'guess') return null;
    if (now >= s.deadline) return fail(t, now, 'timeout');
    if (s.level === 16 && s.dailyOn && ordinal(key(now)) - ordinal(s.dailyOn) > 1) return fail(t, now, 'missed-day');
    if (!ok) return fail(t, now);
    const l = spec(s.level), due = t.due;
    delete s.deadline;
    s.count++;
    if (s.level === 16) {
      s.dailyOn = key(now); s.mode = 'ready'; t.due = tomorrow(now); t.wait = 24 * HOUR;
      return {type: 'daily-done', level: 16};
    }
    if (s.level >= 12 || s.level === 11 && s.extended) {
      enter(t, s.level + 1, now, false);
      return {type: 'advanced', level: s.level};
    }
    if (s.level === 11) { s.mode = 'ready'; t.due = now + l.gap; return {type: 'held', level: 11}; }
    s.mode = s.count >= l.count ? 'boundary' : 'wait';
    t.due = s.level <= 6 ? s.anchor + s.count * l.gap : now >= due + l.gap ? now + l.gap : due + l.gap;
    if (s.mode === 'boundary' && s.level <= 6) t.due = s.anchor + l.duration;
    if (s.level > 6) s.running = false;
    return {type: 'correct', level: s.level, count: s.count};
  }
  return {levels, spec, key, midnight, tomorrow, createTone, migrate, begin, answer, update, fail, DEADLINE};
});
