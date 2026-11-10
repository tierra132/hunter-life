// 3Dモデル層のテスト：実際のThree.jsの代わりに「動作を記録する簡易版」を使い、ロジックを検証する
const fs=require('fs');const out=[];let fails=0;const ok=(n,c,i)=>{out.push((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++};
class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}set(x,y,z){this.x=x;this.y=y;this.z=z;return this}setScalar(s){this.x=this.y=this.z=s;return this}}
class Obj{constructor(){this.position=new V3();this.rotation=new V3();this.scale=new V3(1,1,1);this.children=[];this.parent=null;this.userData={}}
 add(...c){for(const o of c){o.parent=this;this.children.push(o)}return this}remove(o){const i=this.children.indexOf(o);if(i>=0){this.children.splice(i,1);o.parent=null}return this}
 traverse(f){f(this);for(const c of this.children)c.traverse(f)}
 clone(){if(this.userData.cloneThrows)throw new Error('clone失敗(テスト)');const c=new this.constructor();c._bbox=this._bbox;c.isMesh=this.isMesh;if(this.material)c.material=this.material;for(const k of this.children)c.add(k.clone(true));return c}}
class Group extends Obj{}class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m;this.isMesh=true}}
class Color{constructor(h=0xffffff){this.hex=h;this.lerped=0}lerp(c,a){this.lerped+=a;return this}setHex(h){this.hex=h;return this}}
class Lambert{constructor(o={}){this.color=new Color(o.color);this.userData={}}clone(){const c=new Lambert();c.color=new Color(this.color.hex);c.userData={};return c}}
class Box3{setFromObject(o){const src=o._bbox?o:o.children[0],b=src._bbox;let s=1,p={x:0,y:0,z:0};if(o!==src){s=o.scale.x;p=o.position}
 this.min=new V3(b.min.x*s+p.x,b.min.y*s+p.y,b.min.z*s+p.z);this.max=new V3(b.max.x*s+p.x,b.max.y*s+p.y,b.max.z*s+p.z);return this}
 getSize(v){return v.set(this.max.x-this.min.x,this.max.y-this.min.y,this.max.z-this.min.z)}getCenter(v){return v.set((this.max.x+this.min.x)/2,(this.max.y+this.min.y)/2,(this.max.z+this.min.z)/2)}}
class Act{constructor(c){this.clip=c;this.calls=[];this.ts=1}reset(){this.calls.push('reset')}setEffectiveWeight(){}fadeIn(){this.calls.push('fadeIn')}fadeOut(){this.calls.push('fadeOut')}play(){this.calls.push('play')}setEffectiveTimeScale(t){this.ts=t}}
class Mixer{constructor(){this.updates=0;this.stopped=false}clipAction(c){return new Act(c)}update(){this.updates++}stopAllAction(){this.stopped=true}}
global.__geo=0;const geo=()=>class{constructor(){global.__geo++}};
global.__mode='ok';global.__gltf=null;
class Loader{load(url,okf,prog,errf){const m=global.__mode;if(m==='throw')throw new Error('loader例外');if(m==='timeout')return;
 setTimeout(()=>{if(m==='error')errf(new Error('404'));else if(m==='noscene')okf({animations:[]});else okf(global.__gltf())},0)}}
