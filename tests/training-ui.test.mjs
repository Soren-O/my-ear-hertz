import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import LTLevels from '../long-term-levels.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const section = (from, to) => script.slice(script.indexOf(from), script.indexOf(to, script.indexOf(from)));

test('guessed notes keep their octave and use a spaced signed cents offset', () => {
  const context = vm.createContext({});
  vm.runInContext(section('const NOTE =', 'const FMIN =') + 'globalThis.label = noteOffsetLabel;', context);
  assert.equal(context.label(1047), 'C6');
  assert.equal(context.label(1047 * 2 ** (15 / 1200)), 'C6 + 15c');
  assert.equal(context.label(1047 * 2 ** (-15 / 1200)), 'C6 − 15c');
  assert.equal(context.label(2093 * 2 ** (25 / 1200)), 'C7 + 25c');
});

test('confetti launches around the visible target instead of the hidden old note button and clears afterward', () => {
  const frames=[],particles=[],math=Object.create(Math);
  math.random=()=>0.5;
  const drawing={setTransform(){},clearRect(){},save(){},translate(x,y){particles.push([x,y]);},rotate(){},fillRect(){},restore(){}};
  const canvas={getContext:()=>drawing},hidden={left:0,top:0,width:0,height:0};
  const rects={ltTargetPitch:{left:70,top:280,width:150,height:112},playBtn:hidden,scoreRing:hidden};
  const context=vm.createContext({$:id=>id==='confetti'?canvas:{getBoundingClientRect:()=>rects[id]},
    Math:math,window:{devicePixelRatio:1},innerWidth:390,innerHeight:844,performance:{now:()=>0},
    waveColors:()=>['#fff'],oklchRgb:()=> '#0f0',requestAnimationFrame:frame=>frames.push(frame)});
  vm.runInContext(section('function confetti(){','/* ---------- lab ----------'),context);
  context.confetti(); frames.shift()(16);
  assert.equal(particles.length,150);
  assert.ok(particles.every(([x,y])=>x>=70&&x<=220&&y>=280&&y<=392));
  frames.shift()(2400); assert.equal(frames.length,0);
});

function countIn(reduced = true) {
  let now = 0, id = 0;
  const timers = new Map(), elements = new Map(), animations = [], sounds = [], pitches = [], errors = [];
  let resumeAudio, rejectAudio, stops = 0;
  const sine = {id:'sine'}, engine = {state:'running',currentTime:0,
    resume() { return new Promise((resolve,reject)=>{resumeAudio=()=>{engine.state='running';resolve();};rejectAudio=reject;}); }
  };
  const $ = name => {
    if (!elements.has(name)) elements.set(name, {hidden:true,dataset:{},textContent:'',focus(){},setAttribute(){},
      querySelector(){return name==='cue-target'?null:{animate(frames,options){const a={frames,options,cancel(){this.cancelled=true;}};animations.push(a);return a;}};}});
    return elements.get(name);
  };
  const context = vm.createContext({$, document:{activeElement:null}, reduceMotion:{matches:reduced},
    sfx:step=>{if(engine.state==='running')sounds.push([step,now]);}, audio:()=>engine, SINE:sine,
    stopAll:()=>stops++, voiceReady:voice=>voice!==sine, ampFor:()=>0, noteName:f=>({523:'C5',1047:'C6',2093:'C7'})[f],
    tone:(f,at,dur)=>pitches.push(['sine',f,at,dur]), strike:(voice,f,at,opts)=>pitches.push([voice.id,f,at,opts.dur]),
    noteAnchor(){}, setAudio(){}, showError:message=>errors.push(message),
    setTimeout(fn, delay) { const key = ++id; timers.set(key, {fn,at:now+delay}); return key; },
    clearTimeout(key) { timers.delete(key); }
  });
  vm.runInContext(section('const textFades =', 'let pageGhost ='), context);
  vm.runInContext(section('let introActive = false', "$('countInCancel').addEventListener"), context);
  return {$, animations, sounds, pitches, errors, sine, start:context.startCountIn, cancel:context.cancelCountIn, cue:context.showCountInCue, hide:context.hideCountInCue,
    suspend(){engine.state='suspended';}, resume(){resumeAudio();}, reject(){rejectAudio(new Error('blocked'));}, get stops(){return stops;},
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
  assert.deepEqual(ui.sounds,[['ready',0],['set',800]]);
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
  assert.deepEqual(ui.sounds,[['ready',0]]);
  assert.equal(ui.$('app').inert,true);
  ui.cue('set','LEVEL 1','ladder'); assert.equal(ui.$('cue-ready').hidden,true);
  assert.equal(ui.$('cue-set').hidden,false);
  ui.hide('ladder'); assert.equal(ui.$('countIn').hidden,true); assert.equal(ui.$('app').inert,false);
});

