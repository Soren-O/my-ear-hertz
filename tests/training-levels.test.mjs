import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const section=(from,to)=>script.slice(script.indexOf(from),script.indexOf(to,script.indexOf(from)));
const plain=value=>JSON.parse(JSON.stringify(value));
function app(data={},random=()=>0.999) {
  const math=Object.create(Math);math.random=random;
  const stored=plain(data),context=vm.createContext({Math:math,store:{
    get:(key,fallback)=>key in stored?plain(stored[key]):fallback,
    set:(key,value)=>{stored[key]=plain(value);}
  }});
  vm.runInContext(`
    ${section('const NOTE =','/* ---------- formatting & math ---------- */')}
    const lt={unlocked:false,tones:[]},saveLT=()=>{};
    ${section('const isFindC6 =','lt.tones.forEach(t => {')}
    let round=null,trial=null,last=null,phase='idle';
    const SINE={id:'sine'},input={value:''},$=()=>({focus(){}});
    const levelOf=()=>round.L||LEVELS[round.lv-1],voiceRange=()=>[50,14000],makeStops=()=>({n:10,ti:5}),newRove=()=>0;
    const render=()=>{},showError=()=>{},showTip=()=>{},playPreview=()=>{},startAdj=()=>{},trainItf=()=>null;
    const startEchoTone=()=>{},armLadderClock=()=>{},play=()=>{},centerRoll=()=>{},logUniform=()=>880,checkHasCard=()=>false;
    ${section('const trainingStreak =','let introActive =')}
    ${section('function nextQuestion()','const playPreview =')}
    globalThis.api={settings,history,rounds,levels:LEVELS,oldLevels:PRE_PAIR_LEVELS,gateLv,findOneLv,goal:trainingGoal,
      start(lv,extra={}){round={lv,freeform:true,items:[],...extra};trial=null;},
      question(){nextQuestion();return trial.f;},
      answer(ok){const rec={task:'find',f:trial?.f||LEVELS[round.lv-1].choices[0],ok:Number(ok)};round.items.push(rec);recordTrainingStreak(rec);},
      get round(){return round;},get lt(){return lt;}};
  `,context);
  return {api:context.api,stored};
}

test('both opening passes find C6, C5, their pair, C7, its pair with C6, then all three',()=>{
  const {api}=app();
  const targets=[[1047],[523],[523,1047],[2093],[1047,2093],[523,1047,2093]];
  for(const wrap of ['note','both']) {
    const finds=api.levels.filter(L=>L.first&&L.wrap===wrap&&L.task==='find');
    assert.deepEqual(plain(finds.map(L=>L.choices)),targets);
    assert.equal(finds[2].short,`${wrap==='note'?'♪':'Hz'} Find C5 + C6`);
    assert.equal(finds[4].short,`${wrap==='note'?'♪':'Hz'} Find C6 + C7`);
    assert.equal(finds[2].pair,true);assert.equal(finds[4].pair,true);
  }
  assert.equal(api.findOneLv(1047),2);assert.equal(api.findOneLv(523),3);assert.equal(api.findOneLv(2093),5);
  assert.equal(api.gateLv(2093),5);
  assert.equal(api.levels[api.gateLv(262)-1].tier,1);
  assert.equal(api.levels.filter(L=>L.pair).length,4);
});

test('single-note and pair levels require ten consecutive hits while the three-note level requires twelve',()=>{
  const {api}=app();
  assert.equal(api.settings.level,1);assert.equal(api.settings.top,1);assert.equal(api.settings.ladder,6);
  api.start(2);for(let i=0;i<10;i++)api.answer(true);
  assert.equal(api.lt.unlocked,true);
  for(const [lv,next,goal] of [[3,4,10],[4,5,10],[5,6,10],[6,7,10],[7,8,12]]) {
    api.start(lv);
    assert.equal(api.goal(lv),goal);
    for(let i=0;i<goal-1;i++)api.answer(true);
    assert.equal(api.settings.top,lv);
    api.answer(false);assert.equal(api.settings.trainStreaks[lv],0);
    for(let i=0;i<goal-1;i++)api.answer(true);
    assert.equal(api.settings.top,lv);
    api.answer(true);assert.equal(api.settings.top,next);
    assert.equal(api.settings.trainBest[lv],goal);
  }
});

test('multi-note Find exercises cycle in order in both passes regardless of the random starting pitch',()=>{
  for(const random of [()=>0,()=>0.999]) {
    const {api}=app({},random);
    const wide=api.levels.findIndex(L=>L.task==='find'&&L.choices?.length===7)+1;
    for(const lv of [4,6,7,12,14,15,wide]) {
      api.start(lv);const choices=Array.from(api.levels[lv-1].choices),targets=[];
      for(let i=0;i<choices.length*3;i++){targets.push(api.question());api.answer(true);}
      assert.deepEqual(targets,[...choices,...choices,...choices]);
    }
  }
});

