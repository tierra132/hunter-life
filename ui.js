/* UI層：画面レイアウト(回転対応)・通知・画面枠・各画面の描画・HUD・射撃フィードバック
   ※ゲーム本体(game.js)より先に読み込まれます。ここでは定義のみを行い、実行時にgame.jsの変数を参照します。 */
'use strict';
let GW=innerWidth,GH=innerHeight,ROT=0,kick=0,AC=null;
const UI={tab:{}},FX={shots:0,hits:0,last:0};
const UD=(k,d)=>{const v=S.settings&&S.settings[k];return v===undefined?d:v};

/* ===== 画面レイアウト：縦持ち・回転ロック時もゲーム画面は常に横向きで表示する ===== */
function layout(){const W=innerWidth,H=innerHeight,por=H>W;ROT=por?((S&&S.settings&&S.settings.rot===-1)?-1:1):0;
 const h=document.documentElement,st=$('stage');h.classList.toggle('rot',!!ROT);h.classList.toggle('cw',ROT===1);h.classList.toggle('ccw',ROT===-1);
 GW=ROT?H:W;GH=ROT?W:H;st.style.width=GW+'px';st.style.height=GH+'px';
 st.style.transform=ROT===1?`translate(${W}px,0) rotate(90deg)`:ROT===-1?`translate(0,${H}px) rotate(-90deg)`:'none'}
/* 画面上のタッチ座標 → ゲーム画面内の座標（回転を打ち消す） */
const gp=e=>ROT===1?{x:e.clientY,y:innerWidth-e.clientX}:ROT===-1?{x:innerHeight-e.clientY,y:e.clientX}:{x:e.clientX,y:e.clientY};
function flipRot(){S.settings.rot=(S.settings.rot===-1)?1:-1;layout();resize();save()}
async function tryLandscape(){/* 可能な端末(主にAndroid)では全画面＋横固定を試みる。不可なら回転表示で対応 */
 try{if(typeof matchMedia!=='undefined'&&matchMedia('(pointer:coarse)').matches){const d=document.documentElement;if(d.requestFullscreen&&!document.fullscreenElement)await d.requestFullscreen({navigationUI:'hide'})}}catch(e){}
 try{await screen.orientation.lock('landscape')}catch(e){}}

/* ===== 入力：押した瞬間に反応(pointerdown)。歩きながら(別の指でスティック操作中)でも押せる ===== */
function tap(el,fn){const on=()=>el.classList.add('prs'),off=()=>el.classList.remove('prs');
 el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();on();fn(e)});
 for(const t of['pointerup','pointercancel','pointerleave'])el.addEventListener(t,off)}
let started=false;
async function startGame(){if(started)return;started=true;tryLandscape();audioInit();$('start').style.display='none';
 try{await ModelKit.preloadAll((d,n)=>{$('bootMsg').textContent='3Dモデルを準備中 '+d+'/'+n})}catch(e){}
 const st=ModelKit.status();if(st.errors.length)setTimeout(()=>toast('一部の3Dモデルを読み込めませんでした（簡易表示で動作します）','warn'),1500);
 buildPlayerModel();$('boot').style.display='none';go('base');requestAnimationFrame(loop);if(!S.settings.help)helpPanel()}

/* ===== 通知：画面中央を避け、上端のHUDの間に小さく表示。重要度別・連続時は集約 ===== */
const NDUR={info:2200,good:2800,warn:3200,imp:4200,res:4500},NOTES=[];let nTm=null;
const nGuess=m=>/失敗|足りません|できません|上限|不可|近すぎ|弾切れ|読み込め/.test(m)?'warn':/達成|ランクアップ|レベルアップ|解放|初捕獲|仲間|報酬/.test(m)?'good':'info';
function notify(msg,lv,html){const now=Date.now();lv=lv||'info';if(lv==='res'){for(let i=NOTES.length-1;i>=0;i--)if(NOTES[i].lv==='res')NOTES.splice(i,1)}
 const last=NOTES[NOTES.length-1];
 if(last&&lv!=='res'&&last.lv===lv&&last.msg===msg&&now-last.t<1500){last.n++;last.t=now;last.until=now+NDUR[lv]}
 else NOTES.push({msg,lv,html,t:now,n:1,until:now+NDUR[lv]});
 while(NOTES.length>3)NOTES.shift();renderNotes();clearTimeout(nTm);nTm=setTimeout(expireNotes,250)}
