#!/bin/sh
# One entry point for local work. Everything it fetches or caches stays in the
# git-ignored .tools/ and node_modules/ directories.
#   ./scripts/dev.sh check         type check and all tests
#   ./scripts/dev.sh example [--originals <dir> | --fetch]
#                                  convert the worked example's originals again,
#                                  compare, and check it; --fetch downloads them
#                                  from the recorded addresses
#   ./scripts/dev.sh report        rebuild the worked example's research report
#                                  (examples/coral-reefs/report/) from the committed
#                                  source files; also typesets report.pdf when the
#                                  pinned Typst is in .tools/typst-0.15.1/
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

if [ ! -d node_modules/typescript ] || [ ! -d node_modules/@playwright/test ]; then
  "$bun" install --frozen-lockfile --ignore-scripts --registry=https://registry.npmjs.org
fi

case "${1:-check}" in
  check)
    echo "== typecheck"
    run node_modules/typescript/bin/tsc --project tsconfig.json
    echo "ok"
    echo "== tests"
    run scripts/build.ts >/dev/null
    # Many tests run several commands in turn, so they get longer than the
    # 5-second default when workers share the machine.
    run test ./tests --parallel=4 --timeout=30000
    ;;
  build) run scripts/build.ts ;;
  example)
    shift
    run scripts/build.ts >/dev/null
    run dist/stemma.js ingest --project "$root/examples/coral-reefs" --reconvert --actor software:dev-example "$@" ;;
  report)
    python3 -I -B examples/coral-reefs/report/tools/build.py
    typst="$root/.tools/typst-0.15.1/typst-aarch64-apple-darwin/typst"
    if [ -x "$typst" ]; then
      "$typst" compile --root examples/coral-reefs/report examples/coral-reefs/report/report.typ examples/coral-reefs/report/report.pdf
      echo "wrote examples/coral-reefs/report/report.pdf"
    else
      echo "report.pdf not typeset: Typst 0.15.1 is not in .tools/typst-0.15.1/"
    fi ;;
  report-check) python3 -I -B examples/coral-reefs/report/tools/build.py --check ;;
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
