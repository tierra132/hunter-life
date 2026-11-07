const {load}=require('./harness.js');
const files=process.argv.slice(2);
const out=[];let fails=0;
globalThis.__rep=(n,c,info)=>{out.push((c?'PASS ':'FAIL ')+n+(info?'  '+info:''));if(!c)fails++};
const body=`
(function(){
 const ok=__rep,T=(n,f)=>{try{f()}catch(e){__rep(n,false,'例外: '+e.message.slice(0,80))}};
 const fresh=()=>{S=validate(defSave());go('base')};
 fresh();
 T('R1 連打(射撃): 50連打でも弾は1発しか減らない',()=>{S.own=['airgun'];S.gun='airgun';S.ammo.airgun=20;go('satoyama');setAim(true);cd=0;try{fire()}catch(e){}for(let i=0;i<50;i++)try{fire()}catch(e){};ok('R1 連打(射撃): 50連打でも弾は1発しか減らない',S.ammo.airgun===19,'ammo='+S.ammo.airgun);setAim(false)});
 T('R2 報酬の二重付与なし(通常)',()=>{fresh();act2('accept',{id:'m1'});mEvt('catch','tanuki');const m0=S.money;for(let i=0;i<5;i++)act2('claim',{id:'m1'});ok('R2 報酬の二重付与なし(通常)',S.money-m0>=DATA.missions.m1.fixed.money&&S.money-m0<=DATA.missions.m1.fixed.money+400,'+'+(S.money-m0))});
 T('R2b 報酬の二重付与なし(デイリー)',()=>{fresh();rollMissions();const id=Object.keys(S.gen)[0];const m=S.gen[id];S.missions.active.push({id,prog:m.goals.map(g=>g.n),ready:true});const m0=S.money;for(let i=0;i<5;i++)act2('claim',{id});const gain=S.money-m0;ok('R2b 報酬の二重付与なし(デイリー)',gain>0&&gain<=m.fixed.money+400,'+'+gain+' 固定'+m.fixed.money)});
 T('R3 売却の二重実行なし',()=>{fresh();const r={id:'rx',k:'deer',size:80,area:'satoyama',t:1,method:'gun',rare:false};S.records.push(r);S.bag.push('rx');const m0=S.money;for(let i=0;i<5;i++)act2('sell',{id:'rx'});ok('R3 売却の二重実行なし',S.money-m0===priceOf(r)&&S.bag.length===0,'+'+(S.money-m0))});
 T('R4 購入: 所持金不足/購入済みで残高が壊れない',()=>{fresh();S.money=100;for(let i=0;i<5;i++)act2('buyGun',{id:'rifle'});const a=S.money===100&&!S.own.includes('rifle');S.money=500;for(let i=0;i<100;i++)act2('buyAmmo',{id:'airgun'});const b=S.money>=0&&S.money<DATA.ammoPack.airgun.price;S.money=9999;act2('buyGun',{id:'rifle'});const m1=S.money;act2('buyGun',{id:'rifle'});ok('R4 購入: 所持金不足/購入済みで残高が壊れない',a&&b&&S.money===m1,'残高'+S.money)});
 T('R5 保存失敗時に既存データを壊さない',()=>{fresh();S.money=777;save();const good=JSON.parse(__store.hlg_save).money;S.money=1;globalThis.__failSet=true;const r=save();globalThis.__failSet=false;const L=load();ok('R5 保存失敗時に既存データを壊さない',r===false&&L.money===777&&good===777,'復元所持金='+L.money)});
 T('R6 壊れたセーブからの復旧(本体破損→バックアップ)',()=>{fresh();S.money=555;save();S.money=666;save();__store.hlg_save='{broken';const L=load();ok('R6 壊れたセーブからの復旧(本体破損→バックアップ)',L.money===555,'復元='+L.money)});
 T('R6b 本体もバックアップも破損→初期データで起動',()=>{__store.hlg_save='x';__store.hlg_save_bak='y';const L=load();ok('R6b 本体もバックアップも破損→初期データで起動',L.rank===1&&L.dogs.length>=1)});
 T('R9 型や値が不正なデータを補正して読込(有効な値exp=50は保持)',()=>{__store.hlg_save=JSON.stringify({v:1,money:'abc',rank:-5,exp:50,dogs:null,records:'x',traps:{},unlocked:['zzz','forest'],bag:['none'],ammo:5,missions:{active:[{id:'ghost'},{id:'m1',prog:'x'}],daily:'?'},dex:5,pop:7,own:['laser'],gun:'laser',party:['dogX']});const L=load();ok('R9 型や値が不正なデータを補正して読込(有効な値exp=50は保持)',L.exp===50&&L.money===500&&L.rank===1&&L.rank>=1&&L.dogs.length>=1&&Array.isArray(L.records)&&L.own.length>=1&&DATA.guns[L.gun]&&L.party.length>=1&&L.missions.active.every(a=>DATA.missions[a.id]&&Array.isArray(a.prog)),JSON.stringify({m:L.money,r:L.rank,g:L.gun,p:L.party,a:L.missions.active.length}))});
 T('R10 経験値→ランク→エリア解放/2頭目の犬',()=>{fresh();addExp(DATA.rankExp[4]);ok('R10a Rank5到達で2頭目の犬が加わる',S.rank>=5&&S.dogs.length===2,'rank'+S.rank+' dogs'+S.dogs.length);ok('R10b ミッション未達成ではエリア未解放',!S.unlocked.includes('forest')||S.missions.done[DATA.areas.forest.needMission]);S.missions.done[DATA.areas.forest.needMission]=true;checkUnlock();ok('R10c 条件(ランク+ミッション)を満たすと解放',S.unlocked.includes('forest'))});
 T('R11 ミッション: 受注前の所持獲物(prior)',()=>{fresh();const p=Object.entries(DATA.missions).find(([id,m])=>m.prior);if(!p){ok('R11 ミッション: prior設定のミッションが存在すること',false,'prior:true のミッションが定義されていません');return}const [id,m]=p;const g=m.goals[0];for(let i=0;i<g.n;i++){const r={id:'p'+i,k:g.animal,size:5,area:'satoyama',t:1,method:'gun'};S.records.push(r);S.bag.push(r.id)}act2('accept',{id});const a=S.missions.active.find(x=>x.id===id);ok('R11 ミッション: 受注前の所持獲物(prior)が達成扱い',a&&a.ready)});
 T('R12 結合: 受注→捕獲→売却→報酬→記録が一致',()=>{fresh();act2('accept',{id:'m1'});go('satoyama');const a={k:'tanuki',D:DATA.animals.tanuki,sz:5,rare:false,g:null};const c=capture(a);const a2=S.missions.active.find(x=>x.id==='m1');const ready=a2&&a2.ready;const m0=S.money;act2('sell',{id:c.r.id});act2('claim',{id:'m1'});ok('R12 結合: 受注→捕獲→売却→報酬→記録が一致',ready&&S.money>m0&&S.dex.tanuki.caught===1&&S.records.length===1&&S.bag.length===0&&S.missions.done.m1,'所持金'+S.money)});
 T('R13 保存→再読込でゲーム状態が一致',()=>{fresh();S.money=1234;S.rank=3;S.trapInv.box=2;S.dogs[0].lv=4;S.dex.deer={seen:2,caught:1,max:90};save();const L=load();ok('R13 保存→再読込でゲーム状態が一致',L.money===1234&&L.rank===3&&L.trapInv.box===2&&L.dogs[0].lv===4&&L.dex.deer.max===90)});
 T('R14 画面遷移を連打しても状態が壊れない',()=>{fresh();for(let i=0;i<30;i++){go(i%2?'satoyama':'base')}ok('R14 画面遷移を連打しても状態が壊れない',aid==='base'||aid==='satoyama')});
})();`;
load(files,body);
console.log(out.join('\n'));console.log('---',out.length,'項目 /',fails,'失敗 / 0 スキップ');
process.exit(fails?1:0);