function expireNotes(){const now=Date.now();for(let i=NOTES.length-1;i>=0;i--)if(NOTES[i].until<=now)NOTES.splice(i,1);renderNotes();if(NOTES.length)nTm=setTimeout(expireNotes,250)}
function renderNotes(){$('notes').innerHTML=NOTES.map(n=>`<div class="note ${n.lv}">${n.html||n.msg}${n.n>1?' ×'+n.n:''}</div>`).join('')}
function toast(m,lv){notify(m,lv||nGuess(m))}
function resCard(t,h){notify(null,'res',`<b>${t}</b><br>${h}`)}

/* ===== 射撃フィードバック：発砲の閃光・反動・音・振動・クールダウン・命中表示 ===== */
function audioInit(){try{if(!AC){const C=window.AudioContext||window.webkitAudioContext;if(C)AC=new C()}if(AC&&AC.state==='suspended')AC.resume()}catch(e){}}
function shotSound(g){if(!UD('sound',1)||!AC)return;try{const t=AC.currentTime,loud=g.noise>50,len=loud?.45:.18,n=AC.createBuffer(1,Math.floor(AC.sampleRate*len),AC.sampleRate),d=n.getChannelData(0);
 for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,loud?2.2:3);
 const s=AC.createBufferSource();s.buffer=n;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=loud?2400:5000;const v=AC.createGain();v.gain.value=loud?.9:.35;s.connect(f);f.connect(v);v.connect(AC.destination);s.start(t);
 if(loud){const o=AC.createOscillator(),og=AC.createGain();o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(40,t+.2);og.gain.setValueAtTime(.8,t);og.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(og);og.connect(AC.destination);o.start(t);o.stop(t+.3)}}catch(e){}}
function flashOn(){const f=$('flash');f.classList.remove('on');void f.offsetWidth;f.classList.add('on')}
function shotFx(g){FX.shots++;FX.last=Date.now();kick=Math.min(.14,.05+g.power*.03+(g.pellets?.02:0));flashOn();shotSound(g);
 if(UD('vib',1)&&typeof navigator!=='undefined'&&navigator.vibrate)try{navigator.vibrate(g.noise>50?40:18)}catch(e){}
 const gb=$('gun');gb.classList.remove('pulse');void gb.offsetWidth;gb.classList.add('pulse')}
function hitMark(k){FX.hits++;const h=$('hitm');h.className='';void h.offsetWidth;
 h.innerHTML=k==='kill'?'<div class="x kill">✕</div><div class="kill">仕留めた</div>':k==='hit'?'<div class="x">✕</div><div>命中</div>':'<div class="mut">外れ</div>';h.className='on '+k}
function uiTick(dt){if(!aiming)return;const g=G(),p=cd>0?(1-cd/g.reload)*360:360;$('fire').style.setProperty('--p',p+'deg')}

/* ===== 構え／慎重移動の状態 ===== */
function setAim(v){aiming=v;aimT=0;kick=0;document.documentElement.classList.toggle('aiming',v);
 $('ret').style.display=v?'block':'none';$('fire').style.display=v?'flex':'none';$('aim').classList.toggle('on',v);$('aimL').textContent=v?'解除':'構える';
 const f=aid!=='base';$('sneak').style.display=(!v&&f)?'flex':'none';$('trapB').style.display=(!v&&f)?'flex':'none';if(v){near=null;$('act').style.display='none'}}
function setSneak(v){sneak=v;$('sneak').classList.toggle('on',v);$('sneakL').textContent=v?'慎重':'通常'}

/* ===== HUD ===== */
function updInfo(){const f=aid!=='base',g=f&&DATA.guns[S.gun],d=party()[0];
 $('info').innerHTML=`<b>${area.name}</b>${f&&env?' <span class="mut">'+envText()+'</span>':''}<br><small>Rank ${S.rank}　💰${S.money}${f&&d?'　🐕'+Math.round(d.fatigue)+'%':''}</small>`;
 const gb=$('gun');gb.style.display=f?'block':'none';if(g)gb.innerHTML=`🔫 ${g.name}　弾 <b>${S.ammo[S.gun]||0}</b>`;
 $('fa').textContent=g?'弾 '+(S.ammo[S.gun]||0):'';updMis()}
