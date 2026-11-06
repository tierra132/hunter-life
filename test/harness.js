// テスト用ハーネス：ブラウザ無しでゲームのロジックを読み込む（DOM/THREEは最小のスタブ）
const fs=require('fs');
function load(files,extra){
  let js=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
  const any=()=>new Proxy(function(){},{get:(t,k)=>k==='style'?{}:k==='position'||k==='rotation'||k==='scale'?(t['__'+k]=t['__'+k]||{x:0,y:0,z:0,set(){}}):k==='getContext'?()=>new Proxy({}, {get:()=>()=>{},set:()=>true}):k==='dataset'?{}:k==='fov'?60:k==='geometry'?{attributes:{position:{array:new Float32Array(60),needsUpdate:false}}}:k==='attributes'?{position:{array:new Float32Array(60),needsUpdate:false}}:k==='children'?[]:k==='fog'?(t.__fog=t.__fog||{color:{copy(){}},near:0,far:0}):k==='intensity'?1:()=>any(),set:()=>true,construct:()=>any(),apply:()=>any()});
  const g=globalThis;
  g.document={getElementById:()=>any(),createElement:()=>any(),addEventListener(){},hidden:false};
  g.window=g;g.innerWidth=800;g.innerHeight=400;g.addEventListener=()=>{};g.requestAnimationFrame=()=>{};g.devicePixelRatio=1;g.setInterval=()=>0;
  g.THREE=new Proxy({},{get:()=>any()});
  const store={};g.__store=store;
  g.localStorage={getItem:k=>(k in store)?store[k]:null,setItem:(k,v)=>{if(g.__failSet)throw new Error('QuotaExceeded');store[k]=v},removeItem:k=>delete store[k]};
  g.__NOW=1.78e12;const D0=Date;g.Date=class extends D0{constructor(...a){a.length?super(...a):super(g.__NOW)}static now(){return g.__NOW}};
  js+='\n;'+extra;
  const r=(0,eval)(js);return r;
}
module.exports={load};
