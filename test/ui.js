// UIの入力経路・回転・通知・射撃フィードバックのテスト（疑似DOMに実際のタッチイベントを送る）
const {load}=require('./harness.js');const fs=require('fs');const out=[];let fails=0;globalThis.__out=out;
globalThis.__rep=(n,c,i)=>{out.push((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++};
globalThis.__css=fs.readFileSync('style.css','utf8');
const body=`(function(){
 const ok=__rep,T=(n,f)=>{try{f()}catch(e){ok(n,false,'例外: '+e.message.slice(0,90))}};
 S=validate(defSave());go('base');
 T('U1 縦持ち/横持ちの画面向きと座標変換',()=>{
  innerWidth=390;innerHeight=844;S.settings.rot=1;layout();ok('U1a 縦持ちで回転表示になる(論理サイズは横長)',ROT===1&&GW===844&&GH===390);
  const fwd={'1':(x,y)=>({clientX:innerWidth-y,clientY:x}),'-1':(x,y)=>({clientX:y,clientY:innerHeight-x})};let good=true;
  for(const r of[1,-1]){S.settings.rot=r;layout();for(const[x,y]of[[0,0],[100,50],[400,200],[844,390],[10,380]]){const b=gp(fwd[String(r)](x,y));if(Math.abs(b.x-x)>1e-9||Math.abs(b.y-y)>1e-9)good=false}}
  ok('U1b 回転時のタッチ座標が正しく元に戻る(時計回り・反時計回り)',good);
  innerWidth=800;innerHeight=400;S.settings.rot=1;layout();ok('U1c 横持ちでは回転しない',ROT===0&&GW===800&&GH===400&&gp({clientX:12,clientY:34}).x===12)});
 T('U2 通知：重複集約・最大3件・期限切れ・重要度',()=>{NOTES.length=0;notify('a');notify('a');ok('U2a 同じ通知は1件に集約(×2)',NOTES.length===1&&NOTES[0].n===2);
  notify('b');notify('c');notify('d');ok('U2b 同時表示は最大3件',NOTES.length===3);resCard('結果1','x');resCard('結果2','y');ok('U2c 結果カードは常に1枚',NOTES.filter(n=>n.lv==='res').length===1);
  __NOW+=6000;expireNotes();ok('U2d 時間が経つと消える',NOTES.length===0);
  ok('U2e 重要度の判定(警告/良い知らせ/通常)',nGuess('所持金が足りません')==='warn'&&nGuess('ミッション達成！')==='good'&&nGuess('罠を設置した')==='info')});
 T('U2b 通知はちらつかない：変化が無ければ画面を書き換えず、既存の通知は作り直さない',()=>{NOTES.length=0;for(const k of Object.keys(NODE))delete NODE[k];__els.notes.children.length=0;
  notify('A');const el=__els.notes.children[0],w0=el._iw;for(let i=0;i<10;i++)renderNotes();ok('U2b-1 同じ内容を何度描画しても書き換えない',el._iw===w0&&__els.notes.children.length===1);
  notify('B');ok('U2b-2 通知が増えても既存の通知は作り直されない',__els.notes.children[0]===el&&__els.notes.children.length===2);
  const eb=__els.notes.children[1],w1=eb._iw;notify('B');ok('U2b-3 直前と同じ通知の連続は、増えずに件数表示(×2)へ書き換わるだけ',__els.notes.children.length===2&&eb._iw===w1+1&&/×2/.test(eb.innerHTML));
  __NOW+=1500;notify('C');__NOW+=1000;expireNotes();ok('U2b-4 期限が来た通知(A,B)だけが消え、新しい通知(C)は残る',Object.keys(NODE).length===1&&el._c.has('out'));
  ok('U2b-5 発見・犬の反応は控えめ表示(sub)に分類される',nGuess('ニホンジカを発見！')==='sub'&&nGuess('🐕 ハナが反応（右前方）')==='sub'&&nGuess('【物音】右前方でガサガサ…')==='sub'&&nGuess('ミッション達成！')==='good')});
 T('U3 歩きながら(スティック操作中)でも構え・慎重移動・銃切替を押せる',()=>{S.own=['airgun','rifle'];S.gun='airgun';go('satoyama');const ui=$('ui');
  ui.dispatch('pointerdown',{pointerId:1,clientX:100,clientY:300});ok('U3a 左側タッチでスティックが始まる',st.id===1);
  $('aim').dispatch('pointerdown',{pointerId:2});ok('U3b スティック操作中に構えられる',aiming===true&&st.id===1);
  ui.dispatch('pointermove',{pointerId:1,clientX:150,clientY:250});ok('U3c 構え中も移動入力が続く(構えが解除されない)',aiming===true&&st.x>0);
  $('aim').dispatch('pointerdown',{pointerId:3});ok('U3d スティック操作中に構えを解除できる',aiming===false);
  $('sneak').dispatch('pointerdown',{pointerId:4});ok('U3e スティック操作中に慎重移動を切り替えられる',sneak===true);
  $('gun').dispatch('pointerdown',{pointerId:5});ok('U3f スティック操作中に銃を切り替えられる',S.gun==='rifle');
  ui.dispatch('pointerup',{pointerId:1})});
 T('U4 HUDボタンはclick方式ではなくpointerdown方式',()=>{const bad=[];for(const id of['aim','sneak','gun','trapB','fire','act','menuBtn','misBtn','rotBtn','start']){const e=$(id);if(e.onclick!==null||!(e._l.pointerdown&&e._l.pointerdown.length))bad.push(id)}ok('U4 全HUDボタンが押した瞬間に反応する',bad.length===0,bad.join(','))});
 T('U5 構えは操作では解除されず、画面遷移でのみ解除される',()=>{go('satoyama');setAim(true);const ui=$('ui');ui.dispatch('pointerdown',{pointerId:1,clientX:100,clientY:300});ui.dispatch('pointerdown',{pointerId:2,clientX:700,clientY:200});
  for(let i=0;i<20;i++){ui.dispatch('pointermove',{pointerId:1,clientX:100+i*3,clientY:300-i*2});ui.dispatch('pointermove',{pointerId:2,clientX:700-i*4,clientY:200+i})}
  ui.dispatch('pointerup',{pointerId:1});ui.dispatch('pointerup',{pointerId:2});ok('U5a 移動・視点操作を続けても構えが維持される',aiming===true);go('base');ok('U5b 拠点へ戻ると構えは解除される',aiming===false)});
 T('U6 発砲フィードバック(閃光・反動・音・振動・弾数)が連打でも1回分だけ',()=>{S.own=['airgun'];S.gun='airgun';S.ammo.airgun=10;go('satoyama');setAim(true);cd=0;FX.shots=0;kick=0;
  try{fire()}catch(e){}for(let i=0;i<30;i++)try{fire()}catch(e){}
  ok('U6a 連打しても発砲は1回(クールダウン)',FX.shots===1&&S.ammo.airgun===9,'shots='+FX.shots+' ammo='+S.ammo.airgun);
  ok('U6b 閃光・反動・銃チップの反応が出る',__els.flash._c.has('on')&&kick>0&&__els.gun._c.has('pulse'));
  uiTick(.1);hitMark('kill');hitMark('hit');hitMark('miss');ok('U6c 命中表示(仕留めた/命中/外れ)が出せる',__els.hitm.className.indexOf('miss')>=0)});
 T('U7 回転時でも左右の操作領域がゲーム画面基準で働く',()=>{innerWidth=390;innerHeight=844;S.settings.rot=1;layout();go('satoyama');const ui=$('ui');
  ui.dispatch('pointerdown',{pointerId:7,clientX:200,clientY:100});const left=st.id===7;ui.dispatch('pointerup',{pointerId:7});
  ui.dispatch('pointerdown',{pointerId:8,clientX:200,clientY:700});const right=lk.id===8&&st.id===null;ui.dispatch('pointerup',{pointerId:8});
  ok('U7 縦持ち(回転)でも 画面の左=移動 / 右=視点 になる',left&&right);innerWidth=800;innerHeight=400;layout()});
 T('U8 通知は画面中央を避けて上端のHUDの間に出す(CSS)',()=>{const m=/#notes\\{([^}]*)\\}/.exec(__css);ok('U8 通知の表示位置が上端(中央に出さない)',!!m&&/top:8px/.test(m[1])&&/left:210px/.test(m[1])&&!/top:50%/.test(m[1]))});
 T('U9 画面のタブ切替',()=>{boardPanel();uiAct('tab',{id:'board:sub'});ok('U9a ミッションのタブ切替',UI.tab.board==='sub');shopPanel();uiAct('tab',{id:'shop:trap'});ok('U9b ショップのタブ切替',UI.tab.shop==='trap');
  uiAct('opt',{id:'sens:1.4'});ok('U9c 設定(感度)が保存される',S.settings.sens===1.4)});
})();`;
load(process.argv.slice(2),body);console.log(out.join('\n'));console.log('---',out.filter(x=>/^(PASS|FAIL)/.test(x)).length,'項目 /',fails,'失敗 / 0 スキップ');process.exit(fails?1:0);
