// Optional asset export; ordinary application builds use the committed files.
// Run with Sharp available through NODE_PATH, without application environment files.
const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')

const root = path.resolve(__dirname, '..')
const website = path.resolve(root, '../website')
// Storefront gold preserves the brighter identity of the original shop logo.
// Geometry continues to come from the shared v0.2 diamond artwork.
const storeColors = { gold: '#E5A11B', tabDark: '#F3BE49', touchBackground: '#FFF8E5' }

async function build() {
  const identity = JSON.parse(await fs.readFile(path.join(website, 'brand/identity.json'), 'utf8'))
  const store = identity.marks.store
  const color = storeColors.gold
  const brand = path.join(root, 'public/brand')
  await fs.mkdir(brand, { recursive: true })

  const mark = (ink, ringWidth) => `<path d="${identity.ring}" fill="none" stroke="${ink}" stroke-width="${ringWidth}" stroke-linecap="round"/>${store.paths.map(geometry => `<path d="${geometry}" fill="${ink}"/>`).join('')}`
  for (const [name, ink] of [['store-mark.svg', color], ['store-mark-white.svg', '#FFFFFF']]) {
    const artwork = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img"><title>LD 士多</title>${mark(ink, identity.ringWidth)}</svg>`
    await fs.writeFile(path.join(brand, name), artwork)
  }

  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img">
  <title>LD 士多</title>
  <style>:root{color:${color}}@media(prefers-color-scheme:dark){:root{color:${storeColors.tabDark}}}</style>
  ${mark('currentColor', identity.favicon.ringWidth)}
</svg>\n`
  await fs.writeFile(path.join(root, 'public/favicon.svg'), favicon)

  const sizes = [16, 32, 48]
  const images = await Promise.all(sizes.map(size => sharp(Buffer.from(favicon)).resize(size, size).png().toBuffer()))
  const directory = Buffer.alloc(6 + sizes.length * 16)
  directory.writeUInt16LE(1, 2)
  directory.writeUInt16LE(sizes.length, 4)
  let offset = directory.length
  images.forEach((buffer, index) => {
    const entry = 6 + index * 16
    directory[entry] = sizes[index]
    directory[entry + 1] = sizes[index]
    directory.writeUInt16LE(1, entry + 4)
    directory.writeUInt16LE(32, entry + 6)
    directory.writeUInt32LE(buffer.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += buffer.length
  })
  await fs.writeFile(path.join(root, 'public/favicon.ico'), Buffer.concat([directory, ...images]))

  // Apple controls corner clipping and expects an opaque square PNG.
  const touch = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" fill="${storeColors.touchBackground}"/><g transform="translate(32 32) scale(1.8125)">${mark(color, identity.ringWidth)}</g></svg>`
  await sharp(Buffer.from(touch)).png().toFile(path.join(brand, 'apple-touch-icon.png'))
  console.log('Exported LD 士多 v' + identity.version + ' marks, transparent favicon and Apple touch icon')
}

build().catch(error => {
  console.error(error)
  process.exitCode = 1
})
