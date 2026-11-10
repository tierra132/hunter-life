// 全テストの一括実行。1つでも失敗・異常終了・要約行なし・READMEの件数不一致があれば、終了コード1で失敗する
const {spawnSync}=require('child_process');const fs=require('fs');
const G=['data.js','terrain.js','models.js','ui.js','game.js'];
const suites=[['regression',G],['traps',G],['smoke',G],['ui',G],['terrain',G],['models',[]],['assets',[]],['text',[]],['layout',[]]];
let bad=0,res={};
for(const[name,args]of suites){
  const file='tests/'+(name==='layout'?'layout_check':name)+'.js';
  const r=spawnSync('node',[file,...args],{encoding:'utf8',timeout:300000});
  const text=(r.stdout||'')+(r.stderr||''),m=/---\s*(\d+) 項目 \/ (\d+) 失敗(?: \/ (\d+) スキップ)?/.exec(text);
  console.log('== '+name+' ==');
  if(!m){console.log('FAIL 要約行が出力されていません(異常終了)。終了コード='+r.status);console.log(text.split('\n').slice(-6).join('\n'));bad++;continue}
  const n=+m[1],f=+m[2],sk=+(m[3]||0);res[name]={n,fail:f,skip:sk};
  for(const l of text.split('\n'))if(/^(FAIL|SKIP|INFO)/.test(l))console.log(l);
  console.log(`   ${n}項目 / 失敗${f} / スキップ${sk}`);
  if(f>0||r.status!==0)bad++;
}
fs.writeFileSync('tests/last_result.json',JSON.stringify(res,null,1));
// READMEの件数が実際の結果と一致していること
const rd=fs.readFileSync('README.md','utf8');
for(const[name,v]of Object.entries(res)){const m=new RegExp('<!--T:'+name+'=(\\d+)-->').exec(rd);if(!m){console.log('FAIL READMEに件数の目印がありません: '+name);bad++}else if(+m[1]!==v.n){console.log(`FAIL READMEの件数が実際と違います: ${name} README=${m[1]} 実際=${v.n}`);bad++}}
const tot=Object.values(res).reduce((a,v)=>a+v.n,0),sk=Object.values(res).reduce((a,v)=>a+v.skip,0);
console.log(`\n合計 ${tot}項目 / スキップ${sk} / ${bad?'失敗あり('+bad+')':'すべて合格'}`);
process.exit(bad?1:0);
