#!/bin/sh
# 使い方: sh tests/run_all.sh  （Node.js が必要）。1つでも失敗すると終了コード1になります。
cd "$(dirname "$0")/.." && node tests/run_all.js
