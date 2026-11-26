#!/bin/sh
# One entry point for local work. Everything it fetches or caches stays in the
# git-ignored .tools/ and node_modules/ directories.
#   ./scripts/dev.sh check         type check and all tests
#   ./scripts/dev.sh demo          build, then run the demo in a fresh temporary directory
#   ./scripts/dev.sh plugin-check  build, then install into an isolated Claude profile
#   ./scripts/dev.sh build         write dist/stemma.js and dist/release/
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
"$root/scripts/setup-bun.sh" >/dev/null
export BUN_INSTALL="$root/.tools/bun-home"
export BUN_INSTALL_CACHE_DIR="$root/.tools/bun-cache"
bun="$root/.tools/bun"
# --no-install: no run-time package download. The other two stop Bun loading a
# working directory's .env and bunfig.toml (SEC-014).
run() { "$bun" --no-install --no-env-file --config=/dev/null "$@"; }

if [ ! -d node_modules/typescript ]; then
  "$bun" install --frozen-lockfile --ignore-scripts --registry=https://registry.npmjs.org
fi

case "${1:-check}" in
  check)
    echo "== typecheck"
    run node_modules/typescript/bin/tsc --project tsconfig.json
    echo "ok"
    echo "== tests"
    run scripts/build.ts >/dev/null
    run test ./tests
    ;;
  build) run scripts/build.ts ;;
  demo) run scripts/build.ts >/dev/null && run scripts/demo.ts ;;
  plugin-check) run scripts/build.ts >/dev/null && run scripts/plugin-check.ts ;;
  *) echo "usage: $0 check|build|demo|plugin-check" >&2; exit 2 ;;
esac
