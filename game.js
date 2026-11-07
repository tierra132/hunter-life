/* ゲーム本体：セーブ・3D・操作・動物・狩猟・罠・ミッション・UI */
'use strict';
/* ===== ログ・通知 ===== */
const LOG=[];function log(...a){LOG.push([Date.now(),...a].join(' '));if(LOG.length>200)LOG.shift();console.warn(...a)}
const $=id=>document.getElementById(id);
let tt;/* ===== セーブ（一時書込→検証→本体、旧世代をバックアップ、版数管理） ===== */
const KEY='hlg_save';
const defSave=()=>({v:DATA.saveVersion,rank:1,exp:0,money:500,unlocked:['satoyama'],inv:{},missions:{active:[],done:{}},dex:{},records:[],dogs:[mkDog('dog1','ハナ',{find:.5,track:.3,coop:.25})],party:['dog1'],traps:[],trapInv:{box:0,snare:1},gen:{},pop:{},settings:{},own:['airgun'],gun:'airgun',ammo:{airgun:30},bag:[],res:{meat:0,hide:0},gearOwn:[],gearOn:[],savedAt:0});
const MIGRATE={/* 例: 1:o=>{...;o.v=2;return o} */};
function migrate(o){if(!o||typeof o!=='object')throw new Error('bad save');while(o.v<DATA.saveVersion){if(!MIGRATE[o.v])throw new Error('no migration '+o.v);o=MIGRATE[o.v](o)}return o}
function validate(o){const d=defSave(),r=Object.assign(defSave(),o);
 r.unlocked=(Array.isArray(r.unlocked)?r.unlocked:[]).filter(id=>DATA.areas[id]&&id!=='base');
 if(!r.unlocked.includes('satoyama'))r.unlocked.push('satoyama');
 for(const k of['rank','exp','money'])if(!Number.isFinite(r[k])||r[k]<0)r[k]=d[k];
 r.dogs=Array.isArray(r.dogs)?r.dogs.filter(x=>x&&typeof x==='object'&&x.id):[];if(!r.dogs.length)r.dogs=d.dogs;
 r.records=Array.isArray(r.records)?r.records.filter(x=>x&&x.id&&DATA.animals[x.k]):[];if(!Array.isArray(r.traps))r.traps=[];
 r.own=(Array.isArray(r.own)?r.own:[]).filter(id=>DATA.guns[id]);if(!r.own.length)r.own=d.own;if(!r.own.includes(r.gun))r.gun=r.own[0];
 if(!r.ammo||typeof r.ammo!=='object')r.ammo={};
 for(const x of r.dogs){x.ab=Object.assign({find:.4,track:.3,coop:.2},x.ab);x.act=Object.assign({find:0,track:0,coop:0},x.act);x.lv=Math.max(1,x.lv|0);x.exp=Math.max(0,x.exp|0);x.fatigue=Math.max(0,Math.min(100,+x.fatigue||0))}
 if(!Array.isArray(r.party))r.party=[];r.party=r.party.filter(id=>r.dogs.some(x=>x.id===id)).slice(0,r.rank>=DATA.dog.partyRank?2:1);if(!r.party.length)r.party=[r.dogs[0].id];
 if(!r.trapInv||typeof r.trapInv!=='object')r.trapInv={};for(const k in DATA.traps)r.trapInv[k]=Math.max(0,r.trapInv[k]|0);
 r.traps=r.traps.filter(t=>t&&DATA.traps[t.type]&&DATA.areas[t.area]&&Number.isFinite(t.at)).map(t=>({id:String(t.id),type:t.type,area:t.area,x:+t.x||0,z:+t.z||0,at:t.at,n:Math.max(0,t.n|0),seed:t.seed|0,st:t.st==='caught'?'caught':'set',k:t.k,size:t.size,rare:!!t.rare,ct:t.ct,chk:!!t.chk,warned:!!t.warned}));
 if(!r.res||typeof r.res!=='object')r.res={meat:0,hide:0};r.res.meat=r.res.meat|0;r.res.hide=r.res.hide|0;
 r.gearOwn=(Array.isArray(r.gearOwn)?r.gearOwn:[]).filter(id=>DATA.gear[id]);r.gearOn=(Array.isArray(r.gearOn)?r.gearOn:[]).filter(id=>r.gearOwn.includes(id));
 if(!r.missions||!Array.isArray(r.missions.active))r.missions={active:[],done:{}};if(!r.missions.done)r.missions.done={};
 if(!r.gen||typeof r.gen!=='object')r.gen={};for(const id of Object.keys(r.gen)){const m=r.gen[id];if(!m||!['daily','weekly'].includes(m.slot)||!Array.isArray(m.goals)||!m.goals.every(g=>g&&g.n>0&&(!g.animal||g.animal==='*'||DATA.animals[g.animal]))||!m.fixed)delete r.gen[id]}
 const MDr=id=>DATA.missions[id]||r.gen[id];if(!r.pop||typeof r.pop!=='object')r.pop={};
 r.missions.active=r.missions.active.filter(a=>a&&MDr(a.id)).map(a=>({id:a.id,ready:!!a.ready,prog:MDr(a.id).goals.map((g,i)=>Math.min(g.n,(a.prog&&a.prog[i])|0))}));if(!r.settings||typeof r.settings!=='object')r.settings={};if(!r.dex||typeof r.dex!=='object')r.dex={};r.bag=(Array.isArray(r.bag)?r.bag:[]).filter(id=>r.records.some(x=>x.id===id));return r}
function load(){for(const k of[KEY,KEY+'_bak']){try{const s=localStorage.getItem(k);if(!s)continue;return validate(migrate(JSON.parse(s)))}catch(e){log('load fail',k,e.message)}}return defSave()}
function save(){try{S.savedAt=Date.now();const j=JSON.stringify(S);JSON.parse(j);const old=localStorage.getItem(KEY);localStorage.setItem(KEY+'_tmp',j);if(old)localStorage.setItem(KEY+'_bak',old);localStorage.setItem(KEY,j);localStorage.removeItem(KEY+'_tmp');return true}catch(e){log('save fail',e.message);toast('⚠ セーブに失敗しました（保存領域を確認してください）');return false}}
let S=load();
/* ===== 3D基盤 ===== */
const R=new THREE.WebGLRenderer({canvas:$('gl'),antialias:false});
R.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
const cam=new THREE.PerspectiveCamera(60,1,.1,200);
let scene,area='base',aid='base',trees=[],near=null,paused=false;
const player=new THREE.Group();
{const b=new THREE.Mesh(new THREE.CylinderGeometry(.3,.35,1.1,8),new THREE.MeshLambertMaterial({color:0x4d6b3a}));b.position.y=.75;
 const h=new THREE.Mesh(new THREE.SphereGeometry(.25,8,8),new THREE.MeshLambertMaterial({color:0xe3b98f}));h.position.y=1.5;
 const n=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.3),new THREE.MeshLambertMaterial({color:0x222}));n.position.set(0,1.5,.3);player.add(b,h,n)}
