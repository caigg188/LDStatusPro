import { describe, expect, it } from 'vitest'
import { ALLOWED_ADVISORIES, leftoverVulnerabilities, parseAuditResult } from '../scripts/check-audit.mjs'

describe('check-audit', () => {
  it('rejects unavailable, malformed and failed audit responses', () => {
    for (const report of [{ error: { code: 'ENOAUDIT' } }, {}, null, { vulnerabilities: [] }]) {
      expect(() => leftoverVulnerabilities(report)).toThrow()
      expect(() => parseAuditResult({ status: 1, stdout: JSON.stringify(report) })).toThrow()
    }
    for (const result of [
      { status: 0, stdout: '<html>unavailable</html>' },
      { status: 1, stdout: '{"vulnerabilities":{}}' },
      { status: 2, stdout: '{"vulnerabilities":{}}' },
      { status: null, signal: 'SIGTERM', stdout: '{}' },
      { status: 0, error: new Error('spawn failed'), stdout: '{"vulnerabilities":{}}' },
    ]) expect(() => parseAuditResult(result)).toThrow()
  })

  it('accepts clean reports and exit 1 with a valid allowed advisory', () => {
    expect(parseAuditResult({ status: 0, stdout: '{"vulnerabilities":{}}' })).toEqual({ vulnerabilities: {} })
    const report = { vulnerabilities: { braces: { severity: 'high', via: [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }] } } }
    expect(leftoverVulnerabilities(parseAuditResult({ status: 1, stdout: JSON.stringify(report) }))).toEqual([])
  })
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