test('pair streaks cover each note five times and three-note streaks cover each note four times, even after a miss',()=>{
  for(const lv of [4,6,7,12,14,15]) {
    const {api}=app({'hbe3.settings':{ladder:6,level:lv,top:lv}});
    api.start(lv);api.question();api.answer(false);
    assert.equal(api.settings.trainStreaks[lv],0);
    const choices=Array.from(api.levels[lv-1].choices),targets=[],goal=choices.length===2?10:12;
    for(let i=0;i<goal;i++) {
      assert.equal(api.settings.top,lv);
      targets.push(api.question());api.answer(true);
    }
    assert.equal(targets[0],choices[1]);
    assert.equal(api.settings.top,lv+1);
    for(const f of choices)assert.equal(targets.filter(target=>target===f).length,goal/choices.length);
  }
});

test('a four-note Find set unlocks after sixteen hits with four successes on each note',()=>{
  const {api}=app(),choices=[262,523,1047,2093],targets=[];
  const lv=api.levels.push({task:'find',choices,short:'Find four',wrap:'note'});
  api.settings.top=lv;api.start(lv);
  assert.equal(api.goal(lv),16);
  for(let i=0;i<15;i++){targets.push(api.question());api.answer(true);}
  assert.equal(api.settings.trainCleared[lv],undefined);
  targets.push(api.question());api.answer(true);
  assert.equal(api.settings.trainCleared[lv],true);
  assert.deepEqual(targets,Array.from({length:4},()=>choices).flat());
});

test('the note cycle and streak resume after quitting without an unanswered question advancing the cycle',()=>{
  const first=app({'hbe3.settings':{ladder:6,level:7,top:7}}),targets=[];
  first.api.start(7);
  for(let i=0;i<5;i++){targets.push(first.api.question());first.api.answer(true);}
  assert.equal(first.api.question(),2093);
  const resumed=app(first.stored);resumed.api.start(7);
  assert.equal(resumed.api.settings.trainStreaks[7],5);
  for(let i=0;i<7;i++){targets.push(resumed.api.question());resumed.api.answer(true);}
  assert.deepEqual(targets,Array.from({length:4},()=>[523,1047,2093]).flat());
  assert.equal(resumed.api.settings.trainStreaks[7],12);assert.equal(resumed.api.settings.top,8);
});

test('each Find level keeps its own position while Name, Echo and correction practice keep their target rules',()=>{
  const {api}=app();
  api.start(4);assert.equal(api.question(),523);api.answer(true);
  api.start(6);assert.equal(api.question(),1047);api.answer(true);
  api.start(4);assert.equal(api.question(),1047);
  const positions=plain(api.settings.trainFindNext);
  api.start(1);assert.equal(api.question(),2093);assert.equal(api.question(),2093);
  api.start(4,{freeform:false,practice:true});assert.equal(api.question(),1047);api.answer(true);
  api.start(4,{freeform:false,echo:{tones:[1500,500]}});
  assert.equal(api.question(),1500);api.answer(true);assert.equal(api.question(),500);
  assert.deepEqual(plain(api.settings.trainFindNext),positions);
  assert.equal(api.settings.trainStreaks[4],1);
});

test('existing levels, history and streaks migrate to the same exercises once, without creating pair streaks',()=>{
  const oldCount=app().api.oldLevels.length;
  const oldToNew=lv=>lv+[4,5,10,11].filter(at=>lv>=at).length;
  const keyed=value=>Object.fromEntries(Array.from({length:oldCount},(_,i)=>[i+1,value(i+1)]));
  const data={'hbe3.settings':{ladder:5,level:11,top:oldCount,trainStatsVersion:1,
    trainStreaks:keyed(lv=>lv%10),trainBest:keyed(lv=>lv+10),trainCleared:keyed(()=>true)},
    'hbe3.history':Array.from({length:oldCount},(_,i)=>({lv:i+1,f:1047,ok:1})),
    'hbe3.rounds':Array.from({length:oldCount},(_,i)=>({lv:i+1,n:10,score:8}))};
  const {api,stored}=app(data);
  assert.equal(api.settings.level,15);assert.equal(api.settings.top,api.levels.length);
  for(let lv=1;lv<=oldCount;lv++) {
    const mapped=oldToNew(lv);
    assert.equal(api.history[lv-1].lv,mapped);assert.equal(api.rounds[lv-1].lv,mapped);
    assert.equal(api.levels[mapped-1],api.oldLevels[lv-1]);
    assert.equal(api.settings.trainStreaks[mapped],lv%10);
    assert.equal(api.settings.trainBest[mapped],lv+10);
    assert.equal(api.settings.trainCleared[mapped],true);
  }
  for(const lv of [4,6,12,14])assert.equal(api.settings.trainBest[lv],undefined);
  assert.deepEqual(app(stored).stored,stored);
});

test('earlier installations finish their old migration before pair insertion and retain unlocked progress',()=>{
  const old=app({'hbe3.settings':{ladder:4,level:11},
    'hbe3.rounds':[{lv:12,n:10,score:10}],'hbe3.history':[{lv:11,ok:0},{lv:13,ok:1}]}).api;
  assert.equal(old.settings.level,13);
  assert.equal(old.rounds[0].lv,15);assert.equal(old.settings.top,16);
  assert.deepEqual(Array.from(old.history,r=>r.lv),[13,16]);
  const inferred=app({'hbe3.settings':{ladder:5,level:4},'hbe3.rounds':[{lv:4,n:10,score:10}]}).api;
  assert.equal(inferred.settings.level,5);assert.equal(inferred.settings.top,7);
});