function rng(s){return()=>(s=(s*1664525+1013904223)>>>0)/4294967296}
function label(t){const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');g.fillStyle='rgba(0,0,0,.6)';g.fillRect(0,0,256,64);g.fillStyle='#fff';g.font='bold 26px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(t,128,34);
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false}));s.scale.set(4,1,1);return s}
function build(id){
 const A=DATA.areas[id];scene=new THREE.Scene();scene.background=new THREE.Color(A.sky);scene.fog=new THREE.Fog(A.sky,25,90);
 HL=new THREE.HemisphereLight(0xffffff,0x556644,.95);SUN=new THREE.DirectionalLight(0xffffff,.6);SUN.position.set(30,50,20);scene.add(HL,SUN);RAIN=null;
 const g=new THREE.Mesh(new THREE.PlaneGeometry(A.half*2+240,A.half*2+240),new THREE.MeshLambertMaterial({color:A.ground}));g.rotation.x=-Math.PI/2;scene.add(g);
 const rnd=rng(id==='base'?7:id.length*977+13);trees=[];
 const n=A.trees,tr=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.25,2,6),new THREE.MeshLambertMaterial({color:0x6b4a2b}),n),
  cr=new THREE.InstancedMesh(new THREE.ConeGeometry(1.4,3.2,7),new THREE.MeshLambertMaterial({color:0x2f6b36}),n),m=new THREE.Matrix4();
 for(let i=0;i<n;i++){let x,z;do{x=(rnd()*2-1)*A.half;z=(rnd()*2-1)*A.half}while(id==='base'?(Math.abs(x)<17&&Math.abs(z)<16):(Math.hypot(x,z)<6));
  const s=.8+rnd()*.7;trees.push([x,z]);m.makeScale(s,s,s).setPosition(x,s,z);tr.setMatrixAt(i,m);m.makeScale(s,s,s).setPosition(x,2+s*1.2,z);cr.setMatrixAt(i,m)}
 scene.add(tr,cr);
 belt(A.half);

 if(id==='base')for(const f of DATA.facilities){const b=new THREE.Mesh(new THREE.BoxGeometry(4,3,3),new THREE.MeshLambertMaterial({color:f.c}));b.position.set(f.x,1.5,f.z);scene.add(b);
  const l=label(f.name);l.position.set(f.x,4.2,f.z);scene.add(l);trees.push([f.x,f.z,2.2])}
 scene.add(player);area=A;aid=id}
function go(id){paused=false;closePanel();build(id);const A=DATA.areas[id];
 player.position.set(0,0,id==='base'?10:0);yaw=id==='base'?Math.PI:0;pitch=.35;faceY=yaw;
 $('sneak').style.display=id==='base'?'none':'block';setSneak(false);for(const b of['aim','trapB'])$(b).style.display=id==='base'?'none':'flex';setAim(false);
 if(id==='base'&&S.own.includes('airgun')&&(S.ammo.airgun||0)<5&&S.money<DATA.ammoPack.airgun.price){S.ammo.airgun=10;toast('見習い支給：空気銃の弾10発')}
 initField();checkUnlock();procTraps();updInfo();save();if(id==='base'&&S.bag.length)storagePanel()}
/* ===== 操作 ===== */
let yaw=0,pitch=.35,faceY=0,sneak=false;const st={id:null,ox:0,oy:0,x:0,y:0},lk={id:null,x:0,y:0},keys={};
const ui=$('ui');
ui.addEventListener('pointerdown',e=>{if(paused||e.target.closest('button,.panel'))return;const g=gp(e);
 if(g.x<GW*.45){if(st.id===null){st.id=e.pointerId;st.ox=g.x;st.oy=g.y;st.x=st.y=0;const o=$('stick');o.style.display='block';o.style.left=(g.x-ui.offsetLeft)+'px';o.style.top=(g.y-ui.offsetTop)+'px'}}
 else if(lk.id===null){lk.id=e.pointerId;lk.x=g.x;lk.y=g.y}ui.setPointerCapture(e.pointerId)});
ui.addEventListener('pointermove',e=>{const g=gp(e);if(e.pointerId===st.id){let dx=g.x-st.ox,dy=g.y-st.oy;const d=Math.hypot(dx,dy),M=50;if(d>M){dx*=M/d;dy*=M/d}st.x=dx/M;st.y=dy/M;$('knob').style.transform=`translate(${dx*.8}px,${dy*.8}px)`}
 else if(e.pointerId===lk.id){const sn=(aiming?.4:1)*(S.settings.sens||1);yaw-=(g.x-lk.x)*.006*sn;pitch=Math.max(.05,Math.min(1.2,pitch+(g.y-lk.y)*.005*sn));lk.x=g.x;lk.y=g.y}});
const up=e=>{if(e.pointerId===st.id){st.id=null;st.x=st.y=0;$('stick').style.display='none';$('knob').style.transform=''}if(e.pointerId===lk.id)lk.id=null};
ui.addEventListener('pointerup',up);ui.addEventListener('pointercancel',up);
addEventListener('keydown',e=>keys[e.code]=1);addEventListener('keyup',e=>keys[e.code]=0);
tap($('sneak'),()=>setSneak(!sneak));
/* ===== パネル ===== */
$('panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.a,id=b.dataset.id;if(uiAct(a,b.dataset))return;if(act2(a,b.dataset))return;
 if(a==='close')closePanel();else if(a==='go')go(id);else if(a==='save')toast(save()?'セーブしました':'セーブ失敗');
 else if(a==='fac'){const f=DATA.facilities.find(x=>x.id===id);f.id==='gate'?gatePanel():pending(f)}
 else if(a==='reset'){if(b.dataset.c){S=defSave();save();go('base');toast('初期化しました')}else{b.dataset.c=1;b.textContent='本当に消去する？もう一度押す'}}});
tap($('menuBtn'),()=>paused?closePanel():menuPanel());tap($('misBtn'),toggleMis);tap($('rotBtn'),flipRot);
tap($('act'),()=>{if(!near||paused)return;if(near.sign)return inspect(near.sign);if(near.trapId)return trapAct(near.trapId);near.id==='gate'?gatePanel():pending(near)});
/* ===== 動物・痕跡・発見（Phase 2） ===== */
const AN=[],SG=[],pulses=[];let signT=0,moving=false,dog=null;
const cl=v=>Math.max(-(area.half-1),Math.min(area.half-1,v));
const blocked=(x,z)=>trees.some(q=>Math.hypot(x-q[0],z-q[1])<(q[2]||.7)+.4);
function occ(ax,az,bx,bz){let n=0;const vx=bx-ax,vz=bz-az,L=vx*vx+vz*vz||1;for(const q of trees){const t=((q[0]-ax)*vx+(q[1]-az)*vz)/L;if(t<.05||t>.95)continue;if(Math.hypot(ax+vx*t-q[0],az+vz*t-q[1])<.9&&++n>=2)return true}return false}
function pick(sp){let t=0;for(const k in sp)t+=sp[k];let r=Math.random()*t;for(const k in sp)if((r-=sp[k])<=0)return k}
function dirText(dx,dz){const f=dx*Math.sin(yaw)+dz*Math.cos(yaw),r=-dx*Math.cos(yaw)+dz*Math.sin(yaw),a=Math.atan2(r,f),w=a<0?'左':'右',b=Math.abs(a);return b<.4?'正面':b<1.2?w+'前方':b<2?w+'側':'後方'}
function addExp(n){S.exp+=n;while(DATA.rankExp[S.rank]!==undefined&&S.exp>=DATA.rankExp[S.rank]){S.rank++;toast('ランクアップ！ Rank '+S.rank);checkUnlock()}updInfo()}
function mkAnimal(k,x,z){const D=DATA.animals[k],g=new THREE.Group(),b=D.body,rare=Math.random()<D.rare*(area.rareMul||1),m=new THREE.MeshLambertMaterial({color:rare?new THREE.Color(D.col).lerp(new THREE.Color(0xffffff),.5):D.col});
 const bd=new THREE.Mesh(new THREE.BoxGeometry(b[0],b[1],b[2]),m);bd.position.y=b[1]/2+.2;const h=new THREE.Mesh(new THREE.BoxGeometry(b[0]*.6,b[1]*.5,b[2]*.3),m);h.position.set(0,b[1]+.2,b[2]*.5);
 g.add(bd,h);g.position.set(cl(x),0,cl(z));g.rotation.y=Math.random()*6.28;scene.add(g);
 const a={k,D,g,rare,hx:g.position.x,hz:g.position.z,st:'normal',t:Math.random()*3,tx:0,tz:0,mv:false,seen:false,vis:0,hint:0,mk:null,dogd:false,sz:D.size[0]+Math.random()*(D.size[1]-D.size[0])};AN.push(a);return a}
