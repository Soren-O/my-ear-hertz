import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const section=(from,to)=>script.slice(script.indexOf(from),script.indexOf(to,script.indexOf(from)));
const plain=value=>JSON.parse(JSON.stringify(value));
function app(data={}) {
  const stored=plain(data),context=vm.createContext({store:{
    get:(key,fallback)=>key in stored?plain(stored[key]):fallback,
    set:(key,value)=>{stored[key]=plain(value);}
  }});
  vm.runInContext(`
    ${section('const NOTE =','/* ---------- formatting & math ---------- */')}
    const lt={unlocked:false,tones:[]},saveLT=()=>{};
    ${section('const isFindC6 =','lt.tones.forEach(t => {')}
    let round=null;
    ${section('const trainingStreak =','let introActive =')}
    globalThis.api={settings,history,rounds,levels:LEVELS,oldLevels:PRE_PAIR_LEVELS,gateLv,findOneLv,
      start(lv){round={lv,freeform:true,items:[]};},
      answer(ok){const rec={ok:Number(ok)};round.items.push(rec);recordTrainingStreak(rec);},
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

test('new users unlock each pair and the following exercise only after ten consecutive hits',()=>{
  const {api}=app();
  assert.equal(api.settings.level,1);assert.equal(api.settings.top,1);assert.equal(api.settings.ladder,6);
  api.start(2);for(let i=0;i<10;i++)api.answer(true);
  assert.equal(api.lt.unlocked,true);
  for(const [lv,next] of [[3,4],[4,5],[5,6],[6,7]]) {
    api.start(lv);
    for(let i=0;i<9;i++)api.answer(true);
    assert.equal(api.settings.top,lv);
    api.answer(false);assert.equal(api.settings.trainStreaks[lv],0);
    for(let i=0;i<9;i++)api.answer(true);
    assert.equal(api.settings.top,lv);
    api.answer(true);assert.equal(api.settings.top,next);
    assert.equal(api.settings.trainBest[lv],10);
  }
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
