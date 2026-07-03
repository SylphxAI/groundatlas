# Open-source Strategy

GroundAtlas started from an internal need: keep human and agent context grounded
in source truth across many projects. The public product should turn that
operating discipline into a general open-source primitive.

## Market positioning

GroundAtlas is the **source-grounded repository control plane**.

It sits between code search, generated docs, AI agents, and CI:

- code search tells you where text appears;
- generated wikis explain what a model thinks;
- docs sites publish polished prose;
- GroundAtlas tells you which files own truth, whether generated context is
  fresh, and what humans/agents should inspect before changing code.

## Business value

For teams:

- faster onboarding;
- fewer stale-doc incidents;
- safer AI-agent changes;
- better PR impact routing;
- reusable governance across many repos without vendor lock-in.

For SylphxAI:

- public proof of engineering taste and operating discipline;
- community-maintained primitives instead of private-only tooling;
- a neutral foundation that can support commercial services later without
  closing the core;
- stronger trust because generated context remains non-authoritative.

## Community value

GroundAtlas should be useful even when a team never buys anything:

- local CLI;
- no model key required;
- no network required for deterministic scan/audit;
- vendor-neutral project control file;
- generated output that can be deleted and recreated;
- clear extension points for adapters and future dashboards.

## Star-worthy roadmap

To earn sustained open-source attention, prioritize slices that are visible,
composable, and easy to try:

1. publish the npm package with provenance and readback;
2. ship a polished landing page and quickstart;
3. provide `project.manifest.json` schema, examples, and validators;
4. add richer HTML output;
5. add claim/citation graph with source anchors;
6. add PR comment/report mode;
7. add workspace/fleet dashboard from neutral project manifests;
8. add optional AI adapters only after deterministic citation gates are strong.

## Anti-goals

- Do not make SylphxAI Doctrine a public requirement.
- Do not make Claude, Codex, Cursor, GitHub Copilot, LangChain, or any provider
  required.
- Do not claim semantic dependency analysis before it exists.
- Do not hide publication state; npm readback is the public release proof.
