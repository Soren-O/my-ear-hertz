import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const section=(from,to)=>script.slice(script.indexOf(from),script.indexOf(to,script.indexOf(from)));

function app(saved) {
  const data=saved||{}, elements=new Map();
  const $=id=>{
    if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',dataset:{},style:{},setAttribute(){},focus(){},
      classList:{add(){},remove(){}}});
    return elements.get(id);
  };
  const context=vm.createContext({$,Date,stored:data,
    store:{set(key,value){data[key]=JSON.parse(JSON.stringify(value));}},
    settings:{trainBest:{},...(data.settings?JSON.parse(JSON.stringify(data.settings)):{level:1,top:1,trainStreaks:{},trainCleared:{}})},
    levels:Array.from({length:4},(_,i)=>({short:'Find',choices:[1047],c6:i===1})),
    reduceMotion:{matches:true},document:{},input:{blur(){}},
    fadeText:(el,text)=>{el.textContent=text;},fadeVisibility:(el,visible)=>{el.hidden=!visible;},sfx(){},stopAll(){},showTip(){},confetti(){},hearOne(){},
    saveCheckAnswer(){},completeLTPractice(){},noteAnchor(){},saveLT(){},ltOfferOnce(){},
    modeOf:()=> 'match',trainItf:()=>null,itfKey:()=>null,roundVoice:()=>({id:'sine'}),voiceReady:()=>true,
    audio:()=>({state:'running'}),startCountIn:begin=>begin(),isFindC6:L=>L.c6});
  vm.runInContext(`
    let round=null,trial=null,last=null,phase='idle',lastRound=null,screen='home',ltSessionTone=null;
    let introActive=false,history=[],anchors=[],rounds=[],questions=0,rendered=0;
    ${section('const TRAIN_GOAL =','const TOL =')}
    const ROUND=10,COLD_GAP=600000,ECHO_N=5,ECHO_L={},LEVELS=levels,SINE={id:'sine'},audioState='idle';
    const lt={unlocked:false,tones:[]};
    const saveSettings=()=>store.set('settings',settings);
    const render=()=>rendered++,go=name=>{screen=name;},showError=()=>{};
    const nextQuestion=()=>{questions++;phase='listening';last=null;trial={task:'find',voice:SINE,f:1047};};
    ${section('const trainingStreak =','let introActive =')}
    ${section('function startRound(', 'function nextQuestion()')}
    ${section('function record(rec)', 'function answer(g)')}
    ${section('const roundLen =','const echoPts =')}
    ${section('const advance =', "$('nextBtn').addEventListener")}
    ${section('function quitRound()', 'function showError(')}
    ${section('function renderTrainingHeading()', 'function renderTrainingPitches(')}
    ${section('function roundProgress()', 'let renderedTrial =')}
    globalThis.api={
      start(lv=1,echo=null,extra){settings.level=lv;startRound(echo,extra);},
      answer(ok){record({task:'find',lv:round.lv,g:ok?1047:880,f:1047,t:Date.now(),ok:ok?1:0});},
      next:advance,quit:quitRound,progress:roundProgress,length:roundLen,label:nextButtonLabel,heading:renderTrainingHeading,display:renderTrainingProgress,
      get round(){return round;},get settings(){return settings;},get questions(){return questions;},get history(){return history;},
      get sessions(){return rounds;},get screen(){return screen;},get longTermUnlocked(){return lt.unlocked;}
    };`,context);
  return {api:context.api,data,$};
}

test('training continues past twelve total answers; only twelve consecutive hits unlock the next step',()=>{
  const {api}=app();api.start();
  for(let i=0;i<11;i++){api.answer(true);api.next();}
  assert.equal(api.settings.top,1);assert.equal(api.progress().k,11);assert.equal(api.progress().n,12);
  api.answer(false);assert.equal(api.progress().k,0);
  assert.ok(api.progress().marks.every(mark=>mark===''));
  api.next();assert.equal(api.length(),Infinity);assert.equal(api.label(),'Next');
  for(let i=0;i<11;i++){api.answer(true);api.next();}
  assert.equal(api.settings.top,1);
  api.answer(true);
  assert.equal(api.settings.top,2);assert.equal(api.settings.level,1);
  assert.equal(api.progress().k,12);assert.equal(api.progress().visible,true);
  assert.ok(api.progress().marks.every(mark=>mark==='y'));
  api.next();assert.equal(api.progress().visible,false);
  api.answer(false);api.next();
  assert.equal(api.settings.top,2);assert.equal(api.progress().visible,false);
  assert.equal(api.round.items.length,25);assert.equal(api.questions,26);assert.equal(api.screen,'train');
});

