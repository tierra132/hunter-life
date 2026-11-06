// 罠（現実時間経過）テスト：時計を差し替えて「アプリを閉じている間」を再現する
const {load}=require('./harness.js');const out=[];let fails=0;globalThis.__out=out;
globalThis.__rep=(n,c,i)=>{out.push((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++};
const body=`(function(){
 const ok=__rep,T0=__NOW;
 S=validate(defSave());go('base');go('satoyama');S.rank=1;S.trapInv.box=2;S.trapInv.snare=3;
 const cand=[];for(let x=-40;x<=40&&cand.length<5;x+=6)for(let z=-40;z<=40&&cand.length<5;z+=6)if(!blocked(x,z)&&!blocked(x+1.6,z)&&cand.every(c=>Math.hypot(c[0]-x,c[1]-z)>8))cand.push([x,z]);
 cand.forEach((c,i)=>{player.position.x=c[0];player.position.z=c[1];placeTrap(i%2?'box':'snare')});
 ok('T1 設置上限(Rank1=3個)が守られる',S.traps.length===3);
 player.position.x=S.traps[0].x+1;player.position.z=S.traps[0].z;const n0=S.traps.length;S.rank=10;placeTrap('snare');S.rank=1;ok('T2 他の罠に近すぎる場所には置けない',S.traps.length===n0);
 let now=T0+10*3600e3;stepTraps(now);ok('T3 10時間後: 判定回数=10',S.traps.every(t=>t.st!=='set'||t.n===10));
 const snap=JSON.stringify(S.traps);stepTraps(now);stepTraps(now);ok('T4 同時刻の再実行で二重判定されない',JSON.stringify(S.traps)===snap);
 save();const L=load();ok('T5 再起動後に罠が復元される',JSON.stringify(L.traps.map(t=>[t.id,t.n,t.st,t.k]))===JSON.stringify(S.traps.map(t=>[t.id,t.n,t.st,t.k])));
 const clone=JSON.parse(JSON.stringify(S));now=T0+30*3600e3;stepTraps(now);const big=JSON.stringify(S.traps.map(t=>[t.id,t.n,t.st,t.k,t.size,t.ct]));
 S=clone;for(let h=11;h<=30;h++)stepTraps(T0+h*3600e3);ok('T6 一括経過と刻み経過で結果が一致(再起動で結果が変わらない)',JSON.stringify(S.traps.map(t=>[t.id,t.n,t.st,t.k,t.size,t.ct]))===big);
 const c=S.traps.find(t=>t.st==='caught');if(c){const k=c.k,n=c.n;stepTraps(T0+40*3600e3);ok('T7 捕獲済みは追加判定されない',c.n===n&&c.k===k)}
 const setN=S.traps.filter(t=>t.st==='set').length,inv=S.trapInv.box+S.trapInv.snare;stepTraps(T0+49*3600e3);ok('T8 48時間超の未捕獲罠は期限切れ→手元に戻る',S.traps.every(t=>t.st!=='set')&&S.trapInv.box+S.trapInv.snare===inv+setN);
 const cc=S.traps.find(t=>t.st==='caught');if(cc){const bag=S.bag.length,sn=cc.type==='snare';trapAct(cc.id);if(sn){ok('T9 くくり罠は確認→回収の2段階',S.bag.length===bag&&S.traps.includes(cc));trapAct(cc.id)}ok('T10 回収で所持品・個体記録に反映され罠は消える',S.bag.length===bag+1&&!S.traps.includes(cc)&&S.records.slice(-1)[0].method==='trap')}
 for(const type of['box','snare']){let c=0;for(let i=0;i<1000;i++){const t={type,area:'satoyama',seed:(Math.random()*2147483647)|0};for(let n=1;n<=48;n++)if(trapRoll(t,n)){c++;break}}__out.push('INFO '+DATA.traps[type].name+' 48時間以内の捕獲率 '+(c/10).toFixed(0)+'%')}
 S.traps.push({id:'tx',type:'box',area:'satoyama',x:50,z:50,at:__NOW+5*3600e3,n:0,seed:1,st:'set',chk:false,warned:false});ok('T11 時計が過去に戻っても壊れない',stepTraps(__NOW).length===0);
})();`;
load(process.argv.slice(2),body);console.log(out.join('\n'));console.log('---',out.filter(x=>/^(PASS|FAIL)/.test(x)).length,'項目 /',fails,'失敗');process.exit(fails?1:0);
