#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_dir"

if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  [[ "${GITHUB_REF:-}" == "refs/heads/main" ]] || {
    echo "Refusing Pages deployment: GitHub Actions ref must be refs/heads/main, found ${GITHUB_REF:-unset}" >&2
    exit 1
  }
else
  current_branch=$(git branch --show-current)
  [[ "$current_branch" == 'main' ]] || {
    echo "Refusing Pages deployment: expected branch main, found ${current_branch:-detached HEAD}" >&2
    exit 1
  }
fi
[[ -z "$(git status --porcelain)" ]] || {
  echo 'Refusing Pages deployment: Git worktree is not clean' >&2
  exit 1
}
git fetch origin main
local_head=$(git rev-parse HEAD)
remote_head=$(git rev-parse origin/main)
[[ "$local_head" == "$remote_head" ]] || {
  echo 'Refusing Pages deployment: local main is not synchronized with origin/main' >&2
  exit 1
}

npm run lint
npm run audit
npm run validate:og

# This file is intentionally ignored by Git. It contains a public Faro
# ingestion identifier, but keeping deployment-only values out of tracked
# files avoids silently changing the production telemetry contract.
if [[ -f .env.production.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production.local
  set +a
fi

# For this monorepo-style local workspace, allow the storefront release command
# to read only the public browser ingestion identifier from the observability
# project's local .env. Do not source that file: it may contain unrelated
# service credentials and a release must never inherit them accidentally.
# An explicit VITE_FARO_API_KEY or .env.production.local always takes priority.
if [[ -z "${VITE_FARO_API_KEY:-}" ]]; then
  observability_env=${LDSP_OBSERVABILITY_ENV:-"$project_dir/../../ldsp-observability/.env"}
  if [[ -r "$observability_env" ]]; then
    workspace_faro_key=$(awk '
      /^FARO_API_KEY=/ { value = substr($0, length("FARO_API_KEY=") + 1) }
      END { print value }
    ' "$observability_env")
    workspace_faro_key=${workspace_faro_key%$'\r'}
    workspace_faro_key=${workspace_faro_key#\"}
    workspace_faro_key=${workspace_faro_key%\"}
    workspace_faro_key=${workspace_faro_key#\'}
    workspace_faro_key=${workspace_faro_key%\'}
    if [[ ${#workspace_faro_key} -ge 16 ]]; then
      export VITE_FARO_API_KEY=$workspace_faro_key
      printf '%s\n' 'Using the local observability Faro ingestion identifier.' >&2
    fi
  fi
fi

enabled=$(printf '%s' "${VITE_FARO_ENABLED:-1}" | tr '[:upper:]' '[:lower:]')
case "$enabled" in
  1|true|yes|on) ;;
  *) echo 'Refusing Pages deployment: Faro must remain enabled in production' >&2; exit 1 ;;
esac

export VITE_FARO_ENABLED=1
export VITE_FARO_COLLECTOR_URL="${VITE_FARO_COLLECTOR_URL:-https://api1.ldspro.qzz.io/faro/collect}"
[[ "$VITE_FARO_COLLECTOR_URL" == 'https://api1.ldspro.qzz.io/faro/collect' ]] || {
  echo 'Refusing Pages deployment: unexpected Faro collector URL' >&2
  exit 1
}

faro_api_key=${VITE_FARO_API_KEY:-}
[[ ${#faro_api_key} -ge 16 ]] || {
  echo 'Refusing Pages deployment: set VITE_FARO_API_KEY in .env.production.local, the trusted shell, or LDSP_OBSERVABILITY_ENV' >&2
  exit 1
}
export VITE_FARO_API_KEY=$faro_api_key
export VITE_FARO_SESSION_SAMPLE_RATE=1
export VITE_DEPLOYMENT_ENVIRONMENT=production
export CF_PAGES_COMMIT_SHA=$(git rev-parse HEAD)

npm run build:private-metadata
private_hashes=$(find dist/assets -type f -name '*.js' -exec shasum -a 256 {} \; | sed 's#  dist/##' | sort)
npm run build
public_hashes=$(find dist/assets -type f -name '*.js' -exec shasum -a 256 {} \; | sed 's#  dist/##' | sort)
[[ "$private_hashes" == "$public_hashes" ]] || {
  echo 'Refusing Pages deployment: public JavaScript differs from private source-map build' >&2
  exit 1
}
[[ $(find dist -type f -name '*.map' | wc -l | tr -d ' ') == 0 ]] || {
  echo 'Refusing Pages deployment: public build contains source maps' >&2
  exit 1
}
npm run check:bundle

npx wrangler pages deploy dist --project-name=ld-store --branch main --commit-dirty=true

release=$(git rev-parse --short=12 HEAD)
printf 'Pages deployment completed: release=%s source-map artifact=.private-artifacts/ldstore-web-%s.tar.gz\n' "$release" "$release"
