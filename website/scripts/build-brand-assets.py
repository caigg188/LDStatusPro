"""Optional design asset regeneration; not part of application builds.

Usage: python build-brand-assets.py Manrope.ttf NotoSansSC.ttf
Requires fonttools[woff]. PNG/ICO exports are rendered from the resulting SVG.
The original fonts and their OFL files come from google/fonts, ofl/{manrope,notosanssc}.
"""
from pathlib import Path
import json
import sys
import html
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools import subset

ROOT = Path(__file__).resolve().parents[1]
identity = json.loads((ROOT / 'brand/identity.json').read_text())
colors = identity['colors']
out = ROOT / 'public/brand'
out.mkdir(parents=True, exist_ok=True)
fonts = {'display': TTFont(sys.argv[1]), 'body': TTFont(sys.argv[2])}

def mark(key, color=None):
    data = identity['marks'][key]
    color = color or colors[data['color']]
    content = ''
    if data.get('ring', True):
        content += f'<path d="{identity["ring"]}" fill="none" stroke="{color}" stroke-width="{identity["ringWidth"]}" stroke-linecap="round"/>'
    for stroke in data.get('strokes', []):
        content += f'<path d="{stroke["path"]}" fill="none" stroke="{color}" stroke-width="{stroke["width"]}" stroke-linecap="round"/>'
    for path in data['paths']:
        content += f'<path d="{path}" fill="{color}"/>'
    return content

def placed(key, x, y, size, color=None):
    return f'<g transform="translate({x} {y}) scale({size/64})">{mark(key, color)}</g>'

def text(x, y, size, value, color=None, font='body', weight=500):
    f = fonts[font]
    glyphs = f.getGlyphSet(location={'wght': weight})
    cmap = f.getBestCmap()
    scale = size / f['head'].unitsPerEm
    content = ''
    for char in value:
        glyph = glyphs[cmap[ord(char)]]
        pen = SVGPathPen(glyphs)
        glyph.draw(pen)
        content += f'<path d="{pen.getCommands()}" transform="translate({x} {y}) scale({scale} {-scale})"/>'
        x += glyph.width * scale
    return f'<g fill="{color or colors["ink"]}" aria-label="{html.escape(value, quote=True)}">{content}</g>'

def svg(width, height, content, title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img"><title>{html.escape(title)}</title>{content}</svg>'

for key, data in identity['marks'].items():
    for suffix, color in [('', None), ('-white', '#FFFFFF'), ('-mono', colors['ink'])]:
        (out / f'{key}-mark{suffix}.svg').write_text(svg(64, 64, mark(key, color), data['name']))

paper = f'<rect width="1200" height="630" fill="{colors["paper"]}"/>'
content = paper + text(68, 82, 20, 'LDSP', colors['suite'], 'display', 700)
content += text(66, 186, 48, '社区里的日常，有好工具相伴。', weight=650)
content += text(70, 240, 21, 'LDStatusPro 插件与 LD 士多，持续开发的开源社区工具。', colors['muted'])
content += placed('plugin', 72, 322, 104) + text(196, 363, 31, 'LDStatusPro', colors['plugin'], 'display', 700)
content += text(198, 409, 20, '阅读统计与社区成长', colors['muted'])
content += placed('store', 675, 322, 104) + text(800, 363, 31, 'LD 士多', colors['store'], weight=700)
content += text(802, 409, 20, '社区积分兑换平台', colors['muted'])
content += f'<path d="M70 505H1130" stroke="{colors["line"]}"/>'
content += text(70, 560, 18, '认真阅读。尽兴发现。', colors['muted'])
(out / 'og-default.svg').write_text(svg(1200, 630, content, 'LDSP · LDStatusPro 插件与 LD 士多'))

content = f'<rect width="1400" height="850" fill="{colors["paper"]}"/>'
content += text(64, 75, 27, 'LDSP / by Jacky', colors['suite'], 'display', 700)
content += text(64, 125, 23, '开放的圆环，各自清楚的内核。', colors['muted'])
for i, (key, data) in enumerate(identity['marks'].items()):
    x = 64 + i * 335
    content += placed(key, x + 60, 205, 160)
    content += text(x, 435, 28, data['name'], font='body' if key == 'store' else 'display', weight=700)
    content += text(x, 485, 17, data['description'], colors['muted'])
    content += text(x, 532, 16, colors[data['color']], colors[data['color']], 'display', 600)
    content += placed(key, x, 585, 32) + placed(key, x+70, 585, 48)
    content += f'<rect x="{x+151}" y="578" width="75" height="75" rx="8" fill="{colors["ink"]}"/>'
    content += placed(key, x+164, 591, 48, '#FFFFFF')
content += text(64, 761, 19, '插件：抽象沙漏 / 士多：双切面钻石 / 母版 64 × 64 / v0.2', colors['muted'])
(out / 'identity-sheet.svg').write_text(svg(1400, 850, content, 'LDSP 新标志 · 抽象沙漏与切面钻石'))

favicon = f'<rect width="64" height="64" rx="14" fill="{colors["paper"]}"/>' + placed('ldsp', 5, 5, 54)
(ROOT / 'public/favicon.svg').write_text(svg(64, 64, favicon, 'LDSP by Jacky'))
touch = f'<rect width="180" height="180" fill="{colors["paper"]}"/>' + placed('ldsp', 32, 32, 116)
(out / 'apple-touch-icon.svg').write_text(svg(180, 180, touch, 'LDSP'))

tokens = '.brand-site {\n' + ''.join(f'  --brand-{key}: {value};\n' for key, value in colors.items()) + '}\n'
(ROOT / 'src/brand-tokens.css').write_text(tokens)

# Self-hosted font subsets; no Google Fonts request is required by the homepage.
font_dir = out / 'fonts'
font_dir.mkdir(exist_ok=True)
corpus = ''.join(p.read_text() for p in (ROOT / 'src').rglob('*.tsx')) + ''.join(data['name'] + data['description'] for data in identity['marks'].values())
for font, filename, family, content in [
    (fonts['display'], 'manrope-latin.woff2', 'LDSP Site Display', ''.join(chr(i) for i in range(32,127))),
    (fonts['body'], 'noto-sans-sc-subset.woff2', 'LDSP Site Sans', corpus),
]:
    options = subset.Options()
    sub = subset.Subsetter(options=options)
    sub.populate(text=content)
    sub.subset(font)
    for record in font['name'].names:
        if record.nameID in [1, 2, 3, 4, 6, 16, 17]:
            value = family if record.nameID in [1,4,16] else ('Regular' if record.nameID in [2,17] else family.replace(' ', ''))
            record.string = value.encode(record.getEncoding(), errors='replace')
    font.flavor = 'woff2'
    font.save(font_dir / filename)
print('Generated brand SVGs, tokens and local font subsets')
