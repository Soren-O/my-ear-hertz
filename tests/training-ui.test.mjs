import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import LTLevels from '../long-term-levels.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const section = (from, to) => script.slice(script.indexOf(from), script.indexOf(to, script.indexOf(from)));

function countIn() {
  let now = 0, id = 0;
  const timers = new Map(), elements = new Map();
  const $ = name => {
    if (!elements.has(name)) elements.set(name, {hidden:true,dataset:{},textContent:'',focus(){}});
    return elements.get(name);
  };
  const context = vm.createContext({$, document:{activeElement:null}, reduceMotion:{matches:true},
    setTimeout(fn, delay) { const key = ++id; timers.set(key, {fn,at:now+delay}); return key; },
    clearTimeout(key) { timers.delete(key); }
  });
  vm.runInContext(section('let introActive = false', "$('countInCancel').addEventListener"), context);
  return {$, start:context.startCountIn, cancel:context.cancelCountIn,
    advance(ms) {
      const end = now+ms;
      for (;;) {
        const next = [...timers].sort((a,b)=>a[1].at-b[1].at)[0];
        if (!next || next[1].at>end) break;
        now=next[1].at; timers.delete(next[0]); next[1].fn();
      }
      now=end;
    }, get now(){return now;}
  };
}

test('Ready, Set, Go precedes the guess deadline and long-term anchor', () => {
  const ui=countIn(), tone=LTLevels.createTone(1047,0);
  ui.start(()=>LTLevels.begin(tone,ui.now),'LEVEL 1');
  assert.equal(ui.$('countInWord').textContent,'READY');
  assert.equal(ui.$('app').inert,true);
  assert.equal(tone.ladder.deadline,undefined);
  ui.advance(800); assert.equal(ui.$('countInWord').textContent,'SET');
  ui.advance(800); assert.equal(ui.$('countInWord').textContent,'GO!');
  ui.advance(799); assert.equal(tone.ladder.deadline,undefined);
  ui.advance(1);
  assert.equal(tone.ladder.deadline,22400);
  assert.equal(ui.$('countIn').hidden,true);
  assert.equal(ui.$('app').inert,false);
  LTLevels.answer(tone,3400,true);
  assert.equal(tone.due,62400);
});

test('cancelling a count-in cannot start an abandoned attempt or keep the app inert', () => {
  const ui=countIn(); let starts=0;
  ui.start(()=>starts++,'LEVEL 1'); ui.advance(900); ui.cancel(); ui.advance(5000);
  assert.equal(starts,0);
  assert.equal(ui.$('app').inert,false);
  assert.equal(ui.$('countIn').hidden,true);
  ui.start(()=>starts++,'ECHO'); ui.advance(2400);
  assert.equal(starts,1);
});

function gestures() {
  const handlers = new Map(), moves = []; let allowed=true, releases=0;
  const pad={addEventListener(type,fn){handlers.set(type,fn);},setPointerCapture(){},classList:{add(){},remove(){}}};
  const context=vm.createContext({});
  vm.runInContext(section('function bindTunePad(', "bindTunePad($('pad'),"),context);
  context.bindTunePad(pad,{can:()=>allowed,move:d=>moves.push(d),release:()=>releases++});
  const event=(type,extra={})=>handlers.get(type)({pointerId:1,clientX:100,clientY:100,button:0,isPrimary:true,
    deltaX:0,deltaY:0,deltaMode:0,preventDefault(){},...extra});
  return {moves,event,allow(v){allowed=v;},get releases(){return releases;}};
}

test('vertical and horizontal swipes raise/lower pitch, with ten times the range vertically', () => {
  const g=gestures();
  g.event('pointerdown'); g.event('pointermove',{clientY:80}); g.event('pointerup');
  g.event('pointerdown'); g.event('pointermove',{clientX:120}); g.event('pointerup');
  assert.deepEqual(g.moves,[40,4]);
  g.event('pointerdown'); g.event('pointermove',{clientY:120}); g.event('pointerup');
  g.event('pointerdown'); g.event('pointermove',{clientX:80}); g.event('pointerup');
  assert.deepEqual(g.moves,[40,4,-40,-4]);
});

test('a fine swipe stays fine across diagonal drift, ignores other fingers, and releases on cancellation', () => {
  const g=gestures();
  g.event('pointerdown'); g.event('pointermove',{clientX:103,clientY:102});
  assert.equal(g.moves.length,0);
  g.event('pointermove',{clientX:110,clientY:102});
  g.event('pointerdown',{pointerId:2,clientX:200});
  g.event('pointermove',{pointerId:2,clientX:300});
  g.event('pointerup',{pointerId:2});
  g.event('pointermove',{clientX:120,clientY:160});
  assert.deepEqual(g.moves,[2,2]);
  g.event('pointercancel'); assert.equal(g.releases,1);
  g.event('pointermove',{clientX:300}); assert.equal(g.moves.length,2);
});

test('a deadline or feedback screen prevents continued pitch changes from a held gesture', () => {
  const g=gestures();
  g.event('pointerdown'); g.event('pointermove',{clientY:80});
  g.allow(false); g.event('pointermove',{clientY:60});
  g.event('pointerdown'); g.event('wheel',{deltaY:-10});
  assert.deepEqual(g.moves,[40]);
});

test('scroll and trackpad input use the same coarse/fine directions and normalize line scrolling', () => {
  const g=gestures();
  g.event('wheel',{deltaY:-10}); g.event('wheel',{deltaX:10});
  g.event('wheel',{deltaY:-10,shiftKey:true}); g.event('wheel',{deltaY:-1,deltaMode:1});
  assert.deepEqual(g.moves,[20,2,2,32]);
});