let misShow=0,misTm=null;
function updMis(){const A=S.missions.active,rd=A.filter(a=>a.ready).length,b=$('misBtn');b.style.display=A.length?'flex':'none';$('misN').textContent=rd?'✅'+rd:(A.length||'');
 const e=$('mis');if(!A.length||!misShow){e.style.display='none';return}e.style.display='block';
 e.innerHTML=A.slice().sort((x,y)=>y.ready-x.ready).slice(0,4).map(a=>{const m=MD(a.id);return`${a.ready?'✅':'📋'} <b>${m.title}</b><br><small>${m.goals.map((g,i)=>goalTxt(g)+' '+Math.min(a.prog[i],g.n)+'/'+g.n).join(' ／ ')}</small>`}).join('<hr style="border:0;border-top:1px solid var(--ln);margin:4px 0">')+(A.length>4?'<br><small>…他'+(A.length-4)+'件</small>':'')}
function toggleMis(){misShow=misShow?0:1;clearTimeout(misTm);if(misShow)misTm=setTimeout(()=>{misShow=0;updMis()},8000);updMis()}

/* ===== 画面(パネル)の枠 ===== */
function openPanel(t,h){paused=true;st.id=lk.id=null;st.x=st.y=0;$('stick').style.display='none';const p=$('panel');
 p.innerHTML=`<div class="ph"><div class="pt">${t}</div><button class="px" data-a="close" aria-label="閉じる">✕</button></div><div class="pb">${h}</div>`;p.style.display='flex'}
function closePanel(){$('panel').style.display='none';paused=false}
const tabs=(key,list,def)=>{const c=UI.tab[key]&&list.some(x=>x[0]===UI.tab[key])?UI.tab[key]:def;
 return{cur:c,html:`<div class="tabs">${list.map(([id,l,b])=>`<button class="tab ${c===id?'on':''}" data-a="tab" data-id="${key}:${id}">${l}${b?`<span class="badge">${b}</span>`:''}</button>`).join('')}</div>`}};
function uiAct(a,d){
 if(a==='tab'){const[k,v]=d.id.split(':');UI.tab[k]=v;if(cur)cur();return true}
 if(a==='flip'){flipRot();if(cur)cur();return true}
 if(a==='credits'){creditsPanel();return true}
 if(a==='opt'){const[k,v]=d.id.split(':');S.settings[k]=isNaN(+v)?v:+v;save();if(k==='sound'&&+v)audioInit();if(cur)cur();return true}
 return false}

/* ===== メニュー（拠点：施設へのショートカット／フィールド：帰還ほか） ===== */
const tile=(ic,name,sub,a,id,badge,cls)=>`<button class="tile ${cls||''}" data-a="${a}"${id?` data-id="${id}"`:''}><span class="ic">${ic}</span><b>${name}</b><small>${sub}</small>${badge?`<span class="badge">${badge}</span>`:''}</button>`;
function menuPanel(){cur=menuPanel;const rd=S.missions.active.filter(a=>a.ready).length,cg=S.traps.filter(t=>t.st==='caught').length;let h='<div class="grid">';
 if(aid==='base')h+=tile('🚪','出発準備','銃・装備・犬・エリア','fac','gate',0,'pri')+tile('📋','ミッション','依頼を受ける・報酬','fac','mission',rd)+tile('🛒','ショップ','銃・弾薬・装備・罠','fac','shop')+tile('🎒','所持品・売却','獲物を売る・資源化','fac','storage',S.bag.length)+tile('🐕','犬舎','成長・餌・疲労','fac','kennel')+tile('📖','図鑑・記録','動物と捕獲の記録','fac','dex');
 else h+=tile('🏠','拠点へ戻る','探索を終える','go','base',0,'pri');
 h+=tile('🪤','罠の状況','設置・回収',  'traps',null,cg)+tile('❓','操作説明','遊び方','help')+tile('⚙️','設定','感度・音・向き','settings')+tile('💾','セーブ','今すぐ保存','save');
 openPanel('メニュー',h+'</div>')}
function pending(f){const P={mission:boardPanel,shop:shopPanel,storage:storagePanel,kennel:kennelPanel,dex:dexPanel}[f.id];if(P)return P();openPanel(f.name,'<div class="card dim">この施設は準備中です。</div>')}

