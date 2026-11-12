/* 地形層：高低差・区域(林道/田畑/雑木林/小川)・歩行可否・斜面での移動速度・視線・衝突用の空間グリッド。
   描画やゲーム状態には依存しない純粋な関数だけで作り、同じ設定なら必ず同じ地形になります(セーブ済みの罠の座標も再現できます)。 */
'use strict';
const Terrain=(()=>{
  const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
  const lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function hash(ix,iz,s){let h=(Math.imul(ix,374761393)+Math.imul(iz,668265263)+Math.imul(s,1274126177))|0;h=Math.imul(h^(h>>>13),1274126177);return(((h^(h>>>16))>>>0)%1000003)/1000003}
  function vn(x,z,s){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
    return lerp(lerp(hash(ix,iz,s),hash(ix+1,iz,s),u),lerp(hash(ix,iz+1,s),hash(ix+1,iz+1,s),u),v)}
  const fbm=(x,z,s,o,gain)=>{o=o||3;gain=gain||.5;let a=.5,f=1,t=0,n=0;for(let i=0;i<o;i++){t+=a*vn(x*f,z*f,s+i*31);n+=a;a*=gain;f*=2}return t/n};
  function distSeg(px,pz,ax,az,bx,bz){const vx=bx-ax,vz=bz-az,L=vx*vx+vz*vz||1;let t=((px-ax)*vx+(pz-az)*vz)/L;t=clamp(t,0,1);const cx=ax+vx*t,cz=az+vz*t;return{d:Math.hypot(px-cx,pz-cz),cx,cz}}
  function distPoly(px,pz,pts){let b={d:1e9,cx:0,cz:0};for(let i=0;i<pts.length-1;i++){const r=distSeg(px,pz,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1]);if(r.d<b.d)b=r}return b}
  function chaikin(pts,it){let p=pts.map(q=>q.slice());for(let k=0;k<(it||0);k++){const o=[p[0]];for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1];o.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75])}o.push(p[p.length-1]);p=o}return p}

  /* 空間グリッド：木・岩などの障害物を素早く探す */
  function makeGrid(cell){const m=new Map(),key=(i,j)=>i*100003+j;
    return{add(q){const k=key(Math.floor(q[0]/cell),Math.floor(q[1]/cell));let a=m.get(k);if(!a)m.set(k,a=[]);a.push(q)},
      /* 半径r内の候補を順に cb へ渡す。cb が true を返したら即終了して true を返す */
      near(x,z,r,cb){const i0=Math.floor((x-r)/cell),i1=Math.floor((x+r)/cell),j0=Math.floor((z-r)/cell),j1=Math.floor((z+r)/cell);
        for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const a=m.get(key(i,j));if(a)for(const q of a)if(cb(q)===true)return true}return false},
      clear(){m.clear()},size(){let n=0;m.forEach(a=>n+=a.length);return n}}}

  const FLAT={reach:()=>true,h:()=>0,slope:()=>0,zoneAt:()=>'open',isWater:()=>false,walkable:()=>true,speedMul:()=>1,los:()=>true,vantage:()=>1,colorAt:()=>[.45,.6,.33],grad:()=>[0,0],streams:[],path:null,fields:[],flat:true,half:0,spec:{}};

  /* 特徴(林道・小川・田畑・出発地点)を周囲の地形になだらかにつなぐ：特徴からの距離に応じて、高さの差を「勾配g以内」に抑える。
     これにより、特徴の縁に崖(直線状の壁)ができない。a=現在の高さ、ft=特徴の高さ、d=特徴の縁までの距離 */
  function proj(y,dd,ft,g){if(dd<=0)return ft;const l=g*dd,dev=y-ft,a=Math.abs(dev),k=.7*l,o=a<=k?a:k+(l-k)*Math.tanh((a-k)/(l-k+1e-9));return ft+(dev<0?-o:o)}
  /* 折れ線(林道・小川)に沿った高さの断面：緩い勾配に制限し、滑らかにする。小川は下流へ向かって単調に下る */
  function mkProfile(pts,fn,gmax,mono){const n=pts.length,len=[0];for(let i=1;i<n;i++)len.push(len[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
    let y=pts.map(p=>fn(p[0],p[1]));
    const sweep=()=>{for(let i=1;i<n;i++){const m=gmax*(len[i]-len[i-1]);y[i]=clamp(y[i],y[i-1]-m,y[i-1]+m)}for(let i=n-2;i>=0;i--){const m=gmax*(len[i+1]-len[i]);y[i]=clamp(y[i],y[i+1]-m,y[i+1]+m)}};
    for(let k=0;k<6;k++)sweep();
    for(let k=0;k<3;k++){const c=y.slice();for(let i=1;i<n-1;i++)y[i]=(c[i-1]+2*c[i]+c[i+1])/4}
    if(mono){const dir=y[0]>=y[n-1]?1:-1;if(dir>0){for(let i=1;i<n;i++)y[i]=Math.min(y[i],y[i-1]-.02*(len[i]-len[i-1]))}else{for(let i=n-2;i>=0;i--)y[i]=Math.min(y[i],y[i+1]-.02*(len[i+1]-len[i]))}}
    return{len,y}}
  function nearProf(px,pz,pts,pr){let b={d:1e9,cx:0,cz:0,y:0};for(let i=0;i<pts.length-1;i++){const r=distSeg(px,pz,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1]);if(r.d<b.d){const L=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1])||1,t=Math.hypot(r.cx-pts[i][0],r.cz-pts[i][1])/L;b={d:r.d,cx:r.cx,cz:r.cz,y:pr.y[i]+(pr.y[i+1]-pr.y[i])*t}}}return b}
  /* エリアの外側(地形メッシュの外)を埋める4枚の帯。地形メッシュの上には重ならないので、谷が隠れることはない */
  function farStrips(half,ext){const W=ext||half+26,B=half*2+600;return[{cx:0,cz:-(W+B/2),w:B*2,d:B},{cx:0,cz:W+B/2,w:B*2,d:B},{cx:-(W+B/2),cz:0,w:B,d:W*2},{cx:W+B/2,cz:0,w:B,d:W*2}]}

  function make(spec,half){
    if(!spec)return Object.assign({},FLAT,{half,plateau:0});
    const s=spec.seed||1,amp=spec.amp||0,sc=spec.scale||36,rise=spec.edgeRise||0,maxSlope=spec.maxSlope||.8,gain=spec.gain||.42;
    const path=spec.path?{pts:chaikin(spec.path.pts,2),w:spec.path.w}:null;
    const streams=(spec.streams||[]).map(o=>({pts:chaikin(o.pts,2),w:o.w,depth:o.depth||1}));
    const fields=spec.fields||[];
    const deOf=(x,z)=>half-Math.max(Math.abs(x),Math.abs(z));
    const raw=(x,z)=>amp*(fbm(x/sc,z/sc,s,3,gain)-.5)*2;
    const base=(x,z)=>{const de=deOf(x,z);return raw(x,z)*(de>=0?1:1-sm(0,-14,de))};                // 外側は平らな台地へ
    const low=(x,z)=>amp*.55*(fbm(x/(sc*2.2),z/(sc*2.2),s+7,2,gain)-.5)*2;
    if(path)path.prof=mkProfile(path.pts,low,.26,false);
    for(const st of streams)st.prof=mkProfile(st.pts,(x,z)=>Math.min(low(x,z),base(x,z))-st.depth,.1,true);
    const wn=(x,z)=>fbm(x/22+50,z/22-30,s+99,2),wthr=spec.woodThr===undefined?.5:spec.woodThr;
    const startY=path?nearProf(0,0,path.pts,path.prof).y:low(0,0);
    function h(x,z){let y=base(x,z);
      y=proj(y,Math.hypot(x,z)-5,startY,.3);                                                     // 出発地点：半径5mは平ら、周囲へなだらかに
      for(const f of fields){const e=Math.hypot((x-f.x)/f.rx,(z-f.z)/f.rz),ft=f.h===undefined?low(f.x,f.z):f.h;y=e<=1?ft:proj(y,(e-1)*Math.min(f.rx,f.rz),ft,.3)}   // 田畑：平坦
      if(path){const r=nearProf(x,z,path.pts,path.prof);y=proj(y,r.d-(path.w*.5+.8),r.y,.34)}   // 林道：緩やかな帯
      for(const st of streams){const r=nearProf(x,z,st.pts,st.prof);y=proj(y,r.d-st.w*.5,r.y,.6)}  // 小川：谷
      const de=deOf(x,z);if(rise&&de<20)y+=rise*sm(20,-12,de);                                  // 端は丘になり自然に行き止まり
      return y}
    function grad(x,z){const e=1;return[(h(x+e,z)-h(x-e,z))/(2*e),(h(x,z+e)-h(x,z-e))/(2*e)]}
    const slope=(x,z)=>{const g=grad(x,z);return Math.hypot(g[0],g[1])};
    function isWater(x,z){for(const st of streams)if(distPoly(x,z,st.pts).d<st.w*.55)return true;return false}
    function zoneAt(x,z){for(const st of streams)if(distPoly(x,z,st.pts).d<st.w*1.4)return'stream';
      if(path&&distPoly(x,z,path.pts).d<path.w*.9)return'path';
      for(const f of fields)if(Math.hypot((x-f.x)/f.rx,(z-f.z)/f.rz)<1)return'field';
      return wn(x,z)>wthr?'wood':'open'}
    const walkable=(x,z)=>Math.abs(x)<half-.6&&Math.abs(z)<half-.6&&slope(x,z)<maxSlope;
    function speedMul(x,z,dx,dz){const g=grad(x,z),up=g[0]*dx+g[1]*dz;let m=up>0?1-.6*up:1+.25*(-up);m=clamp(m,.35,1.12);if(isWater(x,z))m*=.6;else if(zoneAt(x,z)==='path')m*=1.06;return m}
    /* 視線：目の高さ(ay)から相手(by)まで、途中の地面に遮られないか */
    function los(ax,ay,az,bx,by,bz){const d=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(d/2));for(let i=1;i<n;i++){const t=i/n;if(h(ax+(bx-ax)*t,az+(bz-az)*t)>ay+(by-ay)*t-.05)return false}return true}
    const vantage=(py,ty)=>clamp(1+.02*(py-ty),.85,1.25);
    const PAL={open:[.42,.6,.3],wood:[.3,.46,.26],field:[.62,.64,.32],path:[.62,.54,.38],stream:[.46,.44,.3],rock:[.5,.48,.43]};
    function colorAt(x,z){const zn=zoneAt(x,z);let c=PAL[zn].slice();const sl=slope(x,z),k=clamp((sl-.4)/.4,0,1);for(let i=0;i<3;i++)c[i]=lerp(c[i],PAL.rock[i],k*.8);
      const v=.9+.2*vn(x*.7,z*.7,s+5);return[clamp(c[0]*v,0,1),clamp(c[1]*v,0,1),clamp(c[2]*v,0,1)]}
    /* 出発地点から歩いて到達できるか(孤立した窪地・崖の上を除く)。初回に1度だけ計算 */
    let RM=null;function reachMap(){if(RM)return RM;const step=2,n=Math.max(1,Math.floor(half*2/step)),d=new Uint8Array(n*n),w=new Uint8Array(n*n);
      for(let i=0;i<n;i++)for(let j=0;j<n;j++)w[i*n+j]=walkable(-half+(i+.5)*step,-half+(j+.5)*step)?1:0;
      const si=Math.min(n-1,Math.floor(half/step)),q=[[si,si]];if(w[si*n+si]){d[si*n+si]=1;while(q.length){const[i,j]=q.pop();for(const[a,b]of[[1,0],[-1,0],[0,1],[0,-1]]){const ni=i+a,nj=j+b;if(ni<0||nj<0||ni>=n||nj>=n)continue;if(w[ni*n+nj]&&!d[ni*n+nj]){d[ni*n+nj]=1;q.push([ni,nj])}}}}
      return RM={n,step,d}}
    const reach=(x,z)=>{const m=reachMap(),i=Math.floor((x+half)/m.step),j=Math.floor((z+half)/m.step);return i>=0&&j>=0&&i<m.n&&j<m.n&&m.d[i*m.n+j]===1};
    return{h,slope,grad,zoneAt,isWater,walkable,speedMul,los,vantage,colorAt,reach,streams,path,fields,half,spec,flat:false,low,plateau:rise,
      waterY:(px,pz,st)=>nearProf(px,pz,st.pts,st.prof).y+st.depth*.55}}

  /* 条件に合う場所を探す(区域ごとの好みで重みづけ)。見つからなければ null */
  function pickSpot(T,rnd,half,o){o=o||{};for(let i=0;i<(o.tries||60);i++){const x=(rnd()*2-1)*(half-5),z=(rnd()*2-1)*(half-5);
      if(!T.walkable(x,z)||T.isWater(x,z))continue;if(o.minFrom&&Math.hypot(x-o.minFrom[0],z-o.minFrom[1])<o.minDist)continue;
      if(o.zones){const w=o.zones[T.zoneAt(x,z)];if(!(w>0)||rnd()>w)continue}
      if(o.test&&!o.test(x,z))continue;return[x,z]}return null}
  /* 指定の点が使えないとき、最も近い使える点へ(罠の位置補正など。結果は決定的) */
  function nearestOk(T,x,z,maxR,extra){const ok=(a,b)=>T.walkable(a,b)&&!T.isWater(a,b)&&(!extra||extra(a,b));if(ok(x,z))return[x,z];
    for(let r=1;r<=maxR;r++)for(let k=0;k<Math.max(8,r*6);k++){const a=k/Math.max(8,r*6)*Math.PI*2,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(ok(px,pz))return[px,pz]}return null}
  /* 地形の健全性指標(テスト・調整用) */
  function stats(T,half,step){step=step||2;const n=Math.floor(half*2/step),idx=(i,j)=>i*n+j,W=new Uint8Array(n*n),Z={};let walk=0,water=0,hmin=1e9,hmax=-1e9;
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){const x=-half+(i+.5)*step,z=-half+(j+.5)*step,y=T.h(x,z);hmin=Math.min(hmin,y);hmax=Math.max(hmax,y);
      const w=T.walkable(x,z);W[idx(i,j)]=w?1:0;if(w)walk++;if(T.isWater(x,z))water++;const zn=T.zoneAt(x,z);Z[zn]=(Z[zn]||0)+1}
    const si=clamp(Math.floor((0+half)/step),0,n-1),seen=new Uint8Array(n*n),q=[[si,si]];let reach=0;
    if(W[idx(si,si)]){seen[idx(si,si)]=1;while(q.length){const[i,j]=q.pop();reach++;for(const[a,b]of[[1,0],[-1,0],[0,1],[0,-1]]){const ni=i+a,nj=j+b;if(ni<0||nj<0||ni>=n||nj>=n)continue;if(W[idx(ni,nj)]&&!seen[idx(ni,nj)]){seen[idx(ni,nj)]=1;q.push([ni,nj])}}}}
    const tot=n*n;return{walkFrac:walk/tot,reachFrac:walk?reach/walk:0,waterFrac:water/tot,hmin,hmax,zones:Object.fromEntries(Object.entries(Z).map(([k,v])=>[k,v/tot]))}}
  return{make,pickSpot,nearestOk,stats,makeGrid,distPoly,chaikin,fbm,sm,farStrips,FLAT}
})();
