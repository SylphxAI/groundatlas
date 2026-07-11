#!/usr/bin/env bash
# Run unit tests excluding fixture trees that intentionally contain *.test.ts samples.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
files=()
while IFS= read -r -d '' f; do
  files+=("$f")
done < <(find test -name '*.test.ts' ! -path 'test/fixtures/*' -print0)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No unit tests found" >&2
  exit 1
fi
exec bun test "${files[@]}"
