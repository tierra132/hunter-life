/* 3Dモデル層：GLBモデルの読み込み・アニメーション状態管理・読み込み失敗時の代替モデル。
   ゲームロジック(game.js)はここの ModelKit.create(種類) だけを使います。モデルの追加・差し替えは data.js の DATA.models と assets/models/ のみで行えます。 */
'use strict';

/* ---- 純粋関数（ブラウザ無しでテストできる部分） ---- */
/* 候補名のうち、実際にあるクリップ名と一致するものを返す。大文字小文字・"Armature|" 等の接頭辞を無視し、完全一致→前方/部分一致の順 */
function resolveClip(names,wanted){
  if(!names||!names.length||!wanted||!wanted.length)return null;
  const norm=s=>String(s).split('|').pop().replace(/[\s_\-.]/g,'').toLowerCase();
  const list=names.map(n=>[n,norm(n)]);
  for(const w of wanted){const t=norm(w);const e=list.find(x=>x[1]===t);if(e)return e[0]}
  for(const w of wanted){const t=norm(w);const e=list.find(x=>x[1].startsWith(t)||x[1].includes(t));if(e)return e[0]}
  return null}
/* 速度(m/s)と状況から、再生する状態を決める */
function pickState(speed,hint,thr){thr=thr||{idle:.15,run:3.2};
  if(hint==='alert'||hint==='aim')return hint;
  if(hint==='flee')return speed<thr.idle?'idle':'run';
  return speed<thr.idle?'idle':speed<thr.run?'walk':'run'}
/* 移動速度に合わせた再生速度（足が滑らないように、歩幅と移動速度を合わせる） */
function timeScaleFor(state,speed,ref){ref=ref||{walk:1.4,run:6};
  const c=(v,a,b)=>Math.max(a,Math.min(b,v));
  return state==='walk'?c(speed/ref.walk,.6,1.7):state==='run'?c(speed/ref.run,.7,1.6):1}
const lerpK=(dt,rate)=>1-Math.exp(-dt*rate);

