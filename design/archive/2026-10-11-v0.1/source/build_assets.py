"""Regenerate the proposed LDSP brand assets. No network or application calls.

Requires fonttools[woff], the two original Google Fonts TTFs, and Node sharp
for rasterization via render_assets.cjs. Use CLI args for paths to the TTFs.
"""
from pathlib import Path
import sys, json, html, math
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools import subset

ROOT = Path(__file__).resolve().parents[1]
MANROPE = Path(sys.argv[1])
NOTO = Path(sys.argv[2])
ASSETS = ROOT / 'assets'
PREVIEWS = ROOT / 'previews'
for directory in [ASSETS, PREVIEWS, ROOT/'fonts']:
    directory.mkdir(parents=True, exist_ok=True)

INK, MUTED, PAPER, GREEN, BLUE, COPPER = '#203A43', '#51666C', '#F5F8F7', '#1F6658', '#3263C9', '#9A4F27'
BRANDS = {
    'ldsp': {'name':'LDSP', 'color':GREEN, 'description':'开源社区工具 · by Jacky', 'soft':'#E9F1EE'},
    'plugin': {'name':'LDStatusPro', 'color':BLUE, 'description':'社区阅读与成长助手', 'soft':'#EAF0FD'},
    'store': {'name':'LD 士多', 'color':COPPER, 'description':'社区好物，认真交付。', 'soft':'#F6EADF'},
    'jacky': {'name':'Jacky', 'color':INK, 'description':'AI 全栈开发者 · 独立开发者', 'soft':'#E8EFF1'},
}
fonts = {'display':TTFont(MANROPE), 'body':TTFont(NOTO)}
cache = {}

def glyph_data(font_name, weight):
    key=(font_name, weight)
    if key not in cache:
        f=fonts[font_name]
        cache[key]=(f.getGlyphSet(location={'wght':weight}), f.getBestCmap(), f['head'].unitsPerEm)
    return cache[key]

def text(x,y,size,content,color=INK,font='body',weight=500,tracking=0):
    gs,cmap,upem=glyph_data(font,weight)
    scale=size/upem
    out=[];offset=0
    for char in content:
        gname=cmap.get(ord(char))
        if not gname:
            raise ValueError(f'Missing glyph {char!r} in {font}')
        glyph=gs[gname];pen=SVGPathPen(gs);glyph.draw(pen)
        d=pen.getCommands()
        if d: out.append(f'<path d="{d}" transform="translate({x+offset:.3f} {y}) scale({scale:.6f} {-scale:.6f})"/>')
        offset+=glyph.width*scale+tracking
    return '<g fill="'+color+'" aria-label="'+html.escape(content,quote=True)+'">'+''.join(out)+'</g>'

def rect(x,y,w,h,color,r=0,stroke=None):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{color}"'+(f' stroke="{stroke}"' if stroke else '')+'/>'

def line(x1,y1,x2,y2,color='#CBDAD5',width=1):
    return f'<path d="M{x1} {y1}H{x2}" stroke="{color}" stroke-width="{width}"/>' if y1==y2 else f'<path d="M{x1} {y1}L{x2} {y2}" stroke="{color}" stroke-width="{width}"/>'

def mark(key,color=None,mini=False):
    c=color or BRANDS[key]['color']
    if key=='jacky':
        return (f'<path d="M37 12V37C37 49 17 51 15 38" fill="none" stroke="{c}" stroke-width="9" stroke-linecap="round"/>'
                +rect(44,10,10,10,c,2))
    ring=f'<path d="M32 8A24 24 0 1 1 15.03 48.97" fill="none" stroke="{c}" stroke-width="7" stroke-linecap="round"/>'
    if key=='ldsp':
        core=f'<rect x="25" y="25" width="14" height="14" rx="2.5" fill="{c}" transform="rotate(45 32 32)"/>'
    elif key=='plugin':
        core=rect(21,33,5,10,c,1)+rect(29.5,27,5,16,c,1)+rect(38,21,5,22,c,1)
        if mini: core=rect(21,32,6,11,c,1)+rect(30,23,6,20,c,1)+rect(39,17,6,26,c,1)
    else:
        core=(f'<path d="M19 26L24 20H40L45 26V30H19Z" fill="{c}"/>'
              f'<path d="M22 31V44H42V31" fill="none" stroke="{c}" stroke-width="3" stroke-linejoin="round"/>'
              +rect(29,35,6,9,c,1))
        if mini: core=f'<path d="M18 27L24 20H40L46 27V31H18Z M22 33V45H29V36H36V45H42V33Z" fill="{c}"/>'
    return ring+core

