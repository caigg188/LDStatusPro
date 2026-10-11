// Optional documentation preview. Local static files only; no app .env or network.
const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')

const root = path.resolve(__dirname, '../..')
const design = path.join(root, 'design')
const dataUri = (bytes, type) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')

async function render() {
  const standard = JSON.parse(await fs.readFile(path.join(design, 'standard.json'), 'utf8'))
  const store = standard.storefrontIdentity
  const gold = dataUri(await fs.readFile(path.join(design, 'assets/store/brand/store-mark.svg')), 'image/svg+xml')
  const white = dataUri(await fs.readFile(path.join(design, 'assets/store/brand/store-mark-white.svg')), 'image/svg+xml')
  const touch = dataUri(await fs.readFile(path.join(design, 'assets/store/brand/apple-touch-icon.png')), 'image/png')
  const tabSource = await fs.readFile(path.join(design, 'assets/store/icons/favicon.svg'), 'utf8')
  const fixedTab = (color) => dataUri(tabSource.replace(/<style>[\s\S]*?<\/style>/, '').replaceAll('currentColor', color), 'image/svg+xml')
  const ico = await fs.readFile(path.join(design, 'assets/store/icons/favicon.ico'))
  const count = ico.readUInt16LE(4)
  const sizes = []
  for (let index = 0; index < count; index++) {
    const entry = 6 + index * 16
    const size = ico[entry] || 256
    const length = ico.readUInt32LE(entry + 8)
    const offset = ico.readUInt32LE(entry + 12)
    sizes.push({ size, uri: dataUri(ico.subarray(offset, offset + length), 'image/png') })
  }

  const text = (x, y, value, options = '') => `<text x="${x}" y="${y}" ${options}>${esc(value)}</text>`
  const image = (uri, x, y, size) => `<image href="${uri}" x="${x}" y="${y}" width="${size}" height="${size}"/>`
  const swatches = [
    ['页面主体', store.primary], ['深底反白', store.onDark],
    ['深色标签栏', store.faviconDark], ['Apple 收藏底色', store.touchBackground]
  ].map(([label, color], index) => {
    const x = 64 + index * 292
    return `<rect x="${x}" y="622" width="40" height="40" rx="8" fill="${color}" stroke="#D4DFD9"/>${text(x + 56, 638, label, 'font-size="14" fill="#536766"')}${text(x + 56, 662, color, 'font-size="19" font-weight="600"')}`
  }).join('')
  const icoProof = sizes.map(({ size, uri }, index) => {
    const x = 850 + index * 105
    return image(uri, x, 765 - size / 2, size) + text(x + size / 2, 813, `${size}px`, 'text-anchor="middle" font-size="14" fill="#536766"')
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="910" viewBox="0 0 1280 910" role="img">
  <title>LD 士多当前品牌规范：明亮金钻石</title>
  <desc>主体 ${store.primary}，页面深底反白，深色标签栏 ${store.faviconDark}，Apple 收藏底色 ${store.touchBackground}。展示实际 SVG 与 ICO 文件，不使用旧商店图形。</desc>
  <rect width="1280" height="910" fill="#F6F8F5"/>
  <g font-family="PingFang SC, Noto Sans SC, Arial, sans-serif" fill="#233C3D">
    ${text(64, 61, `LDSP / DESIGN ${standard.version}`, 'font-size="14" letter-spacing="2" fill="#536766"')}
    ${text(64, 123, 'LD 士多', 'font-size="46" font-weight="650"')}
    ${text(64, 163, '明亮金 · 开环 + 双切面钻石', 'font-size="21"')}
    ${text(1216, 60, standard.updatedOn, 'font-size="14" text-anchor="end" fill="#536766"')}
    ${text(1216, 122, `确认基线 ${standard.approvedStorefrontCommit.slice(0, 7)}`, 'font-size="15" text-anchor="end" fill="#536766"')}
    <rect x="64" y="207" width="560" height="210" rx="18" fill="#FFFFFF" stroke="#D4DFD9"/>
    <rect x="648" y="207" width="568" height="210" rx="18" fill="#233C3D"/>
    ${image(gold, 108, 252, 120)}
    ${text(268, 291, '页面浅底', 'font-size="23" font-weight="600"')}
    ${text(268, 329, `${store.primary} 明亮金`, 'font-size="19" fill="#536766"')}
    ${image(white, 692, 252, 120)}
    ${text(852, 291, '页面深底 / 固定深底', 'font-size="23" font-weight="600" fill="#FFFFFF"')}
    ${text(852, 329, '白色版 · StoreLogo inverted', 'font-size="17" fill="#C8D9D3"')}
    <rect x="64" y="443" width="368" height="139" rx="14" fill="#FFFFFF" stroke="#D4DFD9"/>
    <rect x="456" y="443" width="368" height="139" rx="14" fill="#233C3D"/>
    <rect x="848" y="443" width="368" height="139" rx="14" fill="#FFFFFF" stroke="#D4DFD9"/>
    ${image(fixedTab(store.primary), 91, 480, 64)}
    ${text(177, 505, '浅色标签栏', 'font-size="20" font-weight="600"')}
    ${text(177, 537, 'SVG 透明底 · 明亮金', 'font-size="16" fill="#536766"')}
    ${image(fixedTab(store.faviconDark), 483, 480, 64)}
    ${text(569, 505, '深色标签栏', 'font-size="20" font-weight="600" fill="#FFFFFF"')}
    ${text(569, 537, 'SVG 透明底 · 浅金', 'font-size="16" fill="#C8D9D3"')}
    ${image(touch, 875, 480, 64)}
    ${text(961, 505, 'Apple Touch', 'font-size="20" font-weight="600"')}
    ${text(961, 537, '180 × 180 · 不透明底', 'font-size="16" fill="#536766"')}
    ${swatches}
    <path d="M64 697H1216" stroke="#D4DFD9"/>
    ${text(64, 737, '共用几何 v0.2 · 页面线宽 5.5 / favicon 线宽 6', 'font-size="17"')}
    ${text(64, 772, '保持 1:1 · 页面最小 24px · 留白至少 1/8 宽度', 'font-size="17" fill="#536766"')}
    ${text(64, 810, `图标缓存版本 ${store.cacheVersion}`, 'font-size="14" fill="#536766"')}
    ${text(846, 727, '实际 ICO · 原尺寸透明图像', 'font-size="14" fill="#536766"')}
    ${icoProof}
    ${text(64, 864, '标识配色与官网按钮 / 文字、商城业务状态色分别维护。完整规范见 design/STORE_BRAND.md', 'font-size="15" fill="#536766"')}
  </g>
</svg>\n`
  await fs.mkdir(path.join(design, 'examples'), { recursive: true })
  await fs.writeFile(path.join(design, 'examples/store-brand-2026-10-11.svg'), svg)
  await sharp(Buffer.from(svg)).resize(2560, 1820).png().toFile(path.join(design, 'examples/store-brand-2026-10-11.png'))
  console.log(`Rendered LD 士多 standard v${standard.version} preview at 2560 × 1820`)
}

render().catch(error => {
  console.error(error)
  process.exitCode = 1
})
