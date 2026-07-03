# Publishing Runbook

GroundAtlas is intended to publish as the public npm package `groundatlas`, with
CLI binaries `groundatlas` and `ga`.

## Current registry state

As of the first publish-prep pass:

- `npm view groundatlas` returns 404: package name is available.
- `npm view @sylphxai/groundatlas` returns 404: scoped fallback is available.
- Local workstation `npm whoami` returns `ENEEDAUTH`: no npm identity is present.

## Required release path

1. Keep source on `main` green through `CI / check`.
2. Create a release tag `vX.Y.Z` from a green commit.
3. Publish through `.github/workflows/release.yml` with GitHub OIDC provenance.
4. Read back the registry package with `npm view groundatlas version dist`.
5. Smoke install in a temp directory, import the library exports, run
   `groundatlas --help`, and run `ga init`, `ga update`, `ga audit`,
   `ga fleet --require-atlas --json`, and `ga explain` against a fixture
   repository that contains both the neutral `project.manifest.json` and the
   `.doctrine/project.json` adapter.
6. Run a copied-repository package pilot with
   `GROUNDATLAS_DOGFOOD_PACKAGE_SPEC=groundatlas@X.Y.Z bun run dogfood:external`
   before claiming fleet package adoption.

## Trusted publishing setup

Before the first real npm publish, configure npm trusted publishing for:

- Package: `groundatlas`
- Repository: `SylphxAI/groundatlas`
- Workflow: `.github/workflows/release.yml`
- Runtime: GitHub-hosted runner, Node.js `22.14.0` or newer, npm `11.5.1` or newer
- Environment: none for MVP, or a protected `npm` environment if the org requires
  an explicit environment gate.

If trusted publishing cannot create the first package, use a one-time npm token
only as a bounded fallback, then immediately move future releases back to OIDC.
Record the token exception with owner, expiry, and removal path.

## Local dry run

```sh
bun install
bun run check
GROUNDATLAS_DOGFOOD_REPOS=/absolute/path/to/repo \
  GROUNDATLAS_DOGFOOD_REPORT_PATH=/tmp/groundatlas-external-dogfood.json \
  bun run dogfood:external
node scripts/assert-dogfood-report.mjs /tmp/groundatlas-external-dogfood.json \
  --expect-pre-npm --expect-adopted --expect-neutral-manifest
bun run release:preflight
npm publish --dry-run --access public
```

`bun run check` includes both `pack:dry-run` and `pack:smoke`. The smoke installs
the packed tarball into a clean temporary project, imports `groundatlas` as a
library, then runs installed `groundatlas` / `ga` commands against a fixture
repository. The fixture proves the public neutral manifest is selected while the
Doctrine file is reported separately under `manifestAdapters`.

The external dogfood report is required pre-publish confidence only. It must
show `claimBoundary: "pre-npm-pilot-only"` and
`groundatlasPackageSource: "packed-local-tarball"` until npm registry readback
has passed. If the target repository contains `.doctrine/project.json`, assert it
with `--expect-doctrine-adapter`; it must remain adapter evidence, not the public
default manifest.

## Manual publish is not done

A local `npm publish` from a human workstation is not GroundAtlas's standard
release path. If a local publish is used to bootstrap npm package ownership, it
must be reported as a temporary exception and followed by registry readback plus
trusted-publishing migration.


## Release gates

The release workflow runs:

1. `bun run release:preflight` — tag/package version consistency, registry
   availability for the exact version, and the full local check suite.
2. `npm publish --access public --provenance` — only from `v*.*.*` tag refs.
3. `bun run release:readback` — `npm view` readback plus the same fresh
   installed-package smoke used for packed tarballs, but installing from the
   immutable npm registry package version.

The registry readback emits machine-readable evidence including version,
integrity, tarball URL, `gitHead`, expected Git commit, and installed-package
smoke results. In GitHub Actions, `gitHead` must match `GITHUB_SHA`.

Workflow dispatch is dry-run/preflight only. Publishing requires a version tag so
the release path is auditable and reproducible.
