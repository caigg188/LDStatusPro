import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'

// Run preview:plugin -- --prepare first. Capture only the isolated, script-free
// presentation documents; never start the userscript or contact its services.
const output = new URL('../public/product-preview/', import.meta.url)
const source = JSON.parse(readFileSync(new URL('source.json', output), 'utf8'))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
if (source.sha256 !== hash(readFileSync(new URL('../../LDStatusPro.user.js', import.meta.url))) ||
    source.fixtureSha256 !== hash(readFileSync(new URL('../brand/plugin-demo.json', import.meta.url))))
  throw new Error('Prepare previews from the current source and fixture before capture.')

const browser = await chromium.launch({ channel: 'chromium', headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 2880, height: 1800 }, deviceScaleFactor: 1 })
  const requests = []
  await context.route('**/*', (route) => {
    requests.push(route.request().url())
    return route.abort()
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const images = {}
  const files = {}
  for (const theme of ['light', 'dark']) for (const view of ['reqs', 'trends']) {
    const name = `plugin-${theme}-${view}`
    const html = readFileSync(new URL(`${name}.html`, output), 'utf8')
    await page.setContent('<html><body style="margin:0;background:transparent"><iframe style="border:0;width:1440px;height:900px;transform:scale(2);transform-origin:0 0"></iframe></body></html>')
    await page.locator('iframe').evaluate((frame, content) => { frame.srcdoc = content }, html)
    const panel = page.frameLocator('iframe').locator('#ldsp-panel')
    await panel.waitFor({ state: 'visible' })
    await panel.evaluate(async (element) => {
      await element.ownerDocument.fonts.ready
      await Promise.all([...element.querySelectorAll('img')].map((image) => image.decode()))
    })
    const bounds = await panel.boundingBox()
    if (!bounds || Math.abs(bounds.width - 760) > 1 || bounds.height > 1320)
      throw new Error(`Unexpected ${name} panel bounds: ${JSON.stringify(bounds)}`)
    const png = await panel.screenshot({ type: 'png', omitBackground: true, animations: 'disabled' })
    // Browser-native WebP encoding avoids a second image-tool dependency.
    const encoded = await page.evaluate(async (base64) => {
      const image = new Image()
      image.src = `data:image/png;base64,${base64}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      canvas.getContext('2d').drawImage(image, 0, 0)
      return { data: canvas.toDataURL('image/webp', 0.96), width: canvas.width, height: canvas.height }
    }, png.toString('base64'))
    if (!encoded.data.startsWith('data:image/webp;base64,')) throw new Error('WebP encoder unavailable')
    const bytes = Buffer.from(encoded.data.split(',')[1], 'base64')
    const size = { width: encoded.width, height: encoded.height }
    if (images[view] && JSON.stringify(images[view]) !== JSON.stringify(size))
      throw new Error(`Theme dimensions disagree for ${view}`)
    images[view] = size
    files[`${name}.webp`] = { sha256: hash(bytes), htmlSha256: hash(html), ...size }
    writeFileSync(new URL(`${name}.webp`, output), bytes)
    console.log(`${name}: ${encoded.width} × ${encoded.height}, ${bytes.length} bytes`)
  }
  if (requests.length || errors.length)
    throw new Error(`Capture failed: ${requests.length} network requests; page errors: ${errors.join('; ')}`)
  writeFileSync(new URL('capture.json', output), JSON.stringify({
    capturedOn: new Date().toISOString().slice(0, 10),
    sha256: source.sha256,
    fixtureSha256: source.fixtureSha256,
    presentationRevision: source.presentationRevision,
    method: 'Playwright Chromium rendering of original source UI with synthetic signed-in fixtures; 1440x900 desktop iframe at CSS scale 2, deviceScaleFactor 1; clipped to DOM panel bounds; external requests blocked',
    browser: `Chromium ${browser.version()}`,
    platform: process.platform,
    images,
    files,
    processing: 'Settled animation frame; browser-native WebP quality 0.96. No live plugin runtime on the website.'
  }, null, 2) + '\n')
} finally {
  await browser.close()
}
