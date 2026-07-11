#!/usr/bin/env bash
# GroundAtlas scanner + CLI scan/audit differential parity — TS oracles vs native Rust SSOT.
# Fail-closed: requires bun + git + built groundatlas-scanner (no SKIP-as-pass).
# See PARITY-VERIFICATION-STANDARD.md, DECISION-001 / rej-010.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRATCH="${SCRATCH_DIR:-/tmp/groundatlas-scan-differential}"
mkdir -p "$SCRATCH"
LOG="$SCRATCH/differential.log"
ARTIFACT="$SCRATCH/verification.json"
ORACLE_JSON="$SCRATCH/oracle.json"
AUDIT_ORACLE_JSON="$SCRATCH/audit-oracle.json"
EXPLAIN_ORACLE_JSON="$SCRATCH/explain-oracle.json"
SLICE_FILTER="all"
: >"$LOG"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slice)
      SLICE_FILTER="${2:-}"
      shift 2
      ;;
    *)
      echo "::error::unknown argument: $1" | tee -a "$LOG"
      exit 1
      ;;
  esac
done

case "$SLICE_FILTER" in
  all|scanner/rust-scan|cli/audit|cli/explain) ;;
  *)
    echo "::error::invalid --slice value: $SLICE_FILTER" | tee -a "$LOG"
    exit 1
    ;;
esac

cd "$REPO_ROOT"

if ! command -v bun >/dev/null 2>&1; then
  echo "::error::bun required for groundatlas differential parity — no SKIP-as-pass" | tee -a "$LOG"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "::error::git required for prepared basic fixture — no SKIP-as-pass" | tee -a "$LOG"
  exit 1
fi

RUST_BINARY="$REPO_ROOT/target/debug/groundatlas-scanner"
if [[ ! -x "$RUST_BINARY" ]]; then
  echo "--- build groundatlas-scanner (debug) ---" | tee -a "$LOG"
  cargo build -p groundatlas-scanner 2>&1 | tee -a "$LOG"
fi

if [[ ! -x "$RUST_BINARY" ]]; then
  echo "::error::groundatlas-scanner binary missing at $RUST_BINARY after build attempt" | tee -a "$LOG"
  exit 1
fi

echo "=== groundatlas differential parity slice=$SLICE_FILTER $(date -Iseconds) ===" | tee -a "$LOG"

if [[ "$SLICE_FILTER" == "all" || "$SLICE_FILTER" == "scanner/rust-scan" ]]; then
  echo "--- check-no-ts-scan-backend gate (cli/scan authority) ---" | tee -a "$LOG"
  bash "$REPO_ROOT/scripts/check-no-ts-scan-backend.sh" 2>&1 | tee -a "$LOG"

  echo "--- TS scan oracle ---" | tee -a "$LOG"
  bun run "$REPO_ROOT/scripts/differential/scan-oracle.ts" >"$ORACLE_JSON" 2>>"$LOG"

  echo "--- bun scanParity gate (TS golden + Rust cross-parity + CLI authority) ---" | tee -a "$LOG"
  GROUNDATLAS_RUST_SCANNER_BIN="$RUST_BINARY" \
    bun test "$REPO_ROOT/test/scanParity.test.ts" 2>&1 | tee -a "$LOG"

  echo "--- Rust native differential test (scanner/rust-scan) ---" | tee -a "$LOG"
  GROUNDATLAS_ORACLE_JSON="$ORACLE_JSON" \
    cargo test -p groundatlas-scanner --test scan_differential 2>&1 | tee -a "$LOG"

  echo "--- Rust basic fixture parity regression ---" | tee -a "$LOG"
  cargo test -p groundatlas-scanner --test basic_fixture_parity 2>&1 | tee -a "$LOG"
fi

if [[ "$SLICE_FILTER" == "all" || "$SLICE_FILTER" == "cli/audit" ]]; then
  echo "--- check-no-ts-audit-backend gate (cli/audit freshness authority) ---" | tee -a "$LOG"
  bash "$REPO_ROOT/scripts/check-no-ts-audit-backend.sh" 2>&1 | tee -a "$LOG"

  echo "--- TS audit freshness oracle ---" | tee -a "$LOG"
  bun run "$REPO_ROOT/scripts/differential/audit-oracle.ts" >"$AUDIT_ORACLE_JSON" 2>>"$LOG"

  echo "--- bun auditParity gate (freshness fingerprint + CLI authority) ---" | tee -a "$LOG"
  GROUNDATLAS_RUST_SCANNER_BIN="$RUST_BINARY" \
    bun test "$REPO_ROOT/test/auditParity.test.ts" 2>&1 | tee -a "$LOG"

  echo "--- Rust native audit differential test (cli/audit freshness) ---" | tee -a "$LOG"
  GROUNDATLAS_AUDIT_ORACLE_JSON="$AUDIT_ORACLE_JSON" \
    cargo test -p groundatlas-scanner --test audit_differential 2>&1 | tee -a "$LOG"
fi

if [[ "$SLICE_FILTER" == "all" || "$SLICE_FILTER" == "cli/explain" ]]; then
  echo "--- TS explain oracle ---" | tee -a "$LOG"
  bun run "$REPO_ROOT/scripts/differential/explain-oracle.ts" >"$EXPLAIN_ORACLE_JSON" 2>>"$LOG"

  echo "--- Rust native explain differential test (cli/explain) ---" | tee -a "$LOG"
  GROUNDATLAS_EXPLAIN_ORACLE_JSON="$EXPLAIN_ORACLE_JSON" \
    cargo test -p groundatlas-scanner --test explain_differential cli_explain_differential_matches_ts_oracle 2>&1 | tee -a "$LOG"
