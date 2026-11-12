// テスト用ハーネス：ブラウザ無しでゲームのロジックとUIの入力経路を動かす
// DOMは「イベントを受け付ける最小の疑似要素」、THREEは何もしない疑似オブジェクト
const fs=require('fs');
const BTN=new Set(['aim','sneak','gun','trapB','fire','act','menuBtn','misBtn','rotBtn','start']);
const noopCtx=new Proxy({}, {get:()=>()=>{},set:()=>true});
function makeEl(id,any){
  class FakeEl{
    constructor(){this.id=id;this.style={setProperty(){}};this.dataset={};this._l={};this._ih='';this._iw=0;this.children=[];this.parentNode=null;this.className='';this.textContent='';this.offsetLeft=0;this.offsetTop=0;this.offsetWidth=0;this.onclick=null;
      const c=new Set();this._c=c;this.classList={add:x=>c.add(x),remove:x=>c.delete(x),toggle:(x,f)=>{((f===undefined)?!c.has(x):f)?c.add(x):c.delete(x)},contains:x=>c.has(x)}}
    addEventListener(t,f){(this._l[t]=this._l[t]||[]).push(f)}
    dispatch(t,e){e=Object.assign({target:this,pointerId:1,clientX:0,clientY:0,preventDefault(){},stopPropagation(){}},e);(this._l[t]||[]).forEach(f=>f(e))}
    closest(){return(BTN.has(this.id)||this.id==='panel')?this:null}
    get innerHTML(){return this._ih} set innerHTML(v){this._ih=v;this._iw++}
    getContext(){return noopCtx} setPointerCapture(){} getBoundingClientRect(){return{left:0,top:0}}
    appendChild(c){this.children.push(c);c.parentNode=this;return c} removeChild(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);c.parentNode=null;return c}
  }
  const el=new FakeEl();
  return new Proxy(el,{get:(t,k)=>(k in t)?t[k]:(typeof k==='symbol'?undefined:()=>any()),set:(t,k,v)=>{t[k]=v;return true}});
}
function load(files,extra){
  let js=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
  const any=()=>new Proxy(function(){},{get:(t,k)=>k==='style'?{}:k==='position'||k==='rotation'||k==='scale'?(t['__'+k]=t['__'+k]||{x:k==='scale'?1:0,y:k==='scale'?1:0,z:k==='scale'?1:0,set(x,y,z){this.x=x;this.y=y;this.z=z;return this},setScalar(s){this.x=this.y=this.z=s;return this},copy(o){this.x=o.x;this.y=o.y;this.z=o.z;return this}}):k==='getContext'?()=>noopCtx:k==='dataset'?{}:k==='fov'?60:k==='geometry'?{attributes:{position:{array:new Float32Array(60),needsUpdate:false}}}:k==='attributes'?{position:{array:new Float32Array(60),needsUpdate:false}}:k==='children'?[]:k==='fog'?(t.__fog=t.__fog||{color:{copy(){}},near:0,far:0}):k==='intensity'?1:()=>any(),set:()=>true,construct:()=>any(),apply:()=>any()});
  const g=globalThis,els={};
  g.__els=els;
  g.document={getElementById:id=>els[id]||(els[id]=makeEl(id,any)),documentElement:makeEl('html',any),createElement:()=>makeEl('el',any),addEventListener(){},hidden:false};
  g.window=g;g.innerWidth=800;g.innerHeight=400;g.addEventListener=()=>{};g.requestAnimationFrame=()=>{};g.devicePixelRatio=1;g.setInterval=()=>0;
  g.THREE=new Proxy({},{get:()=>any()});
  const store={};g.__store=store;
  g.localStorage={getItem:k=>(k in store)?store[k]:null,setItem:(k,v)=>{if(g.__failSet)throw new Error('QuotaExceeded');store[k]=v},removeItem:k=>delete store[k]};
  g.__NOW=1.78e12;const D0=Date;g.Date=class extends D0{constructor(...a){a.length?super(...a):super(g.__NOW)}static now(){return g.__NOW}};
  js+='\n;'+extra;
  return (0,eval)(js);
}
module.exports={load};