function spawnAt(k,n,x,z){for(let i=0;i<n;i++)mkAnimal(k,x+(Math.random()-.5)*5,z+(Math.random()-.5)*5)}
function initField(){AN.length=0;SG.length=0;pulses.length=0;near=null;$('act').style.display='none';dog=null;DG.length=0;BL.length=0;for(const k in TM)delete TM[k];const f=DATA.signs;signT=f.first[0]+Math.random()*(f.first[1]-f.first[0]);
 initEnv();if(!area.spawn)return;S.party.forEach((id,i)=>{const dm=new THREE.Mesh(new THREE.BoxGeometry(.3,.35,.6),new THREE.MeshLambertMaterial({color:i?0x6b4a2b:0xd8b070}));dm.position.set(player.position.x+1+i,.2,player.position.z+1);scene.add(dm);DG.push({m:dm})});
 const W=spawnW();while(AN.length<area.max){const k=pick(W),D=DATA.animals[k];let x,z;do{x=(Math.random()*2-1)*(area.half-3);z=(Math.random()*2-1)*(area.half-3)}while(Math.hypot(x-player.position.x,z-player.position.z)<DATA.spawnMin);
  spawnAt(k,D.group[0]+Math.floor(Math.random()*(D.group[1]-D.group[0]+1)),x,z)}}
function stepA(a,ang,sp,dt){const g=a.g;for(const o of[0,1.1,-1.1]){const x=g.position.x+Math.sin(ang+o)*sp*dt,z=g.position.z+Math.cos(ang+o)*sp*dt;if(Math.abs(x)<area.half-1&&Math.abs(z)<area.half-1&&!blocked(x,z)){g.position.x=x;g.position.z=z;g.rotation.y=ang+o;return}}a.mv=false}
function discover(a){a.seen=true;const D=a.D,e=S.dex[a.k]||(S.dex[a.k]={seen:0,caught:0,max:0}),first=e.seen===0;e.seen++;if(first)e.fs=Date.now();if(a.rare)e.rare=(e.rare||0)+1;
 addExp(DATA.exp.animal);mEvt('see',a.k,{rare:!!a.rare});dogGain('find',4);toast(first?D.name+'を発見！（図鑑に登録）':D.name+'を発見！')}
function updAnimals(dt,p){for(const a of AN){const g=a.g,D=a.D,dx=g.position.x-p.x,dz=g.position.z-p.z,d=Math.hypot(dx,dz)||.01;a.hint=Math.max(0,a.hint-dt);if(a.wound>0){a.wound-=dt;a.bt=(a.bt||0)-dt;if(a.bt<=0&&a.st==='flee'){a.bt=.8;blood(g.position.x,g.position.z)}}
  const sense=D.alert*13*(sneak?.5:1)*(moving?1:.65)*gm('alertMul')*envAlert();
  if(a.st==='normal'){a.t-=dt;if(a.t<=0){a.t=3+Math.random()*5;a.mv=Math.random()<.6;const r=Math.random()*7,an=Math.random()*6.28;a.tx=cl(a.hx+Math.cos(an)*r);a.tz=cl(a.hz+Math.sin(an)*r)}
   if(a.mv){const ex=a.tx-g.position.x,ez=a.tz-g.position.z;if(Math.hypot(ex,ez)<.5)a.mv=false;else stepA(a,Math.atan2(ex,ez),D.speed,dt)}
   if(d<sense){a.st='alert';a.t=1.5+Math.random()+(D.stand||0)}}
  else if(a.st==='alert'){g.rotation.y=Math.atan2(-dx,-dz);a.t-=dt;if(d>sense*1.6){a.st='normal';a.t=2}else if(a.t<=0||d<sense*.5){a.st='prep';a.t=.5}}
  else if(a.st==='prep'){g.rotation.y=Math.atan2(-dx,-dz);a.t-=dt;if(a.t<=0){a.st='flee';a.t=6}}
  else{stepA(a,Math.atan2(dx,dz),D.flee,dt);a.t-=dt;if((a.t<=0&&d>28)||a.t<-6){a.st='normal';a.hx=g.position.x;a.hz=g.position.z;a.t=2}}
  if(!a.seen){const cosA=(dx*Math.sin(yaw)+dz*Math.cos(yaw))/d,Rg=DATA.sight.base*(1-D.disc*.5)*(1+dogSum('find')*DATA.dog.findK+gs('sight'))*(area.sight||1)*envSight();
   if(d<Rg&&cosA>DATA.sight.cone&&!occ(p.x,p.z,g.position.x,g.position.z)){a.vis+=dt;if(a.vis>.7)discover(a)}else a.vis=Math.max(0,a.vis-dt);
   if(!a.dogd&&d<22){a.dogd=true;toast(party()[0].name+'が何かに反応している…')}}
  else if(a.mk)a.mk.visible=d<55}}
const mTrack=new THREE.MeshBasicMaterial({color:0x2b2118}),mFeed=new THREE.MeshLambertMaterial({color:0x5a4a2a});
function spawnSign(p,force){const sp=spawnW();if(!area.spawn)return;const k=pick(sp),r0=Math.random(),type=force?(r0<.5?'track':'feed'):r0<.45?'track':r0<.8?'feed':'sound',fresh=Math.random()<DATA.signs.fresh,an=Math.random()*6.28,r=type==='sound'?30+Math.random()*10:12+Math.random()*16,x=cl(p.x+Math.cos(an)*r),z=cl(p.z+Math.sin(an)*r);
 let ref=null;if(fresh){const o=type==='sound'?0:10+Math.random()*10,aa=Math.random()*6.28;ref=mkAnimal(k,x+Math.cos(aa)*o,z+Math.sin(aa)*o)}
 if(type==='sound'){pulses.push({x,z,t:0});if(ref)ref.hint=25;toast('【物音】'+dirText(x-p.x,z-p.z)+'でガサガサ…'+(fresh?'':'（気のせいかもしれない）'));return}
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=Math.random()*6.28;
 if(type==='track')for(let i=0;i<4;i++){const c=new THREE.Mesh(new THREE.CircleGeometry(.14,8),mTrack);c.rotation.x=-Math.PI/2;c.position.set((i%2?.18:-.18),.03,i*.55);g.add(c)}
 else{const s=new THREE.Mesh(new THREE.SphereGeometry(.3,6,4),mFeed);s.scale.y=.4;s.position.y=.1;g.add(s)}
 scene.add(g);if(SG.length>=6){const o=SG.shift();scene.remove(o.g);if(o.mk)scene.remove(o.mk)}SG.push({x,z,k,type,fresh,ref,g,noticed:false,done:false,mk:null,act:null})}
function signNear(p){if(aiming)return null;const tn=trapNear(p);if(tn)return tn;let best=null,bd=3.4;for(const s of SG){if(!s.noticed||s.done)continue;const d=Math.hypot(p.x-s.x,p.z-s.z);if(d<bd){bd=d;best=s.act||(s.act={sign:s,name:'痕跡を調べる',id:'sign'})}}return best}
function inspect(s){if(s.done)return;s.done=true;const D=DATA.animals[s.k],w=s.type==='track'?'足跡':'食痕';if(s.mk)s.mk.visible=false;near=null;$('act').style.display='none';addExp(DATA.exp.sign);mEvt('sign',null,{});dogGain('track',2);
 if(s.fresh&&s.ref&&AN.includes(s.ref)){s.ref.hint=45;toast(D.name+'の'+w+'：まだ新しい。'+dirText(s.ref.g.position.x-player.position.x,s.ref.g.position.z-player.position.z)+'に気配がある'+(dogSum('track')>.35?`（約${Math.round(Math.hypot(s.ref.g.position.x-player.position.x,s.ref.g.position.z-player.position.z))}m）`:''))}else toast(D.name+'の'+w+'：古い痕跡だ。近くにはいなさそう')}
function field(dt,p){tickEnv(dt,p);updAnimals(dt,p);for(const d of party())d.fatigue=Math.min(100,(d.fatigue||0)+dt/6);cd=Math.max(0,cd-dt);if(aiming){aimT+=dt;$('ret').style.transform='scale('+Math.min(2.6,.5+sway()*G().spread*30)+')'}
 DG.forEach((o,i)=>{const m=o.m.position,sd=i?-1.1:1.1,tx=p.x-Math.sin(yaw)*(1.8+i*.8)+Math.cos(yaw)*sd,tz=p.z-Math.cos(yaw)*(1.8+i*.8)-Math.sin(yaw)*sd,k=Math.min(1,dt*3),ox=m.x,oz=m.z;m.x+=(tx-m.x)*k;m.z+=(tz-m.z)*k;if(Math.hypot(m.x-ox,m.z-oz)>.002)o.m.rotation.y=Math.atan2(m.x-ox,m.z-oz)});
 signT-=dt*(1+dogSum('track')*DATA.dog.trackK)*envSign();if(signT<=0){spawnSign(p);const f=DATA.signs.next;signT=f[0]+Math.random()*(f[1]-f[0])}
 for(const s of SG)if(!s.noticed&&Math.hypot(p.x-s.x,p.z-s.z)<9){s.noticed=true;s.mk=label('？痕跡');s.mk.scale.set(2.4,.6,1);s.mk.position.set(s.x,1.6,s.z);scene.add(s.mk);toast('何かの痕跡を見つけた')}
 for(let i=pulses.length-1;i>=0;i--){pulses[i].t+=dt;if(pulses[i].t>3)pulses.splice(i,1)}}
