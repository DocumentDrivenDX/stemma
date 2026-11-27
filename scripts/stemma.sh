#!/bin/sh
# Runs Stemma's command line for the plugin. On first use it fetches the pinned
# Bun into the plugin's own data directory, checks it against the digest below,
# and uses only that copy. It installs nothing else and changes no system or
# shell setting. Claude runs this; there is nothing for a person to set up.
#
#   sh stemma.sh <absolute data directory> setup
#   sh stemma.sh <absolute data directory> <command> [options]
#
# STEMMA_BUN_ARCHIVE names a local copy of the archive to use instead of
# fetching it. It is checked against the same digest.
set -eu

version=1.4.5

die() {
  echo "stemma: $1 Nothing was checked." >&2
  exit 4
}

[ $# -ge 2 ] || die "usage: stemma.sh <absolute data directory> setup | <command> [options]."
data=$1
shift
case "$data" in
  *'${'*) die "the plugin's data directory was not filled in." ;;
  /* | [A-Za-z]:[/\\]*) ;;
  *) die "the data directory must be an absolute path." ;;
esac

root=$(cd "$(dirname "$0")/.." && pwd)

# The digests are those the npm registry publishes for the @oven packages.
exe=bun
case "$(uname -s) $(uname -m)" in
  "Darwin arm64")
    platform=darwin-aarch64
    integrity='4MIFXHmctH2EhAxLXm2/qxNtv17dFtLJylvaOCsrgq6KSqHTs6eW5YSrJjRbJxYUJaR901fsN8JfZOa+CsWpWQ=='
    ;;
  "Darwin x86_64")
    platform=darwin-x64-baseline
    integrity='zqfLA5A4B+hYMh5WYzYSot3uZ06FzhdP0OEwQisEzdirYtXGj5cQFlfy31BGfNsAsk1Gd/w/OxJ/jqqJ3cMclw=='
    ;;
  "Linux x86_64")
    platform=linux-x64-baseline
    integrity='s8yMwYcFnnrA178gji0gZbkE2WVDej/Ti1x770oPfihxyRxSMNhGhiAQNXV53aDeraZxksdvKV/RAdQBCd0qPA=='
    ;;
  "Linux aarch64" | "Linux arm64")
    platform=linux-aarch64
    integrity='4BXmsSKnjOrlGWqZV4x/oWa7AVoR+B6lCXddMzOAXBIm3t50eslg9wb66gmtW1AamEQ1l1CDvmmruysEhqOWMg=='
    ;;
  MINGW*" x86_64" | MSYS*" x86_64")
    platform=windows-x64-baseline
    integrity='/U3Dc74uGqE6EUqef7mPtg9KwJs7iJH4JHRMfIZIn18MrJh6Xz4gVvWDXRvzCL2j8wPlTnJVyrO4n7Qq4uM7TQ=='
    exe=bun.exe
    ;;
  *) die "this kind of computer ($(uname -s) $(uname -m)) is not supported." ;;
esac

dir="$data/bun-$version"
bun="$dir/$exe"
# From the plugin root, so no bunfig.toml or .env of another directory is near.
cd "$root"

ready() {
  [ -f "$bun" ] && [ "$("$bun" --no-env-file --config=/dev/null --version 2>/dev/null)" = "$version" ]
}

if ! ready; then
  for tool in openssl tar; do
    command -v "$tool" >/dev/null 2>&1 || die "$tool is needed for setup and was not found."
  done
  mkdir -p "$data"
  work=$(mktemp -d "$data/download.XXXXXX")
  trap 'rm -rf "$work"' EXIT
  url="https://registry.npmjs.org/@oven/bun-$platform/-/bun-$platform-$version.tgz"
  if [ -n "${STEMMA_BUN_ARCHIVE:-}" ]; then
    echo "stemma: one-time setup: unpacking Bun $version from a local archive into $data." >&2
    cp "$STEMMA_BUN_ARCHIVE" "$work/bun.tgz" || die "the local archive cannot be read."
  else
    command -v curl >/dev/null 2>&1 || die "curl is needed for setup and was not found."
    echo "stemma: one-time setup: fetching Bun $version (a download of some tens of MB) from $url into $data. Nothing outside that directory changes." >&2
    curl -fsSL --proto '=https' --proto-redir '=https' --max-filesize 200000000 --connect-timeout 30 --max-time 600 \
      -o "$work/bun.tgz" "$url" || die "the download failed. Check the network connection, then run the command again."
  fi
  actual=$(openssl dgst -sha512 -binary "$work/bun.tgz" | openssl base64 -A)
  [ "$actual" = "$integrity" ] || die "the archive does not match its pinned digest, so nothing was unpacked or run."
  mkdir "$work/unpacked"
  tar -xzf "$work/bun.tgz" -C "$work/unpacked" "package/bin/$exe" || die "the archive could not be unpacked."
  chmod 755 "$work/unpacked/package/bin/$exe"
  mkdir -p "$dir"
  mv -f "$work/unpacked/package/bin/$exe" "$bun"
  rm -rf "$work"
  trap - EXIT
  ready || die "the fetched Bun does not run on this computer."
fi

if [ "$1" = setup ]; then
  echo "Bun $version is ready in $dir."
  exit 0
fi

[ -f "$root/dist/stemma.js" ] || die "this copy of the plugin holds no built command line."
BUN_RUNTIME_TRANSPILER_CACHE_PATH="$data/transpiler-cache"
# The data directory also holds the pinned Typst, which `build report --pdf` fetches and checks.
STEMMA_DATA="$data"
export BUN_RUNTIME_TRANSPILER_CACHE_PATH STEMMA_DATA
exec "$bun" --no-install --no-env-file --config=/dev/null "$root/dist/stemma.js" "$@"