test('streaks survive quitting and reloading, and belong to the individual level',()=>{
  const first=app();first.api.start();
  for(let i=0;i<6;i++){first.api.answer(true);first.api.next();}
  first.api.quit();assert.equal(first.api.screen,'home');assert.equal(first.api.sessions.length,1);
  assert.equal(first.api.sessions[0].n,6);assert.equal(first.api.sessions[0].freeform,1);
  const resumed=app(first.data);resumed.api.start();assert.equal(resumed.api.progress().k,6);
  for(let i=0;i<6;i++){resumed.api.answer(true);resumed.api.next();}
  assert.equal(resumed.api.settings.top,2);resumed.api.quit();
  resumed.api.start(2);assert.equal(resumed.api.progress().k,0);assert.equal(resumed.api.progress().visible,true);
  resumed.api.answer(true);assert.equal(resumed.api.progress().k,1);
});

test('previously unlocked steps have no streak bar, and the final step stays completed after misses',()=>{
  const {api}=app({settings:{level:1,top:4,trainStreaks:{},trainCleared:{}}});
  api.start(1);assert.equal(api.progress().visible,false);api.quit();
  api.start(4);assert.equal(api.progress().visible,true);
  for(let i=0;i<12;i++){api.answer(true);api.next();}
  assert.equal(api.settings.top,4);assert.equal(api.progress().visible,false);
  api.answer(false);api.next();assert.equal(api.progress().visible,false);
});

test('Find C6 opens long-term training immediately on the twelfth consecutive success',()=>{
  const {api}=app({settings:{level:2,top:2,trainStreaks:{},trainCleared:{}}});
  api.start(2);
  for(let i=0;i<11;i++){api.answer(true);api.next();}
  assert.equal(api.longTermUnlocked,false);api.answer(true);
  assert.equal(api.longTermUnlocked,true);assert.equal(api.screen,'train');
});

test('free training hides the level heading; Echo and correction practice retain their own flows',()=>{
  const ui=app();ui.api.start();ui.api.heading();assert.equal(ui.$('ltChallengeHeading').hidden,true);
  ui.api.quit();ui.api.start(1,{tones:[1047]});ui.api.heading();
  assert.equal(ui.api.round.freeform,false);assert.equal(ui.api.length(),5);
  assert.equal(ui.$('ltChallengeHeading').hidden,false);assert.equal(ui.$('ltChallengeLevel').textContent,'ECHO');
  ui.api.quit();ui.api.start(1,null,{practice:true});ui.api.heading();
  assert.equal(ui.api.round.freeform,false);assert.equal(ui.api.length(),1);
  assert.equal(ui.$('ltChallengeLevel').textContent,'PRACTICE');
});

test('current and longest streaks persist beyond twelve; a miss resets only the current count',()=>{
  const ui=app();ui.api.start();
  for(let i=0;i<7;i++){ui.api.answer(true);ui.api.next();}
  ui.api.display();assert.equal(ui.$('trainCurrent').textContent,'7');assert.equal(ui.$('trainBest').textContent,'7');
  assert.equal(ui.$('trainBestLabel').textContent,'12 to unlock next level');
  ui.api.answer(false);ui.api.next();ui.api.display();
  assert.equal(ui.$('trainCurrent').textContent,'0');assert.equal(ui.$('trainBest').textContent,'7');
  for(let i=0;i<13;i++){ui.api.answer(true);ui.api.next();}
  ui.api.display();assert.equal(ui.$('trainCurrent').textContent,'13');assert.equal(ui.$('trainBest').textContent,'13');
  assert.equal(ui.$('trainBestLabel').textContent,'Longest streak');assert.equal(ui.$('dots').hidden,true);
  assert.equal(ui.$('trainStats').hidden,false);
  ui.api.answer(false);ui.api.quit();
  const resumed=app(ui.data);resumed.api.start();resumed.api.display();
  assert.equal(resumed.$('trainCurrent').textContent,'0');assert.equal(resumed.$('trainBest').textContent,'13');
  assert.equal(resumed.$('trainBestLabel').textContent,'Longest streak');assert.equal(resumed.$('dots').hidden,true);
});

test('existing longest streaks come from saved answers and perfect rounds, excluding correction practice',()=>{
  const settings={trainBest:{}},history=[
    ...Array.from({length:12},()=>({lv:1,ok:1,rd:1})),{lv:1,ok:0,rd:1},
    ...Array.from({length:15},()=>({lv:2,ok:1,rd:2})),
    ...Array.from({length:4},()=>({lv:2,ok:1,rd:3}))];
  const context=vm.createContext({settings,history,rounds:[{id:2,lv:2,p:1,n:15,score:15},{id:4,lv:3,n:10,score:10}],saveSettings(){}});
  vm.runInContext(section('// Recover measured best streaks','saveSettings();'),context);
  assert.equal(settings.trainBest[1],12);assert.equal(settings.trainBest[2],4);assert.equal(settings.trainBest[3],10);
  assert.equal(settings.trainStatsVersion,1);
});
