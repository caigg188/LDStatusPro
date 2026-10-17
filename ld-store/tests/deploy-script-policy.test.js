import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { describe, expect, it } from 'vitest'

const guard = readFileSync(new URL('../../scripts/verify-pages-release.mjs', import.meta.url), 'utf8')
const script = readFileSync(new URL('../scripts/deploy-pages-production.sh', import.meta.url), 'utf8')

describe('Pages production deployment policy', () => {
  it('requires a clean synchronized main checkout before reading deployment environment', () => {
    const guardIndex = script.indexOf('release_sha=$(node ../scripts/verify-pages-release.mjs)')
    const environmentIndex = script.indexOf('source .env.production.local')

    expect(guardIndex).toBeGreaterThan(-1)
    expect(environmentIndex).toBeGreaterThan(guardIndex)
    expect(guard).toContain("git('status', '--porcelain')")
    expect(guard).toContain("git('fetch', 'origin', 'main')")
    expect(guard).toContain("git('rev-parse', 'origin/main')")
  })

  it('runs deploy-safe gates without invoking the test suite', () => {
    expect(script).toContain('npm run check:source')
    expect(script).toContain('npm run check:artifact')
    expect(script).toContain('node ../scripts/verify-pages-release.mjs "$release_sha"')
    expect(script).toContain('--commit-hash="$release_sha" --commit-dirty=false')
    expect(script).not.toMatch(/npm run (?:test|check)(?:\s|$)/)
  })
})
