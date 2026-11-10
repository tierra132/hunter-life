// 単一HTMLの確認用ファイルを作る: node tools/bundle.js 出力先.html
// (style.css / data.js / ui.js / game.js を index.html に埋め込みます。manifest/iconの参照は外します)
const fs=require('fs');let h=fs.readFileSync('index.html','utf8');
h=h.replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>\n?/g,'<script>/* ビルド版では外部モデルの読み込み拡張を使いません */</script>\n');
h=h.replace(/<link rel="manifest"[^>]*>\s*<link rel="icon"[^>]*>\s*/,'');
h=h.replace('<link rel="stylesheet" href="style.css">','<style>'+fs.readFileSync('style.css','utf8')+'</style>');
for(const f of['data.js','terrain.js','models.js','ui.js','game.js'])h=h.replace(`<script src="${f}"></script>`,'<script>'+fs.readFileSync(f,'utf8')+'</script>');
fs.writeFileSync(process.argv[2]||'bundle.html',h);console.log('出力',process.argv[2],h.length,'bytes');
