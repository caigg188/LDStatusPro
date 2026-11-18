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
  it('limits the approved picomatch exception to development dependencies and expires it automatically', () => {
    const report = { vulnerabilities: { picomatch: { severity: 'high', nodes: ['node_modules/picomatch'], via: [{ url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf' }] } } }
    const options = { now: Date.parse('2026-11-18T00:00:00Z'), packageLock: { packages: { 'node_modules/picomatch': { dev: true } } } }
    expect(leftoverVulnerabilities(report, new Set(), options)).toEqual([])
    expect(leftoverVulnerabilities(report)).toHaveLength(1)
    expect(leftoverVulnerabilities(report, new Set(), { ...options, now: Date.parse('2026-11-25T00:00:00Z') })).toHaveLength(1)
    expect(leftoverVulnerabilities(report, new Set(), { ...options, packageLock: { packages: { 'node_modules/picomatch': { dev: false } } } })).toHaveLength(1)
    const malformed = JSON.parse(JSON.stringify(report)); malformed.vulnerabilities.picomatch.via = [{}]
    expect(leftoverVulnerabilities(malformed, new Set(), options)).toHaveLength(1)
    const mixed = JSON.parse(JSON.stringify(report)); mixed.vulnerabilities.picomatch.nodes.push('node_modules/unknown-copy')
    expect(leftoverVulnerabilities(mixed, new Set(), options)).toHaveLength(1)
    const other = JSON.parse(JSON.stringify(report)); other.vulnerabilities.picomatch.via[0].url = 'https://github.com/advisories/GHSA-unknown'
    expect(leftoverVulnerabilities(other, new Set(), options)).toHaveLength(1)
  })

  it.each([
    ['unknown object', {}], ['null', null], ['number', 1], ['array', []],
    ['unresolved dependency', 'missing'],
    ['unrecognized URL', { url: 'https://example.invalid/advisory' }],
    ['allowed ID on another host', { url: 'https://example.invalid/GHSA-fc5q-39xc-vjpf' }],
    ['allowed ID in a query', { url: 'https://github.com/advisories/other?GHSA-fc5q-39xc-vjpf' }]
  ])('rejects an allowed advisory mixed with %s in either order', (_name, item) => {
    const advisory = { url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf' }
    const options = { now: Date.parse('2026-11-18T00:00:00Z'), packageLock: { packages: { 'node_modules/picomatch': { dev: true } } } }
    for (const via of [[advisory, item], [item, advisory]]) {
      const report = { vulnerabilities: { picomatch: { severity: 'high', nodes: ['node_modules/picomatch'], via } } }
      expect(leftoverVulnerabilities(report, new Set(['UNKNOWN_ADVISORY']), options)[0]?.advisories).toEqual(['UNKNOWN_ADVISORY'])
    }
  })

  it('does not hide unknown entries behind a permanent exception or a transitive reference', () => {
    const report = { vulnerabilities: {
      braces: { severity: 'high', via: [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }, 'wrapper'] },
      wrapper: { severity: 'low', via: [{}] }
    } }
    expect(leftoverVulnerabilities(report).map(item => item.advisories)).toEqual([['UNKNOWN_ADVISORY'], ['UNKNOWN_ADVISORY']])
    for (const via of [[], null, 'missing', {}]) {
      expect(leftoverVulnerabilities({ vulnerabilities: { fixture: { severity: 'low', via } } })[0]?.advisories).toEqual(['UNKNOWN_ADVISORY'])
    }
  })

  it('rejects cycles while allowing shared, fully resolved dependency paths', () => {
    const report = { vulnerabilities: {
      braces: { severity: 'high', via: [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }] },
      wrapper: { severity: 'high', via: ['braces'] },
      parent: { severity: 'high', via: ['braces', 'wrapper'] }
    } }
    expect(leftoverVulnerabilities(report)).toEqual([])
    report.vulnerabilities.braces.via.push('parent')
    const unresolved = leftoverVulnerabilities(report)
    expect(unresolved).toHaveLength(3)
    expect(unresolved.every(item => item.advisories.includes('UNKNOWN_ADVISORY'))).toBe(true)
  })
})