def place_mark(key,x,y,size,color=None,mini=False):
    return f'<g transform="translate({x} {y}) scale({size/64})">'+mark(key,color,mini)+'</g>'

def svg(w,h,content,title,desc='LDSP brand proposal v0.1 by Jacky. Static vector artwork.'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img"><title>{html.escape(title)}</title><desc>{html.escape(desc)}</desc>{content}</svg>'

def save(path,w,h,content,title):
    path.write_text(svg(w,h,content,title),encoding='utf8')

for key,b in BRANDS.items():
    for suffix,c in [('',b['color']),('-mono',INK),('-white','#FFFFFF')]:
        save(ASSETS/f'{key}-mark{suffix}.svg',64,64,mark(key,c),b['name']+' 标志'+suffix)
    save(ASSETS/f'{key}-mark-small.svg',64,64,mark(key,mini=True),b['name']+' 小尺寸标志')
    for suffix,c,tc in [('',b['color'],INK),('-white','#FFFFFF','#FFFFFF')]:
        body=place_mark(key,8,10,88,c)+text(118,72,52,b['name'],tc,font='body' if key=='store' else 'display',weight=700,tracking=-0.4)
        body+=text(120,111,16,b['description'],tc if suffix else MUTED,weight=500)
        save(ASSETS/f'{key}-lockup{suffix}.svg',530,140,body,b['name']+' 组合字标')
    avatar=rect(0,0,1024,1024,b['soft'],224)+place_mark(key,224,224,576)
    save(ASSETS/f'{key}-avatar.svg',1024,1024,avatar,b['name']+' 头像')
    if key!='jacky':
        save(ASSETS/f'{key}-favicon.svg',64,64,rect(0,0,64,64,b['soft'],14)+place_mark(key,5,5,54,mini=True),b['name']+' favicon')
        for size in [180,192,512]:
            # Apple/PWA icons use an opaque square canvas; the host controls cropping.
            save(ASSETS/f'{key}-app-{size}.svg',size,size,rect(0,0,size,size,b['soft'])+place_mark(key,size*.19,size*.19,size*.62),b['name']+' app icon')

# Brand board: one large inherited symbol, quiet typography, then distinct products.
b=rect(0,0,1600,1000,PAPER)
b+=text(72,64,16,'JACKY / LDSP',GREEN,'display',700,2)+text(1284,64,14,'PROPOSAL  /  2026.10',MUTED,'display',600)
b+=line(72,89,1528,89)
b+=place_mark('ldsp',102,152,310)
b+=text(500,248,88,'LDSP',INK,'display',700,-3)
b+=text(506,298,26,'by Jacky',GREEN,'display',600)
b+=text(503,380,34,'把社区里的好用工具，持续做好。',INK,weight=600)
b+=text(505,429,21,'开源社区工具 / 两个独立产品 / 同一位持续维护的作者',MUTED,weight=400)
b+=line(72,505,1528,505)
for x,key,label,desc in [(72,'plugin','LDStatusPro','看见你的社区成长。'),(588,'store','LD 士多','社区好物，认真交付。'),(1104,'jacky','Jacky','AI 全栈开发者 · 独立开发者')]:
    c=BRANDS[key]['color']
    b+=rect(x,548,424,326,'#FFFFFF',16,'#CBDAD5')
    b+=place_mark(key,x+28,576,98)
    b+=text(x+30,736,32,label,INK,'body' if key=='store' else 'display',700)
    b+=text(x+30,784,19,desc,MUTED,weight=500)
    b+=rect(x+30,820,66,6,c,3)
    b+=text(x+112,831,14,c,c,'display',600)
b+=text(72,945,18,'现有产品名继续积累认知，Jacky 的个人身份承接未来作品。',MUTED,weight=400)
b+=text(1311,945,14,'OPEN LOOP / v0.1',MUTED,'display',500)
save(PREVIEWS/'brand-board.svg',1600,1000,b,'Jacky 与 LDSP 品牌家族设计')

# Native-size proof. Raster at 1x so 16 px proof is genuinely sixteen pixels.
b=rect(0,0,1400,780,PAPER)+text(48,62,32,'标志校样',INK,weight=700)+text(48,103,17,'颜色之外，以中心图形区分产品。16px 使用简化版。',MUTED,weight=400)
for x,size in [(408,16),(500,24),(596,32),(704,48),(824,64),(968,96)]:b+=text(x,162,14,str(size)+'px',MUTED,'display',600)
for idx,key in enumerate(BRANDS):
    y=194+idx*130;b+=line(48,y-14,1352,y-14)
    b+=text(48,y+52,24,BRANDS[key]['name'],INK,'body' if key=='store' else 'display',700)
    for x,size in [(408,16),(500,24),(596,32),(704,48),(824,64),(968,96)]:b+=place_mark(key,x,y+22,size,mini=size==16)
    b+=place_mark(key,1130,y+12,64,INK)+rect(1230,y+6,88,88,INK,8)+place_mark(key,1242,y+18,64,'#FFFFFF')
b+=text(48,757,14,'SVG 母版 / 深浅主题 / 单色 / 小尺寸 / 头像裁切',MUTED,weight=400)
save(PREVIEWS/'size-proof.svg',1400,780,b,'Logo 小尺寸和黑白适配校样')

def social(key,heading,subtitle,footer):
    b=rect(0,0,1200,630,PAPER)+rect(0,0,16,630,BRANDS[key]['color'])
    b+=place_mark(key,850,137,238)
    b+=text(70,87,18,'JACKY / LDSP',BRANDS[key]['color'],'display',700,1)
    b+=text(70,251,60,heading,INK,'body' if any(ord(c)>127 for c in heading) else 'display',700,-.7)
    b+=text(73,322,28,subtitle,MUTED,weight=500)
    b+=line(72,475,1128,475)
    b+=text(72,534,21,footer,INK,weight=500)
    b+=text(72,576,15,'OPEN-SOURCE / BUILT & MAINTAINED BY JACKY',MUTED,'display',500,1)
    return b

for key,h,sub,footer in [('ldsp','LDSP by Jacky','把社区里的好用工具，持续做好。','LDStatusPro 插件  ·  LD 士多'),('plugin','LDStatusPro','看见你的社区成长。','Linux.do / IDCFlare · 开源用户脚本'),('store','LD 士多','社区好物，认真交付。','Linux.do 社区积分兑换平台'),('jacky','Jacky','用 AI 做产品，也把产品运营好。','AI 全栈开发者 · 独立开发者')]:
    save(ASSETS/f'social-{key}.svg',1200,630,social(key,h,sub,footer),h+' 分享封面')

b=rect(0,0,1280,640,INK)+place_mark('jacky',75,115,198,'#FFFFFF')
b+=text(338,194,76,'Jacky', '#FFFFFF','display',700,-2)
b+=text(342,258,27,'AI 全栈开发者 · 独立开发者','#DBEAE5',weight=500)
b+=text(80,414,38,'用 AI 做产品，也把产品运营好。','#FFFFFF',weight=600)
b+=text(83,478,23,'LDStatusPro 插件  /  LD 士多  /  开源开发记录','#DBEAE5',weight=400)
b+=line(82,550,1198,550,'#6E9294')+text(83,598,17,'github.com/caigg188','#DBEAE5','display',500)
save(ASSETS/'github-jacky.svg',1280,640,b,'Jacky GitHub 个人主页封面')

for key,tag,heading,sub in [('plugin','产品更新','这次更新，解决一个问题。','替换为真实版本与用户受益；以下为模板样例。'),('store','店主故事','好物之外，看见认真。','替换为获得授权的店主故事与公开物品。'),('jacky','开发记录','从实现，到持续在线。','替换为问题、取舍、验证结果与原文链接。')]:
    c=BRANDS[key]['color'];b=rect(0,0,1080,1080,PAPER)+place_mark(key,72,72,108)
    b+=text(72,258,24,tag,c,weight=600)
    # Every template line is short enough to survive social crop.
    title_lines={'plugin':['这次更新，','解决一个问题。'],'store':['好物之外，','看见认真。'],'jacky':['从实现，','到持续在线。']}[key]
    for n,s in enumerate(title_lines):b+=text(72,454+n*100,65,s,INK,weight=700)
    b+=text(75,701,22,sub,MUTED,weight=400)
    b+=line(72,855,1008,855)+text(74,922,25,BRANDS[key]['name'],c,'body' if key=='store' else 'display',700)
    b+=text(75,974,18,'by Jacky · 内容模板 / 发布前替换样例',MUTED,weight=400)
    save(ASSETS/f'template-{key}.svg',1080,1080,b,tag+' 封面模板')

# Editable web tokens; product accent does not override semantic business states.
tokens={'version':'0.1','status':'proposal','date':'2026-10-11','color':{'ink':INK,'muted':MUTED,'paper':PAPER,'surface':'#FFFFFF','line':'#CBDAD5','suite':GREEN,'plugin':BLUE,'store':COPPER,'suiteSoft':'#E9F1EE','pluginSoft':'#EAF0FD','storeSoft':'#F6EADF'},'typography':{'display':'Manrope (Google Fonts OFL release)','body':'Noto Sans SC','utility':'system monospace','bodySize':'16px','bodyLineHeight':1.65},'logo':{'grid':64,'stroke':7,'clearSpace':'1/8 icon width','minimumSize':16,'smallVariant':'dedicated mark-small','backgroundVariants':['transparent color','ink monochrome','white reverse']},'spacing':[4,8,12,16,24,32,48,64],'radii':{'small':6,'panel':12,'app':16},'guidance':'Product accent is not a payment/order state color. Retain independent semantic tokens.'}
(ROOT/'tokens.json').write_text(json.dumps(tokens,ensure_ascii=False,indent=2),encoding='utf8')
css=':root {\n'+''.join(f'  --brand-{k}: {v};\n' for k,v in tokens['color'].items())+'  --brand-font-display: Manrope, sans-serif;\n  --brand-font-body: "Noto Sans SC", "PingFang SC", sans-serif;\n}\n'
(ROOT/'tokens.css').write_text(css,encoding='utf8')

# A quiet, responsive, fully local preview with actual download links.
cards=''
for key,b in BRANDS.items():
    cards+=f'<article class="identity"><img class="lockup" src="assets/{key}-lockup.svg" alt="{b["name"]} 字标"><p>{b["description"]}</p><div class="variants"><span><img src="assets/{key}-mark.svg" alt="{b["name"]} 色版"></span><span><img src="assets/{key}-mark-mono.svg" alt="{b["name"]} 单色版"></span><span class="dark"><img src="assets/{key}-mark-white.svg" alt="{b["name"]} 反白版"></span></div><div class="downloads"><a href="assets/{key}-lockup.svg" download>字标 SVG</a><a href="assets/{key}-mark.svg" download>图标 SVG</a><a href="assets/{key}-avatar.png" download>头像 PNG</a><a href="assets/social-{key}.png" download>分享封面 PNG</a></div></article>'
preview=f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jacky 与 LDSP 品牌视觉预览</title><style>
@font-face{{font-family:ProofSans;src:url('fonts/report-sans.woff2');font-display:swap}}@font-face{{font-family:ProofDisplay;src:url('fonts/report-display.woff2');font-display:swap}}
*{{box-sizing:border-box}}body{{margin:0;background:{PAPER};color:{INK};font:16px/1.65 ProofSans,sans-serif}}a{{color:{BLUE};text-underline-offset:4px}}a:focus-visible{{outline:3px solid {BLUE};outline-offset:5px}}header,main{{max-width:1250px;margin:auto;padding:34px 24px}}header{{display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;border-bottom:1px solid #CBDAD5}}header strong{{font:700 22px ProofDisplay,sans-serif}}h1{{font-size:clamp(30px,4vw,48px);line-height:1.4}}h2{{font-size:26px;margin-top:50px}}.meta{{color:{MUTED};font-size:14px}}img{{max-width:100%;height:auto}}.board{{width:100%;border-radius:16px}}.grid{{display:grid;grid-template-columns:1fr 1fr;gap:24px}}.identity{{padding:28px;background:white;border:1px solid #CBDAD5;border-radius:14px}}.lockup{{width:100%;max-width:470px}}.identity p{{color:{MUTED}}}.variants{{display:flex;gap:14px;margin:20px 0}}.variants span{{display:grid;place-items:center;width:86px;height:86px;border:1px solid #CBDAD5;border-radius:10px}}.variants img{{width:48px;height:48px}}.dark{{background:{INK}}}.downloads{{display:flex;flex-wrap:wrap;gap:12px 20px;font-size:14px}}.downloads a{{display:inline-flex;align-items:center;min-height:44px}}.social{{display:grid;grid-template-columns:1fr 1fr;gap:20px}}.social figure{{margin:0}}.social img{{border:1px solid #CBDAD5;border-radius:10px}}figcaption{{font-size:14px;color:{MUTED};margin:10px 0 20px}}footer{{border-top:1px solid #CBDAD5;margin-top:48px;padding:24px 0;font-size:14px;color:{MUTED}}}@media(max-width:680px){{.grid,.social{{grid-template-columns:1fr}}.identity{{padding:20px}}}}@media print{{header a,.downloads{{display:none}}.identity{{break-inside:avoid}}}}
</style></head><body><header><strong>Jacky / LDSP</strong><a href="strategy.html">阅读完整品牌运营方案</a></header><main><p class="meta">视觉方向：开环 / 2026.10.11 / 设计提案 v0.1</p><h1>同一个作品系列，<br>各自清楚的产品。</h1><p>保留现有认知，让图形、色彩与作者署名形成可持续使用的家族。</p><img class="board" src="previews/brand-board.png" alt="Jacky 与 LDSP 品牌总览" width="1600" height="1000"><h2>四套标志</h2><div class="grid">{cards}</div><h2>网站与社交分享封面</h2><div class="social">'''+''.join(f'<figure><a href="assets/social-{key}.png" download><img src="assets/social-{key}.png" alt="{BRANDS[key]["name"]} 分享封面" width="1200" height="630"></a><figcaption>{BRANDS[key]["name"]} · 1200 × 630 PNG</figcaption></figure>' for key in BRANDS)+'''</div><h2>小尺寸与单色校样</h2><img src="previews/size-proof.png" alt="四标志的 16 至 96 像素和单色校样" width="1400" height="780"><p class="meta">请在原始尺寸查看 16px 区域。小尺寸文件与主图形保持相同内核，简化细节。品牌稿尚未做真人辨识测试。</p><h2>可复用内容模板</h2><div class="social">'''+''.join(f'<figure><a href="assets/template-{key}.svg" download><img src="assets/template-{key}.png" alt="{label} 内容封面模板" width="1080" height="1080"></a><figcaption>{label} · 1080 × 1080 · 发布前替换样例文案</figcaption></figure>' for key,label in [('plugin','产品更新'),('store','店主故事'),('jacky','开发记录')])+'''</div><footer>可编辑 SVG 字标已转路径。<a href="usage.txt">资源与许可说明</a> · <a href="tokens.json">设计 Tokens</a> · <a href="strategy.html">完整运营方案</a></footer></main></body></html>'''
(ROOT/'brand-preview.html').write_text(preview,encoding='utf8')

# Self-contained local font subsets. Rename every relevant font name to avoid
# distributing modified fonts under possible Reserved Font Names.
corpus=''.join(p.read_text(encoding='utf8') for p in [ROOT/'strategy.html',ROOT/'brand-preview.html'])
corpus+=''.join(v['name']+v['description'] for v in BRANDS.values())
for origin,out_name,family in [(NOTO,'report-sans.woff2','LDSP Proof Sans'),(MANROPE,'report-display.woff2','LDSP Proof Display')]:
    f=TTFont(origin);options=subset.Options();options.flavor='woff2'
    sub=subset.Subsetter(options=options);sub.populate(text=corpus);sub.subset(f)
    for record in f['name'].names:
        if record.nameID in [1,2,3,4,6,16,17]:
            replacement=family if record.nameID in [1,4,16] else ('Regular' if record.nameID in [2,17] else family.replace(' ',''))
            record.string=replacement.encode(record.getEncoding(),errors='replace')
    f.flavor='woff2';f.save(ROOT/'fonts'/out_name)

usage='''Jacky 与 LDSP 品牌资源包 · 方案 v0.1 · 2026-10-11

先打开 brand-preview.html 看视觉，再打开 strategy.html 阅读完整方案。
预览不调用生产 API，不加载外部字体或统计脚本。可以离线打开。

assets/
  ldsp / plugin / store / jacky-mark.svg：透明色版，64×64 母版。
  *-mark-mono.svg / *-mark-white.svg：深色单色版 / 反白版。
  *-mark-small.svg：16px 的专用简化版。
  *-lockup.svg / *-lockup-white.svg：字标组合，文字已转路径。
  *-avatar.png：1024×1024，保留圆形裁切安全区域。
  ldsp / plugin / store-favicon.svg / .ico：favicon。
  *-app-180.png / *-app-192.png / *-app-512.png：不透明 app 图标。
  social-*.png：1200×630 网站分享封面。
  github-jacky.png：1280×640 个人 README 封面。
  template-*.svg / .png：1080×1080 内容模板。样例文案发布前须替换。
  *-mark.png / *-lockup.png：色版 PNG，透明背景。
previews/：品牌总览与小尺寸校样的 SVG / PNG。
tokens.json / tokens.css：设计 Token；产品色与业务语义色分别处理。
source/：生成图形与文字路径的源文件。

集成示例：
  <link rel="icon" type="image/svg+xml" href="/brand/plugin-favicon.svg">
  <link rel="icon" sizes="any" href="/brand/plugin-favicon.ico">
  <link rel="apple-touch-icon" sizes="180x180" href="/brand/plugin-app-180.png">
  <meta property="og:image" content="https://你的实际域名/brand/social-plugin.png">
按网站用途换成 ldsp 或 store；实际路径需要在部署时配置。

视觉：开环从原项目标志演进；字标和内核为本方案制作。
当前为供 Jacky 评审的设计提案，尚未做真人辨识或商标审查。
代码的 MIT 许可不会自动决定本资源包未来的品牌使用规范。
建议确认后另行发布品牌使用指南，明确 fork、转载与官方站点的区分。

字体：Google Fonts 仓库中的 Manrope 与 Noto Sans SC OFL 版本。
字标已转路径；fonts/ 中预览字体是重命名子集 LDSP Proof Display 与
LDSP Proof Sans。OFL 许可和原版权声明随文件附带。
没有打包或分发操作系统字体。

重新生成（独立文档工具环境，不需要加载项目或生产环境变量）：
  python build_assets.py /path/to/Manrope.ttf /path/to/NotoSansSC.ttf
  node render_assets.cjs
Python 需要 fonttools[woff]，Node 需要 sharp。
原字体文件来自：
https://github.com/google/fonts/tree/main/ofl/manrope
https://github.com/google/fonts/tree/main/ofl/notosanssc

本次仅新增提案与静态文件，没有修改应用源代码或线上资源。
'''
(ROOT/'usage.txt').write_text(usage,encoding='utf8')
print(json.dumps({'svg_assets':len(list(ASSETS.glob('*.svg'))),'proofs':len(list(PREVIEWS.glob('*.svg'))),'font_bytes':sum(p.stat().st_size for p in (ROOT/'fonts').glob('*.woff2'))},ensure_ascii=False))
