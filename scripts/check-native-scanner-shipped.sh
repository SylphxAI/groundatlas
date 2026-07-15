#!/usr/bin/env bash
# Fail-closed: published package must ship bin/native/groundatlas-scanner for Rust CLI authority.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/native/groundatlas-scanner"
LEDGER="$ROOT/docs/specs/migration-ledger.json"

if [[ ! -x "$BIN" ]]; then
  echo "FAIL: missing executable $BIN — run bun run stage:rust" >&2
  exit 1
fi
if ! grep -q 'bin/native/groundatlas-scanner' "$ROOT/src/infrastructure/rustScanner.ts"; then
  echo "FAIL: rustScanner.ts must resolve bin/native/groundatlas-scanner" >&2
  exit 1
fi
if ! grep -q '"bin"' "$ROOT/package.json" || ! grep -q 'bin' <<<"$(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).files)")"; then
  echo "FAIL: package.json files must include bin/" >&2
  exit 1
fi
echo "PASS: native groundatlas-scanner is staged for npm pack"
