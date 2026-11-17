/* 動物AI層：警戒度(0〜100の連続値)・個体差・状態遷移・逃走経路の選択・イノシシ/クマの威嚇と突進・群れ・音への反応。
   ゲーム本体(game.js)とは「環境オブジェクト e」だけでつながります(地形・障害物・移動処理・プレイヤー位置を渡す)。数値は data.js の DATA.ai。
   状態: normal(通常) / alert(警戒) / freeze(ウサギの硬直) / prep(逃走準備) / flee(逃走) / watch(逃走後の様子見) / threat(威嚇の予兆) / charge(突進) */
'use strict';
const AI=(()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const prof=k=>Object.assign({},DATA.aiBase,DATA.ai[k]||{});
  const traits=r=>({skit:r(),bold:r(),aggr:r()});                      // 神経質さ・落ち着き・攻撃性(0〜1)。画面には表示しない内部パラメータ
  const thr=a=>{const P=a.P||(a.P=prof(a.k)),s=a.pers.skit;return{al:P.tAlert*(1.2-.4*s),fl:P.tFlee*(1.12-.3*s)}};   // 警戒・逃走のしきい値(神経質なほど低い)
  function init(a,r){a.P=prof(a.k);a.pers=traits(r);a.aw=0;a.st='normal';a.t=0;a.wt=r()*3;a.cd=0;a.fd=0;a.rep=0;a.hopD=a.P.hop[0]+r()*(a.P.hop[1]-a.P.hop[0]);a.angry=false;return a}
  const face=(a,e)=>{const g=a.g;g.rotation.y=Math.atan2(e.p.x-g.position.x,e.p.z-g.position.z)};
  const distTo=(a,e)=>Math.hypot(a.g.position.x-e.p.x,a.g.position.z-e.p.z);

  /* 警戒度の増加量(毎秒)。近いほど・動いているほど・見通しが良いほど・犬が近いほど大きい */
  function gainOf(a,e,d,vis){const P=a.P,R=P.sense*e.senseMul;if(d>=R)return 0;let g=P.gain*Math.pow(1-d/R,.9)*e.moveF*(vis?1:.3)*(.75+.5*a.pers.skit);
    for(const o of e.dogs)if(Math.hypot(o.x-a.g.position.x,o.z-a.g.position.z)<12){g*=1.5;break}return g}
  const visible=(a,e)=>{const g=a.g.position,p=e.p;return!e.occ(p.x,p.z,g.x,g.z)&&e.TER.los(p.x,p.y+1.6,p.z,g.x,g.y+.8,g.z)};

  /* 群れ：仲間の警戒度を上げる(シカなど) */
  function alertMates(a,e,amt){if(a.gid==null||!e.all)return;for(const o of e.all){if(o===a||o.gid!==a.gid)continue;if(Math.hypot(o.g.position.x-a.g.position.x,o.g.position.z-a.g.position.z)<45)o.aw=Math.min(100,o.aw+amt*(.7+.5*o.pers.skit))}}

  /* 逃走方向：真後ろ±約110°を試し、通れる長さ・遮蔽(木/岩/地形の陰)・外周への近さ・ばらつきで選ぶ(エリアの端へ一直線にはならない) */
  function chooseFlee(a,e){const g=a.g.position,P=a.P,p=e.p,away=Math.atan2(g.x-p.x,g.z-p.z),C=[];
    for(let k=-5;k<=5;k++){const th=away+k*.38+(e.rnd()-.5)*.2,sx=Math.sin(th),cz=Math.cos(th);let free=0;
      for(let r=2;r<=14;r+=2){const x=g.x+sx*r,z=g.z+cz*r;if(Math.abs(x)>e.half-2||Math.abs(z)>e.half-2||!e.TER.walkable(x,z)||e.TER.isWater(x,z)||e.blocked(x,z))break;free=r}
      if(free<2)continue;const ex=g.x+sx*free,ez=g.z+cz*free;
      const cover=(free>=4&&(e.occ(p.x,p.z,ex,ez)||!e.TER.los(p.x,p.y+1.6,p.z,ex,e.TER.h(ex,ez)+.6,ez)))?1:0,awayDot=Math.cos(th-away),edge=Math.min(1,(e.half-Math.max(Math.abs(ex),Math.abs(ez)))/20);
      C.push({th,free,sc:free/14*.9+awayDot*.9+cover*P.cover*1.2+edge*.9+(e.rnd()-.5)*.5*(1.3-a.pers.bold)})}
    if(!C.length)return away+(e.rnd()<.5?1.57:-1.57);                                      // 行き止まり：端に沿って逃げる
    const long=C.filter(c=>c.free>=6),L=long.length?long:C;                                  // 次の再計算(約0.6秒)までに端へぶつからない方向を優先
    let best=L[0];for(const c of L)if(c.sc>best.sc)best=c;return best.th}

  const canCharge=(a,e,d)=>{const P=a.P;return(P.behavior==='charge'||P.behavior==='bear')&&a.cd<=0&&d<=P.chargeRange&&(a.angry||a.pers.aggr>=P.aggrThr)};
  function toAlert(a,e){a.st=a.P.behavior==='hop'?'freeze':'alert';a.t=0;a.mv=false;alertMates(a,e,40)}
  function startFlee(a,e){a.st='flee';a.t=0;a.fd=0;a.rep=0;a.ts=0;alertMates(a,e,45)}
  function decide(a,e,d){const P=a.P;
    if(canCharge(a,e,d)){a.st='threat';a.t=0;a.tele=P.tele*(.85+.3*e.rnd());a.angry=true;e.ev('threat',a);return}
    a.st='prep';a.t=0;a.react=(P.react[0]+e.rnd()*(P.react[1]-P.react[0]))*(1.25-.5*a.pers.skit);alertMates(a,e,45)}

  /* 1フレーム進める */
  function step(a,e){const g=a.g,P=a.P||(a.P=prof(a.k)),dt=e.dt,d=distTo(a,e),T=thr(a);
    a.cd=Math.max(0,a.cd-dt);
    let gn=0;if(d<P.sense*e.senseMul)gn=gainOf(a,e,d,visible(a,e));
    if(d<P.fleeDist*(.8+.4*a.pers.skit)&&a.st!=='charge')gn+=60;                               // ごく近いと即座に気づく
    if(gn>0)a.aw=Math.min(100,a.aw+gn*dt);else a.aw=Math.max(0,a.aw-P.decay*(.7+.6*a.pers.bold)*(a.st==='alert'||a.st==='freeze'?.5:1)*dt);
    a.t+=dt;
    switch(a.st){
    case'normal':{if(a.t>=a.wt){a.t=0;a.wt=3+e.rnd()*5;a.mv=e.rnd()<.6;const r=e.rnd()*7,an=e.rnd()*6.28;a.tx=e.cl(a.hx+Math.cos(an)*r);a.tz=e.cl(a.hz+Math.sin(an)*r)}
      if(a.mv){const ex=a.tx-g.position.x,ez=a.tz-g.position.z;if(Math.hypot(ex,ez)<.5)a.mv=false;else e.step(a,Math.atan2(ex,ez),a.D.speed,dt)}
      if(a.aw>=T.al)toAlert(a,e);break}
    case'alert':{face(a,e);if(a.t>P.hold*(1.3-a.pers.skit))a.aw=Math.min(100,a.aw+6*dt);                // 長く見合うと落ち着かなくなる
      if(a.aw>=T.fl||d<P.fleeDist*(.9+.3*a.pers.skit)){decide(a,e,d);break}
      if(a.aw<T.al*.45){a.st='normal';a.t=0;a.wt=2}break}
    case'freeze':{face(a,e);                                                                       // ウサギ：じっと動かず、近づかれると跳ねて逃げる
      if(a.aw>=T.fl||d<P.freezeBreak*(.8+.4*a.pers.skit)){startFlee(a,e);break}
      if(a.aw<T.al*.4&&a.t>3){a.st='normal';a.t=0;a.wt=2}break}
    case'prep':{face(a,e);if(a.t>=a.react)startFlee(a,e);break}
    case'threat':{face(a,e);if(d>P.chargeRange*1.5){a.st='alert';a.t=0;a.angry=false;break}
      if(a.t>=a.tele){a.st='charge';a.t=0;a.cdir=Math.atan2(g.position.x-e.p.x,g.position.z-e.p.z)+Math.PI;e.ev('charge',a)}break}      // 予兆のあと、その時点のプレイヤーの方向へ一直線(横へ避ければ当たらない)
    case'charge':{const bx=g.position.x,bz=g.position.z;e.step(a,a.cdir,P.chargeSpeed,dt);const moved=Math.hypot(g.position.x-bx,g.position.z-bz),dp=distTo(a,e);
      if(dp<1.4){e.ev('hit',a,{dir:a.cdir});a.cd=12;a.angry=false;a.st='flee';a.t=0;a.fd=0;a.rep=.6;a.hd=a.cdir;break}
      if(a.t>=P.chargeDur||moved<.01){a.cd=8;a.angry=false;if(P.behavior==='bear'){a.st='watch';a.t=0}else{a.st='flee';a.t=0;a.fd=0;a.rep=0}}break}
    case'flee':{a.rep-=dt;if(a.rep<=0||a.hd===undefined){a.hd=chooseFlee(a,e);a.rep=.6}
      const burst=a.t<P.burst,spd=a.D.flee*(burst?1:P.trot)*((P.behavior==='bear'&&!a.angry)?P.retreat:1),bx=g.position.x,bz=g.position.z;
      e.step(a,a.hd,spd,dt);a.fd+=Math.hypot(g.position.x-bx,g.position.z-bz);a.ts=(a.ts||0)-dt;if(a.ts<=0){a.ts=.4;e.ev('trail',a)}
      const safe=P.safe*(.85+.3*a.pers.skit);
      if(P.behavior==='hop'&&a.fd>=a.hopD){a.fd=0;a.hopD=P.hop[0]+e.rnd()*(P.hop[1]-P.hop[0]);a.st=d<safe?'freeze':'watch';a.t=0;a.aw=Math.max(a.aw,T.al+2);break}   // ウサギは短く跳ねて止まる
      if(d>safe||a.t>10){a.st='watch';a.t=0;a.mv=false}break}
    case'watch':{face(a,e);if(a.aw>=T.fl*.9&&d<P.safe){startFlee(a,e);break}
      if(a.t>(a.wT||(a.wT=2.5+e.rnd()*3))){a.wT=0;a.st='normal';a.hx=g.position.x;a.hz=g.position.z;a.t=0;a.wt=2}break}
    }}

  /* 音(銃声など)：距離に応じて警戒度が上がる。仲間にも伝わる */
  function hear(a,e,s){const P=a.P||(a.P=prof(a.k)),d=Math.hypot(a.g.position.x-s.x,a.g.position.z-s.z);if(d>=s.power)return 0;
    const add=70*Math.pow(1-d/s.power,.7)*(P.noise||1)*(.7+.6*a.pers.skit);a.aw=Math.min(100,a.aw+add);alertMates(a,e,add*.6);return add}
  /* 命中したが仕留められなかったとき：逃げる。イノシシ・クマは反撃に転じることがある */
  function hit(a,e){const P=a.P||(a.P=prof(a.k)),d=distTo(a,e);a.aw=100;a.wound=45;a.hint=40;a.mv=false;
    if((P.behavior==='charge'||P.behavior==='bear')&&a.cd<=0&&d<=P.chargeRange*1.5&&e.rnd()<P.woundCharge){a.st='threat';a.t=0;a.tele=P.tele*.6;a.angry=true;e.ev('threat',a)}
    else{a.st='flee';a.t=0;a.fd=0;a.rep=0;a.ts=0}}
  return{init,step,hear,hit,gainOf,chooseFlee,thr,prof,traits}
})();
