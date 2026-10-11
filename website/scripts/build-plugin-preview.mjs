import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import { parse } from 'acorn'
import { JSDOM } from 'jsdom'

// Only evaluate presentation declarations. Never boot Panel, OAuth, storage,
// trackers or network adapters from the userscript.
const source = readFileSync(new URL('../../LDStatusPro.user.js', import.meta.url), 'utf8')
const fixture = readFileSync(new URL('../brand/plugin-demo.json', import.meta.url), 'utf8')
const demo = JSON.parse(fixture)
const sha256 = createHash('sha256').update(source).digest('hex')
const fixtureSha256 = createHash('sha256').update(fixture).digest('hex')
const presentationRevision = 'compact-380x660-incomplete-no-level-badge-settled-v1'
const output = new URL('../public/product-preview/', import.meta.url)
if (!process.argv.includes('--prepare')) {
  const capture = JSON.parse(readFileSync(new URL('capture.json', output), 'utf8'))
  if (capture.sha256 !== sha256 || capture.fixtureSha256 !== fixtureSha256 || capture.presentationRevision !== presentationRevision)
    throw new Error('Plugin screenshots are stale. Run preview:plugin -- --prepare, recapture the four browser views, and refresh capture.json before building.')
  for (const theme of ['light', 'dark']) for (const view of ['reqs', 'trends'])
    if (!existsSync(new URL(`plugin-${theme}-${view}.webp`, output)))
      throw new Error(`Missing plugin screenshot: ${theme}-${view}`)
}
const siteIconSource = 'https://img.ldstore.cc.cd/JackyLiii/20260424_logo-new-5_0vbj4s.png'
const siteIcon = `data:image/png;base64,${readFileSync(new URL('../brand/plugin-site-icon.png', import.meta.url)).toString('base64')}`
const ast = parse(source, { ecmaVersion: 'latest' })
const declarations = new Map()
const classes = new Map()
function walk(node, visit) {
  visit(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => child?.type && walk(child, visit))
    else if (value?.type) walk(value, visit)
  }
}
walk(ast, (node) => {
  if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') declarations.set(node.id.name, node)
  if (node.type === 'ClassDeclaration') classes.set(node.id.name, node)
})
const code = (node) => source.slice(node.start, node.end)
const method = (name) => classes.get('Panel').body.body.find((node) => node.key.name === name)
const createPanel = method('_createPanel')
let template, aliases, fontLevels
walk(method('_initState'), (node) => {
  if (node.type === 'AssignmentExpression' && code(node.left) === 'this._fontSizeLevels') fontLevels = node.right
})
walk(createPanel, (node) => {
  if (node.type !== 'AssignmentExpression') return
  if (code(node.left) === 'this.el.innerHTML') template = node.right
  if (code(node.left) === 'this.$') aliases = node.right
})
if (!template || !aliases || !fontLevels)
  throw new Error('Userscript panel template changed: review the preview extractor.')
const version = source.match(/@version\s+(\S+)/)[1]
mkdirSync(output, { recursive: true })

