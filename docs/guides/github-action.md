# GitHub Action Gate

GroundAtlas ships a composite GitHub Action for repositories that want a
machine-enforced source-truth and fleet dogfooding gate.

> Publication boundary: this action is ready in source, but external projects
> should use it from a version tag only after `groundatlas` has been published to
> npm and `bun run release:readback` has passed.

## Recommended post-publish usage

```yaml
name: GroundAtlas

on:
  pull_request:
  merge_group:
  push:
    branches: [main]

jobs:
  groundatlas:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - id: groundatlas
        uses: SylphxAI/groundatlas@v0.1.0
        with:
          package-spec: groundatlas@0.1.0
          require-atlas: "true"
          strict: "true"
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: groundatlas-reports
          path: |
            ${{ steps.groundatlas.outputs.manifest-report-path }}
            ${{ steps.groundatlas.outputs.fleet-report-path }}
```

If the runner does not already provide Node.js 20.11 or newer, add
`actions/setup-node` before the GroundAtlas step.

## What the action does

1. Runs `ga update`.
2. Runs `ga manifest --json` and writes a manifest report.
3. Runs `ga audit`.
4. Runs `ga fleet . --require-atlas --json` and writes a fleet report.
5. Optionally fails if generated GroundAtlas files or `groundatlas.config.json`
   changed in CI.

The action does not make `.groundatlas/**` a source of truth. It checks that the
generated read-model is fresh and that project identity, manifests, adapters,
agent instructions, validation commands, and generated atlas state satisfy the
fleet gate.

## Inputs

| Input | Default | Purpose |
| --- | --- | --- |
| `package-spec` | `groundatlas@0.1.0` | npm package spec executed through `npm exec`. The default must match the action tag's package version; production CI should not use `groundatlas@latest`. |
| `working-directory` | `.` | Repository directory to inspect. |
| `output-dir` | `.groundatlas` | Generated GroundAtlas output directory. |
| `update` | `true` | Run `ga update` before checks. |
| `require-atlas` | `true` | Require generated `atlas.json` in `ga fleet`. |
| `strict` | `false` | Fail on fleet warnings as well as blocked status. |
| `fail-on-diff` | `false` | Optional tracked/unignored generated-output freshness guard. Leave disabled when `.groundatlas/**` is ignored. |
| `manifest-report-path` | runner temp | Optional path for the `ga manifest --json` report. The action output is always absolute. |
| `fleet-report-path` | runner temp | Optional path for the `ga fleet --json` report. The action output is always absolute. |

## Reports

The action writes two machine-readable reports and exposes their paths as action
outputs:

- `manifest-report-path` — selected neutral manifest or recognized adapter plus
  validation issues;
- `fleet-report-path` — adopted/warning/blocked fleet status, manifest adapters,
  generated-atlas audit state, and validation commands.

Use `actions/upload-artifact` with the action outputs to keep those reports as
CI evidence. If custom report paths are relative, they are resolved from
`working-directory`, but the action tees reports to runner temp first and copies
them to the requested paths only after freshness-sensitive scans finish. This
keeps evidence artifacts from becoming scanned source truth.

## No local binary bypass

The public action always executes `ga` through `npm exec --package`. It does not
accept a local CLI path or private binary override. That keeps downstream
dogfooding proof aligned with the package users actually install.

## Boundary

- Use `project.manifest.json` as the vendor-neutral public manifest.
- `.doctrine/project.json` is reported as an adapter when present; it is not the
  public default.
- Before npm publish/readback, use local checkout or packed tarball smoke only as
  pre-publish confidence. Do not claim fleet package adoption.
- Do not use `groundatlas@latest` for commercial CI gates; pin the action tag and
  package spec to the same released version.
- `ga audit` is the primary freshness gate. `fail-on-diff` is only for
  repositories that intentionally track or unignore generated output. `ga update`
  preserves volatile generated-at/git metadata when the source freshness
  fingerprint is unchanged, so tracked output can be diff-checked without a
  timestamp-only failure.
