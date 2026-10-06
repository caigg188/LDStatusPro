import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Advisories with no non-breaking fix. Tailwind 3 still pulls braces 3.x;
 * npm's only suggested upgrade is Tailwind 4.
 */
export const ALLOWED_ADVISORIES = new Set([
    'GHSA-vfj7-8cjw-p6xm'
])

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

export function leftoverVulnerabilities(report, allowedAdvisories = ALLOWED_ADVISORIES) {
    const vulns = report?.vulnerabilities || {}
    return Object.entries(vulns).flatMap(([name, vuln]) => {
        const advisories = collectAdvisoryIds(name, vulns).filter((id) => !allowedAdvisories.has(id))
        return advisories.length ? [{ name, severity: vuln.severity, advisories }] : []
    })
}

function readAuditReport() {
    const result = spawnSync('npm', ['audit', '--json', '--audit-level=low'], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024
    })
    const stdout = result.stdout || ''
    try {
        return JSON.parse(stdout)
    } catch {
        if (result.error) throw result.error
        process.stderr.write(result.stderr || stdout)
        process.exit(result.status === 0 ? 1 : result.status)
    }
}

function main() {
    const report = readAuditReport()
    const leftover = leftoverVulnerabilities(report)
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
