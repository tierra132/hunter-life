// 動物AIのテスト：警戒度・反応距離・状態遷移・逃走経路・遮蔽・群れ・音・イノシシ/クマ/ウサギの専用行動・個体差・決定性
const fs=require('fs');const out=[];let fails=0;const ok=(n,c,i)=>{out.push((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++};
const src=['data.js','terrain.js','animalai.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
const{Terrain,DATA,AI}=new Function(src+';return{Terrain,DATA,AI}')();
const rng=s=>()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
const T0=Terrain.make(null,60);
const KINDS=['deer','boar','tanuki','hare','fox','bear'];
const med=a=>{a=a.filter(v=>v!==null&&v!==undefined).sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:null};
function mk(k,seed,o){o=o||{};const r=rng(seed),a={k,D:DATA.animals[k],g:{position:{x:o.x||0,y:0,z:o.z===undefined?70:o.z},rotation:{y:0}},hx:o.x||0,hz:o.z===undefined?70:o.z,st:'normal',t:0,wound:0,gid:o.gid===undefined?null:o.gid};AI.init(a,r);if(o.pers)Object.assign(a.pers,o.pers);a._r=r;return a}
function mkEnv(a,o){o=o||{};const log=[];const e=Object.assign({dt:.05,p:{x:0,y:0,z:0},moveF:1,senseMul:1,TER:T0,rnd:a._r||rng(1),half:o.half||100,blocked:()=>false,occ:()=>false,cl:v=>v,dogs:[],all:[a],
  step:(an,ang,sp,dt)=>{for(const off of[0,1.1,-1.1]){const x=an.g.position.x+Math.sin(ang+off)*sp*dt,z=an.g.position.z+Math.cos(ang+off)*sp*dt,H=(o.half||100)-1;if(Math.abs(x)<H&&Math.abs(z)<H&&!e.blocked(x,z)){an.g.position.x=x;an.g.position.z=z;an.g.rotation.y=ang+off;return}}},ev:(t,an,d)=>log.push([e.time||0,t,d])},o.env||{});e.log=log;return e}
/* プレイヤーが動物へ向かって歩く。動物が逃走/威嚇に入るか、様子見に入るまで */
function approach(k,seed,speed,moveF,o){o=o||{};const a=mk(k,seed,o),e=mkEnv(a,o);e.moveF=moveF;let st0='normal',tAlert=null,tTrig=null,dAlert=null,dTrig=null,trans=[],t=0;
  for(let i=0;i<4000;i++){t+=e.dt;e.time=t;const dx=a.g.position.x-e.p.x,dz=a.g.position.z-e.p.z,dd=Math.hypot(dx,dz);if(dd>2){e.p.x+=dx/dd*speed*e.dt;e.p.z+=dz/dd*speed*e.dt}
    const d0=Math.hypot(a.g.position.x-e.p.x,a.g.position.z-e.p.z);AI.step(a,e);
    if(a.st!==st0){trans.push([st0,a.st]);st0=a.st}
    if(tAlert===null&&a.st!=='normal'){tAlert=t;dAlert=d0}if(tTrig===null&&['prep','flee','threat'].includes(a.st)){tTrig=t;dTrig=d0}
    if(tTrig!==null&&a.st==='watch')break}
  return{dAlert,dTrig,window:(tAlert!==null&&tTrig!==null)?tTrig-tAlert:null,trans,log:e.log,a}}
const many=(k,speed,mf,n,o)=>{const r=[];for(let s=1;s<=n;s++)r.push(approach(k,s,speed,mf,o));return r};

// A1 警戒度の増え方
{const a=mk('deer',3),e=mkEnv(a);const g=(d,vis,mf,dog)=>{a.g.position.x=0;a.g.position.z=d;e.moveF=mf;e.dogs=dog?[{x:0,z:d}]:[];return AI.gainOf(a,e,d,vis)};
 ok('A1 警戒度の増加：近いほど大きく、動くほど・見通しが良いほど・犬が近いほど大きく、気づき距離の外では0',g(10,true,1)>g(25,true,1)&&g(25,true,1)>g(50,true,1)&&g(20,true,1)>g(20,true,.2)&&g(20,true,.2)>g(20,true,.08)&&g(20,true,1)>g(20,false,1)&&g(20,true,1,true)>g(20,true,1)&&g(80,true,1)===0)}
// A2/A3/A4 反応距離
const TG={deer:40,boar:17,tanuki:11,hare:25,fox:45,bear:23};
{const R={},bad=[];for(const k of KINDS){R[k]=med(many(k,4.2,1,40).map(x=>x.dAlert));if(Math.abs(R[k]-TG[k])/TG[k]>.22)bad.push(k+':'+R[k].toFixed(0)+'m(狙い'+TG[k]+')')}
 ok('A2 通常歩行で近づいたときに警戒する距離が、種類ごとの設計値(±22%)に収まる',bad.length===0,bad.join(' ')||Object.entries(R).map(([k,v])=>k+Math.round(v)).join(' '));
 ok('A2b 警戒距離の順序：キツネ>シカ>ウサギ>クマ>イノシシ>タヌキ',R.fox>R.deer&&R.deer>R.hare&&R.hare>R.bear&&R.bear>R.boar&&R.boar>R.tanuki)}
{const bad=[];for(const k of KINDS){const n=med(many(k,4.2,1,30).map(x=>x.dAlert)),s=med(many(k,1.9,.2,30).map(x=>x.dAlert));if(!(s<=n*.85))bad.push(k+':'+s.toFixed(0)+'/'+n.toFixed(0))}
 ok('A3 慎重に近づくほど、警戒される距離が近くなる(通常の85%以下)',bad.length===0,bad.join(' '))}
{const w=(sp,mf)=>med(many('deer',sp,mf,40).map(x=>x.window)),ws=w(1.9,.2),wn=w(4.2,1);
 ok('A4 狙える時間：シカは慎重に近づくと警戒して立ち止まる時間が長い(慎重>=6秒、通常より1.5倍以上)',ws>=6&&ws>wn*1.5,'慎重'+ws.toFixed(1)+'秒 通常'+wn.toFixed(1)+'秒')}
// A5 状態遷移の妥当性
{const ALLOW=new Set(['normal>alert','normal>freeze','alert>normal','alert>prep','alert>threat','freeze>normal','freeze>flee','prep>flee','threat>alert','threat>charge','charge>flee','charge>watch','flee>watch','flee>freeze','watch>normal','watch>flee']);let bad=new Set(),n=0;
 for(const k of KINDS)for(let s=1;s<=25;s++)for(const[sp,mf]of[[4.2,1],[1.9,.2]]){const r=approach(k,s*7,sp,mf);for(const[a,b]of r.trans){n++;if(!ALLOW.has(a+'>'+b))bad.add(k+':'+a+'>'+b)}}
 ok('A5 状態遷移は想定した経路だけ(全6種×25個体×2通り='+n+'回の遷移)',bad.size===0,[...bad].join(' '))}
// A6 逃走経路
{let bad=[];for(const k of KINDS){let outb=0,turn=0,away=0,N=40;for(let s=1;s<=N;s++){const a=mk(k,s,{x:44,z:0}),e=mkEnv(a,{half:50});e.p.x=36;e.p.z=0;e.moveF=1;a.aw=100;a.st='prep';a.react=.1;a.pers.aggr=0;let maxLat=0,exit=false;
   for(let i=0;i<500;i++){AI.step(a,e);if(Math.abs(a.g.position.x)>50||Math.abs(a.g.position.z)>50)exit=true;maxLat=Math.max(maxLat,Math.abs(a.g.position.z))}
   if(exit)outb++;if(maxLat>2)turn++;if(Math.hypot(a.g.position.x-e.p.x,a.g.position.z-e.p.z)>20)away++}
  if(outb>0||turn<N*.4||away<N*.8)bad.push(k+' 範囲外'+outb+' 曲がる'+turn+'/'+N+' 離れる'+away+'/'+N)}
 ok('A6 逃走：エリア外へ出ない・端へ一直線に突っ込まず曲がる・十分に離れる(端の近くで追い詰めた場合)',bad.length===0,bad.join(' | '))}
// A7 遮蔽物の選択
{const rock=[9*Math.sin(1.75),9*Math.cos(1.75)];const occR=(ax,az,bx,bz)=>{const vx=bx-ax,vz=bz-az,L=vx*vx+vz*vz||1;let u=((rock[0]-ax)*vx+(rock[1]-az)*vz)/L;u=Math.max(0,Math.min(1,u));return Math.hypot(ax+vx*u-rock[0],az+vz*u-rock[1])<2.2&&u>.05&&u<.95};
 const frac=(k,withRock)=>{let c=0,N=160;for(let s=1;s<=N;s++){const a=mk(k,s,{x:0,z:0}),e=mkEnv(a,{half:60,env:{occ:withRock?occR:()=>false}});e.p.x=0;e.p.z=-20;a.aw=100;a.st='prep';a.react=.05;a.pers.aggr=0;for(let i=0;i<42;i++)AI.step(a,e);if(occR(e.p.x,e.p.z,a.g.position.x,a.g.position.z))c++}return c/N};
 const f=frac('fox',true),d=frac('deer',true),f0=frac('fox',false);
 ok('A7 遮蔽物：真後ろから外れた岩の陰へ、キツネは高い割合(70%以上)で逃げ、シカより20ポイント以上多い。遮蔽物が無ければ偶然の割合は低い',f>=.7&&f>=d+.2&&f0<.1,'キツネ'+(f*100).toFixed(0)+'% シカ'+(d*100).toFixed(0)+'% 遮蔽なし'+(f0*100).toFixed(0)+'%')}
// A8 群れ / A9 音
{const a=mk('deer',1,{gid:5}),b=mk('deer',2,{gid:5,x:10}),c=mk('deer',3,{gid:9,x:10}),e=mkEnv(a,{});e.all=[a,b,c];a.g.position.z=20;b.g.position.z=20;c.g.position.z=20;AI.hear(a,e,{x:0,z:0,power:70});
 ok('A8 群れ：1頭が驚くと、同じ群れの仲間の警戒度も上がる(別の群れは変わらない)',b.aw>=15&&c.aw===0,'仲間'+b.aw.toFixed(0)+' 別群'+c.aw)}
{const a=mk('deer',1,{z:50}),e=mkEnv(a,{});const h=(pow,d)=>{a.aw=0;a.g.position.z=d;return AI.hear(a,e,{x:0,z:0,power:pow})};
 ok('A9 銃声：ライフル(70)は50mでも効き、空気銃(14)は近くだけ。近いほど強く、範囲外は0',h(70,50)>=15&&h(14,50)===0&&h(14,5)>=30&&h(70,10)>h(70,40)&&h(60,80)===0)}
// A10 イノシシの威嚇と突進
{const trial=(aggr,seed,sidestep,still)=>{const a=mk('boar',seed,{z:30,pers:{aggr,skit:.5,bold:.5}}),e=mkEnv(a,{});e.moveF=1;let t=0,chargeT=null,threatT=null,hit=false,vmax=0,cdur=0,prev=null,moved=false;
   for(let i=0;i<2500;i++){t+=e.dt;e.time=t;if(!(a.st==='charge'||a.st==='threat'||a.st==='flee'||a.st==='watch')){const dz=a.g.position.z-e.p.z,dx=a.g.position.x-e.p.x,dd=Math.hypot(dx,dz);if(dd>2){e.p.x+=dx/dd*4.2*e.dt;e.p.z+=dz/dd*4.2*e.dt}}
     const bf=e.log.length;AI.step(a,e);for(let j=bf;j<e.log.length;j++){const[tt,ty]=e.log[j];if(ty==='threat'&&threatT===null)threatT=t;if(ty==='charge'){chargeT=t;if(sidestep&&!moved){e.p.x+=4;moved=true}}if(ty==='hit')hit=true}
     if(a.st==='charge'){const p0=prev||{x:a.g.position.x,z:a.g.position.z};vmax=Math.max(vmax,Math.hypot(a.g.position.x-p0.x,a.g.position.z-p0.z)/e.dt);cdur+=e.dt}prev={x:a.g.position.x,z:a.g.position.z};
     if(a.st==='watch'||(i>600&&a.st==='normal'&&threatT===null&&t>20))break}
   return{threatT,chargeT,hit,vmax,cdur,warn:chargeT!==null&&threatT!==null?chargeT-threatT:null}};
 const A=[],B=[];for(let s=1;s<=40;s++){A.push(trial(1,s,false));B.push(trial(0,s,false))}
 const wins=A.map(x=>x.warn).filter(v=>v!==null),tele=med(wins),vm=med(A.filter(x=>x.chargeT!==null).map(x=>x.vmax)),cd=med(A.filter(x=>x.chargeT!==null).map(x=>x.cdur));
 ok('A10a イノシシ(攻撃的な個体)：威嚇の予兆のあとに突進し、予兆は約1.1〜1.5秒、突進速度は6.5m/s以上・1.8秒以内',wins.length>=30&&tele>=1.05&&tele<=1.55&&vm>=6.5&&cd<=1.8,'予兆'+(tele||0).toFixed(2)+'秒 速度'+(vm||0).toFixed(1)+' 時間'+(cd||0).toFixed(2));
 ok('A10b イノシシ(おとなしい個体)は威嚇も突進もせず、逃げる',B.every(x=>x.threatT===null&&x.chargeT===null))
 const S=[];for(let s=1;s<=30;s++)S.push(trial(1,s,true));const H=A.filter(x=>x.chargeT!==null);
 ok('A10c 突進は、立ち止まっていると当たり、突進開始後に横へ避ければ当たらない',H.filter(x=>x.hit).length>=H.length*.6&&S.filter(x=>x.chargeT!==null&&x.hit).length===0,'立ち止まり当たり'+H.filter(x=>x.hit).length+'/'+H.length)}
// A11 クマ
{const a0=(aggr,seed)=>{const a=mk('bear',seed,{z:30,pers:{aggr,skit:.5,bold:.5}}),e=mkEnv(a,{});e.moveF=1;let t=0,ch=false,vflee=0,prev=null;
   for(let i=0;i<2500;i++){t+=.05;e.time=t;if(!['charge','threat','flee','watch'].includes(a.st)){const dx=a.g.position.x-e.p.x,dz=a.g.position.z-e.p.z,dd=Math.hypot(dx,dz);if(dd>2){e.p.x+=dx/dd*4.2*.05;e.p.z+=dz/dd*4.2*.05}}
     const bf=e.log.length;AI.step(a,e);for(let j=bf;j<e.log.length;j++)if(e.log[j][1]==='charge')ch=true;
     if(a.st==='flee'&&prev)vflee=Math.max(vflee,Math.hypot(a.g.position.x-prev.x,a.g.position.z-prev.z)/.05);prev=a.st==='flee'?{x:a.g.position.x,z:a.g.position.z}:null;if(a.st==='watch'&&t>5)break}
   return{ch,vflee}};
 const calm=[],angry=[];for(let s=1;s<=30;s++){calm.push(a0(0,s));angry.push(a0(1,s))}
 let wc=0,N=300;for(let s=1;s<=N;s++){const a=mk('bear',s+500,{z:10}),e=mkEnv(a,{});AI.hit(a,e);if(a.st==='threat')wc++}
 ok('A11a クマ：攻撃的な個体は突進し、そうでない個体は突進せず、ゆっくり(通常の6割以下の速さで)後退する',angry.filter(x=>x.ch).length>=20&&calm.every(x=>!x.ch)&&calm.every(x=>x.vflee<=DATA.animals.bear.flee*.6),'攻撃的で突進'+angry.filter(x=>x.ch).length+'/30 後退速度'+Math.max(...calm.map(x=>x.vflee)).toFixed(1))
 ok('A11b 手負いのクマは、約65%の確率で反撃(威嚇→突進)に転じる',wc/N>=.5&&wc/N<=.8,(wc/N*100).toFixed(0)+'%')}
// A12 ウサギ
{let multi=0,bad=0,N=30;for(let s=1;s<=N;s++){const a=mk('hare',s,{z:60}),e=mkEnv(a,{});e.moveF=1;let freezes=0,st0='normal',startPos=null;
   for(let i=0;i<3000;i++){const dx=a.g.position.x-e.p.x,dz=a.g.position.z-e.p.z,dd=Math.hypot(dx,dz);if(dd>3){e.p.x+=dx/dd*3.5*.05;e.p.z+=dz/dd*3.5*.05}AI.step(a,e);
     if(a.st!==st0){if(a.st==='flee')startPos={x:a.g.position.x,z:a.g.position.z};if(st0==='flee'&&startPos&&Math.hypot(a.g.position.x-startPos.x,a.g.position.z-startPos.z)>DATA.ai.hare.hop[1]+4)bad++;if(a.st==='freeze')freezes++;st0=a.st}}
   if(freezes>=2)multi++}
 ok('A12 ウサギ：近づかれると、硬直→短く跳ねて逃げる→再び硬直、を繰り返す(1回の跳ねは約5〜9m)',multi>=N*.7&&bad<=N*.2,'複数回'+multi+'/'+N+' 長すぎる跳ね'+bad)}
// A13 回復 / A14 足跡
{let rec=0,N=30,trailFlee=0,trailNormal=0;for(let s=1;s<=N;s++){const a=mk('deer',s,{z:30}),e=mkEnv(a,{});a.aw=100;a.st='prep';a.react=.1;e.p.z=0;let t=0,back=null;
   for(let i=0;i<2400&&back===null;i++){t+=.05;e.time=t;if(t>12){e.p.x=0;e.p.z=-300}AI.step(a,e);if(t>12&&a.st==='normal')back=t}
   if(back!==null&&back<60&&Math.abs(a.hx-a.g.position.x)<12)rec++;
   const fl=e.log.filter(x=>x[1]==='trail');trailFlee+=fl.length;}
 const a=mk('deer',1,{z:80}),e=mkEnv(a,{});for(let i=0;i<600;i++)AI.step(a,e);trailNormal=e.log.filter(x=>x[1]==='trail').length;
 ok('A13 逃げ切ったあと、プレイヤーが離れれば通常に戻り、そこを新しい行動範囲にする',rec>=N*.9,rec+'/'+N);
 ok('A14 逃走中だけ足跡が残る(通常時は残らない)',trailFlee>=N*4&&trailNormal===0,'逃走中'+trailFlee+'個 通常'+trailNormal)}
// A15 決定性 / A16 安定性 / A17 個体差 / A18 負傷
{const run=s=>{const r=approach('fox',s,4.2,1);return JSON.stringify([r.dAlert,r.dTrig,r.trans,r.a.g.position])};ok('A15 同じ乱数なら同じ行動になる(再現できる)',run(11)===run(11)&&run(11)!==run(12))}
{let bad=0,r=rng(99);for(const k of KINDS){const a=mk(k,5,{z:30}),e=mkEnv(a,{});for(let i=0;i<20000;i++){if(i%300===0){e.p.x=(r()*2-1)*30;e.p.z=(r()*2-1)*30;e.moveF=[1,.2,.08][Math.floor(r()*3)]}else{e.p.x+=(r()-.5)*.8;e.p.z+=(r()-.5)*.8}AI.step(a,e);
   if(!(a.aw>=0&&a.aw<=100)||!Number.isFinite(a.g.position.x)||!Number.isFinite(a.g.position.z)||!['normal','alert','freeze','prep','flee','watch','threat','charge'].includes(a.st))bad++}}
 ok('A16 長時間(6種×2万ステップ)の乱暴な動きでも、警戒度は0〜100・座標は有限・状態は妥当',bad===0,'違反'+bad)}
{const f=sk=>med(many('deer',4.2,1,30,{pers:{skit:sk,bold:.5,aggr:.5}}).map(x=>x.dAlert));const hi=f(1),lo=f(0);
 ok('A17 個体差：神経質な個体は、そうでない個体より遠くから警戒する(12%以上)',hi>=lo*1.12,'神経質'+hi.toFixed(0)+'m 通常'+lo.toFixed(0)+'m')}
{let bad=0;for(const k of['deer','tanuki','hare','fox']){const a=mk(k,2,{z:20}),e=mkEnv(a,{});AI.hit(a,e);if(a.st!=='flee'||a.wound!==45||a.aw!==100)bad++}ok('A18 命中して仕留められなかった動物は、手負いになって逃げる(痕跡用の血痕タイマーが入る)',bad===0)}
console.log(out.join('\n'));console.log('---',out.length,'項目 /',fails,'失敗 / 0 スキップ');process.exit(fails?1:0);