const ModelKit=(()=>{
  const cache={},errors=[];let loader=null;
  const defs=()=>DATA.modelDefaults||{};
  const entry=k=>Object.assign({},defs(),DATA.models[k]||{});
  const log=(...a)=>{try{console.warn('[ModelKit]',...a)}catch(e){}};

  /* ---- GLB 読み込み ---- */
  function loadOne(kind,timeoutMs){
    const m=entry(kind);
    if(cache[kind])return Promise.resolve(cache[kind]);
    if(!m.src||typeof THREE==='undefined'||!THREE.GLTFLoader){return Promise.resolve(cache[kind]={fallback:true,reason:'no-src-or-loader'})}
    if(!loader)loader=new THREE.GLTFLoader();
    return new Promise(res=>{
      let done=false;const fin=v=>{if(!done){done=true;clearTimeout(tm);cache[kind]=v;res(v)}};
      const fail=(why,quiet)=>{if(!quiet&&!m.optional)errors.push({kind,why:String(why)});if(!quiet)log(kind,'読み込み失敗→代替表示',why);fin({fallback:true,reason:String(why)})};
      const tm=setTimeout(()=>fail('timeout',false),timeoutMs||15000);
      try{loader.load(m.src,gltf=>{try{
          if(!gltf||!gltf.scene)return fail('no-scene');
          fixMaterials(gltf.scene,m);fin({fallback:false,gltf,clips:(gltf.animations||[]).map(a=>a.name)})}catch(e){fail(e.message)}},
        undefined,err=>fail((err&&err.message)||'load-error',!!m.optional))}catch(e){fail(e.message)}})}
  async function preloadAll(onProgress){const kinds=Object.keys(DATA.models);let d=0;
    await Promise.all(kinds.map(k=>loadOne(k).then(()=>{d++;if(onProgress)onProgress(d,kinds.length)})));return status()}
  function status(){const glb=[],fb=[];for(const k of Object.keys(DATA.models))(cache[k]&&!cache[k].fallback?glb:fb).push(k);return{glb,fallback:fb,errors:errors.slice()}}
  const _inject=(k,v)=>{cache[k]=v},_reset=()=>{for(const k in cache)delete cache[k];errors.length=0;loader=null};

  /* GLBの材質調整：本ゲームの描画(リニア出力)に合わせ、暗くなる・金属で真っ黒になる問題を避ける */
  function fixMaterials(root,m){root.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=true;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    for(const mt of mats){if(!mt)continue;
      if(mt.map){mt.map.encoding=THREE.LinearEncoding;mt.map.needsUpdate=true;if(mt.map.anisotropy)mt.map.anisotropy=1}
      if('metalness'in mt)mt.metalness=Math.min(mt.metalness||0,.1);if('roughness'in mt)mt.roughness=Math.max(mt.roughness||.8,.7);
      if(m&&m.noTransparent&&mt.transparent){mt.transparent=false;mt.alphaTest=.5}}})}

  /* ---- 共通：色味の変更(珍しい個体など) ---- */
  function tintAll(root,hex,amt){const c=new THREE.Color(hex);root.traverse(o=>{if(!o.isMesh)return;for(const mt of(Array.isArray(o.material)?o.material:[o.material])){if(mt&&mt.color&&mt.color.lerp&&!mt.userData?.keep)mt.color.lerp(c,amt)}})}

  /* ---- GLB アクター ---- */
  function glbActor(kind,c,m,opts){
    const src=(THREE.SkeletonUtils&&THREE.SkeletonUtils.clone)?THREE.SkeletonUtils.clone(c.gltf.scene):c.gltf.scene.clone(true);
    const root=new THREE.Group(),inner=new THREE.Group();inner.add(src);root.add(inner);inner.rotation.y=m.yaw||0;
    const box=new THREE.Box3().setFromObject(src),size=box.getSize(new THREE.Vector3());
    const by=m.fitBy||'length',L=(by==='height'?size.y:Math.max(size.x,size.z))||1,target=(opts&&(by==='height'?opts.height:opts.length))||m.fitSize||L;
    inner.scale.setScalar(target/L);const b2=new THREE.Box3().setFromObject(inner);
    inner.position.y+=-b2.min.y+(m.yOffset||0);const ctr=b2.getCenter(new THREE.Vector3());inner.position.x-=ctr.x;inner.position.z-=ctr.z;
    const mixer=new THREE.AnimationMixer(src),acts={},names=c.clips||[];
    for(const st of['idle','walk','run','alert','aim']){const n=resolveClip(names,m.clips&&m.clips[st]);if(n){const clip=c.gltf.animations.find(a=>a.name===n);if(clip)acts[st]=mixer.clipAction(clip)}}
    const A={root,kind,isFallback:false,state:null,acts,mixer,cur:null,speed:0,missing:['idle','walk','run'].filter(s=>!acts[s])};
    A.setState=(st,sp)=>{if(st===A.state)return;A.state=st;
      let next=acts[st]||(st==='alert'||st==='aim'?acts.idle:st==='run'?acts.walk:null),extra=(st==='run'&&!acts.run)?1.7:1;
      A._extra=extra;if(next===A.cur)return;if(A.cur)A.cur.fadeOut(.25);
      if(next){next.reset();next.setEffectiveWeight(1);next.fadeIn(.25);next.play()}A.cur=next};
    A.update=(dt,speed,hint)=>{A.speed=speed;const st=pickState(speed,hint,m.thr);A.setState(st,speed);
      if(A.cur)A.cur.setEffectiveTimeScale(timeScaleFor(st==='run'&&!acts.run?'walk':st,speed,m.ref)*(A._extra||1));mixer.update(dt)};
    A.tint=(hex,amt)=>tintAll(src,hex,amt);
    A.dispose=()=>{try{mixer.stopAllAction()}catch(e){}if(root.parent)root.parent.remove(root)};
    A.setState('idle',0);return A}

  /* ---- 代替：関節で動くモデル（素材が無い・読み込めないときに自動で使う） ---- */
  const M=col=>new THREE.MeshLambertMaterial({color:col});
  const ell=(rx,ry,rz,col)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(1,12,10),M(col));o.scale.set(rx,ry,rz);return o};
  const cyl=(r0,r1,h,col)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,h,8),M(col));o.position.y=-h/2;return o};
  const cone=(r,h,col)=>{const o=new THREE.Mesh(new THREE.ConeGeometry(r,h,8),M(col));return o};
  const grp=()=>new THREE.Group();

  function quadActor(kind,L,opts){
    const D=DATA.animals[kind]||{body:[.4,.5,.8]},mm=entry(kind),lk=mm.look||{},b=mm.body||D.body,W=b[0],H=b[1],Ln=(opts&&opts.length)||b[2];
    const LL=H*(lk.leg||.5),tRy=(H-LL)*.55,tY=LL+tRy*.8,col=lk.col||D.col||0x886644;
    const root=grp(),body=grp();root.add(body);body.position.y=0;
    const torso=ell(Ln*.4,tRy,W*.5,col);torso.position.y=tY;body.add(torso);
    const belly=ell(Ln*.36,tRy*.7,W*.46,lk.belly||col);belly.position.set(0,tY-tRy*.35,0);body.add(belly);
    const hip=ell(Ln*.2,tRy*.95,W*.5,col);hip.position.set(0,tY+tRy*.05,-Ln*.26);body.add(hip);
    const shoulder=ell(Ln*.2,tRy*1.02,W*.5,col);shoulder.position.set(0,tY+tRy*.08,Ln*.22);body.add(shoulder);
    if(lk.ridge){const r=ell(Ln*.36,tRy*.25,W*.22,lk.dark||0x2a2018);r.position.set(0,tY+tRy*.95,0);body.add(r)}
    const neck=grp();neck.position.set(0,tY+tRy*.35,Ln*.34);body.add(neck);
    const nL=Ln*(lk.neck||.25),nk=ell(W*.2,W*.22,nL*.6,col);nk.position.set(0,nL*.25,nL*.45);neck.add(nk);
    const head=grp();head.position.set(0,nL*.4,nL*.95);neck.add(head);
    const hs=lk.headS||1,sk=ell(W*.24*hs,W*.22*hs,Ln*.12*hs,col);sk.position.set(0,0,Ln*.03);head.add(sk);
    const sn=cone(W*.11*hs,Ln*(lk.snout||.22),lk.snoutCol||col);sn.rotation.x=Math.PI/2;sn.position.set(0,-W*.04,Ln*.17*hs+Ln*(lk.snout||.22)*.35);head.add(sn);
    const nose=ell(W*.04,W*.04,W*.04,0x151010);nose.position.set(0,-W*.04,Ln*.17*hs+Ln*(lk.snout||.22)*.82);head.add(nose);
    for(const s of[-1,1]){const e=ell(W*.025,W*.025,W*.025,0x0a0808);e.position.set(s*W*.15*hs,W*.06*hs,Ln*.09*hs);head.add(e)}
    const ears=[];for(const s of[-1,1]){const eg=grp();eg.position.set(s*W*.14*hs,W*.17*hs,-Ln*.02);const ec=cone(W*(lk.earW||.07),Ln*(lk.earLen||.1),lk.earCol||col);ec.position.y=Ln*(lk.earLen||.1)*.5;eg.add(ec);eg.userData.s=s;head.add(eg);ears.push(eg)}
    if(lk.mask){for(const s of[-1,1]){const p=ell(W*.06,W*.045,Ln*.05,lk.mask);p.position.set(s*W*.16*hs,W*.03*hs,Ln*.12*hs);head.add(p)}}
    if(lk.antler&&((opts&&opts.seed)||0)%2===0){for(const s of[-1,1]){const ag=grp();ag.position.set(s*W*.1,W*.2*hs,-Ln*.02);const a1=cyl(W*.018,W*.014,Ln*.2,0xd8cdb0);a1.position.y=Ln*.1;a1.rotation.z=-s*.35;ag.add(a1);const a2=cyl(W*.014,W*.01,Ln*.1,0xd8cdb0);a2.position.set(-s*Ln*.035,Ln*.17,Ln*.015);a2.rotation.z=s*.5;ag.add(a2);head.add(ag)}}
    if(lk.tusk){for(const s of[-1,1]){const t=cone(W*.018,Ln*.05,0xe8e0cc);t.rotation.z=s*.5;t.position.set(s*W*.1,-W*.1,Ln*.2);head.add(t)}}
    const tail=grp();tail.position.set(0,tY+tRy*.2,-Ln*.44);body.add(tail);const tl=Ln*(lk.tail||.14),tcn=ell(W*(lk.tailW||.07),W*(lk.tailW||.07),tl*.55,lk.tailCol||col);tcn.position.set(0,0,-tl*.5);tail.add(tcn);
    if(lk.tailTip){const tt=ell(W*(lk.tailW||.07)*.9,W*(lk.tailW||.07)*.9,tl*.2,lk.tailTip);tt.position.set(0,0,-tl*1.0);tail.add(tt)}
    const legs=[];const lc=lk.legCol||col;
    for(const[sx,sz,front]of[[-1,1,1],[1,1,1],[-1,-1,0],[1,-1,0]]){const pv=grp();pv.position.set(sx*W*.3,tY-tRy*.45,sz*Ln*(front?.26:.3));
      const th=front?.58:.52,up=cyl(W*(front?.1:.13),W*.075,LL*th,col);pv.add(up);
      const knee=grp();knee.position.y=-LL*th;pv.add(knee);const lo=cyl(W*.065,W*.05,LL*(1-th)*.96,lc);knee.add(lo);const hoof=ell(W*.07,LL*.04,W*.09,lk.hoof||0x1c1612);hoof.position.set(0,-LL*(1-th)*.96,W*.02);knee.add(hoof);
      body.add(pv);legs.push({pv,knee,front:!!front,side:sx})}
    const gait=Object.assign({walkAmp:.5,runAmp:.9,stride:1.2,hop:false,headLow:0,bob:.02},mm.gait||{});
    const A={root,kind,isFallback:true,state:null,speed:0,phase:0,t:Math.random()*10,prevYaw:0,
      p:{amp:0,neck:0,head:0,tail:0,ear:0,bob:0,pitch:0,roll:0,crouch:0},lean:0};
    const target=st=>{const g=gait;
      if(st==='walk')return{amp:g.walkAmp,neck:.05-g.headLow,head:0,tail:.0,ear:0,pitch:0,crouch:0};
      if(st==='run')return{amp:g.runAmp,neck:-.15-g.headLow*.5,head:-.1,tail:.5,ear:-.3,pitch:.08,crouch:.03};
      if(st==='alert')return{amp:0,neck:.55,head:.15,tail:.45,ear:.5,pitch:-.05,crouch:0};
      return{amp:0,neck:.12,head:.0,tail:.05,ear:0,pitch:0,crouch:0}};
    A.setState=(st)=>{A.state=st};
    A.update=(dt,speed,hint)=>{A.speed=speed;const st=pickState(speed,hint,mm.thr);A.setState(st);A.t+=dt;const k=lerpK(dt,st==='alert'?9:6),tg=target(st),P=A.p;
      for(const key in tg)P[key]+=(tg[key]-P[key])*k;
      const stride=Math.max(.3,H*gait.stride);if(st==='walk'||st==='run')A.phase+=dt*speed*Math.PI*2/stride;
      const moving=(st==='walk'||st==='run'),ph=A.phase,sin=Math.sin;
      let yawRate=0;if(root.rotation){let dy=root.rotation.y-A.prevYaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));yawRate=dt>0?dy/dt:0;A.prevYaw=root.rotation.y}
      A.lean+=(Math.max(-.2,Math.min(.2,-yawRate*.06))*Math.min(1,speed/3)-A.lean)*lerpK(dt,8);
      for(const L of legs){let ang=0,bend=0;
        if(moving){const off=gait.hop?(L.front?0:Math.PI*.5):((L.front?(L.side<0?0:Math.PI):(L.side<0?Math.PI:0)));ang=sin(ph+off)*P.amp;bend=Math.max(0,sin(ph+off+Math.PI/2))*P.amp*(L.front?1.1:1.0)}
        else if(st==='alert'){ang=L.front?.08:-.04;bend=.1}
        L.pv.rotation.x=ang;L.knee.rotation.x=bend*(L.front?1:.8)}
      const breath=sin(A.t*(st==='idle'?1.6:3))*(st==='idle'?.012:.008);
      const hopB=gait.hop&&moving?Math.abs(sin(ph))*H*.35*(P.amp):0;
      body.position.y=(moving&&!gait.hop?Math.abs(sin(ph*2))*gait.bob*H*(P.amp*2):0)+hopB-P.crouch*H*.3;
      body.rotation.x=P.pitch+(gait.hop&&moving?sin(ph)*.12:0);body.rotation.z=A.lean;
      torso.scale.y=tRy*(1+breath);
      neck.rotation.x=-P.neck+(st==='idle'?sin(A.t*.7)*.06:0)+(moving?sin(ph*(gait.hop?1:2))*.04:0);head.rotation.x=P.head+(st==='alert'?sin(A.t*.9)*.0:0);
      head.rotation.y=st==='alert'?sin(A.t*.8)*.5:(st==='idle'?sin(A.t*.35)*.25:0);
      tail.rotation.x=-P.tail+(st==='idle'?sin(A.t*1.3)*.08:moving?sin(ph)*.06:0);tail.rotation.y=moving?sin(ph)*.12:sin(A.t*1.1)*.1;
      for(const e of ears){e.rotation.z=e.userData.s*(.5-P.ear*.5)+(st==='idle'&&((A.t*.8|0)%7===0)?sin(A.t*30)*.08:0);e.rotation.x=P.ear*.4}};
    A.tint=(hex,amt)=>tintAll(root,hex,amt);
    A.dispose=()=>{if(root.parent)root.parent.remove(root)};
    A.setState('idle',0);return A}

  function humanActor(kind,opts){
    const mm=entry(kind),lk=mm.look||{},H=(opts&&opts.height)||1.75,sc=H/1.75,skin=lk.skin||0xe3b98f,jac=lk.jacket||0x4d6b3a,pan=lk.pants||0x3b3a2e,boot=lk.boot||0x2a2118,cap=lk.cap||0x6e5a2e;
    const root=grp(),hips=grp();root.add(hips);hips.position.y=.92*sc;
    const torso=grp();hips.add(torso);
    const chest=ell(.2*sc,.3*sc,.13*sc,jac);chest.position.y=.3*sc;torso.add(chest);
    const waist=ell(.17*sc,.15*sc,.12*sc,pan);waist.position.y=.04*sc;torso.add(waist);
    const neck=cyl(.05*sc,.05*sc,.08*sc,skin);neck.position.y=.62*sc;torso.add(neck);
    const head=grp();head.position.y=.74*sc;torso.add(head);const sk=ell(.095*sc,.115*sc,.105*sc,skin);head.add(sk);
    const hat=ell(.105*sc,.06*sc,.11*sc,cap);hat.position.y=.07*sc;head.add(hat);const brim=ell(.12*sc,.012*sc,.15*sc,cap);brim.position.set(0,.045*sc,.04*sc);head.add(brim);
    const pack=ell(.14*sc,.2*sc,.08*sc,lk.pack||0x5a4a32);pack.position.set(0,.32*sc,-.17*sc);torso.add(pack);
    const arms=[];for(const s of[-1,1]){const sh=grp();sh.position.set(s*.23*sc,.5*sc,0);const ua=cyl(.05*sc,.04*sc,.28*sc,jac);sh.add(ua);const el=grp();el.position.y=-.28*sc;sh.add(el);const fa=cyl(.04*sc,.035*sc,.26*sc,jac);el.add(fa);const hd=ell(.04*sc,.04*sc,.04*sc,skin);hd.position.y=-.27*sc;el.add(hd);torso.add(sh);arms.push({sh,el,s})}
    const legs=[];for(const s of[-1,1]){const hp=grp();hp.position.set(s*.1*sc,0,0);hips.add(hp);const th=cyl(.075*sc,.06*sc,.44*sc,pan);hp.add(th);const kn=grp();kn.position.y=-.44*sc;hp.add(kn);const sn=cyl(.055*sc,.045*sc,.42*sc,pan);kn.add(sn);const ft=ell(.05*sc,.035*sc,.11*sc,boot);ft.position.set(0,-.43*sc,.04*sc);kn.add(ft);legs.push({hp,kn,s})}
    const rifle=grp();const bar=ell(.018*sc,.018*sc,.42*sc,0x2a2a2a);bar.position.z=.2*sc;rifle.add(bar);const stock=ell(.03*sc,.045*sc,.16*sc,0x5a3a22);stock.position.z=-.1*sc;rifle.add(stock);torso.add(rifle);
    const A={root,kind,isFallback:true,state:null,speed:0,phase:0,t:0,prevYaw:0,lean:0,p:{amp:0,lean:0,aim:0}};
    A.setState=st=>{A.state=st};
    A.update=(dt,speed,hint)=>{A.speed=speed;const st=pickState(speed,hint,mm.thr),aim=(st==='aim'||hint==='aim')?1:0;A.setState(st);A.t+=dt;const k=lerpK(dt,8),P=A.p;
      const tgAmp=st==='walk'?.55:st==='run'?.95:(aim&&speed>.15?.35:0),tgLean=st==='run'?.22:st==='walk'?.05:0;P.amp+=(tgAmp-P.amp)*k;P.lean+=(tgLean-P.lean)*k;P.aim+=(aim-P.aim)*lerpK(dt,12);
      const stride=.85*sc*(st==='run'?1.5:1);if(speed>.1)A.phase+=dt*speed*Math.PI*2/stride;const ph=A.phase,sin=Math.sin;
      let yr=0;if(root.rotation){let dy=root.rotation.y-A.prevYaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));yr=dt>0?dy/dt:0;A.prevYaw=root.rotation.y}
      A.lean+=(Math.max(-.15,Math.min(.15,-yr*.04))-A.lean)*lerpK(dt,8);
      for(const L of legs){const a=sin(ph+(L.s<0?0:Math.PI))*P.amp;L.hp.rotation.x=a;L.kn.rotation.x=Math.max(0,-sin(ph+(L.s<0?0:Math.PI)+.6))*P.amp*1.1}
      hips.position.y=(.92*sc)+(speed>.1?Math.abs(sin(ph))*.035*sc*(P.amp*2):0);
      torso.rotation.x=P.lean-P.aim*.05;torso.rotation.z=A.lean;
      const idleBreath=sin(A.t*1.5)*.012;chest.scale.y=.3*sc*(1+idleBreath);
      for(const R of arms){const swing=-sin(ph+(R.s<0?Math.PI:0))*P.amp*.9;
        const raise=R.s>0?-1.45:-1.25;   // 右腕=銃の引き金側、左腕=銃身を支える
        R.sh.rotation.x=swing*(1-P.aim)+raise*P.aim;R.sh.rotation.z=R.s*(.06+.0*P.aim);R.el.rotation.x=-.2*(1-P.aim)-(P.amp>.6?.5:0)*(1-P.aim)-(.25+.0)*P.aim}
      rifle.position.set(0,(.4+P.aim*.18)*sc,(-.16+P.aim*.45)*sc);rifle.rotation.set((1-P.aim)*1.25,0,(1-P.aim)*.7);
      head.rotation.x=-P.aim*.1+sin(A.t*.6)*.02};
    A.tint=(hex,amt)=>tintAll(root,hex,amt);A.dispose=()=>{if(root.parent)root.parent.remove(root)};
    A.setState('idle',0);return A}

  function fallbackActor(kind,opts){const mm=entry(kind);return(mm.rig==='human')?humanActor(kind,opts):quadActor(kind,0,opts)}

  /* ---- 公開：ゲームから呼ぶ唯一の入口 ---- */
  function create(kind,opts){opts=opts||{};const c=cache[kind],m=entry(kind);let a=null;
    if(c&&!c.fallback){try{a=glbActor(kind,c,m,opts)}catch(e){errors.push({kind,why:'instantiate: '+e.message});log(kind,'生成失敗→代替表示',e.message);a=null}}
    if(!a)a=fallbackActor(kind,opts);
    if(opts.rare&&opts.tint)a.tint(opts.tint.color,opts.tint.amt);return a}
  const credits=()=>Object.keys(DATA.models).filter(k=>cache[k]&&!cache[k].fallback&&DATA.models[k].credit).map(k=>Object.assign({kind:k},DATA.models[k].credit));
  return{create,loadOne,preloadAll,status,credits,entry,_inject,_reset,errors}
})();