/* ===== 出発準備 ===== */
function prepHtml(){let h=`<div class="card"><b>🔫 銃</b><div class="row">${S.own.map(id=>`<button class="${S.gun===id?'pri':''}" data-a="selgun" data-id="${id}">${DATA.guns[id].name}<br><small>弾 ${S.ammo[id]||0}</small></button>`).join('')}</div>${(S.ammo[S.gun]||0)<=0?'<div class="warn">⚠ 選択中の銃の弾がありません（ショップで購入できます）</div>':''}</div>`;
 h+=`<div class="card"><b>🎒 補助装備</b><div class="row">${S.gearOwn.length?S.gearOwn.map(id=>`<button class="${S.gearOn.includes(id)?'pri':''}" data-a="gear" data-id="${id}">${DATA.gear[id].name}</button>`).join(''):'<span class="mut">なし（ショップで購入）</span>'}</div></div>`;
 h+=`<div class="card"><b>🐕 同行犬（最大${partyMax()}頭）</b><div class="row">${dogBtns()}</div></div>`;
 h+=`<div class="card"><b>🪤 罠</b>　<span class="mut">${Object.entries(DATA.traps).map(([k,T])=>T.name+' '+(S.trapInv[k]||0)).join('・')}（設置 ${S.traps.length}/${trapLimit()}）</span></div>`;return h}
function gatePanel(){cur=gatePanel;let R='';
 for(const[id,A]of Object.entries(DATA.areas)){if(id==='base')continue;const ok=S.unlocked.includes(id)&&A.ready;
  R+=`<div class="card ${ok?'':'dim'}"><b>${A.name}</b><br><span class="mut">${A.desc}${A.feat?'　特徴：'+A.feat:''}</span>${ok&&A.spawn?'<br>獣の気配：'+abund(id):''}<div class="row">${ok?`<button class="pri" data-a="go" data-id="${id}">出発</button>`:`<span class="mut">未解放（Rank ${A.unlockRank}${A.needMission?'・「'+DATA.missions[A.needMission].title+'」達成':''}）</span>`}</div></div>`}
 openPanel('出発準備',`<div class="cols"><div><h3>準備</h3>${prepHtml()}${evHtml()}</div><div><h3>エリアを選ぶ</h3>${R}</div></div>`)}

/* ===== ミッション掲示板（タブ式） ===== */
const SLOTS=[['main','メイン',1],['sub','サブ',2],['special','特別',1],['daily','デイリー',3],['weekly','ウィークリー',2]];
const mGoals=(a,m)=>m.goals.map((g,i)=>{const p=a?Math.min(a.prog[i],g.n):0;return`<div>${goalTxt(g)} ${a?p+'/'+g.n:'×'+g.n}</div>${a?`<div class="bar"><i style="width:${p/g.n*100}%"></i></div>`:''}`}).join('');
const mRw=m=>`<small class="mut">報酬 💰${m.fixed.money}　EXP ${m.fixed.exp}　＋追加報酬(確率)</small>`;
function boardPanel(){cur=boardPanel;rollMissions();const M=Object.assign({},DATA.missions,S.gen),A=S.missions.active.filter(a=>M[a.id]),rd=A.filter(a=>a.ready).length;
 const T=tabs('board',[['act','受注中',rd?'✓'+rd:(A.length||0)],...SLOTS.map(([s,l])=>[s,l,A.filter(a=>M[a.id].slot===s&&a.ready).length])],A.length?'act':'main');
 const act=a=>{const m=M[a.id];return`<div class="card"><b>${a.ready?'✅ ':''}${m.title}</b> <span class="mut">[${(SLOTS.find(x=>x[0]===m.slot)||[0,''])[1]}]</span><br><span class="mut">${m.reason||''}</span>${mGoals(a,m)}${mRw(m)}<div class="row">${a.ready?`<button class="pri" data-a="claim" data-id="${a.id}">報酬を受け取る</button>`:`<button data-a="drop" data-id="${a.id}">破棄</button>`}</div></div>`};
 let h=T.html;
 if(T.cur==='act')h+=A.length?A.map(act).join(''):'<div class="card dim">受注中のミッションはありません。各タブから受注できます。</div>';
 else{const max=SLOTS.find(x=>x[0]===T.cur)[2],mine=A.filter(a=>M[a.id].slot===T.cur);h+=`<div class="mut">受注枠 ${mine.length}/${max}</div>`+mine.map(act).join('');
  for(const[id,m]of Object.entries(M)){if(m.slot!==T.cur||m.rank>S.rank||S.missions.done[id]||A.some(a=>a.id===id))continue;
   h+=`<div class="card"><b>${m.title}</b> <span class="mut">Rank ${m.rank}〜</span><br><span class="mut">${m.reason||''}</span>${m.prior?'<br><small>※受注前に捕獲した所持中の獲物も対象</small>':''}${mGoals(null,m)}${mRw(m)}<div class="row">${mine.length>=max?'<span class="mut">枠がいっぱいです</span>':`<button class="pri" data-a="accept" data-id="${id}">受注</button>`}</div></div>`}}
 openPanel('ミッション掲示板',h)}

