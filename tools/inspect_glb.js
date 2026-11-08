// GLBファイルの点検ツール: node tools/inspect_glb.js ファイル.glb [...]
// ポリゴン数・アニメーション・テクスチャ寸法・容量を読み取り、スマートフォン向けの予算に収まるか判定します。
const fs=require('fs');
function parseGLB(buf){
  if(buf.length<20||buf.readUInt32LE(0)!==0x46546C67)throw new Error('GLBではありません(先頭のマジック不一致)');
  if(buf.readUInt32LE(4)!==2)throw new Error('glTF 2.0 のGLBではありません');
  let off=12,json=null,bin=null;
  while(off+8<=buf.length){const len=buf.readUInt32LE(off),type=buf.readUInt32LE(off+4),data=buf.slice(off+8,off+8+len);
    if(type===0x4E4F534A)json=JSON.parse(data.toString('utf8'));else if(type===0x004E4942)bin=data;off+=8+len+((4-len%4)%4===0?0:0)}
  if(!json)throw new Error('JSONチャンクがありません');return{json,bin}}
function imageSize(bytes){ // PNG/JPEGの幅×高さ
  if(bytes.length>24&&bytes[0]===0x89&&bytes[1]===0x50)return{w:bytes.readUInt32BE(16),h:bytes.readUInt32BE(20),type:'png'};
  if(bytes[0]===0xFF&&bytes[1]===0xD8){let i=2;while(i+9<bytes.length){if(bytes[i]!==0xFF){i++;continue}const mk=bytes[i+1];if(mk>=0xC0&&mk<=0xCF&&mk!==0xC4&&mk!==0xC8&&mk!==0xCC)return{h:bytes.readUInt16BE(i+5),w:bytes.readUInt16BE(i+7),type:'jpeg'};i+=2+bytes.readUInt16BE(i+2)}}
  return null}
function inspect(buf){
  const{json,bin}=parseGLB(buf),acc=json.accessors||[],bv=json.bufferViews||[];let tris=0,verts=0;
  for(const m of json.meshes||[])for(const p of m.primitives||[]){const mode=p.mode===undefined?4:p.mode;if(p.attributes&&p.attributes.POSITION!==undefined)verts+=acc[p.attributes.POSITION].count;
    if(mode===4)tris+=(p.indices!==undefined?acc[p.indices].count:acc[p.attributes.POSITION].count)/3}
  const anims=(json.animations||[]).map(a=>{let dur=0;for(const s of a.samplers||[]){const ac=acc[s.input];if(ac&&ac.max&&ac.max[0]>dur)dur=ac.max[0]}return{name:a.name||'(無名)',duration:+dur.toFixed(2),channels:(a.channels||[]).length}});
  const images=(json.images||[]).map((im,i)=>{let info=null;if(im.bufferView!==undefined&&bin){const v=bv[im.bufferView];info=imageSize(bin.slice(v.byteOffset||0,(v.byteOffset||0)+v.byteLength))}return{index:i,mime:im.mimeType||(im.uri?'外部ファイル':'?'),w:info&&info.w,h:info&&info.h,external:!!im.uri&&!im.uri.startsWith('data:')}});
  const skins=(json.skins||[]).map(s=>({joints:(s.joints||[]).length}));
  return{bytes:buf.length,meshes:(json.meshes||[]).length,triangles:Math.round(tris),vertices:verts,materials:(json.materials||[]).length,skins,animations:anims,images,
    extensions:json.extensionsUsed||[],generator:(json.asset||{}).generator||null,copyright:(json.asset||{}).copyright||null}}
// スマートフォン向けの予算（超えると警告）
const LIMITS={maxBytes:3*1024*1024,maxTriangles:15000,maxTexture:2048,maxJoints:80,needClips:['idle','walk','run']};
function check(rep,kind,defs){const out=[];const L=LIMITS;
  if(rep.bytes>L.maxBytes)out.push(`容量が大きい(${(rep.bytes/1048576).toFixed(1)}MB > ${L.maxBytes/1048576}MB)`);
  if(rep.triangles>L.maxTriangles)out.push(`ポリゴン数が多い(${rep.triangles} > ${L.maxTriangles})`);
  for(const im of rep.images){if(im.external)out.push('外部テクスチャ参照(GLBに埋め込まれていない)');if(im.w&&Math.max(im.w,im.h)>L.maxTexture)out.push(`テクスチャが大きい(${im.w}x${im.h} > ${L.maxTexture})`)}
  for(const s of rep.skins)if(s.joints>L.maxJoints)out.push(`ボーンが多い(${s.joints} > ${L.maxJoints})`);
  if(rep.extensions.some(e=>/draco|meshopt|basisu/i.test(e)))out.push('圧縮拡張('+rep.extensions.filter(e=>/draco|meshopt|basisu/i.test(e)).join(',')+')を使用：追加のデコーダが必要で、現在の読み込み基盤は未対応');
  if(defs){const names=rep.animations.map(a=>a.name),res=(global.resolveClip||(()=>null));for(const st of L.needClips)if(!res(names,defs.clips[st]))out.push(`「${st}」に使えるアニメーションが見つからない(${names.join(', ')||'なし'})`)}
  return out}
module.exports={parseGLB,inspect,check,imageSize,LIMITS};
if(require.main===module){const files=process.argv.slice(2);if(!files.length){console.log('使い方: node tools/inspect_glb.js ファイル.glb');process.exit(2)}let bad=0;
  for(const f of files){try{const r=inspect(fs.readFileSync(f)),p=check(r);console.log(`\n== ${f}\n  容量 ${(r.bytes/1024).toFixed(0)}KB / メッシュ${r.meshes} / 三角形${r.triangles} / 頂点${r.vertices} / 材質${r.materials} / ボーン${r.skins.map(s=>s.joints).join(',')||'なし'}\n  アニメーション: ${r.animations.map(a=>a.name+'('+a.duration+'s)').join(', ')||'なし'}\n  テクスチャ: ${r.images.map(i=>i.w?i.w+'x'+i.h:i.mime).join(', ')||'なし'}\n  作者表記(asset.copyright): ${r.copyright||'なし'} / 生成元: ${r.generator||'不明'}`);
    if(p.length){bad++;console.log('  ⚠ 要確認:\n   - '+p.join('\n   - '))}else console.log('  ✔ 予算内')}catch(e){bad++;console.log(`\n== ${f}\n  ✖ ${e.message}`)}}process.exit(bad?1:0)}
