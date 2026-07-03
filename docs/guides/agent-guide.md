# Agent Guide

GroundAtlas is designed for agents that need a safe orientation layer before they
change code.

## Agent entry sequence

1. Read the repo's tool-neutral agent adapter, preferably `AGENTS.md`.
2. Read `PROJECT.md` and any machine project manifest such as
   `project.manifest.json`.
3. Read `.groundatlas/README.md` only as a generated map.
4. Follow links to specs, ADRs, schemas, tests, workflows, and source files.
5. Change canonical truth homes, not generated GroundAtlas output.
6. Run the narrowest relevant validation, then `ga update && ga audit`.

## Agent contract

Agents may use GroundAtlas to find context. They must not treat `.groundatlas/**`
as source truth. The generated map is a compass, not the territory.

## Useful commands

```sh
ga scan --json
ga manifest project.manifest.json --json
ga explain "project manifest"
ga impact --since origin/main
ga fleet . --require-atlas --json
ga audit --json
```

JSON output is intended for automation. Markdown output is intended for humans
and agent handoffs.
