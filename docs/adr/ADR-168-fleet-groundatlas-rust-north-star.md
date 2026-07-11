# ADR-168 — Fleet GroundAtlas Rust North Star architecture

- **Status:** Accepted
- **Date:** 2026-07-09
- **Builds on:** [ADR-0002](./ADR-0002-source-grounded-control-plane.md) (source-grounded control plane)
- **Relates to:** ADR-167 (SylphxAI/doctrine)
- **Change class:** `required-future` for GroundAtlas; `advisory` for fleet

## Context

GroundAtlas is a CLI-first, deterministic knowledge control plane that generates
source-grounded repository maps for humans and AI agents. ADR-0002 locked
deterministic-first, SSOT-safe behavior: generated maps are read models, not truth.

Today the scanner and audit pipeline run in TypeScript with an npm-published CLI.
Doctrine [ADR-167](https://github.com/SylphxAI/doctrine/blob/main/docs/adr/ADR-167-boundary-contract-stack-and-platform-pillars.md)
requires Rust-first authority for tooling backends. Rust improves scan performance,
memory safety on large repos, and fleet dogfood quality for the scanner hot path.

## Decision

### 1. North Star production stack (GroundAtlas repo)

| Layer | North Star | Transitional (until sunset slice) |
| --- | --- | --- |
| Cross-boundary contract | Protobuf + Buf (`proto/groundatlas/v1/`) | JSON map format (ADR-0002) |
| Scanner + audit engine | Rust `crates/groundatlas-scanner` | TypeScript scanner |
| CLI entry | Thin npm wrapper → Rust binary | `groundatlas` npm CLI |
| Library API | Rust crate + optional `napi`/`wasm` bindings | TS library exports during cutover |
| Map renderers | TS renderers consuming Rust scan output | unchanged until S2 |

### 2. Ownership matrix

| Concern | Owner | GroundAtlas may | GroundAtlas must not |
| --- | --- | --- | --- |
| Scan, audit, map format, CLI | **SylphxAI/groundatlas** | Own deterministic scan rules | Mutate scanned source files |
| Downstream repo architecture | Target repositories | Project maps and citations | Replace ADRs/specs/tests as SSOT |

### 3. Strangler-fig cutover posture

- **S0:** Rust scanner crate + fixture repos; npm CLI delegates to Rust for `scan`.
- **S1:** Deterministic map output parity against TS scanner on fixture corpus.
- **S2:** Audit/freshness gates on Rust output; shadow CI job comparing TS vs Rust.
- **S3:** Delete TS scanner authority; npm package is distribution + thin adapters.
- ADR-0002 truth model and citation requirements preserved across cutover.

### 4. Contract stack (ADR-167 alignment)

- **Protobuf + Buf** for MCP/query and fleet integration surfaces.
- JSON map format remains the human-readable contract until proto projection ships.
- Optional AI adapters remain gated behind deterministic Rust scan/audit (ADR-0002).

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Permanent TS scanner | Contradicts ADR-167; limits performance on large repos |
| Rewrite renderers in Rust first | Renderers are not hot-path; scanner is |
| Generated-wiki-first pivot | Rejected by ADR-0002 |

## Consequences

- New scan/audit code defaults to `crates/groundatlas-*`.
- npm `groundatlas` package becomes thin wrapper over Rust binary.
- Fixture corpus is SSOT for parity claims.
- Fleet cutover registry: Rust scanner is first milestone.

## Validation

- S1 evidence: `test/fixtures/basic/atlas.golden.json`, `crates/groundatlas-scanner/tests/basic_fixture_parity.rs`, `test/scanParity.test.ts`; migration ledger `docs/specs/groundatlas-migration-ledger.json`
- S2 evidence: `src/cli.ts`, `src/infrastructure/rustScanner.ts`, `scripts/check-no-ts-scan-backend.sh`, `test/check-no-ts-scan-backend.test.ts`, `test/rustScanner.bridge.test.ts`; `cli/scan` → `authority_rust` on `feat/adr-168-s1-scan-parity`; `scripts/check-no-ts-init-backend.sh`, `test/initParity.test.ts`; `cli/init` → `authority_rust` on `feat/adr-168-s2-audit-rust-scan`; `scripts/check-no-ts-update-backend.sh`, `test/updateParity.test.ts`; `cli/update` → `authority_rust` on `feat/adr-168-s2-audit-rust-scan`; `scripts/check-no-ts-manifest-backend.sh`, `test/manifestParity.test.ts`; `cli/manifest` discovery → `authority_rust` on `feat/adr-168-s2-audit-rust-scan`; `scripts/check-no-ts-impact-backend.sh`, `test/impactParity.test.ts`; `cli/impact` → `authority_rust` on `feat/adr-168-s2-audit-rust-scan`
- Deterministic map parity on fixture repos (TS vs Rust)
- ADR-0002 audit gates pass on Rust output
- `cargo test` + `cargo clippy -D warnings`
- npm publish readback with Rust binary bundled
- `python3 $DOCTRINE/scripts/project-control-plane-audit.py --local . --fail-on-drift`