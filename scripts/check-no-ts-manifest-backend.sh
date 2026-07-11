#!/usr/bin/env bash
# ADR-168 S2 gate: npm CLI `manifest` discovery must default to Rust scanner authority.
# Allowed: TS scanRepository for library exports; explicit GROUNDATLAS_RUST_SCANNER=0|ts opt-out.
# Forbidden: CLI manifest discovery hot path without Rust delegation gate.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="${ROOT}/src/cli.ts"
RUST_SCANNER="${ROOT}/src/infrastructure/rustScanner.ts"
PARITY_TEST="${ROOT}/test/manifestParity.test.ts"
GATE_TEST="${ROOT}/test/check-no-ts-manifest-backend.test.ts"

violations=0

report_violation() {
  echo "VIOLATION: $*"
  violations=$((violations + 1))
}

echo "=== check-no-ts-manifest-backend $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [[ ! -f "${CLI}" ]]; then
  report_violation "missing src/cli.ts"
fi

if [[ ! -f "${RUST_SCANNER}" ]]; then
  report_violation "missing src/infrastructure/rustScanner.ts"
fi

if [[ ! -f "${PARITY_TEST}" ]]; then
  report_violation "missing test/manifestParity.test.ts"
fi

if [[ ! -f "${GATE_TEST}" ]]; then
  report_violation "missing test/check-no-ts-manifest-backend.test.ts"
fi

if [[ -f "${CLI}" ]]; then
  if ! grep -q 'GROUNDATLAS_RUST_SCANNER = "1"' "${CLI}"; then
    report_violation "cli.ts must set GROUNDATLAS_RUST_SCANNER=1 default for published npm entry"
  fi

  if ! grep -q 'if (rustScannerDelegationEnabled())' "${CLI}"; then
    report_violation "cli.ts manifest discovery must gate on rustScannerDelegationEnabled()"
  fi

  if ! grep -q 'scanRepositoryViaRust' "${CLI}"; then
    report_violation "cli.ts manifest discovery must delegate to scanRepositoryViaRust"
  fi

  manifest_block="$(awk '/if \(args\.command === "manifest"\)/,/return inspection\.selected\.valid/' "${CLI}")"
  if [[ -z "${manifest_block}" ]]; then
    report_violation "cli.ts manifest command block not found"
  elif ! grep -q 'rustScannerDelegationEnabled' <<<"${manifest_block}"; then
    report_violation "cli.ts manifest discovery block must reference rustScannerDelegationEnabled"
  elif ! grep -q 'scanRepositoryViaRust' <<<"${manifest_block}"; then
    report_violation "cli.ts manifest discovery block must call scanRepositoryViaRust"
  fi
fi

if [[ "${violations}" -gt 0 ]]; then
  echo ""
  echo "FAIL: ${violations} CLI manifest discovery TS authority violation(s)."
  echo "Authority: crates/groundatlas-scanner via src/infrastructure/rustScanner.ts."
  exit 1
fi

echo "PASS: npm CLI manifest discovery defaults through Rust scanner authority."