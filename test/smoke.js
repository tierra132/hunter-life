// 全体の通し確認：全エリア出発・長時間進行・全パネル描画・イベント・日替わり
const {load}=require('./harness.js');globalThis.__gamesrc=require('fs').readFileSync('game.js','utf8');const out=[];let fails=0;
globalThis.__rep=(n,c,i)=>{out.push((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++};
const body=`(function(){
 const ok=__rep,T=(n,f)=>{try{f();ok(n,true)}catch(e){ok(n,false,e.message.slice(0,90))}};
 T('S1 新規開始→拠点→各パネル描画',()=>{S=validate(defSave());go('base');for(const f of[boardPanel,shopPanel,storagePanel,kennelPanel,dexPanel,trapPanel,gatePanel,helpPanel,settingsPanel,menuPanel])f();for(const tb of['act','main','sub','special','daily','weekly']){UI.tab.board=tb;boardPanel()}for(const tb of['gun','ammo','gear','trap']){UI.tab.shop=tb;shopPanel()}for(const tb of['sp','rec']){UI.tab.dex=tb;dexPanel()}});
 for(const id of['satoyama','forest','mountain','deep'])T('S2 エリア出発と30分相当の進行: '+id,()=>{S.rank=10;S.unlocked=['satoyama','forest','mountain','deep'];go(id);if(!env||AN.length<1)throw new Error('初期化失敗 env='+!!env+' 動物='+AN.length);for(let i=0;i<7200;i++)field(.25,player.position)});
 T('S3 探索イベントの連続発火',()=>{go('satoyama');for(let i=0;i<300;i++)fireEvent(player.position)});
 T('S4 生息数: 捕獲で減り時間で回復',()=>{popHit('satoyama','deer');const a=popOf('satoyama','deer');__NOW+=10*3600e3;const b=popOf('satoyama','deer');if(!(a<1&&b>a))throw new Error(a+' '+b)});
 T('S5 日付が変わるとデイリー/ウィークリーが入れ替わる',()=>{const b=Object.keys(S.gen).join();__NOW+=40*3600e3;rollMissions();if(Object.keys(S.gen).join()===b)throw new Error('変化なし')});
 T('S6 同日に何度開いても内容は変わらない',()=>{const a=Object.keys(S.gen).join();rollMissions();rollMissions();if(Object.keys(S.gen).join()!==a)throw new Error('変動')});
 T('S7 操作説明は初回のみ(設定に記録)・感度設定が保存される',()=>{S.settings.help=0;helpPanel();act2('sens',{id:'1.4'});save();const L=load();if(L.settings.help!==1||L.settings.sens!==1.4)throw new Error(JSON.stringify(L.settings))});
  T('S9 距離に応じた更新・描画の間引き(近い=毎フレーム/遠い=間引き/霧の外=省略)',()=>{const a=lodFor(10),b=lodFor(60),c=lodFor(100);if(!(a.vis&&a.every===1&&b.vis&&b.every===4&&!c.vis))throw new Error(JSON.stringify([a,b,c]))});
 T('S10 犬が反応した位置がミニマップ用に記録され(おおよその位置)、時間で消える',()=>{go('satoyama');const a=AN[0],p=player.position;p.x=0;p.z=0;a.g.position.x=15;a.g.position.z=0;a.seen=false;a.dogd=false;a.st='normal';DPING.length=0;updAnimals(.05,p);
  if(DPING.length!==1)throw new Error('記録されない');const q=DPING[0],dd=Math.hypot(q.x-15,q.z-0);if(dd>8)throw new Error('位置がずれすぎ'+dd);if(dd===0)throw new Error('正確すぎる(動物の真上)');drawMini(p);animTick(41);if(DPING.length!==0)throw new Error('消えない')});
 T('S11 イノシシの突進を受けると短く動けず・撃てず・構えが解除され、少し押し戻される',()=>{go('satoyama');const a=AN[0],q=player.position;q.x=0;q.z=0;S.own=['airgun'];S.gun='airgun';S.ammo.airgun=5;setAim(true);cd=0;const x0=q.x,z0=q.z;aiEvent('hit',a,{dir:0});
  if(!(stun>1.5))throw new Error('硬直しない');if(Math.hypot(q.x-x0,q.z-z0)<1)throw new Error('押し戻されない');setAim(true);cd=0;const n=S.ammo.airgun;fire();if(S.ammo.airgun!==n)throw new Error('硬直中に撃てた')});
 T('S12 発砲音・命中後の反応・個体の初期化・毎フレーム更新がAI層につながっている',()=>{const src=__gamesrc;for(const k of['AI.hear(','AI.hit(','AI.init(','AI.step('])if(!src.includes(k))throw new Error(k+'が呼ばれていない')});
 T('S13 動物が(30秒相当×3エリア)動いても、警戒度は0〜100・座標は有限・状態は妥当で、突進以外で急に移動しない',()=>{const OK=['normal','alert','freeze','prep','flee','watch','threat','charge'];for(const id of['satoyama','forest','mountain']){go(id);const p=player.position;p.x=0;p.z=0;let prev=AN.map(a=>[a.g.position.x,a.g.position.z]);
   for(let f=0;f<900;f++){field(1/30,p);AN.forEach((a,i)=>{const x=a.g.position.x,z=a.g.position.z;if(!(a.aw>=0&&a.aw<=100)||!Number.isFinite(x)||!Number.isFinite(z)||!OK.includes(a.st))throw new Error(id+' '+a.k+' '+a.st+' aw='+a.aw);
     const mv=Math.hypot(x-prev[i][0],z-prev[i][1]);if(mv>1.2)throw new Error(id+' '+a.k+'が1フレームで'+mv.toFixed(1)+'m移動('+a.st+')');prev[i]=[x,z]})}}})
 T('S8 獲物を持ち帰ると売却画面が開く(まとめて処理)',()=>{go('satoyama');const c=capture({k:'deer',D:DATA.animals.deer,sz:80,rare:false,g:null});go('base');act2('sellAll',{});if(S.bag.length)throw new Error('残存')});
})();`;
load(process.argv.slice(2),body);console.log(out.join('\n'));console.log('---',out.length,'項目 /',fails,'失敗 / 0 スキップ');process.exit(fails?1:0);