global.THREE={Group,Mesh,Color,Box3,Vector3:V3,AnimationMixer:Mixer,MeshLambertMaterial:Lambert,SphereGeometry:geo(),CylinderGeometry:geo(),ConeGeometry:geo(),LinearEncoding:3000,GLTFLoader:Loader};
const src=['data.js','models.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
const K=new Function(src+';return{ModelKit,resolveClip,pickState,timeScaleFor,DATA}')();
const{ModelKit,resolveClip,pickState,timeScaleFor,DATA}=K;
const mkScene=(bb,mat)=>{const s=new Group();s._bbox=bb;const m=new Mesh({},mat||{map:{encoding:0,needsUpdate:false},metalness:1,roughness:.1,color:new Color(0x888888)});s.add(m);return s};
const BB={min:{x:-.3,y:-.1,z:-1.2},max:{x:.3,y:1.1,z:1.2}};
const mkGltf=names=>()=>({scene:mkScene(BB),animations:names.map(n=>({name:n}))});

// --- M1-3 純粋関数
ok('M1a アニメ名の解決: 完全一致・大文字小文字・接頭辞を無視',resolveClip(['Idle','Walk','AnimalArmature|Gallop'],['Run','Gallop'])==='AnimalArmature|Gallop'&&resolveClip(['WALK'],['Walk'])==='WALK');
ok('M1b アニメ名の解決: 前方/部分一致と、見つからない場合',resolveClip(['Armature|Walk_Cycle'],['Walk'])==='Armature|Walk_Cycle'&&resolveClip(['Eat'],['Walk'])===null&&resolveClip([],['Walk'])===null&&resolveClip(['A'],[])===null);
ok('M2 速度と状況から状態を決める(待機/歩行/走行/警戒/逃走/構え)',pickState(0,null)==='idle'&&pickState(1.5,null)==='walk'&&pickState(5,null)==='run'&&pickState(0,'alert')==='alert'&&pickState(8,'flee')==='run'&&pickState(0,'flee')==='idle'&&pickState(1,'aim')==='aim');
ok('M3 再生速度は移動速度に比例し範囲内に収まる(足が滑らない)',Math.abs(timeScaleFor('walk',1.4)-1)<1e-9&&timeScaleFor('walk',10)===1.7&&timeScaleFor('walk',.1)===.6&&timeScaleFor('run',6)===1&&timeScaleFor('idle',5)===1);
// --- M4 定義の整合
const kinds=Object.keys(DATA.models),bad=[];
for(const k of Object.keys(DATA.animals))if(!DATA.models[k])bad.push('定義なし:'+k);
for(const k of kinds){const e=ModelKit.entry(k);if(!/^assets\/models\/[a-z0-9_-]+\.glb$/.test(e.src||''))bad.push('src不正:'+k);if(!['human','quad'].includes(e.rig))bad.push('rig不正:'+k);if(!e.look)bad.push('look無し:'+k);
  for(const st of['idle','walk','run'])if(!(e.clips[st]&&e.clips[st].length))bad.push('clips無し:'+k+'/'+st)}
ok('M4 全動物+プレイヤー+犬にモデル定義がある(素材名・骨格種別・代替の外観・アニメ候補)',bad.length===0&&['player','dog'].every(k=>DATA.models[k]),bad.join(','));
// --- M5 代替モデル(関節付き)
const finite=r=>{let good=true;r.traverse(o=>{for(const v of[o.position,o.rotation,o.scale])for(const a of['x','y','z'])if(!Number.isFinite(v[a]))good=false});return good};
const snap=r=>{const a=[];r.traverse(o=>a.push(o.rotation.x,o.rotation.y,o.rotation.z));return a};
const diff=(a,b)=>a.reduce((n,v,i)=>n+(Math.abs(v-b[i])>.1?1:0),0);
let allOk=true,moveOk=true,alertOk=true,detail='';
for(const k of kinds){ModelKit._reset();const a=ModelKit.create(k,{length:1,height:1.75,seed:2});if(!a.isFallback||a.root.children.length<1){allOk=false;detail+=' 非代替:'+k}
  const step=(sp,h,n)=>{for(let i=0;i<n;i++)a.update(1/60,sp,h)};
  step(0,null,120);const idle=snap(a.root);step(1.4,null,90);const walk=snap(a.root);step(7,'flee',90);const run=snap(a.root);step(0,'alert',120);const al=snap(a.root);step(0,'aim',60);
  if(!finite(a.root)){allOk=false;detail+=' 非有限:'+k}
  if(diff(idle,walk)<(DATA.models[k].rig==='human'?2:4)||diff(idle,run)<(DATA.models[k].rig==='human'?2:4)){moveOk=false;detail+=' 動きなし:'+k}
  if(DATA.models[k].rig==='quad'&&diff(idle,al)<1){alertOk=false;detail+=' 警戒差なし:'+k}}
ok('M5a 全モデル(8種)の代替表示が生成でき、待機→歩行→走行→警戒→逃走→構えを通しても座標が壊れない',allOk,detail);
ok('M5b 歩行・走行では関節(脚/腕)が実際に動く',moveOk,detail);
ok('M5c 動物は警戒時に姿勢が変わる(首・耳・尾)',alertOk,detail);
// 個体差と珍しい個体の色味
ModelKit._reset();const r1=ModelKit.create('deer',{length:1.5,rare:true,tint:{color:0xffffff,amt:.5}});let tinted=0;r1.root.traverse(o=>{if(o.isMesh&&o.material&&o.material.color&&o.material.color.lerped>0)tinted++});
ok('M5d 珍しい個体は色味が変わる(代替モデル)',tinted>0,tinted+'個');
// --- M6 GLB
ModelKit._reset();ModelKit._inject('deer',{fallback:false,gltf:mkGltf(['Idle','Walk','Gallop'])(),clips:['Idle','Walk','Gallop']});
const g=ModelKit.create('deer',{length:1.6});const inner=g.root.children[0];
ok('M6a GLBが使われる(代替ではない)・必要なアニメが全て見つかる',!g.isFallback&&g.missing.length===0&&!!g.acts.idle&&!!g.acts.walk&&!!g.acts.run);
const sc=1.6/2.4;ok('M6b 大きさを指定の体長に合わせる',Math.abs(inner.scale.x-sc)<1e-9,'scale='+inner.scale.x);
ok('M6c 接地：モデルの最下部が地面(y=0)に来る・中心がずれない',Math.abs(inner.position.y-(.1*sc))<1e-9&&Math.abs(inner.position.x)<1e-9&&Math.abs(inner.position.z)<1e-9,'y='+inner.position.y);
const ci=g.acts.idle.calls.length;g.update(1/60,1.4,null);
ok('M6d 速度に応じて待機→歩行へ切り替わり、クロスフェードする',g.state==='walk'&&g.acts.idle.calls.includes('fadeOut')&&g.acts.walk.calls.includes('fadeIn')&&g.acts.walk.calls.includes('play'));
ok('M6e 歩行の再生速度が移動速度と一致する',Math.abs(g.acts.walk.ts-1)<1e-9,'ts='+g.acts.walk.ts);
g.update(1/60,6,null);ok('M6f 走行へ切り替わる',g.state==='run'&&g.acts.run.calls.includes('fadeIn')&&Math.abs(g.acts.run.ts-1)<1e-9);
g.update(1/60,0,'alert');ok('M6g 警戒は待機アニメで代用される(警戒用アニメが無い場合)',g.state==='alert'&&g.cur===g.acts.idle);
ok('M6h 毎フレームmixerが更新される',g.mixer.updates===3);
g.tint(0xffffff,.5);let t2=0;g.root.traverse(o=>{if(o.isMesh&&o.material.color.lerped>0)t2++});ok('M6i 珍しい個体の色味変更がGLBにも効く',t2>0);
g.dispose();ok('M6j 破棄でアニメ停止・シーンから外れる',g.mixer.stopped&&g.root.parent===null);
ModelKit._reset();ModelKit._inject('deer',{fallback:false,gltf:mkGltf(['Idle','Walk'])(),clips:['Idle','Walk']});const g2=ModelKit.create('deer',{length:1.6});g2.update(1/60,6,'flee');
ok('M6k 走行アニメが無いGLBは歩行アニメを速めて代用し、不足を記録する',g2.missing.join()==='run'&&g2.cur===g2.acts.walk&&g2.acts.walk.ts>1.5,'ts='+g2.acts.walk.ts);
// --- M7 読み込み失敗の扱い
(async()=>{
  const race=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(()=>r('TIMEOUT'),ms))]);
  global.__gltf=mkGltf(['Idle','Walk','Run']);
  ModelKit._reset();global.__mode='error';let r=await race(ModelKit.loadOne('deer'),500);
  ok('M7a ファイル無し(404)でも停止せず代替表示になる。任意素材は警告を出さない',r&&r.fallback===true&&ModelKit.errors.length===0);
  ModelKit._reset();DATA.models.deer.optional=false;r=await race(ModelKit.loadOne('deer'),500);
  ok('M7b 必須素材の読み込み失敗はエラーとして記録される(代替表示で継続)',r&&r.fallback===true&&ModelKit.errors.length===1);delete DATA.models.deer.optional;
  ModelKit._reset();global.__mode='timeout';const t0=Date.now();r=await race(ModelKit.loadOne('deer',60),1000);
  ok('M7c 応答が無い場合は時間切れで代替表示になる(固まらない)',r&&r.fallback===true&&Date.now()-t0<800);
  ModelKit._reset();global.__mode='noscene';r=await race(ModelKit.loadOne('deer'),500);ok('M7d 中身が壊れたファイルは代替表示になる',r&&r.fallback===true);
  ModelKit._reset();global.__mode='throw';r=await race(ModelKit.loadOne('deer'),500);ok('M7e ローダー自体が例外を出しても代替表示になる',r&&r.fallback===true);
  ModelKit._reset();global.__mode='ok';r=await race(ModelKit.loadOne('deer'),500);let mt=null;r&&r.gltf&&r.gltf.scene.traverse(o=>{if(o.isMesh)mt=o.material});
  ok('M7f 読み込み成功：アニメ一覧を保持し、材質を調整(暗くならない・金属で黒くならない)',r&&!r.fallback&&r.clips.join()==='Idle,Walk,Run'&&mt&&mt.map.encoding===3000&&mt.metalness<=.1&&mt.roughness>=.7);
  ModelKit._reset();global.__mode='error';let prog=0;const st=await ModelKit.preloadAll(()=>prog++);
  ok('M7g 全モデルの事前読み込み：進捗が全件分通知され、全て失敗でも完了する',prog===Object.keys(DATA.models).length&&st.fallback.length===Object.keys(DATA.models).length&&st.glb.length===0);
  ModelKit._reset();global.__mode='ok';const st2=await ModelKit.preloadAll();ok('M7h 事前読み込み成功時は全て外部モデルになる',st2.glb.length===Object.keys(DATA.models).length);
  // --- M8 生成失敗
  ModelKit._reset();const bs=mkGltf(['Idle','Walk','Run'])();bs.scene.userData.cloneThrows=true;ModelKit._inject('deer',{fallback:false,gltf:bs,clips:['Idle','Walk','Run']});
  const fa=ModelKit.create('deer',{length:1.6});ok('M8 モデルの複製に失敗しても代替表示で継続し、記録する',fa.isFallback&&ModelKit.errors.some(e=>/instantiate/.test(e.why)));
  // --- M9 クレジット
  ModelKit._reset();ModelKit._inject('deer',{fallback:false,gltf:mkGltf(['Idle'])(),clips:['Idle']});ModelKit._inject('fox',{fallback:true});
  const none=ModelKit.credits().length;DATA.models.deer.credit={title:'Deer',author:'作者A',license:'CC0',url:'https://example.com'};DATA.models.fox.credit={author:'B',license:'CC0',url:'u'};
  const c=ModelKit.credits();ok('M9 クレジットは「実際に使っている外部モデル」だけ表示される(未記入は出ない・代替表示は出ない)',none===0&&c.length===1&&c[0].author==='作者A');
  // --- M10 負荷対策：形状・材質の共有、メッシュ数の予算、色変更の独立性
  ModelKit._reset();ModelKit.create('deer',{length:1.6,seed:1});const g0=global.__geo;const ds=[];for(let i=0;i<10;i++)ds.push(ModelKit.create('deer',{length:1.6,seed:i}));
  ok('M10a 同じ種類を10体増やしても、新しい形状(ジオメトリ)は作られない(共有)',global.__geo===g0,'増加='+(global.__geo-g0));
  const cnt=r=>{let n=0;r.traverse(o=>{if(o.isMesh)n++});return n};let over=[];for(const k of Object.keys(DATA.models)){const a=ModelKit.create(k,{length:1,height:1.75});const lim=DATA.models[k].rig==='human'?30:40;if(cnt(a.root)>lim)over.push(k+':'+cnt(a.root))}
  ok('M10b 1体あたりのメッシュ数が予算内(人型30以下・動物40以下)',over.length===0,over.join(','));
  const r1=ModelKit.create('deer',{length:1.6,rare:true,tint:{color:0xffffff,amt:.5}}),r2=ModelKit.create('deer',{length:1.6});let l1=0,l2=0;r1.root.traverse(o=>{if(o.isMesh&&o.material.color.lerped)l1++});r2.root.traverse(o=>{if(o.isMesh&&o.material.color.lerped)l2++});
  ok('M10c 珍しい個体の色変更は他の個体に影響しない',l1>0&&l2===0,'珍しい='+l1+' 通常='+l2);
  console.log(out.join('\n'));console.log('---',out.length,'項目 /',fails,'失敗 / 0 スキップ');process.exit(fails?1:0);
})();
