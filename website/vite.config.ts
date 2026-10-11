import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const scriptHeader = readFileSync(new URL('../LDStatusPro.user.js', import.meta.url), 'utf8').split(
  '// ==/UserScript=='
)[0]
const pluginVersion = scriptHeader.match(/^\/\/\s*@version\s+(\S+)/m)?.[1]
if (!pluginVersion) throw new Error('LDStatusPro.user.js is missing its @version metadata')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __PLUGIN_VERSION__: JSON.stringify(pluginVersion) }
})
