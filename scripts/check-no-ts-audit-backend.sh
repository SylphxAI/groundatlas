#!/usr/bin/env bash
# ADR-168 S2 gate: audit freshness compare must default to Rust scanner authority.
# Allowed: TS scanRepository for explicit GROUNDATLAS_RUST_SCANNER=0|ts opt-out.
# Forbidden: auditFreshness hot path without Rust delegation gate.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUDIT="${ROOT}/src/application/audit.ts"
RUST_SCANNER="${ROOT}/src/infrastructure/rustScanner.ts"
PARITY_TEST="${ROOT}/test/auditParity.test.ts"
GATE_TEST="${ROOT}/test/check-no-ts-audit-backend.test.ts"

violations=0

report_violation() {
  echo "VIOLATION: $*"
  violations=$((violations + 1))
}

echo "=== check-no-ts-audit-backend $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [[ ! -f "${AUDIT}" ]]; then
  report_violation "missing src/application/audit.ts"
fi

if [[ ! -f "${RUST_SCANNER}" ]]; then
  report_violation "missing src/infrastructure/rustScanner.ts"
fi

if [[ ! -f "${PARITY_TEST}" ]]; then
  report_violation "missing test/auditParity.test.ts"
fi

if [[ ! -f "${GATE_TEST}" ]]; then
  report_violation "missing test/check-no-ts-audit-backend.test.ts"
fi

if [[ -f "${AUDIT}" ]]; then
  if ! grep -q 'rustScannerDelegationEnabled' "${AUDIT}"; then
    report_violation "audit.ts must gate freshness on rustScannerDelegationEnabled()"
  fi

  if ! grep -q 'scanRepositoryViaRust' "${AUDIT}"; then
    report_violation "audit.ts auditFreshness must delegate to scanRepositoryViaRust"
  fi

  freshness_block="$(awk '/async function auditFreshness/,/^}/' "${AUDIT}")"
  if [[ -z "${freshness_block}" ]]; then
    report_violation "audit.ts auditFreshness block not found"
  elif ! grep -q 'rustScannerDelegationEnabled' <<<"${freshness_block}"; then
    report_violation "auditFreshness must reference rustScannerDelegationEnabled"
  elif ! grep -q 'scanRepositoryViaRust' <<<"${freshness_block}"; then
    report_violation "auditFreshness must call scanRepositoryViaRust"
  fi
fi

if [[ "${violations}" -gt 0 ]]; then
  echo ""
  echo "FAIL: ${violations} audit freshness TS authority violation(s)."
  echo "Authority: crates/groundatlas-scanner via src/infrastructure/rustScanner.ts."
  exit 1
fi

echo "PASS: audit freshness defaults through Rust scanner authority."