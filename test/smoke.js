// 全体の通し確認：全エリア出発・長時間進行・全パネル描画・イベント・日替わり
const {load}=require('./harness.js');const out=[];let fails=0;
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
 T('S8 獲物を持ち帰ると売却画面が開く(まとめて処理)',()=>{go('satoyama');const c=capture({k:'deer',D:DATA.animals.deer,sz:80,rare:false,g:null});go('base');act2('sellAll',{});if(S.bag.length)throw new Error('残存')});
})();`;
load(process.argv.slice(2),body);console.log(out.join('\n'));console.log('---',out.length,'項目 /',fails,'失敗 / 0 スキップ');process.exit(fails?1:0);
