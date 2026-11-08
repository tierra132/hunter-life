// 素材(GLB)の点検ツールと、assets/models/ の運用ルール(作者表記の記入・予算内)のテスト
const fs=require('fs'),path=require('path');const out=[];let fails=0;const ok=(n,c,i)=>{out.push((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++};
const I=require('../tools/inspect_glb.js');
// 合成GLB（三角形1枚・歩行アニメ・1024pxのPNGヘッダ・24ボーン）を作って、点検ツール自体を検証
function buildGLB(over){over=over||{};
  const pos=Buffer.alloc(36);[0,0,0,1,0,0,0,1,0].forEach((v,i)=>pos.writeFloatLE(v,i*4));
  const idx=Buffer.alloc(8);[0,1,2].forEach((v,i)=>idx.writeUInt16LE(v,i*2));
  const tm=Buffer.alloc(8);tm.writeFloatLE(0,0);tm.writeFloatLE(over.duration||1.5,4);
  const png=Buffer.alloc(32);Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]).copy(png);png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(over.tex||1024,16);png.writeUInt32BE(over.tex||1024,20);
  const bin=Buffer.concat([pos,idx,tm,png]);
  const json={asset:{version:'2.0',generator:'test',copyright:over.copyright},
    buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:6},{buffer:0,byteOffset:44,byteLength:8},{buffer:0,byteOffset:52,byteLength:32}],
    accessors:[{bufferView:0,componentType:5126,count:over.verts||3,type:'VEC3'},{bufferView:1,componentType:5123,count:over.idxCount||3,type:'SCALAR'},{bufferView:2,componentType:5126,count:2,type:'SCALAR',min:[0],max:[over.duration||1.5]}],
    meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],
    skins:[{joints:Array.from({length:over.joints||24},(_,i)=>i)}],
    animations:[{name:over.anim||'Walk',samplers:[{input:2,output:2}],channels:[{sampler:0,target:{node:0,path:'translation'}}]}],
    images:[over.external?{uri:'tex.png'}:{bufferView:3,mimeType:'image/png'}],extensionsUsed:over.ext||[]};
  let js=Buffer.from(JSON.stringify(json));while(js.length%4)js=Buffer.concat([js,Buffer.from(' ')]);let b=bin;while(b.length%4)b=Buffer.concat([b,Buffer.alloc(1)]);
  const total=12+8+js.length+8+b.length,h=Buffer.alloc(12);h.writeUInt32LE(0x46546C67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(total,8);
  const c0=Buffer.alloc(8);c0.writeUInt32LE(js.length,0);c0.writeUInt32LE(0x4E4F534A,4);const c1=Buffer.alloc(8);c1.writeUInt32LE(b.length,0);c1.writeUInt32LE(0x004E4942,4);
  return Buffer.concat([h,c0,js,c1,b])}
const r=I.inspect(buildGLB({copyright:'作者X'}));
ok('A1 点検ツール: 三角形数・ボーン数・アニメーション名/長さ・テクスチャ寸法・作者表記を読み取れる',r.triangles===1&&r.skins[0].joints===24&&r.animations[0].name==='Walk'&&r.animations[0].duration===1.5&&r.images[0].w===1024&&r.images[0].h===1024&&r.copyright==='作者X',JSON.stringify({t:r.triangles,j:r.skins[0].joints,a:r.animations[0],i:r.images[0]}));
ok('A2 点検ツール: 予算内のモデルは問題なしと判定',I.check(r).filter(x=>!/アニメーション/.test(x)).length===0);
ok('A3 点検ツール: ポリゴン過多・巨大テクスチャ・ボーン過多・外部テクスチャ・圧縮拡張を検出',
  I.check(I.inspect(buildGLB({idxCount:3*20000}))).some(x=>/ポリゴン/.test(x))&&I.check(I.inspect(buildGLB({tex:4096}))).some(x=>/テクスチャが大きい/.test(x))&&I.check(I.inspect(buildGLB({joints:200}))).some(x=>/ボーン/.test(x))&&I.check(I.inspect(buildGLB({external:true}))).some(x=>/外部テクスチャ/.test(x))&&I.check(I.inspect(buildGLB({ext:['KHR_draco_mesh_compression']}))).some(x=>/圧縮/.test(x)));
let thr1=false,thr2=false;try{I.inspect(Buffer.from('これはGLBではありません........'))}catch(e){thr1=true}try{const b=buildGLB();b.writeUInt32LE(1,4);I.inspect(b)}catch(e){thr2=true}
ok('A4 点検ツール: GLBでないファイル・古い版は分かりやすく拒否する',thr1&&thr2);
// アニメ名の検査(models.jsのresolveClipを使う)
const src=['data.js','models.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n');const K=new Function(src+';return{resolveClip,DATA}')();global.resolveClip=K.resolveClip;
ok('A5 アニメーション不足の検出(待機・歩行・走行に使えるものが無い)',I.check(I.inspect(buildGLB({anim:'Eat'})),'deer',K.DATA.modelDefaults).some(x=>/「idle」/.test(x)&&true)&&I.check(I.inspect(buildGLB({anim:'Walk'})),'deer',K.DATA.modelDefaults).some(x=>/「run」/.test(x)));
// 実際の素材フォルダの運用ルール
const dir='assets/models',files=fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith('.glb')):[];let viol=[];const total=files.reduce((n,f)=>n+fs.statSync(path.join(dir,f)).size,0);
for(const f of files){const k=f.replace(/\.glb$/,''),m=K.DATA.models[k];
  if(!m){viol.push(f+': DATA.models に定義がありません');continue}
  const c=m.credit;if(!c||!c.author||!c.license||!c.url)viol.push(f+': credit(作者・ライセンス・URL)が未記入');
  else if(!/^(CC0|CC-BY-4\.0|CC-BY-3\.0|CC-BY-SA-4\.0|Purchased|Generated)/.test(c.license))viol.push(f+': ライセンス表記が想定外('+c.license+')');
  try{const rep=I.inspect(fs.readFileSync(path.join(dir,f)));for(const p of I.check(rep,k,K.DATA.modelDefaults))viol.push(f+': '+p)}catch(e){viol.push(f+': '+e.message)}}
if(total>20*1024*1024)viol.push('素材の合計容量が20MBを超えています('+(total/1048576).toFixed(1)+'MB)');
ok('A6 assets/models/ の全素材: 作者表記が記入済み・スマホ向け予算内・合計20MB以下',viol.length===0,viol.join(' / '));
out.push('INFO 導入済みの外部モデル: '+(files.length?files.join(', '):'なし(すべて代替表示)')+' / 合計 '+(total/1024).toFixed(0)+'KB');
console.log(out.join('\n'));console.log('---',out.filter(x=>/^(PASS|FAIL)/.test(x)).length,'項目 /',fails,'失敗 / 0 スキップ');process.exit(fails?1:0);
