// 罠（現実時間経過）テスト：時計を差し替えて「アプリを閉じている間」を再現。乱数に依存しない(種を固定して必ず捕獲/非捕獲を作る)
const {load}=require('./harness.js');const out=[];let fails=0;globalThis.__out=out;
globalThis.__rep=(n,c,i)=>{out.push((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++};
const body=`(function(){
 const ok=__rep,T0=__NOW,H=3600e3;
 const findSeed=(type,want)=>{for(let s=1;s<20000;s++){const t={type,area:'satoyama',seed:s};let hit=0;for(let n=1;n<=48;n++)if(trapRoll(t,n)){hit=n;break}if(want?(hit&&hit<=20):!hit)return s}return null};
 const sCatchSnare=findSeed('snare',true),sCatchBox=findSeed('box',true),sNoSnare=findSeed('snare',false);
 ok('T0 テスト用の固定シードを用意できる(捕獲あり/なし)',sCatchSnare&&sCatchBox&&sNoSnare,[sCatchSnare,sCatchBox,sNoSnare].join(','));
 S=validate(defSave());go('base');go('satoyama');S.rank=1;S.trapInv.box=2;S.trapInv.snare=3;
 const cand=[];for(let x=-40;x<=40&&cand.length<5;x+=6)for(let z=-40;z<=40&&cand.length<5;z+=6)if(!blocked(x,z)&&!blocked(x+1.6,z)&&cand.every(c=>Math.hypot(c[0]-x,c[1]-z)>8))cand.push([x,z]);
 cand.forEach((c,i)=>{player.position.x=c[0];player.position.z=c[1];placeTrap(i%2?'box':'snare')});
 ok('T1 設置上限(Rank1=3個)が守られる',S.traps.length===3);
 player.position.x=S.traps[0].x+1;player.position.z=S.traps[0].z;const n0=S.traps.length;S.rank=10;placeTrap('snare');S.rank=1;ok('T2 他の罠に近すぎる場所には置けない',S.traps.length===n0);
 // 種を固定：[0]くくり罠(必ず捕獲) [1]箱罠(必ず捕獲) [2]くくり罠(捕獲しない)
 S.traps[0].seed=sCatchSnare;S.traps[1].seed=sCatchBox;S.traps[2].seed=sNoSnare;
 ok('T2b 罠の種類が想定どおり(くくり/箱/くくり)',S.traps.map(t=>t.type).join()==='snare,box,snare');
 let now=T0+25*H;stepTraps(now);
 ok('T3 25時間後: 捕獲あり2基は捕獲済み・捕獲なしは判定25回で稼働中',S.traps[0].st==='caught'&&S.traps[1].st==='caught'&&S.traps[2].st==='set'&&S.traps[2].n===25);
 const snap=JSON.stringify(S.traps);stepTraps(now);stepTraps(now);ok('T4 同時刻の再実行で二重判定されない',JSON.stringify(S.traps)===snap);
 save();const L=load();ok('T5 再起動後に罠が復元される',JSON.stringify(L.traps.map(t=>[t.id,t.n,t.st,t.k]))===JSON.stringify(S.traps.map(t=>[t.id,t.n,t.st,t.k])));
 // 一括経過 と 刻み経過 が同じ結果になること(閉じていた時間をまとめて計算しても、都度計算しても同じ)
 const fresh=()=>{S.traps.forEach((t,i)=>{t.st='set';t.n=0;t.k=undefined;t.chk=false;t.warned=false});S.traps[0].seed=sCatchSnare;S.traps[1].seed=sCatchBox;S.traps[2].seed=sNoSnare};
 fresh();stepTraps(T0+30*H);const big=JSON.stringify(S.traps.map(t=>[t.n,t.st,t.k,t.size,t.ct]));
 fresh();for(let h=1;h<=30;h++)stepTraps(T0+h*H);ok('T6 一括経過と刻み経過で結果が一致(再起動で結果が変わらない)',JSON.stringify(S.traps.map(t=>[t.n,t.st,t.k,t.size,t.ct]))===big);
 const c0=S.traps[0],kk=c0.k,nn=c0.n;stepTraps(T0+45*H);ok('T7 捕獲済みは追加判定されない',c0.n===nn&&c0.k===kk&&c0.st==='caught');
 const inv=S.trapInv.box+S.trapInv.snare;stepTraps(T0+49*H);ok('T8 48時間超の捕獲なし罠は期限切れ→手元に戻る(捕獲済みは残る)',S.traps.length===2&&S.traps.every(t=>t.st==='caught')&&S.trapInv.box+S.trapInv.snare===inv+1);
 const bag=S.bag.length,sn=S.traps[0];trapAct(sn.id);ok('T9 くくり罠は確認→回収の2段階(1回目では回収されない)',S.bag.length===bag&&S.traps.includes(sn)&&sn.chk===true);
 trapAct(sn.id);ok('T10a くくり罠の回収で所持品・個体記録に反映され罠は消える',S.bag.length===bag+1&&!S.traps.includes(sn)&&S.records.slice(-1)[0].method==='trap');
 const bx=S.traps[0];trapAct(bx.id);ok('T10b 箱罠は現地で回収できる',S.bag.length===bag+2&&S.traps.length===0);
 for(const type of['box','snare']){let c=0;for(let i=0;i<1000;i++){const t={type,area:'satoyama',seed:(Math.random()*2147483647)|0};for(let n=1;n<=48;n++)if(trapRoll(t,n)){c++;break}}__out.push('INFO '+DATA.traps[type].name+' 48時間以内の捕獲率 '+(c/10).toFixed(0)+'%')}
 S.traps.push({id:'tx',type:'box',area:'satoyama',x:50,z:50,at:__NOW+5*H,n:0,seed:1,st:'set',chk:false,warned:false});ok('T11 時計が過去に戻っても壊れない',stepTraps(__NOW).length===0);
})();`;
load(process.argv.slice(2),body);console.log(out.join('\n'));console.log('---',out.filter(x=>/^(PASS|FAIL)/.test(x)).length,'項目 /',fails,'失敗 / 0 スキップ');process.exit(fails?1:0);
