import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

/**
 * Advisories with no non-breaking fix. Tailwind 3 still pulls braces 3.x;
 * npm's only suggested upgrade is Tailwind 4.
 */
export const ALLOWED_ADVISORIES = new Set([
    'GHSA-vfj7-8cjw-p6xm'
])

// Approved 2026-11-18: no published fix is available. This exception applies
// only to lockfile-proven development dependencies with trusted build globs.
export const DEV_ADVISORY_EXCEPTION = Object.freeze({
    id: 'GHSA-fc5q-39xc-vjpf', expiresAt: '2026-11-25T00:00:00Z'
})

function allowedDevelopmentAdvisory(id, vuln, { packageLock, now = Date.now() } = {}) {
    return id === DEV_ADVISORY_EXCEPTION.id && now < Date.parse(DEV_ADVISORY_EXCEPTION.expiresAt)
        && Array.isArray(vuln.nodes) && vuln.nodes.length > 0
        && vuln.nodes.every(path => packageLock?.packages?.[path]?.dev === true)
}

export function collectAdvisoryIds(name, vulns, visiting = new Set()) {
    const vuln = vulns[name]
    if (!vuln || visiting.has(name)) return []
    visiting.add(name)
    const ids = []
    for (const item of vuln.via || []) {
        if (typeof item === 'string') {
            ids.push(...collectAdvisoryIds(item, vulns, visiting))
            continue
        }
        const ghsa = String(item.url || '').match(/GHSA-[0-9a-z-]+/i)?.[0]
        if (ghsa) ids.push(ghsa)
    }
    return [...new Set(ids)]
}

export function leftoverVulnerabilities(report, allowedAdvisories = ALLOWED_ADVISORIES, options = {}) {
    if (report?.error || !report?.vulnerabilities || typeof report.vulnerabilities !== 'object'
        || Array.isArray(report.vulnerabilities)) {
        throw new Error('npm audit did not return a valid vulnerability report')
    }
    const vulns = report.vulnerabilities
    return Object.entries(vulns).flatMap(([name, vuln]) => {
        const discovered = collectAdvisoryIds(name, vulns)
        const advisories = (discovered.length ? discovered : ['UNKNOWN_ADVISORY']).filter((id) => !allowedAdvisories.has(id)
            && !allowedDevelopmentAdvisory(id, vuln, options))
        return advisories.length ? [{ name, severity: vuln.severity, advisories }] : []
    })
}

export function parseAuditResult(result) {
    if (result.error) throw result.error
    if (result.signal || ![0, 1].includes(result.status)) {
        throw new Error('npm audit failed to execute')
    }
    let report
    try {
        report = JSON.parse(result.stdout)
    } catch {
        throw new Error('npm audit returned invalid JSON')
    }
    // Exit 1 is also used for valid reports containing allowed advisories.
    leftoverVulnerabilities(report)
    if (result.status === 1 && Object.keys(report.vulnerabilities).length === 0) {
        throw new Error('npm audit failed without reporting vulnerabilities')
    }
    return report
}

function main() {
    const report = parseAuditResult(spawnSync('npm', ['audit', '--json', '--audit-level=low'], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024
    }))
    const packageLock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
    const leftover = leftoverVulnerabilities(report, ALLOWED_ADVISORIES, { packageLock })
    if (!leftover.length) {
        console.log('npm audit: no blocking vulnerabilities')
        return
    }
    console.error('npm audit: blocking vulnerabilities remain:')
    for (const item of leftover) {
        console.error(`- ${item.name} (${item.severity}): ${item.advisories.join(', ')}`)
    }
    process.exit(1)
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
    main()
}