function drawMini(p){const c=Math.cos(yaw),s=Math.sin(yaw);mc.setTransform(1,0,0,1,0,0);mc.clearRect(0,0,96,96);mc.fillStyle='#1d2a22';mc.fillRect(0,0,96,96);
 mc.setTransform(-c,-s,s,-c,48,48);const H=area.half;mc.fillStyle='#3f7a46';mc.fillRect(-H-p.x,-H-p.z,2*H,2*H);
 
 mc.fillStyle='#fff';for(const g of SG)if(g.noticed&&!g.done)mc.fillRect(g.x-p.x-1.5,g.z-p.z-1.5,3,3);drawTrapsMini(p);
 
 mc.setTransform(1,0,0,1,48,48);mc.rotate(yaw-player.rotation.y);mc.fillStyle='#e0a43a';mc.beginPath();mc.moveTo(0,-5);mc.lineTo(4,4);mc.lineTo(-4,4);mc.fill();mc.setTransform(1,0,0,1,0,0)}
/* ===== 狩猟：構え・照準・射撃・捕獲（Phase 3） ===== */
let aiming=false,aimT=0,cd=0,rtm;const G=()=>DATA.guns[S.gun];
function sway(){const g=G();return(1.3-g.stab)*(aimT<1.5?2.5-aimT:1)*(moving?1.8:1)*(1-Math.min(.35,dogSum('coop')*DATA.dog.coopK))}
function occTrunk(ax,az,bx,bz){const vx=bx-ax,vz=bz-az,L=vx*vx+vz*vz||1;for(const q of trees){const t=((q[0]-ax)*vx+(q[1]-az)*vz)/L;if(t<.02||t>.98)continue;if(Math.hypot(ax+vx*t-q[0],az+vz*t-q[1])<(q[2]||.3)+.15)return true}return false}
function capture(a){const D=a.D,rare=!!a.rare,sz=+(a.sz*(rare?1.15:1)).toFixed(1),e=S.dex[a.k]||(S.dex[a.k]={seen:0,caught:0,max:0}),first=e.caught===0,rec=sz>e.max;e.caught++;if(first)e.fc=Date.now();if(rec)e.max=sz;
 const r={id:'r'+Date.now().toString(36)+Math.floor(Math.random()*1e4),k:a.k,size:sz,area:aid,t:Date.now(),method:a.trap?'trap':'gun',gun:a.trap||S.gun,rare};S.records.push(r);S.bag.push(r.id);
 if(a.g){scene.remove(a.g);AN.splice(AN.indexOf(a),1)}addExp(Math.round(DATA.exp.catchBase*(1+D.catch)));mEvt('catch',a.k,{rare:!!a.rare});popHit(aid,a.k);if(!a.trap)dogGain('coop',8);save();return{r,D,first,rec}}