test('each count-in sound starts with its word, and Go finishes before the question begins', () => {
  const ui=countIn(); let began;
  ui.start(()=>began=ui.now,'LEVEL 1'); ui.advance(2400);
  assert.deepEqual(ui.sounds,[['ready',0],['set',800],['go',1600]]);
  const context=vm.createContext({});
  vm.runInContext(section('const SFX =', 'let tickAt =')+'globalThis.effects=SFX;',context);
  for (const [step,at] of ui.sounds) assert.ok(at+context.effects[step].dur*1000+50<began);
});

test('the first Ready waits for the suspended audio engine, so its sound is not skipped', async () => {
  const ui=countIn(); let starts=0;
  ui.suspend(); ui.start(()=>starts++,'ECHO'); ui.advance(1000);
  assert.equal(ui.$('countIn').hidden,true);
  assert.deepEqual(ui.sounds,[]); assert.equal(starts,0);
  ui.resume(); await Promise.resolve();
  assert.equal(ui.$('countInWord').textContent,'READY');
  assert.deepEqual(ui.sounds,[['ready',1000]]);
  ui.advance(2400); assert.equal(starts,1);
  assert.deepEqual(ui.sounds,[['ready',1000],['set',1800],['go',2600]]);
});

test('cancelling or failing audio startup cannot produce delayed cues or start a guess', async () => {
  const cancelled=countIn(); let starts=0;
  cancelled.suspend(); cancelled.start(()=>starts++,'LEVEL 1'); cancelled.cancel(); cancelled.resume();
  await Promise.resolve(); cancelled.advance(5000);
  assert.equal(starts,0); assert.deepEqual(cancelled.sounds,[]);
  const failed=countIn(); failed.suspend(); failed.start(()=>starts++,'LEVEL 1'); failed.reject();
  await Promise.resolve(); await Promise.resolve(); failed.advance(5000);
  assert.equal(starts,0); assert.deepEqual(failed.sounds,[]);
  assert.equal(failed.$('app').inert,false); assert.equal(failed.errors.length,1);
});

test('one target preview precedes Ready, Set, Go and the guess deadline starts only afterward', () => {
  const ui=countIn(), tone=LTLevels.createTone(1047,0);
  ui.start(()=>LTLevels.begin(tone,ui.now),'LEVEL 1',{f:1047,voice:ui.sine});
  assert.equal(ui.$('cue-target').hidden,false); assert.equal(ui.$('countInWord').textContent,'LISTEN');
  assert.deepEqual(ui.pitches,[['sine',1047,.03,3]]); assert.deepEqual(ui.sounds,[]);
  ui.advance(3099); assert.equal(tone.ladder.deadline,undefined);
  ui.advance(1); assert.equal(ui.$('cue-target').hidden,true); assert.equal(ui.$('cue-ready').hidden,false);
  ui.advance(2399); assert.equal(tone.ladder.deadline,undefined);
  ui.advance(1); assert.equal(tone.ladder.deadline,25500);
  assert.deepEqual(ui.sounds,[['ready',3100],['set',3900],['go',4700]]);
  LTLevels.answer(tone,6500,true); assert.equal(tone.due,65500);
});

test('an instrument target is struck once, and cancelling its preview stops playback and all later cues', () => {
  const ui=countIn(); let starts=0;
  ui.start(()=>starts++,'LEVEL 1',{f:1047,voice:{id:'piano'}});
  assert.deepEqual(ui.pitches,[['piano',1047,.03,3]]);
  const stops=ui.stops; ui.advance(1000); ui.cancel(); ui.advance(5000);
  assert.equal(ui.stops,stops+1); assert.equal(starts,0); assert.deepEqual(ui.sounds,[]);
  assert.equal(ui.$('cue-target').hidden,true); assert.equal(ui.$('app').inert,false);
});

