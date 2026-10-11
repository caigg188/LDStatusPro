// Local files only. Run from any directory; no app environment, network or deploy.
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const design = path.join(root, 'design')
const check = process.argv.includes('--check')
if (process.argv.slice(2).some((flag) => flag !== '--check')) throw new Error('Usage: node design/scripts/sync-assets.mjs [--check]')

async function filesBelow(directory) {
  const files = []
  const entries = await readdir(path.join(root, directory), { withFileTypes: true })
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name.startsWith('.')) continue
    const relative = `${directory}/${entry.name}`
    if (entry.isDirectory()) files.push(...await filesBelow(relative))
    else if (entry.isFile()) files.push(relative)
  }
  return files
}

const pairs = [
  ['website/brand/identity.json', 'system/identity.json'],
  ['website/brand/plugin-demo.json', 'system/plugin-demo.json'],
  ['website/src/brand-tokens.css', 'system/brand-tokens.css'],
  ['website/public/favicon.svg', 'assets/icons/favicon.svg'],
  ['website/public/favicon.ico', 'assets/icons/favicon.ico']
]
for (const source of await filesBelow('website/public/brand')) {
  pairs.push([source, source.replace('website/public/brand', 'assets/brand')])
}
for (const name of ['source.json', 'capture.json', 'plugin-light-reqs.webp', 'plugin-light-trends.webp', 'plugin-dark-reqs.webp', 'plugin-dark-trends.webp']) {
  pairs.push([`website/public/product-preview/${name}`, `assets/product/plugin/${name}`])
}
for (const source of await filesBelow('website/public/screenshots')) {
  pairs.push([source, source.replace('website/public/screenshots', 'assets/product/store')])
}
pairs.sort((a, b) => a[1].localeCompare(b[1], 'en'))

const records = []
const problems = []
for (const [source, destination] of pairs) {
  const bytes = await readFile(path.join(root, source))
  records.push({ file: destination, source, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  if (check) {
    try {
      if (!(await readFile(path.join(design, destination))).equals(bytes)) problems.push(`${destination} differs from ${source}`)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      problems.push(`${destination} is missing`)
    }
  } else {
    await mkdir(path.dirname(path.join(design, destination)), { recursive: true })
    await writeFile(path.join(design, destination), bytes)
  }
}

// Obsolete exports need an explicit archival decision, never silent deletion.
const expected = new Set(records.map((record) => `design/${record.file}`))
for (const directory of ['design/system', 'design/assets']) {
  for (const file of await filesBelow(directory)) if (!expected.has(file)) problems.push(`Unlisted active asset: ${file}; archive it or add its source mapping`)
}

const standard = JSON.parse(await readFile(path.join(design, 'standard.json'), 'utf8'))
const identity = JSON.parse(await readFile(path.join(root, standard.identitySource), 'utf8'))
const manifest = { schemaVersion: 1, standard, identityVersion: identity.version, note: 'Derived mirrors; edit their source files and synchronize after a confirmed design change.', files: records }
const serialized = JSON.stringify(manifest, null, 2) + '\n'
if (check) {
  try {
    if ((await readFile(path.join(design, 'manifest.json'), 'utf8')) !== serialized) problems.push('manifest.json differs from the current sources or standard metadata')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    problems.push('manifest.json is missing')
  }
} else if (!problems.length) {
  await writeFile(path.join(design, 'manifest.json'), serialized)
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exitCode = 1
} else {
  console.log(`${check ? 'Verified' : 'Synchronized'} ${records.length} current design files; identity v${identity.version}, standard v${standard.version}.`)
}
