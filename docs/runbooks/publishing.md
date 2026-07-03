# Publishing Runbook

GroundAtlas is intended to publish as the public npm package `groundatlas`, with
CLI binaries `groundatlas` and `ga`.

## Current registry state

As of the release-evidence hardening patch:

- `groundatlas@0.1.2` is published on npm as the current public unscoped
  package.
- `npm view groundatlas@0.1.2 version dist.integrity dist.tarball gitHead --json`
  must read back `version: "0.1.2"` and the tag commit git head before the
  package is treated as release evidence.
- The `v0.1.1` tag workflow is the first successful publish run. It used
  `npm publish --access public --provenance` through the organization
  `NPM_TOKEN` fallback while trusted publishing setup remains open.
- The `v0.1.2` tag workflow proves the JSON-pure release evidence path added
  after the first publish.
- The `v0.1.0` tag workflow reached `npm publish` but did not create a registry
  package because npm returned 404/not-authorized for `groundatlas@0.1.0`.
  Do not move the already-pushed `v0.1.0` tag; it is retained as failed release
  history.

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
7. Preserve the `groundatlas-release-evidence` workflow artifact containing
   parseable JSON files: `groundatlas-npm-readback.json` and
   `groundatlas-post-publish-dogfood.json`.

## Trusted publishing setup

Before removing the bounded token fallback, configure npm trusted publishing for:

- Package: `groundatlas`
- Repository: `SylphxAI/groundatlas`
- Workflow: `.github/workflows/release.yml`
- Runtime: GitHub-hosted runner, Node.js `22.14.0` or newer, npm `11.5.1` or newer
- Environment: none for MVP, or a protected `npm` environment if the org requires
  an explicit environment gate.

If trusted publishing cannot create or update the package, use an npm token only
as a bounded fallback, then move future releases back to OIDC. Record the token
exception with owner, expiry, and removal path.

The release workflow currently passes the organization `NPM_TOKEN` explicitly to
`npm publish --provenance` so the first package can be bootstrapped through the
same CI/CD credential path used by other SylphxAI libraries. Remove the token
fallback only after npm trusted publishing is configured and a tokenless dry run
has been proven on a non-production test package or the next release candidate.

## Local dry run

```sh
bun install
bun run check
GROUNDATLAS_DOGFOOD_REPOS=/absolute/path/to/repo \
  GROUNDATLAS_DOGFOOD_REPORT_PATH=/tmp/groundatlas-external-dogfood.json \
  bun run dogfood:external
node scripts/assert-dogfood-report.mjs /tmp/groundatlas-external-dogfood.json \
  --expect-pre-npm --expect-adopted --expect-neutral-manifest
bun run release:readback > /tmp/groundatlas-npm-readback.json
node scripts/assert-json-file.mjs /tmp/groundatlas-npm-readback.json
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
smoke results. In GitHub Actions, `gitHead` must match `GITHUB_SHA`, and the
written artifact must pass `scripts/assert-json-file.mjs` before upload.

On tag runs, the release workflow then installs the just-published npm package
into the external dogfood pilot and writes
`groundatlas-post-publish-dogfood.json`. The assertion requires
`claimBoundary: "post-publish-package-pilot"`,
`groundatlasPackageSource: "npm-registry"`, `packagePublished: true`, adopted
fleet status, neutral manifest selection, Doctrine adapter reporting, and no
mutation of the checked-out target repository.

Workflow dispatch is dry-run/preflight only. Publishing requires a version tag so
the release path is auditable and reproducible.
