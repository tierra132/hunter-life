# 横画面スマホの代表サイズで、HUD/ボタンの重なりを座標から検査する（CSSの配置値を転記）
import itertools,sys
def els(W,H,small):
    R=lambda right,top=None,bottom=None,w=0,h=0:(W-right-w,(top if top is not None else H-bottom-h),W-right,(top if top is not None else H-bottom-h)+h)
    e={
     'info':(8,8,8+200,8+66),'mis':(8,78,8+(180 if small else 210),78+135),
     'mini':R(84,top=8,w=96,h=96),'menu':R(8,top=8,w=68,h=44),'gun':R(8,top=58,w=68,h=44),
     'act':R(28,bottom=36,w=120,h=64),
     'sneak':R(160,bottom=36,w=96,h=44) if small else R(28,bottom=116,w=96,h=44),
     'aim':R(264,bottom=36,w=96,h=44) if small else R(28,bottom=176,w=96,h=44),
     'trap':R(372,bottom=36,w=72,h=44) if small else R(160,bottom=40,w=72,h=44)}
    return e
def aimmode(W,H,small):
    e=els(W,H,small);keep={k:e[k] for k in['info','mis','mini','menu','gun','aim']}
    keep['fire']=(W-28-96,H-40-96,W-28,H-40);return keep
def ov(a,b):return min(a[2],b[2])-max(a[0],b[0])>2 and min(a[3],b[3])-max(a[1],b[1])>2
bad=0
for (W,H) in[(568,300),(640,320),(667,330),(740,340),(812,350),(844,360),(852,393),(932,430)]:
    small=H<340
    for name,E in(('通常',els(W,H,small)),('構え中',aimmode(W,H,small))):
        for (a,b) in itertools.combinations(E,2):
            if ov(E[a],E[b]):print(f'  重なり {W}x{H} {name}: {a} × {b}');bad+=1
        for k,v in E.items():
            if v[0]<0 or v[1]<0 or v[2]>W or v[3]>H:print(f'  はみ出し {W}x{H} {name}: {k} {v}');bad+=1
print('重なり/はみ出し:',bad,'件' + ('（レイアウト調整前の配置）' if len(sys.argv)>1 and sys.argv[1]=='before' else ''))