test('C5, C6 and C7 each play with their label before one count-in and the first guess', () => {
  const ui=countIn(); let began;
  ui.start(()=>began=ui.now,'♪ Find',[523,1047,2093].map(f=>({f,voice:ui.sine})));
  assert.equal(ui.$('countInTargetNote').textContent,'C5');
  ui.advance(3099); assert.equal(ui.pitches.length,1); assert.equal(began,undefined);
  ui.advance(1); assert.equal(ui.$('countInTargetNote').textContent,'C6');
  ui.advance(3100); assert.equal(ui.$('countInTargetNote').textContent,'C7');
  assert.deepEqual(ui.pitches.map(p=>[p[1],p[3]]),[[523,3],[1047,3],[2093,3]]);
  assert.deepEqual(ui.sounds,[]); assert.equal(began,undefined);
  ui.advance(3100); assert.equal(ui.$('countInWord').textContent,'READY');
  ui.advance(2399); assert.equal(began,undefined);
  ui.advance(1); assert.equal(began,11700);
  assert.deepEqual(ui.sounds,[['ready',9300],['set',10100],['go',10900]]);
});

test('cancelling during a multi-note reference stops that note and prevents later notes and the count-in', () => {
  const ui=countIn(); let starts=0;
  ui.start(()=>starts++,'♪ Find',[523,1047,2093].map(f=>({f,voice:{id:'piano'}})));
  ui.advance(3500); assert.equal(ui.pitches.length,2);
  const stops=ui.stops; ui.cancel(); ui.advance(20000);
  assert.equal(ui.stops,stops+1); assert.equal(starts,0);
  assert.deepEqual(ui.pitches.map(p=>[p[0],p[1],p[3]]),[['piano',523,3],['piano',1047,3]]);
  assert.deepEqual(ui.sounds,[]); assert.equal(ui.$('app').inert,false);
});

test('pair and mixed C5–C7 Find levels preview only their notes, using the round instrument', () => {
  const intros=[], sine={id:'sine'}, voice={id:'piano'};
  const context=vm.createContext({SINE:sine,roundVoice:()=>voice,voiceReady:()=>true,audio:()=>({state:'running'}),
    $:()=>({}),lt:{tones:[]},go(){},nextQuestion(){},
    startCountIn:(begin,label,reference)=>intros.push({begin,reference})});
  vm.runInContext(`
    ${section('const NOTE =','const CHOICE_TASKS =')}
    let introActive=false,round=null,screen='home'; const settings={level:1};
    ${section('function startRound(', 'function nextQuestion()')}
    globalThis.api={levels:LEVELS,start(lv,extra={}){round=null;startRound(null,{lv,...extra});},get round(){return round;}};
  `,context);
  const {api}=context;
  const expected=new Map([[4,[523,1047]],[6,[1047,2093]],[7,[523,1047,2093]],
    [12,[523,1047]],[14,[1047,2093]],[15,[523,1047,2093]]]);
  for(let i=0;i<api.levels.length;i++){
    api.start(i+1);
    const references=intros.at(-1).reference;
    if (expected.has(i+1)) {
      assert.deepEqual(Array.from(references,r=>r.f),expected.get(i+1));
      assert.ok(references.every(r=>r.voice===voice));
      intros.at(-1).begin(); assert.equal(api.round.previewed,true);
    } else assert.equal(references,undefined,api.levels[i].name+' '+api.levels[i].short);
  }
  api.start(4,{practice:true}); assert.equal(intros.at(-1).reference,undefined);
  api.start(4,{lt:1047}); assert.equal(intros.at(-1).reference,undefined);
});

