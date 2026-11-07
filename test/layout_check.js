// 画面配置の検査：代表的な端末サイズで、HUD・ボタンの重なり/はみ出しを座標から確認する
// 縦持ちでも画面を回転して横表示するため、論理サイズ(GW×GH)は「長辺×短辺」で検査する
const out=[];let fails=0;
const sizes=[[568,300],[640,320],[667,330],[740,340],[812,350],[844,360],[852,393],[932,430],[1024,600]];
const R=(GW,GH,right,bottom,w,h)=>[GW-right-w,GH-bottom-h,GW-right,GH-bottom];
const T=(GW,GH,right,top,w,h)=>[GW-right-w,top,GW-right,top+h];
function els(GW,GH,aim){
  const e={info:[8,8,208,58],gunchip:[8,62,208,98],mini:T(GW,GH,8,8,96,96),menu:T(GW,GH,112,8,52,52),misBtn:T(GW,GH,172,8,52,52),rotBtn:[8,GH-60,60,GH-8],
    notes:[210,8,GW-236,8+110]};
  if(aim){e.fire=R(GW,GH,24,24,96,96);e.aim=R(GW,GH,132,30,68,68)}
  else{e.act=R(GW,GH,20,100,150,52);e.aim=R(GW,GH,20,20,68,68);e.sneak=R(GW,GH,100,20,56,56);e.trap=R(GW,GH,164,20,56,56)}
  return e}
const ov=(a,b)=>Math.min(a[2],b[2])-Math.max(a[0],b[0])>1&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>1;
let n=0;
for(const[GW,GH]of sizes)for(const aim of[false,true]){const E=els(GW,GH,aim),k=Object.keys(E);n++;const bad=[];
  for(let i=0;i<k.length;i++)for(let j=i+1;j<k.length;j++)if(ov(E[k[i]],E[k[j]]))bad.push(k[i]+'×'+k[j]);
  for(const x of k){const v=E[x];if(v[0]<0||v[1]<0||v[2]>GW||v[3]>GH)bad.push('はみ出し:'+x)}
  if(E.notes[2]-E.notes[0]<120)bad.push('通知の幅が狭すぎる('+(E.notes[2]-E.notes[0])+'px)');
  out.push((bad.length?'FAIL ':'PASS ')+`${GW}x${GH} ${aim?'構え中':'通常'}`+(bad.length?'  '+bad.join(', '):''));if(bad.length)fails++}
console.log(out.join('\n'));console.log('---',n,'項目 /',fails,'失敗 / 0 スキップ');process.exit(fails?1:0);
