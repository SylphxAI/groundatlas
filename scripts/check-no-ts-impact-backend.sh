#!/usr/bin/env bash
# ADR-168 S2 gate: npm CLI `impact` must default to Rust scanner authority.
# Allowed: TS scanRepository for library exports; explicit GROUNDATLAS_RUST_SCANNER=0|ts opt-out.
# Forbidden: CLI impact hot path without Rust delegation gate.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="${ROOT}/src/cli.ts"
RUST_SCANNER="${ROOT}/src/infrastructure/rustScanner.ts"
PARITY_TEST="${ROOT}/test/impactParity.test.ts"
GATE_TEST="${ROOT}/test/check-no-ts-impact-backend.test.ts"

violations=0

report_violation() {
  echo "VIOLATION: $*"
  violations=$((violations + 1))
}

echo "=== check-no-ts-impact-backend $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [[ ! -f "${CLI}" ]]; then
  report_violation "missing src/cli.ts"
fi

if [[ ! -f "${RUST_SCANNER}" ]]; then
  report_violation "missing src/infrastructure/rustScanner.ts"
fi

if [[ ! -f "${PARITY_TEST}" ]]; then
  report_violation "missing test/impactParity.test.ts"
fi

if [[ ! -f "${GATE_TEST}" ]]; then
  report_violation "missing test/check-no-ts-impact-backend.test.ts"
fi

if [[ -f "${CLI}" ]]; then
  if ! grep -q 'GROUNDATLAS_RUST_SCANNER = "1"' "${CLI}"; then
    report_violation "cli.ts must set GROUNDATLAS_RUST_SCANNER=1 default for published npm entry"
  fi

  if ! grep -q 'if (rustScannerDelegationEnabled())' "${CLI}"; then
    report_violation "cli.ts impact command must gate on rustScannerDelegationEnabled()"
  fi

  if ! grep -q 'scanRepositoryViaRust' "${CLI}"; then
    report_violation "cli.ts impact command must delegate to scanRepositoryViaRust"
  fi

  impact_block="$(awk '/if \(args\.command === "impact"\)/,/return 0;/' "${CLI}")"
  if [[ -z "${impact_block}" ]]; then
    report_violation "cli.ts impact command block not found"
  elif ! grep -q 'rustScannerDelegationEnabled' <<<"${impact_block}"; then
    report_violation "cli.ts impact block must reference rustScannerDelegationEnabled"
  elif ! grep -q 'scanRepositoryViaRust' <<<"${impact_block}"; then
    report_violation "cli.ts impact block must call scanRepositoryViaRust"
  fi
fi

if [[ "${violations}" -gt 0 ]]; then
  echo ""
  echo "FAIL: ${violations} CLI impact TS authority violation(s)."
  echo "Authority: crates/groundatlas-scanner via src/infrastructure/rustScanner.ts."
  exit 1
fi

echo "PASS: npm CLI impact defaults through Rust scanner authority."