function fire(){if(!aiming||paused||cd>0)return;const g=G();if((S.ammo[S.gun]||0)<=0){toast('弾切れ');return}
 S.ammo[S.gun]--;cd=g.reload;dogGain('coop',1);updInfo();shotFx(g);cam.updateMatrixWorld();
 const O=cam.position.clone(),V=new THREE.Vector3();cam.getWorldDirection(V);
 const rt=new THREE.Vector3().setFromMatrixColumn(cam.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(cam.matrix,1),p=player.position;
 const C=a=>new THREE.Vector3(a.g.position.x,a.D.body[1]/2+.2,a.g.position.z);
 let refD=25,best=1e9;for(const a of AN){const w=C(a).sub(O),t=w.dot(V);if(t>0&&t<best&&w.sub(V.clone().multiplyScalar(t)).length()<2.5){best=t;refD=t}}
 const df=refD<g.range[0]?1+(g.range[0]-refD)/g.range[0]*.3:refD<=g.range[1]?1:refD<=g.range[2]?1+(refD-g.range[1])/g.range[1]:3;
 const sp=g.spread*sway()*df,hits=new Map(),n=g.pellets||1;let crit=false;
 for(let i=0;i<n;i++){const r=sp*Math.sqrt(Math.random()),an=Math.random()*6.283,dir=V.clone().addScaledVector(rt,r*Math.cos(an)).addScaledVector(up,r*Math.sin(an)).normalize();let ha=null,ht=1e9,hp=0;
  for(const a of AN){const w=C(a).sub(O),t=w.dot(dir);if(t<2||t>g.range[2]*1.3||t>=ht)continue;const pd=w.sub(dir.clone().multiplyScalar(t)).length(),rad=Math.max(...a.D.body)*.5+.12;if(pd<rad&&!occTrunk(p.x,p.z,a.g.position.x,a.g.position.z)){ha=a;ht=t;hp=pd/rad}}
  if(ha){hits.set(ha,(hits.get(ha)||0)+1);if(!g.pellets&&hp<.35)crit=true}}
 let fled=0;for(const a of AN)if(!hits.has(a)){const d=Math.hypot(a.g.position.x-p.x,a.g.position.z-p.z);if(d<g.noise&&(a.st==='normal'||a.st==='alert')){a.st='prep';a.t=.2+Math.random()*.4;if(a.seen)fled++}}
 const caught=[];let wounded=0,weak=false;
 for(const[a,k]of hits){const power=g.pellets?g.power*k:g.power*(crit?1.25:1),can=!(g.maxCatch&&a.D.catch>g.maxCatch),pk=can?Math.min(.95,power/(1+a.D.catch*2)):0;
  if(!can)weak=true;if(Math.random()<pk)caught.push(capture(a));else{wounded++;a.st='flee';a.t=8;a.hint=40;a.wound=45;a.mv=false;if(!a.seen)discover(a)}}
 let t,h='';
 if(caught.length){t='捕獲成功！';h=caught.map(c=>`${c.D.name}　${c.r.size}kg　銃猟（${g.name}）${c.first?'<br>★初捕獲':''}${c.rec&&!c.first?'<br>★最大記録':''}${c.r.rare?'<br>★珍しい個体！':''}`).join('<br>');if(wounded)h+='<br>仕留められず逃げた個体あり'}
 else if(wounded){t='命中！ だが仕留められず逃走';h=(weak?g.name+'では威力が足りない。':'')+'地面の血痕を辿れば見つかるかもしれない'}
 else{t='命中失敗';h=fled?'動物は逃げ出した':'弾は外れた'}
hitMark(caught.length?'kill':wounded?'hit':'miss');resCard(t,h)}
tap($('aim'),()=>setAim(!aiming));
tap($('fire'),fire);
tap($('gun'),()=>{const i=S.own.indexOf(S.gun);S.gun=S.own[(i+1)%S.own.length];aimT=0;updInfo()});
/* ===== ミッション・経済（Phase 4） ===== */
let cur=null;
const gs=k=>S.gearOn.reduce((s,id)=>s+(DATA.gear[id][k]||0),0),gm=k=>S.gearOn.reduce((s,id)=>s*(DATA.gear[id][k]||1),1);
const spend=n=>{if(S.money<n){toast('所持金が足りません');return false}S.money-=n;return true};
function goalTxt(g){return({catch:'捕獲',see:'発見',sign:'痕跡調査',trap:'罠で捕獲'})[g.type]+(g.animal&&g.animal!=='*'?'：'+DATA.animals[g.animal].name:'')+condTxt(g.cond)}
function mEvt(t,k,x){let ch=false,rd=false;for(const a of S.missions.active){const m=MD(a.id);
  m.goals.forEach((g,i)=>{if(g.type===t&&(!g.animal||g.animal==='*'||g.animal===k)&&condOk(g.cond,x)&&a.prog[i]<g.n){a.prog[i]++;ch=true}});
  if(!a.ready&&m.goals.every((g,i)=>a.prog[i]>=g.n)){a.ready=true;rd=true;toast('ミッション達成！「'+m.title+'」— 拠点の掲示板で報酬を受け取れます')}}
 if(ch){updMis();if(rd)save()}}
function claim(id){const i=S.missions.active.findIndex(a=>a.id===id&&a.ready);if(i<0)return;const m=MD(id);S.missions.active.splice(i,1);if(!m.repeat)S.missions.done[id]=true;
 const fm=Math.round(m.fixed.money*evMul());S.money+=fm;let msg=`💰${fm} ／ EXP ${m.fixed.exp}`;
 if(Math.random()<DATA.missionRand.p){const T=DATA.missionRand.table;let r=Math.random()*T.reduce((s,x)=>s+x.w,0);const e=T.find(x=>(r-=x.w)<=0)||T[0];
  if(e.money){const v=Math.round(e.money*(m.rand||1));S.money+=v;msg+=`<br>★追加報酬：💰${v}`}
  else if(e.ammo){const n=Math.round(e.ammo[1]*(m.rand||1));S.ammo[e.ammo[0]]=(S.ammo[e.ammo[0]]||0)+n;msg+=`<br>★追加報酬：${DATA.guns[e.ammo[0]].name}の弾 ${n}発`}
  else if(e.gear){if(S.gearOwn.includes(e.gear)){S.money+=300;msg+='<br>★追加報酬：💰300（所持済み装備の代わり）'}else{S.gearOwn.push(e.gear);msg+=`<br>★追加報酬：${DATA.gear[e.gear].name}`}}}
 addExp(m.fixed.exp);checkUnlock();resCard('報酬を受け取った',msg)}
const priceOf=r=>{const D=DATA.animals[r.k],f=.9+.2*(r.size-D.size[0])/((D.size[1]-D.size[0])||1);return Math.round(D.value*Math.max(.8,Math.min(1.15,f)))};
const resOf=r=>({meat:Math.max(1,Math.round(r.size*DATA.res.meatPerKg)),hide:DATA.res.hide[r.k]||1});
function doOut(r,sell){if(sell){S.money+=priceOf(r);r.fate='sold'}else{const q=resOf(r);S.res.meat+=q.meat;S.res.hide+=q.hide;r.fate='processed'}}
function act2(a,d){const id=d.id;
 switch(a){
 case'sell':case'proc':{const i=S.bag.indexOf(id),r=S.records.find(x=>x.id===id);if(i<0||!r)break;S.bag.splice(i,1);doOut(r,a==='sell');break}
 case'sellAll':case'procAll':{const ids=S.bag.slice();S.bag=[];for(const rid of ids){const r=S.records.find(x=>x.id===rid);if(r)doOut(r,a==='sellAll')}break}
 case'sellHide':S.money+=S.res.hide*DATA.res.hidePrice;S.res.hide=0;break;
 case'exch':{const x=DATA.exchange[id];if(!x||Object.entries(x.give).some(([k,n])=>S.res[k]<n)){toast('資源が足りません');return true}for(const[k,n]of Object.entries(x.give))S.res[k]-=n;S.ammo[x.ammo[0]]=(S.ammo[x.ammo[0]]||0)+x.ammo[1];break}
 case'buyGun':if(!S.own.includes(id)&&spend(DATA.price[id]))S.own.push(id);break;
 case'buyAmmo':{const k=DATA.ammoPack[id];if(k&&S.own.includes(id)&&spend(k.price))S.ammo[id]=(S.ammo[id]||0)+k.n;break}
 case'buyGear':if(DATA.gear[id]&&!S.gearOwn.includes(id)&&spend(DATA.gear[id].price)){S.gearOwn.push(id);S.gearOn.push(id)}break;
 case'selgun':if(S.own.includes(id))S.gun=id;break;
 case'gear':{const i=S.gearOn.indexOf(id);i<0?S.gearOn.push(id):S.gearOn.splice(i,1);break}
 case'accept':{const m=MD(id);if(!m||S.missions.done[id]||m.rank>S.rank||S.missions.active.some(x=>x.id===id)||S.missions.active.filter(x=>MD(x.id).slot===m.slot).length>=({main:1,sub:2,special:1,daily:3,weekly:2})[m.slot])break;const a={id,prog:m.goals.map(()=>0),ready:false};if(m.prior){m.goals.forEach((g,i)=>{if(g.type==='catch'){const c=S.bag.map(b=>S.records.find(r=>r.id===b)).filter(r=>r&&(!g.animal||g.animal==='*'||r.k===g.animal)).length;a.prog[i]=Math.min(g.n,c)}});a.ready=m.goals.every((g,i)=>a.prog[i]>=g.n)}S.missions.active.push(a);if(a.ready)toast('受注前の捕獲分で達成済み！報酬を受け取れます');break}
 case'party':{const i=S.party.indexOf(id);if(i>=0){if(S.party.length>1)S.party.splice(i,1)}else if(S.party.length<partyMax())S.party.push(id);else toast('同行できるのは最大'+partyMax()+'頭です');break}
 case'feed':{const d=S.dogs.find(x=>x.id===id);if(!d||S.res.meat<1){toast('肉が足りません');return true}S.res.meat--;dogExp(d,10);d.fatigue=Math.max(0,d.fatigue-30);break}
 case'dextab':dexTab=id;break;
 case'buyTrap':if(DATA.traps[id]&&spend(DATA.traps[id].price))S.trapInv[id]=(S.trapInv[id]||0)+1;break;
 case'place':placeTrap(id);break;
 case'traps':cur=trapPanel;break;
 case'help':cur=helpPanel;break;
 case'settings':cur=settingsPanel;break;
 case'sens':S.settings.sens=+id;break;
 case'notif':try{Notification.requestPermission().then(()=>{if(cur)cur()})}catch(e){toast('このブラウザは通知に対応していません')}break;
 case'claim':claim(id);break;
 case'drop':S.missions.active=S.missions.active.filter(m=>m.id!==id);break;
 default:return false}
 updInfo();save();if(cur)cur();return true}
/* ===== 図鑑・犬・エリア解放・境界（Phase 5） ===== */
const DG=[],BL=[];let dexTab='sp',wt=0;
const mBlood=new THREE.MeshBasicMaterial({color:0x7a1515});
function blood(x,z){const c=new THREE.Mesh(new THREE.CircleGeometry(.12+Math.random()*.1,7),mBlood);c.rotation.x=-Math.PI/2;c.position.set(x+(Math.random()-.5)*.4,.04,z+(Math.random()-.5)*.4);scene.add(c);BL.push(c);if(BL.length>70)scene.remove(BL.shift())}
function belt(h){const pts=[],j=()=>(Math.random()-.5)*.6;
 for(const off of[.7,2.3])for(let t=-h;t<=h;t+=1.8){const e=h-off;pts.push([t+j(),-e+j()],[t+j(),e+j()],[-e+j(),t+j()],[e+j(),t+j()])}
 const n=pts.length,tr=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.25,2,6),new THREE.MeshLambertMaterial({color:0x5a3f25}),n),cr=new THREE.InstancedMesh(new THREE.ConeGeometry(1.5,3.4,7),new THREE.MeshLambertMaterial({color:0x2a5f31}),n),m=new THREE.Matrix4();
 pts.forEach((q,i)=>{const s=.9+Math.random()*.6;trees.push(q);m.makeScale(s,s,s).setPosition(q[0],s,q[1]);tr.setMatrixAt(i,m);m.makeScale(s,s,s).setPosition(q[0],2+s*1.2,q[1]);cr.setMatrixAt(i,m)});scene.add(tr,cr)}
