#!/bin/sh
# One entry point for local work. Everything it fetches or caches stays in the
# git-ignored .tools/ and node_modules/ directories.
#   ./scripts/dev.sh check         type check and all tests
#   ./scripts/dev.sh example [--originals <dir> | --fetch]
#                                  convert the worked example's originals again,
#                                  compare, and check it; --fetch downloads them
#                                  from the recorded addresses
#   ./scripts/dev.sh report        rebuild both worked examples' research reports
#                                  (examples/*/report/) with stemma build report,
#                                  and typeset each report.pdf with the pinned
#                                  Typst, which it fetches into .tools/ if missing.
#                                  The PostgreSQL report is not rebuilt where this
#                                  copy lacks the text of works it quotes
#   ./scripts/dev.sh report-check  fail if either report's generated files are stale.
#                                  Where this copy lacks text the PostgreSQL report
#                                  quotes, it says that whether that report is
#                                  current cannot be told, and does not fail for it
#   ./scripts/dev.sh demo          build, then run the demo in a fresh temporary directory
#   ./scripts/dev.sh plugin-check  build, then install into an isolated Claude profile
#   ./scripts/dev.sh build         write dist/stemma.js and dist/release/
#   ./scripts/dev.sh docs          regenerate website/generated/, diagrams included
#                                  (needs browsers)
#   ./scripts/dev.sh docs-check    fail if website/generated/ is stale
#   ./scripts/dev.sh record-example  rerun the worked examples' runs that the
#                                  site shows, into website/recorded/. One run of
#                                  the PostgreSQL example needs all its text, and
#                                  is left as it was where that is missing
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
"$root/scripts/setup-bun.sh" >/dev/null
export BUN_INSTALL="$root/.tools/bun-home"
export BUN_INSTALL_CACHE_DIR="$root/.tools/bun-cache"
export BUN_RUNTIME_TRANSPILER_CACHE_PATH="$root/.tools/transpiler-cache"
export PLAYWRIGHT_BROWSERS_PATH="$root/.tools/playwright-browsers"
export PWTEST_CACHE_DIR="$root/.tools/playwright-cache"
bun="$root/.tools/bun"
# --no-install: no run-time package download. The other two stop Bun loading a
# working directory's .env and bunfig.toml (SEC-014).
run() { "$bun" --no-install --no-env-file --config=/dev/null "$@"; }

# Every time, so that a dependency added since the last run is there; with
# nothing to do it takes milliseconds.
"$bun" install --frozen-lockfile --ignore-scripts --registry=https://registry.npmjs.org >/dev/null

# The reports of the worked examples. $1 is an example's folder name; the rest
# are further options of build report.
report_of() {
  example=$1
  shift
  STEMMA_DATA="$root/.tools" run dist/stemma.js build report report "$@" --project "$root/examples/$example"
}
# Whether a folder of source text that the PostgreSQL example does not commit is
# missing here. Its .gitignore lists them.
postgres_text_missing() {
  for folder in $(sed -n 's|^\(sources/.*\)/$|\1|p' examples/postgres-web-apps/.gitignore); do
    [ -d "examples/postgres-web-apps/$folder" ] || return 0
  done
  return 1
}

case "${1:-check}" in
  check)
    echo "== typecheck"
    run node_modules/typescript/bin/tsc --project tsconfig.json
    echo "ok"
    echo "== tests"
    run scripts/build.ts >/dev/null
    # Many tests run several commands in turn, so they get longer than the
    # 5-second default when workers share the machine.
    status=0
    run test ./tests --preload ./tests/cleanup.ts --parallel=4 --timeout=30000 || status=$?
    # Last, so that skipped browser tests are not lost among the other lines.
    run scripts/browser-note.ts
    exit "$status"
    ;;
  build) run scripts/build.ts ;;
  example)
    shift
    run scripts/build.ts >/dev/null
    run dist/stemma.js ingest --project "$root/examples/coral-reefs" --reconvert --actor software:dev-example "$@" ;;
  report)
    run scripts/build.ts >/dev/null
    echo "== coral reefs"
    report_of coral-reefs --pdf
    echo "== PostgreSQL for web applications"
    if postgres_text_missing; then
      echo "NOT REBUILT: this copy does not hold the text of some quoted works. examples/postgres-web-apps/README.md says how to fetch it."
    else
      report_of postgres-web-apps --pdf
    fi ;;
  report-check)
    run scripts/build.ts >/dev/null
    status=0
    echo "== coral reefs"
    report_of coral-reefs --check || status=$?
    echo "== PostgreSQL for web applications"
    code=0
    said=$(report_of postgres-web-apps --check 2>&1) || code=$?
    printf '%s\n' "$said"
    # Exit 5 is "could not be built". It is let past only for text that this copy
    # does not hold; any other failure, or a stale file, fails the run.
    if [ "$code" -eq 5 ] && postgres_text_missing && printf '%s' "$said" | grep -q "it is not held here"; then
      echo "NOT TOLD: whether the PostgreSQL report is current. This copy does not hold the text of some quoted works (examples/postgres-web-apps/README.md says how to fetch it). report-check does not fail for this."
    elif [ "$code" -ne 0 ]; then
      status=$code
    fi
    exit "$status" ;;
  demo) run scripts/build.ts >/dev/null && run scripts/demo.ts ;;
  plugin-check) run scripts/build.ts >/dev/null && run scripts/plugin-check.ts ;;
  publish-plugin) shift; run scripts/build.ts >/dev/null && run scripts/publish-plugin.ts "$@" ;;
  docs) run website/generate.ts ;;
  docs-check) run website/generate.ts --check ;;
  record-example) run website/record-example.ts ;;
  site) run website/build.ts ;;
  preview) run website/build.ts && run website/preview.ts ;;
  browsers) mkdir -p .tools/tmp && TMPDIR="$root/.tools/tmp" run --bun node_modules/.bin/playwright install --only-shell chromium ;;
  e2e) run website/build.ts && run --bun node_modules/.bin/playwright test --config website/playwright.config.ts ;;
  *) echo "usage: $0 check|build|report|report-check|demo|plugin-check|docs|docs-check|example|record-example|site|preview|browsers|e2e|publish-plugin" >&2; exit 2 ;;
esac