test('Level 1 starts with its reference and count-in; later long-term checks start cold without another count-in', () => {
  const references=[], starts=[], tone=LTLevels.createTone(1047,0), sine={id:'sine'};
  const context=vm.createContext({SINE:sine, lt:{tones:[tone]}, audio:()=>({state:'running'}), roundVoice:()=>sine,
    LTLevels:{begin:()=>true}, $:()=>({}), saveLT(){}, holdLadderScreen(){}, go(){}, nextQuestion:()=>starts.push('guess'),
    startCountIn:(begin,label,reference)=>references.push(reference)});
  vm.runInContext(`let introActive=false, round=null, ltSessionTone=null, screen='lt'; const settings={level:1}, LEVELS=[{short:'Find'}];
    ${section('function startRound(', 'function nextQuestion()')}
    globalThis.start=()=>startRound(undefined,{ladder:true,lt:1047,L:{choices:[1047]}});`,context);
  context.start(); assert.equal(references[0].f,1047); assert.equal(references[0].voice,sine);
  assert.equal(starts.length,0);
  tone.ladder.level=7; context.start();
  assert.equal(references.length,1); assert.deepEqual(starts,['guess']);
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
  assert.deepEqual(g.moves,[10,1]);
  g.event('pointerdown'); g.event('pointermove',{clientY:120}); g.event('pointerup');
  g.event('pointerdown'); g.event('pointermove',{clientX:80}); g.event('pointerup');
  assert.deepEqual(g.moves,[10,1,-10,-1]);
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
  assert.deepEqual(g.moves,[.5,.5]);
  g.event('pointercancel'); assert.equal(g.releases,1);
  g.event('pointermove',{clientX:300}); assert.equal(g.moves.length,2);
});

test('a deadline or feedback screen prevents continued pitch changes from a held gesture', () => {
  const g=gestures();
  g.event('pointerdown'); g.event('pointermove',{clientY:80});
  g.allow(false); g.event('pointermove',{clientY:60});
  g.event('pointerdown'); g.event('wheel',{deltaY:-10});
  assert.deepEqual(g.moves,[10]);
});

test('scroll and trackpad input use the same coarse/fine directions and normalize line scrolling', () => {
  const g=gestures();
  g.event('wheel',{deltaY:-10}); g.event('wheel',{deltaX:10});
  g.event('wheel',{deltaY:-10,shiftKey:true}); g.event('wheel',{deltaY:-1,deltaMode:1});
  assert.deepEqual(g.moves,[5,.5,.5,8]);
});

