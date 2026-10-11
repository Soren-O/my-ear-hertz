import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import LTLevels from '../long-term-levels.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const section = (from, to) => script.slice(script.indexOf(from), script.indexOf(to, script.indexOf(from)));

function countIn(reduced = true) {
  let now = 0, id = 0;
  const timers = new Map(), elements = new Map(), animations = [];
  const $ = name => {
    if (!elements.has(name)) elements.set(name, {hidden:true,dataset:{},textContent:'',focus(){},setAttribute(){},
      querySelector(){return {animate(frames,options){const a={frames,options,cancel(){this.cancelled=true;}};animations.push(a);return a;}};}});
    return elements.get(name);
  };
  const context = vm.createContext({$, document:{activeElement:null}, reduceMotion:{matches:reduced},
    setTimeout(fn, delay) { const key = ++id; timers.set(key, {fn,at:now+delay}); return key; },
    clearTimeout(key) { timers.delete(key); }
  });
  vm.runInContext(section('const textFades =', 'let pageGhost ='), context);
  vm.runInContext(section('let introActive = false', "$('countInCancel').addEventListener"), context);
  return {$, animations, start:context.startCountIn, cancel:context.cancelCountIn, cue:context.showCountInCue, hide:context.hideCountInCue,
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

test('every cue has its own visible screen and shrinks from large text, without painting two words together', () => {
  const ui=countIn(false), visible=()=>['ready','set','go'].filter(s=>!ui.$('cue-'+s).hidden);
  ui.start(()=>{},'LEVEL 1'); assert.deepEqual(visible(),['ready']);
  assert.equal(ui.animations[0].frames[0].transform,'scale(1.35)');
  assert.equal(ui.animations[0].frames[2].transform,'scale(1)');
  ui.advance(800); assert.deepEqual(visible(),['set']); assert.equal(ui.animations[0].cancelled,true);
  ui.advance(800); assert.deepEqual(visible(),['go']); assert.equal(ui.animations[1].cancelled,true);
  ui.advance(800); assert.deepEqual(visible(),[]); assert.equal(ui.animations[2].cancelled,true);
});

test('long-term cue ticks do not restart the shrink animation, and hiding them releases the app', () => {
  const ui=countIn(false);
  ui.cue('ready','LEVEL 1','ladder'); ui.cue('ready','LEVEL 1','ladder');
  assert.equal(ui.animations.length,1);
  assert.equal(ui.$('app').inert,true);
  ui.cue('set','LEVEL 1','ladder'); assert.equal(ui.$('cue-ready').hidden,true);
  assert.equal(ui.$('cue-set').hidden,false);
  ui.hide('ladder'); assert.equal(ui.$('countIn').hidden,true); assert.equal(ui.$('app').inert,false);
});

function gestures() {
  const handlers = new Map(), moves = []; let allowed=true, releases=0;
  const pad={addEventListener(type,fn){handlers.set(type,fn);},setPointerCapture(){},classList:{add(){},remove(){}}};
  const context=vm.createContext({});
  vm.runInContext(section('function bindTunePad(', 'bindTunePad(document.body,'),context);
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

test('whole-screen swiping leaves buttons and dialogs available for normal taps', () => {
  const g=gestures();
  const target={closest:()=>({})};
  g.event('pointerdown',{target}); g.event('pointermove',{clientY:20}); g.event('pointerup');
  assert.deepEqual(g.moves,[]);
  g.event('pointerdown',{target:{closest:()=>null}}); g.event('pointermove',{clientY:80}); g.event('pointerup');
  assert.deepEqual(g.moves,[40]);
});

test('text fades finish the old label before revealing the new one, without restarting on clock ticks', () => {
  const animations=[], el={textContent:'Listen',hidden:false,animate(){
    const a={cancel(){this.cancelled=true;}}; animations.push(a); return a;
  }};
  const context=vm.createContext({reduceMotion:{matches:false}});
  vm.runInContext(section('const textFades =','let pageGhost ='),context);
  context.fadeText(el,'Tune'); context.fadeText(el,'Tune');
  assert.equal(el.textContent,'Listen'); assert.equal(animations.length,1);
  animations[0].onfinish();
  assert.equal(el.textContent,'Tune'); assert.equal(animations.length,2);
  animations[1].onfinish(); context.fadeText(el,'Tune');
  assert.equal(animations.length,2);
});

test('a new phase cancels an unfinished text fade so a stale label cannot return', () => {
  const animations=[], el={textContent:'Listen',hidden:false,animate(){
    const a={cancel(){this.cancelled=true;}}; animations.push(a); return a;
  }};
  const context=vm.createContext({reduceMotion:{matches:false}});
  vm.runInContext(section('const textFades =','let pageGhost ='),context);
  context.fadeText(el,'Random notes'); context.fadeText(el,'Get ready');
  assert.equal(animations[0].cancelled,true);
  animations[0].onfinish(); assert.equal(el.textContent,'Listen');
  animations[1].onfinish(); assert.equal(el.textContent,'Get ready');
});

test('waves start identically at random guesses and follow only changes to the guess, never the target', () => {
  const context=vm.createContext({clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),reduceMotion:{matches:false}});
  vm.runInContext(`
    let screen='train', phase='listening', trial={task:'find',guess:200,f:1000};
    let bandTrial=null, bandStartHz=0, bandPitch=1, bandTargetPitch=1;
    const deckHz=t=>t.guess;
    ${section('function syncBandPitch()', 'function placeBand()')}
    globalThis.ui={sync:syncBandPitch,setGuess(f){trial.guess=f;},setTarget(f){trial.f=f;},
      newTrial(f){trial={task:'find',guess:f,f:2000};},reveal(){phase='revealed';},
      get scale(){return bandTargetPitch;}};
  `,context);
  const ui=context.ui;
  ui.sync(); assert.equal(ui.scale,1);
  ui.setTarget(8000); ui.sync(); assert.equal(ui.scale,1);
  ui.setGuess(400); ui.sync(); assert.ok(ui.scale>1);
  ui.setGuess(100); ui.sync(); assert.ok(ui.scale<1);
  ui.newTrial(5000); ui.sync(); assert.equal(ui.scale,1);
  ui.setGuess(10000); ui.sync(); assert.equal(ui.scale,Math.pow(2,.35));
  ui.reveal(); ui.sync(); assert.equal(ui.scale,1);
});