function mkDog(id,name,ab){return{id,name,lv:1,exp:0,fatigue:0,ab:Object.assign({find:.4,track:.3,coop:.2},ab),act:{find:0,track:0,coop:0}}}
const party=()=>S.party.map(id=>S.dogs.find(d=>d.id===id)).filter(Boolean),eff=d=>1-Math.min(100,d.fatigue||0)/200,dogSum=k=>party().reduce((s,d)=>s+d.ab[k]*eff(d),0),partyMax=()=>S.rank>=DATA.dog.partyRank?2:1,dogNeed=lv=>20+lv*15;
function dogExp(d,xp){if(d.lv>=DATA.dog.maxLv)return;d.exp+=xp;while(d.lv<DATA.dog.maxLv&&d.exp>=dogNeed(d.lv)){d.exp-=dogNeed(d.lv);d.lv++;let top='find';for(const k of['track','coop'])if(d.act[k]>d.act[top])top=k;for(const k in d.ab)d.ab[k]=Math.min(1.5,d.ab[k]+(k===top?.06:.02));toast(`${d.name}がLv${d.lv}にレベルアップ！`)}}
function dogGain(ab,xp){for(const d of party()){d.act[ab]++;dogExp(d,xp)}}
function restDogs(dt){for(const d of S.dogs)d.fatigue=Math.max(0,(d.fatigue||0)-dt*4)}
function checkUnlock(){for(const[id,A]of Object.entries(DATA.areas)){if(id==='base'||S.unlocked.includes(id))continue;if(S.rank>=A.unlockRank&&(!A.needMission||S.missions.done[A.needMission])){S.unlocked.push(id);toast('エリア解放：'+A.name)}}
 if(S.rank>=DATA.dog.partyRank&&!S.dogs.some(d=>d.id==='dog2')){S.dogs.push(mkDog('dog2','コタロウ',{find:.25,track:.6,coop:.3}));toast('新しい犬「コタロウ」が仲間になった！同行は最大2頭')}}
function dogBtns(){return S.dogs.map(d=>`<button ${S.party.includes(d.id)?'class="pri"':''} data-a="party" data-id="${d.id}">${d.name} Lv${d.lv}（疲労${Math.round(d.fatigue)}%）</button>`).join('')}
const fmt=t=>new Date(t).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
/* ===== 罠システム（Phase 6：現実時間・タイムスタンプ管理） ===== */
const TM={},TA={};let ttmr=null;
const trapLimit=()=>DATA.trapLimits.reduce((m,[r,l])=>S.rank>=r?l:m,3);
const fmtRemain=ms=>`${Math.floor(Math.max(0,ms)/3600e3)}時間${Math.floor(Math.max(0,ms)%3600e3/60e3)}分`;
function mul32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
/* 判定結果は「罠の種×判定回数」で決まる：再読込・再計算で結果が変わらない */
function trapRoll(t,n){const T=DATA.traps[t.type],A=DATA.areas[t.area],r=mul32((t.seed^Math.imul(n,2654435761))|0);if(!A.spawn||r()>=T.chance*(A.trapMul||1))return null;
 let tot=0;const w={};for(const k in A.spawn){w[k]=A.spawn[k]*(T.aff[k]||0);tot+=w[k]}if(tot<=0)return null;let x=r()*tot,pk=null;for(const k in w){if((x-=w[k])<=0){pk=k;break}}if(!pk)return null;
 const D=DATA.animals[pk];return{k:pk,size:+(D.size[0]+r()*(D.size[1]-D.size[0])).toFixed(1),rare:r()<D.rare}}
function stepTraps(now){const ev=[];for(const t of S.traps.slice()){if(t.st!=='set')continue;const end=t.at+DATA.trap.life;
  for(;;){const n=t.n+1,ct=t.at+n*DATA.trap.interval;if(ct>now||ct>end)break;t.n=n;const r=trapRoll(t,n);if(r){t.st='caught';t.k=r.k;t.size=r.size;t.rare=r.rare;t.ct=ct;ev.push({t:'catch',trap:t});break}}
  if(t.st==='set'){if(now>=end){S.traps.splice(S.traps.indexOf(t),1);S.trapInv[t.type]=(S.trapInv[t.type]||0)+1;ev.push({t:'expire',trap:t})}else if(!t.warned&&now>=end-DATA.trap.warn){t.warned=true;ev.push({t:'warn',trap:t})}}}
 return ev}
function notifyOS(b){try{if(document.hidden&&typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification('野生動物ハンティングライフ',{body:b})}catch(e){}}
function report(ev){let c=0,e=0,w=0,msg='';for(const v of ev){if(v.t==='catch'){c++;msg=v.trap.type==='snare'?'くくり罠に獲物がかかった（'+DATA.areas[v.trap.area].name+'）':'箱罠に動物がかかったようだ'}else if(v.t==='expire'){e++;msg='罠の有効期限が切れた（罠は手元に戻りました）'}else{w++;msg='罠の期限が近づいています'}}
 const text=ev.length>1?`罠の状況が更新されました（捕獲${c}・期限切れ${e}・期限間近${w}）`:msg;toast(text);notifyOS(text)}
function schedTraps(){clearTimeout(ttmr);const now=Date.now();let next=Infinity;
 for(const t of S.traps){if(t.st!=='set')continue;const end=t.at+DATA.trap.life;for(let n=t.n+1;;n++){const ct=t.at+n*DATA.trap.interval;if(ct>end)break;if(trapRoll(t,n)){next=Math.min(next,ct);break}}next=Math.min(next,end);if(!t.warned&&end-DATA.trap.warn>now)next=Math.min(next,end-DATA.trap.warn)}
 if(next<Infinity)ttmr=setTimeout(procTraps,Math.min(2147483000,Math.max(1000,next-now+500)))}
function procTraps(){rollMissions();const ev=stepTraps(Date.now());if(ev.length){save();report(ev)}syncTM();schedTraps();if(ev.length&&cur===trapPanel&&$('panel').style.display==='block')trapPanel()}
function trapMesh(t){const g=new THREE.Group();g.position.set(t.x,0,t.z);const caught=t.st==='caught';
 if(t.type==='box'){const b=new THREE.Mesh(new THREE.BoxGeometry(1.3,.8,.8),new THREE.MeshLambertMaterial({color:caught?0x9a5a4a:0x7a7a70}));b.position.y=.4;const l=new THREE.Mesh(new THREE.BoxGeometry(1.34,.12,.84),new THREE.MeshLambertMaterial({color:0x4a4a44}));l.position.y=.82;g.add(b,l)}
 else{const r=new THREE.Mesh(new THREE.RingGeometry(.25,.4,12),new THREE.MeshBasicMaterial({color:0x8a6a3a,side:THREE.DoubleSide}));r.rotation.x=-Math.PI/2;r.position.y=.05;const s=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.7,5),new THREE.MeshLambertMaterial({color:0x5a3f25}));s.position.set(.45,.35,0);g.add(r,s);
  if(caught){const m=new THREE.Mesh(new THREE.BoxGeometry(.6,.4,.9),new THREE.MeshLambertMaterial({color:0x2a2420}));m.position.set(0,.25,0);g.add(m)}}
 scene.add(g);return g}
function syncTM(){if(!scene||!area.spawn)return;for(const id in TM){const t=S.traps.find(x=>x.id===id);if(!t||TM[id].st!==t.st){scene.remove(TM[id].g);delete TM[id]}}
 for(const t of S.traps)if(t.area===aid&&!TM[t.id])TM[t.id]={g:trapMesh(t),st:t.st}}
function drawTrapsMini(p){for(const t of S.traps){if(t.area!==aid)continue;mc.fillStyle=(t.st==='caught'&&t.type==='snare')?'#ff4a4a':'#d9a441';mc.fillRect(t.x-p.x-2,t.z-p.z-2,4,4)}}
function trapNear(p){let best=null,bd=3.2;for(const t of S.traps){if(t.area!==aid)continue;const d=Math.hypot(p.x-t.x,p.z-t.z);if(d<bd){bd=d;best=t}}if(!best)return null;
 const nm=best.st==='set'?'罠を撤去する':best.type==='snare'&&!best.chk?'くくり罠を確認する':'罠を回収する',o=TA[best.id];return(o&&o.name===nm)?o:(TA[best.id]={trapId:best.id,name:nm,id:'trap'})}
