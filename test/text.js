// 画面に出る文言の検査：開発中の表記(Phase等)・旧方式(onclick)・旧要素の残存がないこと
const fs=require('fs');const out=[];let fails=0;const ok=(n,c,i)=>{out.push((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++};
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[\s;{}])\/\/[^\n]*/g,'$1');
const files=['game.js','ui.js','data.js','index.html'];const src={};for(const f of files)src[f]=strip(fs.readFileSync(f,'utf8'));
for(const f of files){const m=src[f].match(/[^\n]{0,30}Phase\s?\d[^\n]{0,30}/g);ok('X1 画面文言に「Phase」が残っていない: '+f,!m,m?m[0]:'')}
ok('X2 ボタン入力にonclickを使っていない(game.js/ui.js)',!/\.onclick\s*=/.test(src['game.js']+src['ui.js']));
ok('X3 廃止した要素(#toast/#hint/#rot)を参照していない',!/getElementById\('(toast|hint|rot)'\)|\$\('(toast|hint|rot)'\)/.test(src['game.js']+src['ui.js']));
ok('X4 index.htmlがstyle/data/ui/gameを読み込む',['style.css','data.js','ui.js','game.js'].every(x=>src['index.html'].includes(x)));
ok('X5 縦画面で操作不能にする旧表示(回転を促す全面表示)が残っていない',!/回転してください/.test(src['index.html']+fs.readFileSync('style.css','utf8')));
console.log(out.join('\n'));console.log('---',out.length,'項目 /',fails,'失敗 / 0 スキップ');process.exit(fails?1:0);