/* ===== ショップ（カテゴリ別タブ） ===== */
function shopPanel(){cur=shopPanel;const T=tabs('shop',[['gun','銃'],['ammo','弾薬'],['gear','装備'],['trap','罠']],'gun');
 const item=(name,desc,price,own,a,id,ex)=>`<div class="card"><b>${name}</b>${ex?'　<span class="mut">'+ex+'</span>':''}<br><span class="mut">${desc}</span><div class="row">${own?'<span class="mut">所持済み</span>':`<button class="pri ${S.money<price?'dis':''}" data-a="${a}" data-id="${id}">💰${price}　購入</button>`}</div></div>`;
 let h=`<div class="mut">所持金 <b>💰${S.money}</b></div>`+T.html+'<div class="g2">';
 if(T.cur==='gun')for(const id of Object.keys(DATA.guns)){const g=DATA.guns[id];h+=item(g.name,`威力 ${g.power}${g.pellets?'×'+g.pellets:''}　適正距離 ${g.range[0]}〜${g.range[1]}m`,DATA.price[id],S.own.includes(id),'buyGun',id)}
 if(T.cur==='ammo')for(const id of S.own){const k=DATA.ammoPack[id];h+=item(DATA.guns[id].name+'の弾',k.n+'発入り',k.price,false,'buyAmmo',id,'所持 '+(S.ammo[id]||0))}
 if(T.cur==='gear')for(const[id,g]of Object.entries(DATA.gear))h+=item(g.name,g.desc,g.price,S.gearOwn.includes(id),'buyGear',id);
 if(T.cur==='trap')for(const[id,t]of Object.entries(DATA.traps))h+=item(t.name,t.desc,t.price,false,'buyTrap',id,'所持 '+(S.trapInv[id]||0));
 openPanel('ショップ',h+'</div>')}

/* ===== 所持品・売却所 ===== */
function storagePanel(){cur=storagePanel;let h='';const bag=S.bag.map(id=>S.records.find(r=>r.id===id)).filter(Boolean);
 if(!bag.length)h+='<div class="card dim">売却できる獲物はありません。</div>';
 else{let tot=0;h+='@@';for(const r of bag){const p=priceOf(r),q=resOf(r);tot+=p;h+=`<div class="card"><b>${DATA.animals[r.k].name}</b> ${r.size}kg${r.rare?' ★珍しい個体':''}　💰${p}<br><span class="mut">資源化：肉${q.meat}・皮${q.hide}</span><div class="row"><button data-a="sell" data-id="${r.id}">売却</button><button data-a="proc" data-id="${r.id}">資源化</button></div></div>`}
  h=h.replace('@@',`<div class="row"><button class="pri" data-a="sellAll">すべて売却（💰${tot}）</button><button data-a="procAll">すべて資源化</button></div>`)}
 h+=`<h3>資源</h3><div class="card">肉 ${S.res.meat}　皮 ${S.res.hide}<div class="row"><button data-a="sellHide">皮をすべて売る（💰${S.res.hide*DATA.res.hidePrice}）</button></div>${DATA.exchange.map((x,i)=>`<div class="row"><button data-a="exch" data-id="${i}">${x.name}</button></div>`).join('')}</div>`;
 openPanel(`所持品・売却所　💰${S.money}`,h)}