function placeTrap(type){if(aid==='base'||!S.trapInv[type]){toast('設置できません');return}
 if(S.traps.length>=trapLimit()){toast('設置上限です（'+trapLimit()+'個）');return}
 const p=player.position,r=player.rotation.y;let x=p.x+Math.sin(r)*1.6,z=p.z+Math.cos(r)*1.6;if(blocked(x,z)){x=p.x;z=p.z}
 if(blocked(x,z)||Math.abs(x)>area.half-3||Math.abs(z)>area.half-3){toast('ここには設置できません');return}
 if(S.traps.some(t=>t.area===aid&&Math.hypot(t.x-x,t.z-z)<DATA.trap.minDist)){toast('他の罠に近すぎます');return}
 S.traps.push({id:'t'+Date.now().toString(36)+Math.floor(Math.random()*1e4),type,area:aid,x,z,at:Date.now(),n:0,seed:(Math.random()*2147483647)|0,st:'set',chk:false,warned:false});
 S.trapInv[type]--;syncTM();schedTraps();save();closePanel();cur=null;toast(DATA.traps[type].name+'を設置した。アプリを閉じても時間は進む')}
function trapAct(id){const t=S.traps.find(x=>x.id===id);if(!t)return;near=null;$('act').style.display='none';
 if(t.st==='set'){S.traps.splice(S.traps.indexOf(t),1);S.trapInv[t.type]++;syncTM();schedTraps();save();toast('罠を撤去して持ち帰った');return}
 if(t.type==='snare'&&!t.chk){t.chk=true;save();toast('くくり罠に獲物がかかっている。回収できる');return}
 const D=DATA.animals[t.k],c=capture({k:t.k,D,sz:t.size,rare:t.rare,g:null,trap:t.type});S.traps.splice(S.traps.indexOf(t),1);S.trapInv[t.type]++;mEvt('trap',t.k,{rare:t.rare});syncTM();schedTraps();save();
 resCard('罠猟：回収完了',`${D.name}　${c.r.size}kg　${DATA.traps[t.type].name}${c.first?'<br>★初捕獲':''}${c.rec&&!c.first?'<br>★最大記録':''}${c.r.rare?'<br>★珍しい個体！':''}`)}
tap($('trapB'),()=>{if(aid!=='base'&&!aiming)trapPanel()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)procTraps()});setInterval(procTraps,30000);
/* ===== 時間帯・天候・イベント・日次/週次ミッション・生息数（Phase 7） ===== */
let env=null,HL=null,SUN=null,RAIN=null,evT=0,wxT=0,envAcc=0;
const MD=id=>DATA.missions[id]||(S.gen&&S.gen[id]);
const condOk=(c,x)=>!c||((!c.period||(env&&c.period===env.period))&&(!c.weather||(env&&c.weather===env.weather))&&(!c.area||c.area===aid)&&(!c.rare||(x&&x.rare)));
const condTxt=c=>c?'（'+[c.period&&DATA.fx.period[c.period].n,c.weather&&DATA.fx.weather[c.weather].n,c.area&&DATA.areas[c.area].name,c.rare&&'珍しい個体'].filter(Boolean).join('・')+'）':'';
const FXP=()=>DATA.fx.period[env.period],FXW=()=>DATA.fx.weather[env.weather];
const envSight=()=>env?FXP().sight*FXW().sight:1,envAlert=()=>env?FXP().alert*FXW().alert*(area.alertMul||1):1,envSign=()=>env?FXP().sign*FXW().sign*(area.signMul||1):1;
const hourOf=()=>(env.min/60)%24,periodOf=h=>h>=5&&h<10?'morning':h>=10&&h<16?'day':h>=16&&h<19?'evening':'night';
function wpick(o){let t=0;for(const k in o)t+=o[k];let r=Math.random()*t;for(const k in o)if((r-=o[k])<=0)return k;return Object.keys(o)[0]}
function envText(){const h=hourOf();return`🕒${FXP().n}${Math.floor(h)}:${String(Math.floor(h%1*60)).padStart(2,'0')} ${FXW().i}`}
const rnd2=a=>a[0]+Math.random()*(a[1]-a[0]);
function initEnv(){if(!area.spawn){env=null;return}const st=wpick(DATA.time.start),r=DATA.time.range[st];env={min:rnd2(r)*60,period:st,weather:wpick(area.weather||{clear:1})};env.period=periodOf(hourOf());wxT=rnd2(DATA.time.wxEvery);evT=rnd2(DATA.time.evEvery);applyEnv()}
const SKY=[[0,0x0b1226],[5,0x1b2540],[6.5,0xf0b28a],[8,0xa8d0ea],[16,0xa8d0ea],[18,0xe8a070],[19.5,0x2a2f50],[24,0x0b1226]],DIM=[[0,.3],[5,.3],[6.5,.7],[8,1],[16,1],[18,.75],[19.5,.4],[24,.3]];
function ip(tab,h,isCol){for(let i=1;i<tab.length;i++)if(h<=tab[i][0]){const a=tab[i-1],b=tab[i],t=(h-a[0])/(b[0]-a[0]||1);return isCol?new THREE.Color(a[1]).lerp(new THREE.Color(b[1]),t):a[1]+(b[1]-a[1])*t}return isCol?new THREE.Color(tab[tab.length-1][1]):tab[tab.length-1][1]}
function applyEnv(){if(!env||!scene)return;const h=hourOf(),w=env.weather,col=ip(SKY,h,true);if(w!=='clear')col.lerp(new THREE.Color(0x7a828c),w==='rain'?.55:.3);
 const dim=ip(DIM,h,false)*(w==='rain'?.75:w==='cloudy'?.9:1);scene.background=col;scene.fog.color.copy(col);scene.fog.near=w==='rain'?8:25;scene.fog.far=(w==='rain'?55:90)*(env.period==='night'?.75:1);if(HL)HL.intensity=.95*dim;if(SUN)SUN.intensity=.6*dim;setRain(w==='rain')}
function setRain(on){if(on&&!RAIN){const n=260,pos=new Float32Array(n*6);for(let i=0;i<n;i++){const x=(Math.random()-.5)*30,y=Math.random()*14,z=(Math.random()-.5)*30;pos.set([x,y,z,x,y-.6,z],i*6)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));RAIN=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xaabbcc,transparent:true,opacity:.5}));RAIN.frustumCulled=false;scene.add(RAIN)}if(RAIN)RAIN.visible=on}
function tickRain(dt,p){if(!RAIN||!RAIN.visible)return;RAIN.position.set(p.x,0,p.z);const a=RAIN.geometry.attributes.position.array;for(let i=0;i<a.length;i+=6){a[i+1]-=18*dt;a[i+4]-=18*dt;if(a[i+4]<0){a[i+1]=14;a[i+4]=13.4}}RAIN.geometry.attributes.position.needsUpdate=true}
function tickEnv(dt,p){if(!env)return;env.min+=dt*DATA.time.minPerSec;const np=periodOf(hourOf());if(np!==env.period){env.period=np;toast(({morning:'朝になった',day:'日が高くなった',evening:'日が傾いてきた',night:'夜になった。視界が悪い'})[np])}
 wxT-=dt;if(wxT<=0){wxT=rnd2(DATA.time.wxEvery);if(Math.random()<.5){const nw=wpick(area.weather||{clear:1});if(nw!==env.weather){env.weather=nw;toast(nw==='rain'?'雨が降り出した':nw==='clear'?'空が晴れてきた':'雲が出てきた')}}}
 envAcc+=dt;if(envAcc>.5){envAcc=0;applyEnv()}tickRain(dt,p);evT-=dt;if(evT<=0&&!aiming){evT=rnd2(DATA.time.evEvery);fireEvent(p)}}