test('whole-screen swiping leaves buttons and dialogs available for normal taps', () => {
  const g=gestures();
  const target={closest:()=>({})};
  g.event('pointerdown',{target}); g.event('pointermove',{clientY:20}); g.event('pointerup');
  assert.deepEqual(g.moves,[]);
  g.event('pointerdown',{target:{closest:()=>null}}); g.event('pointermove',{clientY:80}); g.event('pointerup');
  assert.deepEqual(g.moves,[10]);
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
      newTrial(f){phase='listening';trial={task:'find',guess:f,f:2000};},reveal(){phase='revealed';},
      get scale(){return bandTargetPitch;},get paintedScale(){return bandPitch;},paint(f){bandPitch=f;}};
  `,context);
  const ui=context.ui;
  ui.sync(); assert.equal(ui.scale,1);
  ui.setTarget(8000); ui.sync(); assert.equal(ui.scale,1);
  ui.setGuess(400); ui.sync(); assert.ok(ui.scale>1);
  ui.setGuess(100); ui.sync(); assert.ok(ui.scale<1);
  ui.newTrial(5000); ui.sync(); assert.equal(ui.scale,1);
  ui.setGuess(10000); ui.sync(); assert.equal(ui.scale,Math.pow(2,.18));
  ui.paint(1.2); ui.reveal(); ui.sync();
  assert.equal(ui.scale,1.2); assert.equal(ui.paintedScale,1.2);
  ui.newTrial(3000); ui.sync(); assert.equal(ui.scale,1); assert.equal(ui.paintedScale,1.2);
});

test('ordinary rounds keep finite background waves and random-note phases turn the fuzz on and off', () => {
  const frames=[], context=vm.createContext({reduceMotion:{matches:false},document:{hidden:false},requestAnimationFrame:()=>1,
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),drawBand:t=>frames.push(t)});
  vm.runInContext(`
    let screen='train', phase='listening', round={}, audioState='adjust', bandRaf=0, bandLast=0, bandTime=0, bandPitch=1, bandTargetPitch=1, bandFuzz=0;
    const $=()=>({dataset:{stage:'tune'}});
    ${section('function updateBandMotion(', 'function drawBand(now)')}
    globalThis.ui={frame:bandLoop,setState(s){audioState=s;},get fuzz(){return bandFuzz;}};
  `,context);
  context.ui.frame(100); assert.equal(context.ui.fuzz,0);
  context.ui.setState('interfere'); context.ui.frame(200); assert.ok(context.ui.fuzz>0);
  const fuzzy=context.ui.fuzz;
  context.ui.setState('idle'); context.ui.frame(300); assert.ok(context.ui.fuzz<fuzzy);
  assert.ok(Number.isFinite(context.ui.fuzz));
  const before=frames.at(-1);
  context.ui.frame(10000);
  assert.ok(frames.at(-1)-before<=80.000001, 'a resumed frame advances the flowing waves gently instead of jumping to wall-clock time');
});

function waveMotion() {
  const context=vm.createContext({clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
  vm.runInContext(`let bandPitch=1,bandTargetPitch=1,bandFuzz=0,bandTime=0;
    ${section('function updateBandMotion(', 'function bandLoop(now)')}
    globalThis.ui={step:updateBandMotion,target(v){bandTargetPitch=v;},get pitch(){return bandPitch;},get fuzz(){return bandFuzz;},get time(){return bandTime;}};`,context);
  return context.ui;
}

test('large wavelength changes and a new question reset have a bounded speed without overshooting', () => {
  const waves=waveMotion(); waves.target(1.6);
  for (let i=0;i<150;i++) {
    const before=waves.pitch, dt=[1/60,1/30,1/15][i%3]; waves.step(dt,false);
    assert.ok(waves.pitch>=before && waves.pitch<1.6);
    assert.ok(waves.pitch-before<=.2*dt+1e-12);
  }
  assert.ok(waves.pitch>1.59);
  waves.target(1);
  for (let i=0;i<150;i++) {
    const before=waves.pitch; waves.step(1/30,false);
    assert.ok(waves.pitch<=before && waves.pitch>1);
    assert.ok(before-waves.pitch<=.2/30+1e-12);
  }
  assert.ok(waves.pitch<1.02);
});

test('small wavelength changes and fuzzy texture ease over seconds consistently across frame rates', () => {
  const thirty=waveMotion(), sixty=waveMotion(); thirty.target(1.08); sixty.target(1.08);
  for(let i=0;i<9;i++)thirty.step(1/30,true);
  for(let i=0;i<18;i++)sixty.step(1/60,true);
  assert.ok(thirty.pitch>1 && thirty.pitch<1.04, 'the waves are still easing after the old quarter-second transition');
  assert.ok(thirty.fuzz>0 && thirty.fuzz<.4);
  assert.ok(Math.abs(thirty.pitch-sixty.pitch)<1e-12);
  assert.ok(Math.abs(thirty.fuzz-sixty.fuzz)<1e-12);
  for(let i=0;i<72;i++)thirty.step(1/30,true);
  assert.ok(thirty.pitch>1.077 && thirty.pitch<1.08);
  assert.ok(thirty.fuzz>.97);
  const fuzzy=thirty.fuzz; thirty.step(.3,false);
  assert.ok(thirty.fuzz>fuzzy*.6 && thirty.fuzz<fuzzy);
});

test('answer transitions and replay hold the visible wavelength and lateral phase; random notes can animate again', () => {
  const waves=waveMotion(); waves.target(1.6); waves.step(.08,false);
  const pitch=waves.pitch,time=waves.time;
  for(let i=0;i<90;i++)waves.step(1/30,false,true);
  assert.equal(waves.pitch,pitch); assert.equal(waves.time,time);
  waves.step(1/30,true,false);
  assert.ok(waves.time>time); assert.ok(waves.fuzz>0);
});

test('wavelength changes hold the middle of every strand in place', () => {
  const middles=[];
  const ctx={clearRect(){},beginPath(){},moveTo(){},lineTo(x,y){if(x===195)middles.push(y);},stroke(){}};
  const context=vm.createContext({band:{width:390,height:844,getContext:()=>ctx},settings:{light:false},reduceMotion:{matches:false}});
  vm.runInContext(`let bandPitch=1,bandFuzz=0;
    ${section('function drawBand(now)', "document.addEventListener('visibilitychange', () => { if (!document.hidden) placeBand();")}
    globalThis.ui={draw:drawBand,pitch(v){bandPitch=v;}};`,context);
  context.ui.draw(1234); const before=middles.splice(0);
  context.ui.pitch(1.6); context.ui.draw(1234);
  assert.equal(before.length,15);
  assert.deepEqual(middles,before);
});

test('the shared note display hides Echo targets until submission and offers both answer replays afterward', () => {
  const elements=new Map(), $=id=>{
    if (!elements.has(id)) elements.set(id,{hidden:false,textContent:'',dataset:{},setAttribute(){}});
    return elements.get(id);
  };
  const context=vm.createContext({$,fadePhase:(el,key,update)=>update(),fadeVisibility:(el,visible)=>{el.hidden=!visible;},noteName:f=>f===1047?'C6':'A5',noteOffsetLabel:()=> 'A5 + 15c',fmtFreq:String,canAdjust:()=>true});
  vm.runInContext(`
    let round={echo:true,tuneCount:1}, trial={task:'find',f:1047,echo:true,heard:true}, phase='listening',last=null;
    ${section('function renderTrainingPitches(', 'function howto()')}
    globalThis.ui={render:renderTrainingPitches,reveal(){phase='revealed';last={f:1047,g:880,ok:0};},
      newFind(){round={tuneCount:2};trial={task:'find',f:1047};phase='listening';last=null;}};
  `,context);
  context.ui.render(true,false);
  assert.equal($('ltTargetNote').textContent,'?'); assert.equal($('ltTargetPitch').disabled,true);
  assert.equal($('ltGuessPitch').hidden,true); assert.equal($('ltSwipeHint').hidden,false);
  context.ui.reveal(); context.ui.render(true,false);
  assert.equal($('ltTargetNote').textContent,'C6'); assert.equal($('ltGuessNote').textContent,'A5 + 15c');
  assert.equal($('ltTargetPitch').disabled,false); assert.equal($('ltGuessPitch').disabled,false);
  assert.equal($('ltSwipeHint').hidden,true);
  context.ui.newFind(); context.ui.render(true,false);
  assert.equal($('ltTargetNote').textContent,'C6'); assert.equal($('ltGuessPitch').hidden,true);
  assert.equal($('ltSwipeHint').hidden,true);
});


test('phase fades retain outgoing text, use the latest clock tick, and do not restart on repeated renders', () => {
  const animations=[], el={hidden:false,textContent:'0:13',animate(frames,options){
    const a={frames,options,cancel(){this.cancelled=true;}}; animations.push(a); return a;
  }};
  const context=vm.createContext({reduceMotion:{matches:false}});
  vm.runInContext(section('const textFades =','let pageGhost ='),context);
  context.fadePhase(el,'find',()=>{el.textContent='0:13';});
  context.fadePhase(el,'listen',()=>{el.textContent='0:20';});
  context.fadePhase(el,'listen',()=>{el.textContent='0:19';});
  assert.equal(el.textContent,'0:13'); assert.equal(animations.length,1);
  assert.deepEqual(Array.from(animations[0].frames,f=>f.opacity),[1,0]);
  animations[0].onfinish();
  assert.equal(el.textContent,'0:19'); assert.equal(animations.length,2);
  assert.deepEqual(Array.from(animations[1].frames,f=>f.opacity),[0,1]);
  context.fadePhase(el,'listen',()=>{el.textContent='0:18';});
  assert.equal(el.textContent,'0:18'); assert.equal(animations.length,2);
});

test('disappearing controls fade before hiding, reject taps immediately, and can be restored without a stale hide', () => {
  const animations=[], el={hidden:false,setAttribute(){},animate(frames,options){
    const a={frames,options,cancel(){this.cancelled=true;}}; animations.push(a); return a;
  }};
  const context=vm.createContext({reduceMotion:{matches:false},getComputedStyle:()=>({opacity:'0.5'})});
  vm.runInContext(section('const textFades =','let pageGhost ='),context);
  context.fadeVisibility(el,false); context.fadeVisibility(el,false);
  assert.equal(el.hidden,false); assert.equal(el.inert,true); assert.equal(animations.length,1);
  context.fadeVisibility(el,true);
  assert.equal(animations[0].cancelled,true); assert.equal(el.inert,false);
  animations[0].onfinish(); assert.equal(el.hidden,false);
  animations[1].onfinish(); assert.equal(el.hidden,false);
  context.fadeVisibility(el,false); animations[2].onfinish(); assert.equal(el.hidden,true);
  context.reduceMotion.matches=true; context.fadeVisibility(el,true);
  assert.equal(el.hidden,false); assert.equal(animations.length,3);
});
