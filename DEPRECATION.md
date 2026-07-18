# Deprecation

GroundAtlas as an independent npm/GitHub product is **deprecated**.

- Binding decision: Control Plane [ADR-0014](https://github.com/SylphxAI/control-plane/blob/main/docs/adr/ADR-0014-groundatlas-product-retirement-cp-ingestion.md)
- Replacement: **Control Plane Repository Ingestion** (`docs/specs/repository-ingestion.md` in `SylphxAI/control-plane`)
- Do not install `groundatlas` for new work.
- Registry deprecation notice should read:
  `DEPRECATED: use Control Plane Repository Ingestion (SylphxAI/control-plane ADR-0014). Do not install for new work.`

Yes-class reverse dependencies on active fleet default branches were cleared
before archive. Historical archives and schema URL lineage may still mention
GroundAtlas without restoring product investment.