/* ===== 犬舎 ===== */
function kennelPanel(){cur=kennelPanel;let h=`<div class="card dim">肉 ${S.res.meat}　餌は任意です（与えなくてもペナルティはありません）。拠点で休むと疲労は自動回復します。</div>`;
 for(const d of S.dogs){const a=d.ab,ab=(l,v)=>`<div class="row" style="margin:2px 0"><span style="width:44px">${l}</span><div class="bar" style="flex:1"><i style="width:${Math.min(100,v/1.5*100)}%"></i></div><span>${v.toFixed(2)}</span></div>`;
  h+=`<div class="card"><b>🐕 ${d.name}</b>　Lv${d.lv}${S.party.includes(d.id)?'　<span class="mut">（同行予定）</span>':''}<br><span class="mut">${d.lv>=DATA.dog.maxLv?'最大レベル':'EXP '+d.exp+'/'+dogNeed(d.lv)}</span>${d.lv>=DATA.dog.maxLv?'':`<div class="bar g"><i style="width:${d.exp/dogNeed(d.lv)*100}%"></i></div>`}${ab('発見',a.find)}${ab('追跡',a.track)}${ab('協力',a.coop)}<span class="mut">疲労 ${Math.round(d.fatigue)}%</span><div class="bar f"><i style="width:${d.fatigue}%"></i></div><div class="row"><button data-a="feed" data-id="${d.id}">肉を与える（肉1）</button></div></div>`}
 openPanel('犬舎',h+`<div class="card dim">同行犬の選択は「出発準備」で行います（最大${partyMax()}頭）。</div>`)}

/* ===== 図鑑・記録 ===== */
function dexPanel(){cur=dexPanel;const T=tabs('dex',[['sp','種別図鑑'],['rec','個体記録']],'sp');let h=T.html;
 if(T.cur==='sp'){h+='<div class="g2">';for(const[k,D]of Object.entries(DATA.animals)){const e=S.dex[k];if(!e||!e.seen){h+='<div class="card dim"><span class="sil">？</span>　？？？（未発見）</div>';continue}
  const ar=Object.values(DATA.areas).filter(A=>A.spawn&&A.spawn[k]).map(A=>A.name).join('・')||'—';
  h+=`<div class="card"><b>${D.name}</b>　<span class="mut">${D.habit}</span><br>発見 ${e.seen}　捕獲 ${e.caught}　最大 ${e.max?e.max+'kg':'—'}<br>珍しい個体の発見 ${e.rare||0}<br><span class="mut">出現：${ar}${e.fs?'<br>初発見 '+fmt(e.fs):''}${e.fc?'　初捕獲 '+fmt(e.fc):''}</span></div>`}h+='</div>'}
 else{const L=S.records.slice(-60).reverse();if(!L.length)h+='<div class="card dim">まだ記録がありません。</div>';
  for(const r of L)h+=`<div class="card"><b>${DATA.animals[r.k].name}</b> ${r.size}kg${r.rare?' ★':''}<br><span class="mut">${fmt(r.t)}　${(DATA.areas[r.area]||{}).name||'?'}　${r.method==='gun'?'銃猟':'罠猟'}${r.fate==='sold'?'（売却済）':r.fate==='processed'?'（資源化済）':'（所持中）'}</span></div>`}
 openPanel('図鑑・記録',h)}

/* ===== 罠の状況 ===== */
function trapPanel(){cur=trapPanel;const stp=stepTraps(Date.now());if(stp.length){save();report(stp);syncTM()}
 let h=`<div class="card">設置中 <b>${S.traps.length}/${trapLimit()}</b>　<span class="mut">所持：${Object.entries(DATA.traps).map(([k,T])=>T.name+' '+(S.trapInv[k]||0)).join('・')}</span></div>`;
 h+=aid!=='base'?'<div class="row">'+Object.entries(DATA.traps).map(([k,T])=>`<button class="pri" data-a="place" data-id="${k}">${T.name}を設置</button>`).join('')+'</div>':'<div class="card dim">罠の設置はフィールドで行います。</div>';
 if(!S.traps.length)h+='<div class="card dim">設置中の罠はありません。</div>';
 for(const t of S.traps){const T=DATA.traps[t.type],rem=t.at+DATA.trap.life-Date.now(),st=t.st==='set'?'稼働中':(t.type==='snare'?'🔴 獲物あり（ミニマップに表示）':'🔴 動物がかかったようだ（現地で確認・回収）');
  h+=`<div class="card"><b>${T.name}</b>　${DATA.areas[t.area].name}<br><span class="mut">設置 ${fmt(t.at)}${t.st==='set'?'　残り '+fmtRemain(rem):''}</span>${t.st==='set'?`<div class="bar"><i style="width:${Math.max(0,Math.min(100,rem/DATA.trap.life*100))}%"></i></div>`:''}<br>${st}</div>`}
 const perm=typeof Notification==='undefined'?'未対応':({granted:'許可済み',denied:'拒否',default:'未設定'})[Notification.permission];
 openPanel('罠の状況',h+`<div class="card dim">罠は設置から最大約48時間、現実時間で進行します。期限切れになっても罰金はありません。<br>通知：${perm}　<button data-a="notif">通知を許可</button><br>※アプリを完全に閉じている間は通知できません。開いたときに結果を表示します。</div>`)}