for (const theme of ['light', 'dark'])
  for (const view of ['reqs', 'trends']) {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
    const context = vm.createContext({
      document: dom.window.document,
      window: { innerWidth: 1440, innerHeight: 900, location: { hostname: 'linux.do' } },
      GM_info: { script: { version } },
      GM_getValue: (_key, fallback) => fallback,
      demo,
      Date: class extends Date {
        constructor(...args) {
          super(...(args.length ? args : [demo.recordedAt]))
        }
        static now() {
          return new Date(demo.recordedAt).getTime()
        }
        getHours() {
          return (this.getUTCHours() + 8) % 24
        }
        getMinutes() {
          return this.getUTCMinutes()
        }
      }
      // No fetch, GM_xmlhttpRequest, credentials, timers or event-loop tasks.
    })
    const names = [
      'COLLAPSED_LOGO_DATA_URI',
      'SITE_CONFIGS',
      'CURRENT_SITE',
      'CONFIG',
      'SafeDom',
      'Utils',
      'Screen',
      'Styles',
      'UI'
    ]
    vm.runInContext(names.map((name) => `const ${code(declarations.get(name))};`).join('\n'), context, {
      timeout: 1000
    })
    vm.runInContext(code(classes.get('Renderer')), context, { timeout: 1000 })
    const el = dom.window.document.createElement('div')
    el.id = 'ldsp-panel'
    el.className = theme === 'light' ? 'light' : ''
    context.panel = {
      el,
      hasLeaderboard: true,
      storage: {
        getGlobal: (key, fallback) => {
          if (key === 'customSize') return { width: 380, height: 660 }
          if (key === 'requirementsDisplayMode') return 'incomplete'
          return fallback
        }
      }
    }
    vm.runInContext(
      `panel.el.innerHTML = (function(){ return ${code(template)} }).call(panel); panel.$ = (function(){ return ${code(aliases)} }).call(panel)`,
      context,
      { timeout: 1000 }
    )
    dom.window.document.body.append(el)
    const icon = el.querySelector('.ldsp-site-icon')
    if (icon.getAttribute('src') !== siteIconSource)
      throw new Error('Plugin site icon changed: refresh the original cached icon.')
    icon.src = siteIcon
    const sizeMethods = [
      '_getPanelSizeBounds',
      '_getPanelSizeConfig',
      '_applyPanelSize',
      '_getDefaultFontSizeLevel',
      '_normalizeFontSizeLevel',
      '_getFontSizeLevelMeta',
      '_getFontSizeScale'
    ]
    vm.runInContext(
      `Object.assign(panel, {${sizeMethods.map((name) => code(method(name))).join(',')}}); panel._fontSizeLevels = ${code(fontLevels)}; panel.fontSizeLevel = panel._getDefaultFontSizeLevel(); panel._applyPanelSize('preview');`,
      context,
      { timeout: 1000 }
    )
    vm.runInContext(
      `panel.renderer = new Renderer(panel);
    panel.renderer.renderUser(demo.username, demo.trustLevel, false, demo.requirements, demo.displayName);
    panel.renderer.renderAvatar(Utils.buildLetterAvatar(demo.username, 128));
    panel.renderer.renderReading(demo.readingMinutes, true);
    panel.renderer.renderReqs(demo.requirements, demo.trustLevel);
    panel.renderer.renderTrends('today');
    panel.$.trends.querySelector('.ldsp-trend-content').innerHTML = panel.renderer.renderTodayTrend(demo.requirements, demo.readingMinutes, {startTs: demo.startedAt, baselineData: demo.baselineData});`,
      context,
      { timeout: 1000 }
    )
    // User-authorized demo account and data, rendered through original product UI.
    // No authentication, production data, OAuth, trackers or application startup.
    el.querySelector('.ldsp-login-btn').style.display = 'none'
    el.querySelector('.ldsp-follow-num-following').textContent = demo.following
    el.querySelector('.ldsp-follow-num-followers').textContent = demo.followers
    el.querySelector('.ldsp-join-days-site').textContent = 'L站'
    el.querySelector('.ldsp-join-days-num').textContent = demo.joinedDays
    // Capture the settled frame, and omit the level badge as requested for this showcase.
    const ring = el.querySelector('.ldsp-ring-fill')
    ring.setAttribute('stroke-dashoffset', ring.style.getPropertyValue('--off'))
    ring.classList.remove('anim')
    el.querySelector('.ldsp-ring-val').classList.remove('anim')
    el.querySelector('.ldsp-ring-lvl-hitbox').remove()
    el.querySelectorAll('.ldsp-tab, .ldsp-section').forEach((node) => node.classList.remove('active'))
    el.querySelector(`[data-tab="${view}"]`).classList.add('active')
    el.querySelector(`#ldsp-${view}`).classList.add('active')
    // Preserve product CSS and supported width/incomplete-requirements settings.
    const css = vm.runInContext('Styles._css(Screen.getConfig())', context, { timeout: 1000 })
    for (const link of el.querySelectorAll('a')) link.removeAttribute('href')
    for (const control of el.querySelectorAll('button, input')) control.setAttribute('tabindex', '-1')
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>LDStatusPro ${version} · ${theme} · ${view} · 演示数据</title><style>${css}\nhtml,body{margin:0;background:transparent;overflow:hidden}#ldsp-panel{left:24px;top:24px;pointer-events:none}#ldsp-panel,#ldsp-panel *{animation:none!important;transition:none!important}</style></head><body>${el.outerHTML}</body></html>`
    writeFileSync(new URL(`plugin-${theme}-${view}.html`, output), html)
    dom.window.close()
  }
writeFileSync(
  new URL('source.json', output),
  JSON.stringify(
    {
      version,
      sha256,
      fixtureSha256,
      presentationRevision,
      source: 'LDStatusPro.user.js',
      state: 'signed-in presentation with explicitly labeled synthetic demonstration data',
      fixture: 'brand/plugin-demo.json',
      siteIconSource,
      presentation: 'original Panel._createPanel, Styles._css and Renderer; supported width 380 and incomplete requirements; level badge omitted for website; no application boot or network',
      delivery: 'pre-rendered 2x browser screenshots; website loads images, not plugin documents'
    },
    null,
    2
  ) + '\n'
)
console.log(`Generated original plugin UI v${version} (light/dark, requirements/trends, demo data).`)
