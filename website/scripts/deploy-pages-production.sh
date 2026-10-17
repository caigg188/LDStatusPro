#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_dir"
release_sha=$(node ../scripts/verify-pages-release.mjs)
readonly release_sha
export CF_PAGES_COMMIT_SHA="$release_sha"
npm run check:deploy
node ../scripts/verify-pages-release.mjs "$release_sha" >/dev/null
npx wrangler pages deploy dist --project-name=ldstatus-pro --branch main --commit-hash="$release_sha" --commit-dirty=false
printf 'Pages deployment completed: commit=%s\n' "$release_sha"
