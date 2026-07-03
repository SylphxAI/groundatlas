# Changelog

## 0.1.1 - pending npm publication

- Initial GroundAtlas CLI and library package surface.
- Deterministic source scanner, map renderer, audit gate, explain, and impact
  commands.
- Fact-scoped SSOT model, orientation route, spec/design classification, and
  generated-map freshness auditing.
- Vendor-neutral `project.manifest.json` control file schema, example, guides,
  public asset validation, and static landing page.
- Repo-local governance docs, permission model, dogfooding contract, fleet
  adoption contract, competitive positioning, and CI.
- Fleet dogfooding report command (`ga fleet` / `ga inventory` / `ga score`) and
  pre-npm external source-checkout pilot script.
- Fleet gate validation for neutral `project.manifest.json` manifests, with
  ecosystem manifest adapters reported separately.
- Shared installed-package smoke for both packed tarballs and npm registry
  readback, including package-based fleet manifest/adaptor dogfooding.
- External dogfood pilot package-source mode for post-publish npm registry
  installs, kept separate from pre-publish packed-tarball evidence.
- CI-gated packed-tarball external dogfood evidence artifact with machine
  assertions for source-checkout boundary, neutral manifest priority, adapter
  reporting, and original-repository immutability.
- Reusable GitHub Action gate contract for downstream `ga update` / `ga audit`
  / `ga fleet` adoption checks after npm publish and version-tag readback.
- GitHub Action manifest/fleet JSON reports and output paths for CI artifacts.
- Validation commands declared in neutral project manifests, so non-package repos
  can satisfy fleet gates without fake package metadata.
- Composite-action packed-tarball smoke plus exact action/package version
  defaulting, so pre-publish action evidence cannot bypass package behavior or
  drift through `groundatlas@latest`.
- Stable generated-output rewrites when source freshness is unchanged, enabling
  tracked `.groundatlas/**` CI diff gates without timestamp-only churn.
- Standalone `ga manifest` command plus `groundatlas/manifest` package subpath
  for vendor-neutral manifest/adaptor validation before full fleet adoption.
- Public package export for `groundatlas/schemas/project.manifest.schema.json`,
  so downstream tools can consume the neutral schema without scraping repo paths.
- Release workflow prepared for npm provenance publishing once trusted publishing
  or npm credentials are configured.
- Tag-gated release evidence bundle for registry readback plus npm-registry
  post-publish dogfood, so first publish proof is machine-readable.
- Node 24-compatible GitHub workflow/action references plus workflow contract
  validation for release, CI, Pages, and artifact-upload examples.
