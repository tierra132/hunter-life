// 探索バランス測定：歩きながら見回すプレイヤーが「最初の手がかり/動物発見」まで何秒かかるか
const {load}=require('./harness.js');
const body=`
(function(){
 if(process.env.SIGHT)DATA.sight.base=+process.env.SIGHT;if(process.env.AMAX){DATA.areas.satoyama.max=+process.env.AMAX;DATA.areas.forest.max=+process.env.AMAX+1}const RUNS=+(process.env.RUNS||14),LIMIT=480,DT=.25,res={};
 const toasts=[];const _t=toast;toast=m=>{toasts.push(m)};
 for(const id of(process.env.AREAS||'satoyama,forest').split(',')){
  const clue=[],ani=[];
  for(let run=0;run<RUNS;run++){
   S=validate(defSave());S.rank=10;S.unlocked=['satoyama','forest','mountain','deep'];go(id);
   const p=player.position;p.x=0;p.z=0;toasts.length=0;pulses.length=0;
   let tc=null,ta=null,t=0,turn=0;yaw=Math.random()*6.28;moving=true;sneak=false;
   while(t<LIMIT&&(tc===null||ta===null)){
    t+=DT;turn+=DT;yaw+=Math.sin(t*.9)*.9*DT;   // 歩きながら左右を見回す
    const nx=p.x+Math.sin(yaw)*3.2*DT,nz=p.z+Math.cos(yaw)*3.2*DT;
    if(Math.abs(nx)<area.half-4&&Math.abs(nz)<area.half-4&&!blocked(nx,nz)){p.x=nx;p.z=nz}else yaw+=1.2;
    field(DT,p);
    if(tc===null&&(SG.some(s=>s.noticed)||pulses.length||toasts.some(m=>/物音|痕跡/.test(m))))tc=t;
    if(ta===null&&AN.some(a=>a.seen))ta=t;
   }
   clue.push(tc===null?LIMIT:tc);ani.push(ta===null?LIMIT:ta);
  }
  const q=(a,f)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(f*(s.length-1))]};
  res[id]={clue:{med:q(clue,.5),p25:q(clue,.25),p75:q(clue,.75)},animal:{med:q(ani,.5),p25:q(ani,.25),p75:q(ani,.75)},noClue:clue.filter(x=>x>=LIMIT).length,noAnimal:ani.filter(x=>x>=LIMIT).length};
 }
 console.log(JSON.stringify(res));
})();`;
load(process.argv.slice(2),body);process.exit(0);
