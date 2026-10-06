import { describe, expect, it } from 'vitest'
import { ALLOWED_ADVISORIES, leftoverVulnerabilities } from '../scripts/check-audit.mjs'

describe('check-audit', () => {
  it('allows the unpatched braces advisory and its dependents', () => {
    const leftover = leftoverVulnerabilities({
      vulnerabilities: {
        braces: {
          severity: 'high',
          via: [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }]
        },
        chokidar: {
          severity: 'high',
          via: ['braces']
        },
        tailwindcss: {
          severity: 'high',
          via: ['chokidar']
        }
      }
    })
    expect(ALLOWED_ADVISORIES.has('GHSA-vfj7-8cjw-p6xm')).toBe(true)
    expect(leftover).toEqual([])
  })

  it('fails on a new advisory', () => {
    const leftover = leftoverVulnerabilities({
      vulnerabilities: {
        braces: {
          severity: 'high',
          via: [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }]
        },
        dompurify: {
          severity: 'low',
          via: [{ url: 'https://github.com/advisories/GHSA-p98j-92pf-mc4p' }]
        }
      }
    })
    expect(leftover).toEqual([
      { name: 'dompurify', severity: 'low', advisories: ['GHSA-p98j-92pf-mc4p'] }
    ])
  })
})
