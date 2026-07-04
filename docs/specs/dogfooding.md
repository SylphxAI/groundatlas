# Dogfooding Contract

GroundAtlas must use GroundAtlas on itself before asking other projects to trust
it.

## Current dogfood loop

`bun run check` runs the full self-hosted loop:

1. Typecheck the product source.
2. Run behavior tests against fixture repositories.
3. Run Biome.
4. Validate this repository's neutral `project.manifest.json` and local
   `.doctrine/project.json` adapter.
5. Build the CLI.
6. Run `node dist/cli.js --help`.
7. Run `node dist/cli.js manifest project.manifest.json --json` so the neutral
   project manifest is validated without generating maps.
8. Run `node dist/cli.js update` on this repository.
9. Run `node dist/cli.js audit` on the generated map, including schema,
   generated/non-SSOT banners, source-owned error risks, and freshness.
10. Run `node dist/cli.js fleet . --require-atlas --json` so GroundAtlas reports
   its own adopted/warning/blocked status through the same machine surface that
   downstream repositories will use.
11. Run package dry-run checks before publish workflows.
12. Install the packed tarball in a clean temp project and run imported library
    plus installed CLI smoke tests, including `groundatlas/manifest`,
    `ga manifest`, and `ga fleet --require-atlas --json` against a fixture with
    both neutral manifest and Doctrine adapter.

## External source-checkout pilot

Before npm registry publish/readback exists, GroundAtlas may run a bounded
external dogfood pilot from the source checkout:

```sh
GROUNDATLAS_DOGFOOD_REPOS=/absolute/path/to/repo bun run dogfood:external
```

This pilot is evidence only. It installs a locally packed tarball into a temp
project, copies the target repository before writing generated output, runs the
installed `groundatlas` / `ga` binaries against the copy, and verifies that the
original repository status is unchanged.

GroundAtlas CI runs this pilot against a clean public checkout and uploads the
machine-readable JSON as the `groundatlas-external-dogfood` artifact. The CI
assertion must prove the source-checkout boundary, selected neutral manifest,
adapter reporting, adopted fleet status, and original-repository immutability.
Private internal repositories such as Doctrine may be used as additional local
or credentialed evidence, but the public CI gate must not depend on private
repository credentials.

The evidence explicitly reports:

- `groundatlasPackageSource: "packed-local-tarball"`;
- `claimBoundary: "pre-npm-pilot-only"`;
- whether the npm package is published;
- detected project manifest and agent adapter;
- standalone manifest validation result for the detected manifest or adapter;
- selected fleet manifest and recognized manifest adapters;
- scan/audit/fleet command results;
- original repository status before and after.

This does **not** satisfy fleet package adoption. Before `groundatlas@0.1.1`,
fleet package adoption remained blocked until npm publication, provenance, and
registry readback succeeded.

After npm publication, `bun run release:readback` must install the immutable
registry package and run the same installed-package fleet smoke before claiming
package-based dogfooding.

After registry readback, the same external pilot can install from npm instead of
a packed local tarball:

```sh
GROUNDATLAS_DOGFOOD_PACKAGE_SPEC=groundatlas@0.1.3 \
  GROUNDATLAS_DOGFOOD_REPOS=/absolute/path/to/repo \
  bun run dogfood:external
```

This post-publish mode reports `groundatlasPackageSource: "npm-registry"` and
`claimBoundary: "post-publish-package-pilot"`. It is the first evidence layer
for package-based fleet adoption, but mandatory fleet rollout still requires
repo-local PRs and CI gates in the target projects.

For `groundatlas@0.1.3`, this package/readback layer exists. The remaining
dogfooding boundary is downstream CI adoption, not package availability.

The release workflow must run this post-publish pilot only on `v*.*.*` tag
events, after npm publish and registry readback. It uploads the
`groundatlas-release-evidence` artifact with both registry readback JSON and
post-publish dogfood JSON. Workflow dispatch remains preflight-only and must not
publish, read back, or claim package-based dogfooding.

## Dogfood policy

- The GroundAtlas repository carries `groundatlas.config.json` as its own config.
- Generated output remains reproducible and non-authoritative.
- If a feature cannot be used on GroundAtlas itself, it is not ready to be the
  default for customers.
- Any future LLM/MCP adapter must be tested against this repo without exposing
  secrets or requiring private vendor infrastructure.
- Source-checkout pilots must never mutate the original target repository. They
  may write generated output only inside a copied temp repository.
- External repositories should use the GitHub Action gate only after npm
  publish/readback and a version tag are available; for released versions such as
  `v0.1.3`, the gate is package-adoption proof for that target repository only.
- `bun run check` must exercise the reusable GitHub Action run block against a
  packed tarball and verify manifest/fleet report JSON so source-ready action
  claims are backed by behavior, not string validation alone.

## Why generated maps are ignored

The default `.groundatlas/` directory is generated output. The repo dogfoods the
CLI by regenerating and auditing it in CI, while canonical project truth remains
in source files, docs, manifests, and tests.

If a downstream repository chooses to commit generated maps, its CI must run
`ga update` and then `ga audit` so stale tracked output cannot pass quietly.
GroundAtlas must not create timestamp-only churn in that path: unchanged source
freshness fingerprints preserve volatile generated-at/git metadata.
