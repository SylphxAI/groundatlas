# User Guide

GroundAtlas helps you enter an unfamiliar repository without trusting stale wiki
pages or asking an AI agent to guess.

## Install and run

```sh
npm install -g groundatlas
cd your-repo
ga init
ga manifest project.manifest.json --json
ga update
ga audit
```

Until npm publication is complete, use a local checkout or packed tarball instead
of claiming public package installation.

## Daily workflow

1. Run `ga update` after meaningful repository changes.
2. Open `.groundatlas/README.md` for the generated start-here map.
3. Inspect the linked canonical files before making decisions.
4. Run `ga explain "topic"` to find likely owning files.
5. Run `ga manifest project.manifest.json --json` when changing project
   identity, surfaces, commands, or adoption state.
6. Run `ga impact --since main` before reviewing a pull request.
7. Run `ga fleet . --require-atlas` to check adopted/warning/blocked
   dogfooding status.
8. Run `ga audit` in CI to catch stale generated maps and missing non-SSOT
   boundaries.

## Mental model

GroundAtlas answers:

- Where does this project define its truth?
- What should I read first?
- Which files are generated navigation vs canonical sources?
- Is my generated map fresh enough to trust as a map?
- Is this repo adopted, warning, or blocked for dogfooding?

GroundAtlas does not answer from generated memory. If the map and source disagree,
fix the source and regenerate the map.
