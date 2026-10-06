import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { describe, expect, it } from 'vitest'

const script = readFileSync(new URL('../scripts/deploy-pages-production.sh', import.meta.url), 'utf8')

describe('Pages production deployment policy', () => {
  it('requires a clean synchronized main checkout before reading deployment environment', () => {
    const guardIndex = script.indexOf("current_branch=$(git branch --show-current)")
    const environmentIndex = script.indexOf('source .env.production.local')

    expect(guardIndex).toBeGreaterThan(-1)
    expect(environmentIndex).toBeGreaterThan(guardIndex)
    expect(script).toContain('git status --porcelain')
    expect(script).toContain('git fetch origin main')
    expect(script).toContain('git rev-parse origin/main')
  })

  it('runs deploy-safe gates without invoking the test suite', () => {
    expect(script).toContain('npm run lint')
    expect(script).toContain('npm run audit')
    expect(script).toContain('npm run validate:og')
    expect(script).toContain('npm run check:bundle')
    expect(script).not.toMatch(/npm run (?:test|check)(?:\s|$)/)
  })
})
