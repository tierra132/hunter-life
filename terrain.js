/* 地形層：高低差・区域(林道/田畑/雑木林/小川)・歩行可否・斜面での移動速度・視線・衝突用の空間グリッド。
   描画やゲーム状態には依存しない純粋な関数だけで作り、同じ設定なら必ず同じ地形になります(セーブ済みの罠の座標も再現できます)。 */
'use strict';
const Terrain=(()=>{
  const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
  const lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function hash(ix,iz,s){let h=(Math.imul(ix,374761393)+Math.imul(iz,668265263)+Math.imul(s,1274126177))|0;h=Math.imul(h^(h>>>13),1274126177);return(((h^(h>>>16))>>>0)%1000003)/1000003}
  function vn(x,z,s){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
    return lerp(lerp(hash(ix,iz,s),hash(ix+1,iz,s),u),lerp(hash(ix,iz+1,s),hash(ix+1,iz+1,s),u),v)}
  const fbm=(x,z,s,o)=>{o=o||3;let a=.5,f=1,t=0,n=0;for(let i=0;i<o;i++){t+=a*vn(x*f,z*f,s+i*31);n+=a;a*=.5;f*=2}return t/n};
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

  function make(spec,half){
    if(!spec)return Object.assign({},FLAT,{half});
    const s=spec.seed||1,amp=spec.amp||0,sc=spec.scale||36,rise=spec.edgeRise||0,maxSlope=spec.maxSlope||.8;
    const path=spec.path?{pts:chaikin(spec.path.pts,2),w:spec.path.w}:null;
    const streams=(spec.streams||[]).map(o=>({pts:chaikin(o.pts,2),w:o.w,depth:o.depth||1}));
    const fields=spec.fields||[];
    const base=(x,z)=>amp*(fbm(x/sc,z/sc,s)-.5)*2,low=(x,z)=>amp*.55*(fbm(x/(sc*2.2),z/(sc*2.2),s+7)-.5)*2;
    const wn=(x,z)=>fbm(x/22+50,z/22-30,s+99,2),wthr=spec.woodThr===undefined?.5:spec.woodThr;
    const bedAt=(st,cx,cz)=>Math.min(low(cx,cz),base(cx,cz))-st.depth;
    function h(x,z){let y=base(x,z);
      y=lerp(0,y,sm(4,14,Math.hypot(x,z)));                                  // 出発地点の周りは平らにする
      for(const f of fields){const e=Math.hypot((x-f.x)/f.rx,(z-f.z)/f.rz),w=1-sm(.8,1.25,e);if(w>0)y=lerp(y,f.h===undefined?low(f.x,f.z):f.h,w)}  // 田畑：平坦
      if(path){const r=distPoly(x,z,path.pts),w=1-sm(path.w*.5,path.w*1.6,r.d);if(w>0)y=lerp(y,low(x,z),w)}                                         // 林道：緩やかで起伏が少ない
      for(const st of streams){const r=distPoly(x,z,st.pts),w=1-sm(st.w*.4,st.w*2.4,r.d);if(w>0)y=lerp(y,bedAt(st,r.cx,r.cz),w)}               // 小川：谷を掘る
      const de=half-Math.max(Math.abs(x),Math.abs(z));if(rise&&de<20)y+=rise*sm(20,-12,de);                                                     // 端は丘になり自然に行き止まり
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
    return{h,slope,grad,zoneAt,isWater,walkable,speedMul,los,vantage,colorAt,reach,streams,path,fields,half,spec,flat:false,low,
      waterY:(px,pz,st)=>{const r=distPoly(px,pz,st.pts);return bedAt(st,r.cx,r.cz)+st.depth*.55}}}

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
  return{make,pickSpot,nearestOk,stats,makeGrid,distPoly,chaikin,fbm,sm,FLAT}
})();