fi

CANDIDATE_SHA="${CANDIDATE_SHA:-$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)}"
BASELINE_TS_SHA="$(git -C "$REPO_ROOT" log -1 --format=%H -- src/application/scan.ts src/domain/classify.ts src/application/audit.ts test/fixtures/basic/atlas.golden.json 2>/dev/null || echo unknown)"
RUST_SHA="$CANDIDATE_SHA"
SCAN_BEHAVIOR_SPEC_HASH="$(sha256sum "$REPO_ROOT/scripts/differential/fixtures/basic-scan-corpus.json" 2>/dev/null | awk '{print $1}' || echo missing)"
AUDIT_BEHAVIOR_SPEC_HASH="$(sha256sum "$REPO_ROOT/scripts/differential/fixtures/basic-audit-corpus.json" 2>/dev/null | awk '{print $1}' || echo missing)"
FIXTURE_CORPUS_HASH="missing"
GOLDEN_BASELINE_HASH="missing"
SCAN_CASE_COUNT=0
AUDIT_FIXTURE_CORPUS_HASH="missing"
AUDIT_CASE_COUNT=0
EXPLAIN_FIXTURE_CORPUS_HASH="missing"
EXPLAIN_CASE_COUNT=0
if [[ -f "$ORACLE_JSON" ]]; then
  FIXTURE_CORPUS_HASH="$(jq -r '.fixtureCorpusHash' "$ORACLE_JSON")"
  GOLDEN_BASELINE_HASH="$(jq -r '.goldenBaselineHash' "$ORACLE_JSON")"
  SCAN_CASE_COUNT="$(jq '.cases | length' "$ORACLE_JSON")"
fi
if [[ -f "$AUDIT_ORACLE_JSON" ]]; then
  AUDIT_FIXTURE_CORPUS_HASH="$(jq -r '.fixtureCorpusHash' "$AUDIT_ORACLE_JSON")"
  AUDIT_CASE_COUNT="$(jq '.cases | length' "$AUDIT_ORACLE_JSON")"
fi
if [[ -f "$EXPLAIN_ORACLE_JSON" ]]; then
  EXPLAIN_FIXTURE_CORPUS_HASH="$(jq -r '.fixtureCorpusHash' "$EXPLAIN_ORACLE_JSON")"
  EXPLAIN_CASE_COUNT="$(jq '.cases | length' "$EXPLAIN_ORACLE_JSON")"
fi

jq -n \
  --arg verifiedAt "$(date -Iseconds)" \
  --arg candidateSha "$CANDIDATE_SHA" \
  --arg baselineTsSha "$BASELINE_TS_SHA" \
  --arg rustCandidateSha "$RUST_SHA" \
  --arg scanBehaviorSpecHash "$SCAN_BEHAVIOR_SPEC_HASH" \
  --arg auditBehaviorSpecHash "$AUDIT_BEHAVIOR_SPEC_HASH" \
  --arg fixtureCorpusHash "$FIXTURE_CORPUS_HASH" \
  --arg goldenBaselineHash "$GOLDEN_BASELINE_HASH" \
  --arg auditFixtureCorpusHash "$AUDIT_FIXTURE_CORPUS_HASH" \
  --arg explainFixtureCorpusHash "$EXPLAIN_FIXTURE_CORPUS_HASH" \
  --argjson scanCaseCount "$SCAN_CASE_COUNT" \
  --argjson auditCaseCount "$AUDIT_CASE_COUNT" \
  --argjson explainCaseCount "$EXPLAIN_CASE_COUNT" \
  --arg sliceFilter "$SLICE_FILTER" \
  '{
    schemaVersion: 2,
    slice: $sliceFilter,
    status: "differential_green",
    verifiedAt: $verifiedAt,
    lastComparedMainSha: $candidateSha,
    mergeGroupSha: $candidateSha,
    baselineTsSha: $baselineTsSha,
    rustCandidateSha: $rustCandidateSha,
    scanBehaviorSpecHash: $scanBehaviorSpecHash,
    auditBehaviorSpecHash: $auditBehaviorSpecHash,
    fixtureCorpusHash: $fixtureCorpusHash,
    goldenBaselineHash: $goldenBaselineHash,
    auditFixtureCorpusHash: $auditFixtureCorpusHash,
    scanCaseCount: $scanCaseCount,
    auditCaseCount: $auditCaseCount,
    explainFixtureCorpusHash: $explainFixtureCorpusHash,
    explainCaseCount: $explainCaseCount,
    harness: "scripts/run-groundatlas-differential.sh",
    differentialTests: [
      "crates/groundatlas-scanner/tests/scan_differential.rs",
      "crates/groundatlas-scanner/tests/audit_differential.rs",
      "crates/groundatlas-scanner/tests/explain_differential.rs"
    ],
    oracles: [
      "scripts/differential/scan-oracle.ts",
      "scripts/differential/audit-oracle.ts",
      "scripts/differential/explain-oracle.ts"
    ],
    authorityGates: [
      "scripts/check-no-ts-scan-backend.sh",
      "scripts/check-no-ts-audit-backend.sh"
    ],
    parityTests: [
      "test/scanParity.test.ts",
      "test/auditParity.test.ts"
    ]
  }' >"$ARTIFACT"

echo "groundatlas-differential: OK (scanCases=$SCAN_CASE_COUNT auditCases=$AUDIT_CASE_COUNT corpus=$FIXTURE_CORPUS_HASH auditCorpus=$AUDIT_FIXTURE_CORPUS_HASH golden=$GOLDEN_BASELINE_HASH)" | tee -a "$LOG"
echo "verification artifact: $ARTIFACT" | tee -a "$LOG"