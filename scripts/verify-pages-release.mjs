import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = 'caigg188/LDStatusPro';
const root = fileURLToPath(new URL('../', import.meta.url));

export function requireSuccessfulCi(run, jobs, sha) {
    if (!run || run.headSha !== sha || run.headBranch !== 'main' || run.event !== 'push'
        || run.status !== 'completed' || run.conclusion !== 'success') {
        throw new Error('Latest main push CI for this SHA must complete successfully');
    }
    const gate = jobs.find(job => job.name === 'CI gate');
    if (gate?.status !== 'completed' || gate.conclusion !== 'success') {
        throw new Error('This SHA has no successful CI gate');
    }
}

function verifyRelease(expectedSha) {
    const command = (bin, args) => execFileSync(bin, args, {
        cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    const git = (...args) => command('git', args);
    const gh = (...args) => JSON.parse(command('gh', args));
    if (process.env.GITHUB_ACTIONS === 'true') throw new Error('Pages deployment is local only');
    const remote = git('remote', 'get-url', 'origin');
    if (![`git@github.com:${repository}.git`, `https://github.com/${repository}.git`, `https://github.com/${repository}`].includes(remote)) {
        throw new Error('origin must point to the canonical LDStatusPro repository');
    }
    if (git('branch', '--show-current') !== 'main') throw new Error('Expected branch main');
    if (git('status', '--porcelain')) throw new Error('Git worktree is not clean');
    git('fetch', 'origin', 'main');
    const sha = git('rev-parse', 'HEAD');
    if (sha !== git('rev-parse', 'origin/main')) throw new Error('HEAD is not synchronized with origin/main');
    if (expectedSha && sha !== expectedSha) throw new Error('HEAD changed during the release');
    const [run] = gh('run', 'list', '--repo', repository, '--workflow', 'ci.yml', '--branch', 'main',
        '--event', 'push', '--commit', sha, '--limit', '1',
        '--json', 'databaseId,headSha,headBranch,event,status,conclusion');
    if (!run) throw new Error('No main push CI exists for this SHA');
    const { jobs } = gh('run', 'view', String(run.databaseId), '--repo', repository, '--json', 'jobs');
    requireSuccessfulCi(run, jobs, sha);
    return sha;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        console.log(verifyRelease(process.argv[2]));
    } catch (error) {
        console.error(`Refusing Pages deployment: ${error.message}`);
        process.exitCode = 1;
    }
}
