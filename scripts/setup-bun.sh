#!/bin/sh
# For work on Stemma itself: put the pinned Bun into the git-ignored .tools/
# directory, using the plugin's own launcher and its pinned digests.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
sh "$root/scripts/stemma.sh" "$root/.tools" setup >/dev/null
ln -sfn "bun-1.4.5/bun" "$root/.tools/bun"
BUN_RUNTIME_TRANSPILER_CACHE_PATH="$root/.tools/transpiler-cache" "$root/.tools/bun" --version