/* ===== 操作説明・設定 ===== */
function helpPanel(){cur=helpPanel;S.settings.help=1;save();
 const c=(t,b)=>`<div class="card"><b>${t}</b><br>${b}</div>`;
 openPanel('操作説明',c('🕹 移動・視点','画面の左側をドラッグで移動、右側をドラッグで視点を動かします。縦持ちでも自動で横表示になります。')+c('🔎 探索','歩いて動物や痕跡を探します。痕跡や物音は動物のヒントです。近づくと「痕跡を調べる」が出ます。🚶ボタンで慎重移動にすると気づかれにくくなります。')+c('🎯 狩猟','🎯で構えると照準が出ます。<b>歩きながらでも構えを切り替えられます。</b>「撃つ」を押したときだけ発砲し、閃光・音・振動と、命中／外れの表示が出ます。動いているときや構えた直後は弾がばらつきます。')+c('🪤 罠','🪤で設置します。現実の時間で最大48時間かけて進み、アプリを閉じていても進みます。')+c('🏠 拠点・保存','☰メニューから施設を開けます。獲物は「所持品・売却」で売却・資源化できます。進行は自動保存されます。'))}
function modelStatusTxt(){const st=ModelKit.status();return st.glb.length?`外部モデル：${st.glb.join('・')}　／　簡易表示：${st.fallback.join('・')||'なし'}`:'外部モデルは未導入です（すべて簡易表示）。素材を assets/models/ に置くと自動で使われます。'}
function creditsPanel(){cur=creditsPanel;const c=ModelKit.credits();openPanel('クレジット',c.length?c.map(x=>`<div class="card"><b>${x.title||x.kind}</b>（${x.kind}）<br><span class="mut">作者：${x.author||'—'}　ライセンス：${x.license||'—'}</span><br><small class="mut">${x.url||''}</small></div>`).join(''):'<div class="card dim">表示する外部素材はありません。</div>')}
function settingsPanel(){cur=settingsPanel;const ch=(k,v,l)=>`<button class="${UD(k,k==='sens'?1:1)===v?'pri':''}" data-a="opt" data-id="${k}:${v}">${l}</button>`;
 openPanel('設定',`<div class="card"><b>視点の感度</b><div class="row">${ch('sens',.7,'低')}${ch('sens',1,'標準')}${ch('sens',1.4,'高')}</div></div>
 <div class="card"><b>効果音</b>（発砲音）<div class="row">${ch('sound',1,'ON')}${ch('sound',0,'OFF')}</div></div>
 <div class="card"><b>振動</b>（発砲時・対応端末のみ）<div class="row">${ch('vib',1,'ON')}${ch('vib',0,'OFF')}</div></div>
 <div class="card"><b>画面の向き</b><br><span class="mut">${ROT?'縦向きのため、ゲーム画面を回転して横表示しています。向きが逆なら反転してください。':'横向きで表示中です。'}</span>${ROT?`<div class="row"><button data-a="flip">↻ 表示の向きを反転（現在：${ROT===1?'時計回り':'反時計回り'}）</button></div>`:''}</div>
 <div class="card"><b>3Dモデル</b><br><span class="mut">${modelStatusTxt()}</span><div class="row"><button data-a="credits">クレジット（素材の権利表記）</button></div></div>
 <div class="card"><b>データ</b><br><span class="mut">最終保存：${S.savedAt?fmt(S.savedAt):'未保存'}　（自動保存：画面移動・重要な操作・アプリを離れるとき）</span><div class="row"><button data-a="save">今すぐ保存</button><button data-a="reset">データを初期化</button></div></div>`)}
