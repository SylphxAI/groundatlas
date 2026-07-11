#!/usr/bin/env bash
# ADR-168 S2 gate: npm CLI `init` must default to Rust scanner authority.
# Allowed: TS scanRepository for library exports; explicit GROUNDATLAS_RUST_SCANNER=0|ts opt-out.
# Forbidden: CLI init hot path without Rust delegation gate.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="${ROOT}/src/cli.ts"
RUST_SCANNER="${ROOT}/src/infrastructure/rustScanner.ts"
GOLDEN="${ROOT}/test/fixtures/basic/atlas.golden.json"
PARITY_TEST="${ROOT}/test/initParity.test.ts"
GATE_TEST="${ROOT}/test/check-no-ts-init-backend.test.ts"

violations=0

report_violation() {
  echo "VIOLATION: $*"
  violations=$((violations + 1))
}

echo "=== check-no-ts-init-backend $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [[ ! -f "${CLI}" ]]; then
  report_violation "missing src/cli.ts"
fi

if [[ ! -f "${RUST_SCANNER}" ]]; then
  report_violation "missing src/infrastructure/rustScanner.ts"
fi

if [[ ! -f "${GOLDEN}" ]]; then
  report_violation "missing test/fixtures/basic/atlas.golden.json"
fi

if [[ ! -f "${PARITY_TEST}" ]]; then
  report_violation "missing test/initParity.test.ts"
fi

if [[ ! -f "${GATE_TEST}" ]]; then
  report_violation "missing test/check-no-ts-init-backend.test.ts"
fi

if [[ -f "${CLI}" ]]; then
  if ! grep -q 'GROUNDATLAS_RUST_SCANNER = "1"' "${CLI}"; then
    report_violation "cli.ts must set GROUNDATLAS_RUST_SCANNER=1 default for published npm entry"
  fi

  if ! grep -q 'if (rustScannerDelegationEnabled())' "${CLI}"; then
    report_violation "cli.ts init command must gate on rustScannerDelegationEnabled()"
  fi

  if ! grep -q 'scanRepositoryViaRust' "${CLI}"; then
    report_violation "cli.ts init command must delegate to scanRepositoryViaRust"
  fi

  init_block="$(awk '/if \(args\.command === "init"\)/,/return atlas\.risks\.some/' "${CLI}")"
  if [[ -z "${init_block}" ]]; then
    report_violation "cli.ts init command block not found"
  elif ! grep -q 'rustScannerDelegationEnabled' <<<"${init_block}"; then
    report_violation "cli.ts init block must reference rustScannerDelegationEnabled"
  elif ! grep -q 'scanRepositoryViaRust' <<<"${init_block}"; then
    report_violation "cli.ts init block must call scanRepositoryViaRust"
  fi
fi

if [[ "${violations}" -gt 0 ]]; then
  echo ""
  echo "FAIL: ${violations} CLI init TS authority violation(s)."
  echo "Authority: crates/groundatlas-scanner via src/infrastructure/rustScanner.ts."
  exit 1
fi

echo "PASS: npm CLI init defaults through Rust scanner authority."