function fireEvent(p){const L=DATA.events.filter(e=>!e.when||((!e.when.period||e.when.period.includes(env.period))&&(!e.when.weather||e.when.weather.includes(env.weather))));let r=Math.random()*L.reduce((s,e)=>s+e.w,0);const e=L.find(x=>(r-=x.w)<=0)||L[0],f=e.fx||{};let extra='';
 if(f.money){const v=f.money[0]+Math.floor(Math.random()*(f.money[1]-f.money[0]));S.money+=v;extra=`（💰${v}）`}
 if(f.ammo){const n=Math.max(2,Math.round(DATA.ammoPack[S.gun].n/2));S.ammo[S.gun]=(S.ammo[S.gun]||0)+n;extra=`（${G().name}の弾 ${n}発）`}
 if(f.dogRest)for(const d of party())d.fatigue=Math.max(0,d.fatigue-f.dogRest);
 if(f.sign)spawnSign(p,true);
 if(f.alertAll)for(const a of AN)if(a.st==='normal'&&Math.hypot(a.g.position.x-p.x,a.g.position.z-p.z)<35){a.st='alert';a.t=2}
 if(f.fresh){const k=pick(spawnW()),an=Math.random()*6.28,rr=25+Math.random()*10,a=mkAnimal(k,p.x+Math.cos(an)*rr,p.z+Math.sin(an)*rr);extra='（'+dirText(a.g.position.x-p.x,a.g.position.z-p.z)+'の方向）'}
 addExp(1);updInfo();toast('◆ '+e.text+extra)}
const popOf=(a,k)=>{const P=(S.pop[a]||{})[k];return P?Math.min(1,P.v+Math.max(0,Date.now()-P.t)/3600e3*DATA.pop.regen):1};
function popHit(a,k){const P=S.pop[a]||(S.pop[a]={});P[k]={v:Math.max(DATA.pop.min,popOf(a,k)-DATA.pop.hit),t:Date.now()}}
const abund=id=>{const ks=Object.keys(DATA.areas[id].spawn||{}),v=ks.reduce((s,k)=>s+popOf(id,k),0)/(ks.length||1);return v>.8?'多い':v>.5?'普通':'少ない'};
const mmdd=s=>{const a=s.split('-');return a[0]*100+ +a[1]};
function activeEvents(){const d=new Date(),n=(d.getMonth()+1)*100+d.getDate();return DATA.seasonal.filter(e=>{const f=mmdd(e.from),t=mmdd(e.to);return f<=t?n>=f&&n<=t:n>=f||n<=t})}
const evMul=()=>activeEvents().reduce((m,e)=>m*(e.rewardMul||1),1);
function evHtml(){const L=activeEvents();return L.length?'<div class="card">🎉 開催中：'+L.map(e=>`<b>${e.name}</b>（${e.desc}）`).join('／')+'</div>':''}
function spawnW(){const W={},ev=activeEvents();for(const k in area.spawn){let w=area.spawn[k]*(.25+.75*popOf(aid,k));if(env)w*=((DATA.fx.bias[env.period]||{})[k]||1);for(const e of ev)w*=((e.spawnBias||{})[k]||1);W[k]=w}return W}
const dkey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function wkey(){const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return dkey(d)}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function genSet(prefix,key,pool,count,scale){const r=mul32(hash(prefix+key)),idx=pool.map((_,i)=>i);for(let i=idx.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]]}
 const sp=new Set();for(const id of S.unlocked)if(DATA.areas[id]&&DATA.areas[id].spawn)for(const k in DATA.areas[id].spawn)if(DATA.areas[id].spawn[k]>=1)sp.add(k);const an=[...sp];
 return idx.slice(0,count).map((pi,i)=>{const P=pool[pi],n=P.n[0]+Math.floor(r()*(P.n[1]-P.n[0]+1)),animal=P.animal==='?'?an[Math.floor(r()*an.length)]:P.animal,id=prefix+':'+key+':'+i;
  return[id,{slot:prefix==='d'?'daily':'weekly',rank:1,title:P.title+(animal&&animal!=='*'&&P.type!=='sign'?'（'+DATA.animals[animal].name+'）':''),reason:P.reason,goals:[P.type==='sign'?{type:'sign',n}:{type:P.type,animal,n}],fixed:{money:Math.round(P.money*n*scale),exp:Math.round(P.exp*n*scale)},rand:scale}]})}
function rollMissions(){const dk=dkey(new Date()),wk=wkey();let ch=false;
 S.missions.active=S.missions.active.filter(a=>{if(!/^[dw]:/.test(a.id))return true;const cur=a.id.startsWith('d:'+dk+':')||a.id.startsWith('w:'+wk+':');if(!cur&&!a.ready){ch=true;return false}return true});
 const want={};for(const[id,m]of genSet('d',dk,DATA.dailyPool,3,1))want[id]=m;for(const[id,m]of genSet('w',wk,DATA.weeklyPool,2,1.6))want[id]=m;
 for(const id in want)if(!S.gen[id]){S.gen[id]=want[id];ch=true}
 const live=new Set(Object.keys(want).concat(S.missions.active.map(a=>a.id)));for(const id of Object.keys(S.gen))if(!live.has(id)){delete S.gen[id];delete S.missions.done[id];ch=true}
 if(ch){updMis();save()}}
/* ===== メインループ ===== */
const mc=$('mc').getContext('2d');let last=0,fr=0;
function loop(t){requestAnimationFrame(loop);const dt=Math.min((t-last)/1000||0,.05);last=t;if(!scene)return;uiTick(dt);
 if(!paused){let sx=st.x,sy=st.y;if(keys.KeyA)sx-=1;if(keys.KeyD)sx+=1;if(keys.KeyW)sy-=1;if(keys.KeyS)sy+=1;
  const m=Math.min(1,Math.hypot(sx,sy));moving=m>.08;if(m>.08){const sp=(aiming?DATA.player.sneak*.6:sneak?DATA.player.sneak:DATA.player.walk)*m*gm('speed'),a=Math.atan2(sx,sy);
   const dx=-Math.sin(yaw)*sy-Math.cos(yaw)*sx,dz=-Math.cos(yaw)*sy+Math.sin(yaw)*sx;const l=Math.hypot(dx,dz)||1;
   let nx=player.position.x+dx/l*sp*dt,nz=player.position.z+dz/l*sp*dt;const H=area.half-.6;nx=Math.max(-H,Math.min(H,nx));nz=Math.max(-H,Math.min(H,nz));
   let hit=false;for(const q of trees){if(Math.hypot(nx-q[0],nz-q[1])<(q[2]||.7)+DATA.player.radius){hit=true;break}}
   if(!hit){player.position.x=nx;player.position.z=nz}else if(Math.max(Math.abs(nx),Math.abs(nz))>area.half-6&&t>wt){wt=t+4000;toast('木々が深く茂っていて、これ以上は進めない')}faceY=Math.atan2(dx,dz)}
  if(aiming)faceY=yaw;let d=faceY-player.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));player.rotation.y+=d*Math.min(1,dt*12)}
 const p=player.position,D=6.5;cam.fov+=((aiming?G().zoom:60)-cam.fov)*Math.min(1,dt*10);cam.updateProjectionMatrix();
 if(aiming){kick=Math.max(0,kick-dt*.6);const A=pitch-.35-kick,ex=p.x-Math.sin(yaw)*1.6-Math.cos(yaw)*.5,ez=p.z-Math.cos(yaw)*1.6+Math.sin(yaw)*.5,ey=p.y+1.7;cam.position.set(ex,ey,ez);cam.lookAt(ex+Math.sin(yaw)*Math.cos(A)*50,ey-Math.sin(A)*50,ez+Math.cos(yaw)*Math.cos(A)*50)}
 else{cam.position.set(p.x-Math.sin(yaw)*Math.cos(pitch)*D,p.y+1.6+Math.sin(pitch)*D,p.z-Math.cos(yaw)*Math.cos(pitch)*D);cam.lookAt(p.x,p.y+1.3,p.z)}
 let best=null;if(aid==='base'){restDogs(dt);let bd=4.6;for(const f of DATA.facilities){const d=Math.hypot(p.x-f.x,p.z-f.z);if(d<bd){bd=d;best=f}}}else if(!paused){field(dt,p);best=signNear(p)}
 if(best!==near){near=best;const a=$('act');a.style.display=near?'flex':'none';if(near)a.textContent=near.sign?'痕跡を調べる':near.id==='gate'?'出発する':near.name}
 R.render(scene,cam);
 if(++fr%6===0)drawMini(p);if(fr%90===0&&aid!=='base')updInfo()}
function resize(){layout();R.setSize(GW,GH,false);cam.aspect=GW/GH;cam.updateProjectionMatrix()}
addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,200));resize();
addEventListener('pagehide',()=>save());document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});
addEventListener('error',e=>log('error',e.message));
tap($('start'),startGame);
