#!/bin/sh
# 使い方: sh tests/run_all.sh  （Node.js が必要）  ゲーム本体のスクリプトを順に結合して読み込みます
cd "$(dirname "$0")/.."
F="data.js game.js"
for t in regression traps smoke; do echo "== $t =="; node tests/$t.js $F 2>&1 | grep -v "^load fail\|^save fail\|^$"; done
