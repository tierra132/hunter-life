// 地形のテスト：地形層(純粋関数)の性質と、ゲーム本体に組み込んだ後の配置・移動・判定の正しさ
const {load}=require('./harness.js');globalThis.__gamesrc=require('fs').readFileSync('game.js','utf8');const out=[];let fails=0;globalThis.__out=out;
globalThis.__rep=(n,c,i)=>{out.push((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++};
const body=`(function(){
 const ok=__rep,R=mul32,AREAS=['satoyama','forest','mountain','deep'];
 const r0=mul32(2024);Math.random=()=>r0();
 const mk=id=>Terrain.make(DATA.terrain[id],DATA.areas[id].half);
 // --- 地形層
 {let same=true,diff=false;const r=R(5);for(const id of AREAS){const a=mk(id),b=mk(id);for(let i=0;i<150;i++){const x=(r()*2-1)*40,z=(r()*2-1)*40;if(a.h(x,z)!==b.h(x,z))same=false}}
  const t1=Terrain.make({seed:1,amp:5,scale:30},50),t2=Terrain.make({seed:2,amp:5,scale:30},50);for(let i=0;i<20;i++)if(t1.h(i*3,i*2)!==t2.h(i*3,i*2))diff=true;
  ok('C1 地形は決定的(同じ設定なら同じ高さ、設定が違えば違う)',same&&diff)}
 {let bad=[];for(const id of AREAS){const T=mk(id);if(T.slope(0,0)>=.25||!T.walkable(0,0)||T.isWater(0,0)||!T.reach(0,0))bad.push(id)}ok('C2 出発地点は平らで歩け、水の中ではない',bad.length===0,bad.join(','))}
 {let bad=[];const L={satoyama:.95,forest:.93,mountain:.88,deep:.8};
  for(const id of AREAS){const A=DATA.areas[id],T=mk(id),s=Terrain.stats(T,A.half,2),sp=DATA.terrain[id];
   if(s.walkFrac<L[id]||s.reachFrac<.95||s.waterFrac<.008||s.waterFrac>.08||(s.hmax-s.hmin)<sp.amp*.8)bad.push(id+':'+JSON.stringify({w:+s.walkFrac.toFixed(2),r:+s.reachFrac.toFixed(2),wa:+s.waterFrac.toFixed(3)}))}
  ok('C3 各エリアの健全性(歩ける面積が十分・到達可能≥95%・小川が1〜8%・起伏がある)',bad.length===0,bad.join(' '))}
 {const z=id=>Terrain.stats(mk(id),DATA.areas[id].half,2).zones,s=z('satoyama'),f=z('forest'),d=z('deep');
  ok('C4 区域の構成：里山は5区域すべて、森林は雑木林が主、奥山はさらに密',['wood','open','path','field','stream'].every(k=>(s[k]||0)>=.015)&&f.wood>=.4&&d.wood>=.6&&d.wood>f.wood)}
 {let bad=[];for(const id of AREAS){const H=DATA.areas[id].half,T=mk(id),p=T.path.pts;let sl=0,n=0;for(const q of p){if(H-Math.max(Math.abs(q[0]),Math.abs(q[1]))<14)continue;if(!T.walkable(q[0],q[1]))bad.push(id+'歩行不可');sl+=T.slope(q[0],q[1]);n++}
   if(sl/n>.3)bad.push(id+'林道が急:'+(sl/n).toFixed(2));const e=p[p.length-1];if(Math.max(Math.abs(e[0]),Math.abs(e[1]))<H-14)bad.push(id+'端に届かない')}
  ok('C5 林道は外周の丘より内側で全線歩け、勾配が緩やかで、エリアの端まで通じている',bad.length===0,bad.join(' '))}
 {let bad=[];for(const id of AREAS){const T=mk(id);for(const st of T.streams){let carved=0,n=0,wat=0;for(let i=2;i<st.pts.length-2;i++){const q=st.pts[i],nx=st.pts[i+1][0]-st.pts[i-1][0],nz=st.pts[i+1][1]-st.pts[i-1][1],L=Math.hypot(nx,nz)||1,ox=-nz/L*st.w*3.5,oz=nx/L*st.w*3.5;
     const hc=T.h(q[0],q[1]),hb=(T.h(q[0]+ox,q[1]+oz)+T.h(q[0]-ox,q[1]-oz))/2;carved+=hb-hc;n++;if(T.isWater(q[0],q[1]))wat++}
    if(carved/n<.25)bad.push(id+'谷が浅い:'+(carved/n).toFixed(2));if(wat/n<.9)bad.push(id+'水判定が途切れる')}}
  ok('C6 小川は岸より低い谷を連続して流れている',bad.length===0,bad.join(' '))}
 {let bad=[];for(const id of AREAS){const A=DATA.areas[id],T=mk(id),sp=DATA.terrain[id];let d=0,n=0;for(let t=-A.half+6;t<=A.half-6;t+=3){for(const[x,z,ix,iz]of[[t,A.half-1,t,A.half-23],[t,-A.half+1,t,-A.half+23],[A.half-1,t,A.half-23,t],[-A.half+1,t,-A.half+23,t]]){d+=T.h(x,z)-T.h(ix,iz);n++}}
   if(d/n<sp.edgeRise*.5)bad.push(id+':'+(d/n).toFixed(1))}ok('C7 エリアの端は丘になり、壁ではなく地形で行き止まりになる(境界は内側22mより平均で高い)',bad.length===0,bad.join(','))}
 {const F=Terrain.make(null,50);const H=Terrain.make({seed:3,amp:12,scale:20},60);let blockedPair=null;const r=R(9);for(let i=0;i<4000&&!blockedPair;i++){const a=[(r()*2-1)*40,(r()*2-1)*40],b=[a[0]+(r()*2-1)*30,a[1]+(r()*2-1)*30];if(!H.los(a[0],H.h(a[0],a[1])+1.6,a[1],b[0],H.h(b[0],b[1])+.8,b[1]))blockedPair=[a,b]}
  const hi=blockedPair&&H.los(blockedPair[0][0],60,blockedPair[0][1],blockedPair[1][0],60,blockedPair[1][1]);
  ok('C8 視線：平地は常に通り、丘で遮られる組が存在し、高所からなら見通せる',F.los(0,1.6,0,40,.8,0)&&!!blockedPair&&hi===true)}
 {const T=mk('mountain');let up=null,wat=null,pth=null;const r=R(3);for(let i=0;i<4000&&(!up||!wat||!pth);i++){const x=(r()*2-1)*55,z=(r()*2-1)*55,g=T.grad(x,z),sl=Math.hypot(g[0],g[1]);if(!up&&sl>.25&&sl<.5&&!T.isWater(x,z)&&T.zoneAt(x,z)!=='path')up=[x,z,g[0]/sl,g[1]/sl];if(!wat&&T.isWater(x,z)&&sl<.4)wat=[x,z,g[0],g[1]]}
  for(const q of T.path.pts)if(!pth&&T.zoneAt(q[0],q[1])==='path'&&T.slope(q[0],q[1])<.15)pth=q;
  const upM=T.speedMul(up[0],up[1],up[2],up[3]),dnM=T.speedMul(up[0],up[1],-up[2],-up[3]),wM=T.speedMul(wat[0],wat[1],0,0);
  ok('C9 移動速度：上り<平地<下り、水中は遅く、林道はやや速い',upM<1&&dnM>1&&dnM>upM&&wM<=.62&&T.speedMul(pth[0],pth[1],0,0)>1,[upM,dnM,wM].map(v=>v.toFixed(2)).join('/'))}
 {const G=Terrain.makeGrid(8),pts=[],r=R(21);for(let i=0;i<800;i++){const q=[(r()*2-1)*60,(r()*2-1)*60,.5+r()*2];pts.push(q);G.add(q)}let same=true;
  for(let i=0;i<600;i++){const x=(r()*2-1)*60,z=(r()*2-1)*60,rad=1+r()*20,pr=q=>Math.hypot(x-q[0],z-q[1])<q[2]+.4;const a=G.near(x,z,rad+3,pr),b=pts.some(q=>Math.hypot(x-q[0],z-q[1])<=rad+3+3&&pr(q));if(a!==b)same=false}
  ok('C10 空間グリッド：800個の障害物に対する600回の問い合わせが総当たりと一致',same&&G.size()===800)}
 {const T=mk('satoyama'),r=R(77);let bad=0,deerOpen=0,N=300;for(let i=0;i<N;i++){const p=Terrain.pickSpot(T,r,50,{zones:DATA.animalZones.deer,minFrom:[0,0],minDist:30,test:(a,b)=>T.reach(a,b),tries:150});if(!p){bad++;continue}
   if(!T.walkable(p[0],p[1])||T.isWater(p[0],p[1])||Math.hypot(p[0],p[1])<30||!T.reach(p[0],p[1]))bad++;const zn=T.zoneAt(p[0],p[1]);if(zn==='open'||zn==='field')deerOpen++}
  ok('C11 生息区域：配置は歩ける・水中でない・出発地点から離れ・到達可能で、シカは開けた場所に多い',bad===0&&deerOpen/N>.5,'開けた場所='+(deerOpen/N*100).toFixed(0)+'%')}
 {const T=mk('satoyama');let wp=null;const r=R(4);for(let i=0;i<3000&&!wp;i++){const x=(r()*2-1)*45,z=(r()*2-1)*45;if(T.isWater(x,z))wp=[x,z]}const a=Terrain.nearestOk(T,wp[0],wp[1],20),b=Terrain.nearestOk(T,wp[0],wp[1],20);
  ok('C12 水中の点は最寄りの使える地点へ(決定的・近距離)',a&&!T.isWater(a[0],a[1])&&T.walkable(a[0],a[1])&&JSON.stringify(a)===JSON.stringify(b)&&Math.hypot(a[0]-wp[0],a[1]-wp[1])<=8,a?Math.hypot(a[0]-wp[0],a[1]-wp[1]).toFixed(1)+'m':'なし')}
 {let good=true;for(const id of AREAS){const T=mk(id);for(let x=-40;x<=40;x+=5)for(let z=-40;z<=40;z+=5){const c=T.colorAt(x,z);if(c.length!==3||c.some(v=>!(v>=0&&v<=1)))good=false}}ok('C13 地面の色は常に有効な範囲',good)}
 // --- 壁・崖・遠回りの検査(ご指摘の「長い壁ができて降りられない・向こうへ行けない」の再発防止)
 {let bad=[];for(const id of AREAS){const T=mk(id);let cliff=0,flat=0;for(let x=-14;x<=14;x++)for(let z=-14;z<=14;z++){const r=Math.hypot(x,z);if(r<=14&&T.slope(x,z)>.8)cliff++;if(r<=5&&T.slope(x,z)>.2)flat++}
   let hmin=1e9,hmax=-1e9;for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)if(Math.hypot(x,z)<=5){const y=T.h(x,z);hmin=Math.min(hmin,y);hmax=Math.max(hmax,y)}
   if(cliff>0||flat>0||hmax-hmin>.6)bad.push(id+' 崖'+cliff+' 平坦でない'+flat+' 高低差'+(hmax-hmin).toFixed(2))}
  ok('C14 出発地点の周り(半径14m)に崖がなく、半径5mは平ら',bad.length===0,bad.join(' '))}
 {let bad=[];for(const id of AREAS){const H=DATA.areas[id].half,T=mk(id);let pb=0,pn=0,pg=0;for(const q of T.path.pts)for(let o=-12;o<=12;o+=2)for(const[dx,dz]of[[o,0],[0,o]]){const x=q[0]+dx,z=q[1]+dz;if(Math.abs(x)>=H-3||Math.abs(z)>=H-3)continue;pn++;if(!T.walkable(x,z))pb++}
   const pp=T.path.pts;for(let i=1;i<pp.length;i++){if(H-Math.max(Math.abs(pp[i][0]),Math.abs(pp[i][1]))<22)continue;pg=Math.max(pg,Math.abs(T.h(pp[i][0],pp[i][1])-T.h(pp[i-1][0],pp[i-1][1]))/Math.hypot(pp[i][0]-pp[i-1][0],pp[i][1]-pp[i-1][1]))}
   if(pb/pn>.08||pg>.5)bad.push(id+' 周辺歩行不可'+(pb/pn*100).toFixed(0)+'% 最大勾配'+pg.toFixed(2))}
  ok('C15 林道の周り(12m)はほぼ歩けて(不可8%以下)、林道の勾配が緩い',bad.length===0,bad.join(' '))}
 {let bad=[];for(const id of AREAS){const H=DATA.areas[id].half,T=mk(id);for(const st of T.streams){const y=st.prof.y,n=y.length,dirDown=y[0]>=y[n-1];let up=0,gmax=0;for(let i=1;i<n;i++){const d=dirDown?y[i]-y[i-1]:y[i-1]-y[i];if(d>.05)up++;gmax=Math.max(gmax,Math.abs(y[i]-y[i-1])/Math.hypot(st.pts[i][0]-st.pts[i-1][0],st.pts[i][1]-st.pts[i-1][1]))}
    let sb=0,sn=0;for(const q of st.pts)for(let o=-8;o<=8;o+=2)for(const[dx,dz]of[[o,0],[0,o]]){const x=q[0]+dx,z=q[1]+dz;if(Math.abs(x)>=H-3||Math.abs(z)>=H-3)continue;sn++;if(!T.walkable(x,z))sb++}
    if(up>0||gmax>.2||sb/sn>.06)bad.push(id+' 逆流'+up+' 勾配'+gmax.toFixed(2)+' 岸の歩行不可'+(sb/sn*100).toFixed(0)+'%')}}
  ok('C16 小川は下流へ単調に下り、勾配が緩く、両岸の歩行不可が6%以下',bad.length===0,bad.join(' '))}
 {const detour=(T,H)=>{const step=2,n=Math.floor(H*2/step),W=new Uint8Array(n*n);for(let i=0;i<n;i++)for(let j=0;j<n;j++)W[i*n+j]=T.walkable(-H+(i+.5)*step,-H+(j+.5)*step)?1:0;
   const r=mul32(7),out=[];let tries=0;while(out.length<60&&tries++<4000){const i=Math.floor(r()*n),j=Math.floor(r()*n);if(!W[i*n+j]||!T.reach(-H+(i+.5)*step,-H+(j+.5)*step))continue;
    const dist=new Int32Array(n*n).fill(-1);dist[i*n+j]=0;const q=[[i,j]];let hd=0;while(hd<q.length){const[a,b]=q[hd++];for(const[da,db]of[[1,0],[-1,0],[0,1],[0,-1]]){const na=a+da,nb=b+db;if(na<0||nb<0||na>=n||nb>=n||!W[na*n+nb]||dist[na*n+nb]>=0)continue;dist[na*n+nb]=dist[a*n+b]+1;q.push([na,nb])}}
    const ti=i+Math.floor((r()*2-1)*20),tj=j+Math.floor((r()*2-1)*20);if(ti<0||tj<0||ti>=n||tj>=n||dist[ti*n+tj]<=0)continue;const man=Math.abs(ti-i)+Math.abs(tj-j);if(man<8)continue;out.push(dist[ti*n+tj]/man)}
   out.sort((a,b)=>a-b);return{med:out[Math.floor(out.length*.5)],p90:out[Math.floor(out.length*.9)],n:out.length}};
  let bad=[];for(const id of AREAS){const d=detour(mk(id),DATA.areas[id].half);if(d.n<30||d.med>1.05||d.p90>1.35)bad.push(id+' n='+d.n+' 中央値'+(d.med||0).toFixed(2)+' 90%点'+(d.p90||0).toFixed(2))}
  ok('C17 長い壁がない：近い2点間の歩行距離が最短距離の1.05倍以内(中央値)・1.35倍以内(90%点)',bad.length===0,bad.join(' '))}
 {let bad=[];for(const id of AREAS){const H=DATA.areas[id].half,T=mk(id),ext=H+26;for(let t=-ext;t<=ext;t+=6)for(const[x,z]of[[t,ext],[t,-ext],[ext,t],[-ext,t]])if(Math.abs(T.h(x,z)-T.plateau)>.3)bad.push(id+'@'+x.toFixed(0)+','+z.toFixed(0)+' '+(T.h(x,z)-T.plateau).toFixed(2))}
  const fs=Terrain.farStrips(50,76),inner=[-fs[0].cz-fs[0].d/2,fs[1].cz-fs[1].d/2,-fs[2].cx-fs[2].w/2,fs[3].cx-fs[3].w/2],ov=(a,b)=>Math.min(a.cx+a.w/2,b.cx+b.w/2)-Math.max(a.cx-a.w/2,b.cx-b.w/2)>.01&&Math.min(a.cz+a.d/2,b.cz+b.d/2)-Math.max(a.cz-a.d/2,b.cz-b.d/2)>.01,foot={cx:0,cz:0,w:152,d:152};
  ok('C18 地形メッシュの外周は台地と同じ高さで、外側を埋める帯は地形メッシュに重ならない(谷が隠れない)',bad.length===0&&inner.every(v=>Math.abs(v-76)<1e-9)&&fs.every(f=>!ov(f,foot)),bad.slice(0,3).join(' '))}
 // --- ゲーム本体に組み込んだ後
 S=validate(defSave());S.rank=10;S.unlocked=['satoyama','forest','mountain','deep'];go('satoyama');
 {const gtrees=trees.filter(q=>q[3]==='tree'),rocks=trees.filter(q=>q[3]==='rock');
  ok('G1 里山を構築：樹木・岩が生成され、全て障害物として登録される',!TER.flat&&gtrees.length>60&&rocks.length>=8&&TG.size()===trees.length,'木'+gtrees.length+' 岩'+rocks.length)}
 {const gt=trees.filter(q=>q[3]==='tree');let bad=0,byZ={};for(const q of gt){if(!TER.walkable(q[0],q[1])||TER.isWater(q[0],q[1])||TER.zoneAt(q[0],q[1])==='path')bad++;const z=TER.zoneAt(q[0],q[1]);byZ[z]=(byZ[z]||0)+1}
  const zs=Terrain.stats(TER,50,2).zones,dens=z=>(byZ[z]||0)/Math.max(.001,zs[z]||.001);
  ok('G2 樹木は水中・林道に無く、雑木林が最も密で、田畑はまばら',bad===0&&dens('wood')>dens('open')*2&&dens('field')<dens('open'),'密度 wood='+dens('wood').toFixed(0)+' open='+dens('open').toFixed(0)+' field='+dens('field').toFixed(0))}
 {const snap=()=>JSON.stringify(trees.filter(q=>q[3]==='tree'||q[3]==='rock'));const a=snap();go('base');go('satoyama');ok('G3 同じエリアは毎回同じ樹木・岩の配置(罠や痕跡の位置関係が変わらない)',a===snap())}
 {let same=true;const r=R(31);const brute=(x,z)=>trees.some(q=>Math.hypot(x-q[0],z-q[1])<(q[2]||.7)+.4);for(let i=0;i<800;i++){const x=(r()*2-1)*50,z=(r()*2-1)*50;if(blocked(x,z)!==brute(x,z))same=false}
  ok('G4 障害物判定(空間グリッド)が従来の総当たり判定と一致',same)}
 {let same=true;const r=R(41);const oldOcc=(ax,az,bx,bz)=>{let n=0;const vx=bx-ax,vz=bz-az,L=vx*vx+vz*vz||1;for(const q of trees){const t=((q[0]-ax)*vx+(q[1]-az)*vz)/L;if(t<.05||t>.95)continue;const big=(q[2]||.7)>1;if(Math.hypot(ax+vx*t-q[0],az+vz*t-q[1])<(big?q[2]:.9)){n+=big?2:1;if(n>=2)return true}}return false};
  for(let i=0;i<500;i++){const ax=(r()*2-1)*45,az=(r()*2-1)*45,bx=ax+(r()*2-1)*40,bz=az+(r()*2-1)*40;if(occ(ax,az,bx,bz)!==oldOcc(ax,az,bx,bz))same=false}ok('G5 視線の遮り判定(空間グリッド)が総当たりと一致',same)}
 {ok('G6 出発時、プレイヤーは地面の高さに立つ',Math.abs(player.position.y-TER.h(player.position.x,player.position.z))<1e-9&&TER.walkable(player.position.x,player.position.z))}
 {let off=0,kinds={},runs=40;for(let i=0;i<runs;i++){go('satoyama');for(const a of AN){if(!TER.walkable(a.g.position.x,a.g.position.z)||TER.isWater(a.g.position.x,a.g.position.z)||Math.abs(a.g.position.y-TER.h(a.g.position.x,a.g.position.z))>1e-6||!TER.reach(a.g.position.x,a.g.position.z))off++;if(a.k==='deer'||a.k==='boar'){const z=TER.zoneAt(a.g.position.x,a.g.position.z);(kinds[a.k]=kinds[a.k]||{})[z]=(kinds[a.k][z]||0)+1}}}
  const tot=o=>Object.values(o||{}).reduce((s,v)=>s+v,0),frac=(o,ks)=>ks.reduce((s,k)=>s+((o||{})[k]||0),0)/Math.max(1,tot(o));
  ok('G7 動物は常に歩ける・水中でない・到達可能な地面に、地面の高さで配置される('+runs+'回)',off===0,'違反='+off);
  ok('G8 区域の好み：シカは開けた場所、イノシシは雑木林に多い',frac(kinds.deer,['open','field'])>.5&&frac(kinds.boar,['wood'])>.45,'シカ開='+(frac(kinds.deer,['open','field'])*100).toFixed(0)+'% イノシシ林='+(frac(kinds.boar,['wood'])*100).toFixed(0)+'%')}
 {go('satoyama');let moved=0,bad=0;const p=player.position;p.x=0;p.z=0;for(let f=0;f<900;f++){field(1/30,p);for(const a of AN){const x=a.g.position.x,z=a.g.position.z;if(!TER.walkable(x,z)||TER.isWater(x,z)||Math.abs(a.g.position.y-TER.h(x,z))>1e-6)bad++}}
  ok('G9 動物は歩き回っても(30秒相当)水中・急斜面に入らず、常に地面に接する',bad===0,'違反='+bad)}
 {go('satoyama');let wp=null;const r=R(8);for(let i=0;i<4000&&!wp;i++){const x=(r()*2-1)*44,z=(r()*2-1)*44;if(TER.isWater(x,z))wp=[x,z]}
  S.traps=[{id:'tw',type:'box',area:'satoyama',x:wp[0],z:wp[1],at:__NOW,n:0,seed:1,st:'set',chk:false,warned:false},{id:'tok',type:'box',area:'satoyama',x:0,z:3,at:__NOW,n:0,seed:2,st:'set',chk:false,warned:false}];
  const ok0=[S.traps[1].x,S.traps[1].z];syncTM();const t=S.traps[0],t2=S.traps[1];
  ok('G10 保存済みの罠が水中にあれば最寄りの使える場所へ補正され、問題ない罠は動かない',TER.walkable(t.x,t.z)&&!TER.isWater(t.x,t.z)&&!blocked(t.x,t.z)&&Math.hypot(t.x-wp[0],t.z-wp[1])<=30&&t2.x===ok0[0]&&t2.z===ok0[1])}
 {go('base');ok('G11 拠点は従来どおり平らで、施設が障害物として登録されている',TER.flat&&trees.filter(q=>q[3]==='bldg').length===DATA.facilities.length&&Math.abs(player.position.y)<1e-9)}
 {const src=__gamesrc;ok('G12 視線(発見・射撃)が地形による遮りと高低差を考慮している',(src.match(/TER\\.los\\(/g)||[]).length>=2&&/TER\\.vantage\\(/.test(src))}
})();`;
load(process.argv.slice(2),body);console.log(out.join('\n'));console.log('---',out.length,'項目 /',fails,'失敗 / 0 スキップ');process.exit(fails?1:0);
