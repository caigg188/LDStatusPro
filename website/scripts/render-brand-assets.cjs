// Optional raster export. Run with Sharp available in Node's module search path.
const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')

const root = path.resolve(__dirname, '..')

async function render() {
  const brand = path.join(root, 'public/brand')
  const identity = JSON.parse(await fs.readFile(path.join(root, 'brand/identity.json'), 'utf8'))
  const color = identity.colors[identity.marks.ldsp.color]
  // Full-size geometry and a slightly stronger ring stay legible at 16 px.
  // Transparency also preserves the open ring on both light and dark tab bars.
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img">
  <title>LDSP by Jacky</title>
  <style>:root{color:${color}}@media(prefers-color-scheme:dark){:root{color:${identity.favicon.darkColor}}}</style>
  <path d="${identity.ring}" fill="none" stroke="currentColor" stroke-width="${identity.favicon.ringWidth}" stroke-linecap="round"/>
  ${identity.marks.ldsp.paths.map((geometry) => `<path d="${geometry}" fill="currentColor"/>`).join('\n  ')}
</svg>\n`
  await fs.writeFile(path.join(root, 'public/favicon.svg'), favicon)

  if (!process.argv.includes('--favicon-only')) {
    for (const name of ['og-default', 'identity-sheet', 'apple-touch-icon']) {
      await sharp(path.join(brand, `${name}.svg`))
        .png()
        .toFile(path.join(brand, `${name}.png`))
    }
  }

  // ICO directory with PNG-encoded entries, preserving sharp edges at each size.
  const sizes = [16, 32, 48]
  const images = await Promise.all(
    sizes.map((size) => sharp(path.join(root, 'public/favicon.svg')).resize(size, size).png().toBuffer())
  )
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
  console.log('Rendered transparent favicon.svg and favicon.ico' + (process.argv.includes('--favicon-only') ? '' : ', plus brand PNGs'))
}

render().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
