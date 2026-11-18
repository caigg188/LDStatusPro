import { spawnSync } from 'node:child_process'
for (const key of ['NODE_ENV', 'ENVIRONMENT', 'DEPLOYMENT_ENVIRONMENT']) {
  if (String(process.env[key] || '').toLowerCase() === 'production') throw new Error('Browser tests must not use production')
}
// Do not pass application secrets, provider credentials or VITE_* overrides to
// the browser runner or its local server. No production .env files are loaded.
const allowed = ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'CI', 'LANG', 'TZ', 'TERM', 'PLAYWRIGHT_BROWSERS_PATH', 'PLAYWRIGHT_HTML_OUTPUT_DIR']
const env = Object.fromEntries(allowed.filter(key => process.env[key]).map(key => [key, process.env[key]]))
env.NODE_ENV = 'test'
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], { env, stdio: 'inherit' })
process.exit(result.status ?? 1)
