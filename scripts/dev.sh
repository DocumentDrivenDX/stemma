#!/bin/sh
# One entry point for local work. Everything it fetches or caches stays in the
# git-ignored .tools/ and node_modules/ directories.
#   ./scripts/dev.sh check         type check and all tests
#   ./scripts/dev.sh all           check, plugin-check, docs-check, report-check
#                                  and e2e at the same time, after one build
#   ./scripts/dev.sh example [--originals <dir> | --fetch]
#                                  convert the worked example's originals again,
#                                  compare, and check it; --fetch downloads them
#                                  from the recorded addresses
#   ./scripts/dev.sh report        rebuild the worked example's research report
#                                  (examples/coral-reefs/report/) with stemma build
#                                  report, and typeset report.pdf with the pinned
#                                  Typst, which it fetches into .tools/ if missing
#   ./scripts/dev.sh report-check  fail if the report's generated files are stale
#   ./scripts/dev.sh demo          build, then run the demo in a fresh temporary directory
#   ./scripts/dev.sh plugin-check  build, then install into an isolated Claude profile
#   ./scripts/dev.sh build         write dist/stemma.js and dist/release/
#   ./scripts/dev.sh docs          regenerate website/generated/ (needs browsers)
#   ./scripts/dev.sh docs-check    fail if website/generated/ is stale
#   ./scripts/dev.sh record-example  rerun the worked example's runs that the
#                                  site shows, into website/recorded/
#   ./scripts/dev.sh site          build the website into website/dist/
#   ./scripts/dev.sh preview       build the website and serve it on 127.0.0.1
#   ./scripts/dev.sh browsers      fetch the pinned headless Chromium into .tools/
#   ./scripts/dev.sh e2e           build the website and run the Playwright tests
#   ./scripts/dev.sh publish-plugin <dir>  build, then copy the plugin into a
#                                  checkout of DocumentDrivenDX/plugins (no push);
#                                  a pushed v<version> tag runs this and pushes
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
# `all` sets up, installs and builds once, then runs this script again for each
# check with STEMMA_DEV_BUILT set, so that none of them changes .tools/bun,
# node_modules/ or dist/ while the others use them.
[ -n "${STEMMA_DEV_BUILT:-}" ] || "$root/scripts/setup-bun.sh" >/dev/null
export BUN_INSTALL="$root/.tools/bun-home"
export BUN_INSTALL_CACHE_DIR="$root/.tools/bun-cache"
export BUN_RUNTIME_TRANSPILER_CACHE_PATH="$root/.tools/transpiler-cache"
export PLAYWRIGHT_BROWSERS_PATH="$root/.tools/playwright-browsers"
export PWTEST_CACHE_DIR="$root/.tools/playwright-cache"
bun="$root/.tools/bun"
# --no-install: no run-time package download. The other two stop Bun loading a
# working directory's .env and bunfig.toml (SEC-014).
run() { "$bun" --no-install --no-env-file --config=/dev/null "$@"; }

build() { [ -n "${STEMMA_DEV_BUILT:-}" ] || run scripts/build.ts >/dev/null; }

# Every time, so that a dependency added since the last run is there; with
# nothing to do it takes milliseconds.
[ -n "${STEMMA_DEV_BUILT:-}" ] ||
  "$bun" install --frozen-lockfile --ignore-scripts --registry=https://registry.npmjs.org >/dev/null

case "${1:-check}" in
  check)
    echo "== typecheck"
    run node_modules/typescript/bin/tsc --project tsconfig.json
    echo "ok"
    echo "== tests"
    build
    # A worker for each processor core, and the files that took longest last time
    # first, by the times kept in .tools/. Many tests run several commands in turn,
    # so they get longer than the 5-second default when workers share the machine.
    status=0
    run test ./tests --preload ./tests/cleanup.ts --parallel --timeout=30000 \
      --timings=.tools/test-timings.json --update-timings || status=$?
    # Last, so that skipped browser tests are not lost among the other lines.
    run scripts/browser-note.ts
    exit "$status"
    ;;
  all)
    run scripts/build.ts >/dev/null
    logs=$(mktemp -d "${TMPDIR:-/tmp}/stemma-all.XXXXXX")
    trap 'rm -rf "$logs"' EXIT
    checks="check plugin-check docs-check report-check e2e"
    began=$(date +%s)
    for name in $checks; do
      (
        status=0
        STEMMA_DEV_BUILT=1 "$root/scripts/dev.sh" "$name" >"$logs/$name.log" 2>&1 || status=$?
        echo "$status $(($(date +%s) - began))" >"$logs/$name.status"
      ) &
    done
    wait
    for name in $checks; do
      printf '\n######## %s\n' "$name"
      cat "$logs/$name.log"
    done
    printf '\n'
    failed=0
    for name in $checks; do
      read -r status seconds <"$logs/$name.status"
      [ "$status" = 0 ] && said=passed || { said="FAILED (exit $status)"; failed=1; }
      echo "$name: $said after $seconds s"
    done
    echo "all five: $(($(date +%s) - began)) s"
    exit "$failed"
    ;;
  build) run scripts/build.ts ;;
  example)
    shift
    run scripts/build.ts >/dev/null
    run dist/stemma.js ingest --project "$root/examples/coral-reefs" --reconvert --actor software:dev-example "$@" ;;
  report)
    run scripts/build.ts >/dev/null
    STEMMA_DATA="$root/.tools" run dist/stemma.js build report report --pdf --project "$root/examples/coral-reefs" ;;
  report-check)
    build
    run dist/stemma.js build report report --check --project "$root/examples/coral-reefs" ;;
  demo) run scripts/build.ts >/dev/null && run scripts/demo.ts ;;
  plugin-check) build && run scripts/plugin-check.ts ;;
  publish-plugin) shift; run scripts/build.ts >/dev/null && run scripts/publish-plugin.ts "$@" ;;
  docs) run website/generate.ts ;;
  docs-check) run website/generate.ts --check ;;
  record-example) run website/record-example.ts ;;
  site) run website/build.ts ;;
  preview) run website/build.ts && run website/preview.ts ;;
  browsers) mkdir -p .tools/tmp && TMPDIR="$root/.tools/tmp" run --bun node_modules/.bin/playwright install --only-shell chromium ;;
  e2e) run website/build.ts && run --bun node_modules/.bin/playwright test --config website/playwright.config.ts ;;
  *) echo "usage: $0 check|all|build|report|report-check|demo|plugin-check|docs|docs-check|example|record-example|site|preview|browsers|e2e|publish-plugin" >&2; exit 2 ;;
esac
