#!/bin/sh
# Put the pinned Bun into the git-ignored .tools/ directory. Installs nothing
# system-wide, runs no package lifecycle script, and changes no shell setting.
# The tarball is the official @oven package from the npm registry; its pinned
# sha512 is checked before anything is unpacked.
set -eu

version=1.4.5
root=$(cd "$(dirname "$0")/.." && pwd)
dest="$root/.tools/bun-$version"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)
    package=bun-darwin-aarch64
    integrity='4MIFXHmctH2EhAxLXm2/qxNtv17dFtLJylvaOCsrgq6KSqHTs6eW5YSrJjRbJxYUJaR901fsN8JfZOa+CsWpWQ=='
    ;;
  *)
    echo "setup-bun: only macOS on Apple silicon is set up here; install Bun $version yourself and set STEMMA_BUN." >&2
    exit 4
    ;;
esac

if [ ! -x "$dest/bun" ]; then
  mkdir -p "$root/.tools"
  work=$(mktemp -d "$root/.tools/download.XXXXXX")
  trap 'rm -rf "$work"' EXIT
  curl -fsSL -o "$work/bun.tgz" \
    "https://registry.npmjs.org/@oven/$package/-/$package-$version.tgz"
  actual=$(openssl dgst -sha512 -binary "$work/bun.tgz" | openssl base64 -A)
  if [ "$actual" != "$integrity" ]; then
    echo "setup-bun: integrity mismatch; nothing was unpacked." >&2
    exit 4
  fi
  mkdir "$work/unpacked"
  tar -xzf "$work/bun.tgz" -C "$work/unpacked" package/bin/bun
  mkdir -p "$dest"
  mv "$work/unpacked/package/bin/bun" "$dest/bun"
  chmod 755 "$dest/bun"
fi

ln -sfn "bun-$version/bun" "$root/.tools/bun"
BUN_RUNTIME_TRANSPILER_CACHE_PATH="$root/.tools/transpiler-cache" "$root/.tools/bun" --version
