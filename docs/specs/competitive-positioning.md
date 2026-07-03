# Competitive Positioning

GroundAtlas is not trying to be another pretty generated wiki. It is the
source-grounded control plane underneath repo understanding: deterministic first,
SSOT-safe, CLI/library-native, and designed for human + agent change workflows.

Facts below were checked from public project READMEs on 2026-07-03 where noted.
Competitor behavior may change; the GroundAtlas positioning should be refreshed
before major marketing or pricing decisions.

## The sharp positioning

> OpenWiki can write a wiki. GroundAtlas tells you which source owns the truth,
> whether the generated map is safe, and what an agent must inspect before it
> changes code.

GroundAtlas wins when the buyer cares about governance, CI gates, reproducible
context, SSOT boundaries, and agent safety. It should not compete by being the
most magical prose generator; it should compete by being the most trustworthy
repository context substrate.

## What happens if you choose each path?

| Choice | End state | Strength | Risk |
| --- | --- | --- | --- |
| No tool | Humans and agents rediscover structure manually. | No new dependency. | Slow onboarding, tribal knowledge, stale docs, hallucinated agent context, weak impact analysis. |
| GroundAtlas | Source-grounded map + auditable truth routing + CLI/library surface. | Deterministic, no model key required, no secret reads, no source mutation, generated output not SSOT. | Less magical prose today; must keep building citation/freshness gates and published package proof. |
| OpenWiki | AI-maintained `openwiki/` docs and interactive CLI for documentation generation. | Strong generated-doc experience and model-provider support. | Can become another docs surface; public README says it can append prompts to `AGENTS.md`/`CLAUDE.md` and stores provider secrets under `~/.openwiki/.env`. |
| OpenClaw | Personal AI assistant/gateway across channels, tools, apps, and skills. | Powerful assistant ecosystem and operator UX. | Different category; does not solve repo SSOT/governed knowledge-map needs by itself. |
| Repomix/context packers | Flatten/pack repo context for LLM prompts. | Fast context packaging. | Snapshot context, not a durable SSOT/audit/control-plane layer. |
| DeepWiki-style hosted repo docs | Public generated wiki experience. | Easy reading and discovery. | Hosted/derived docs can drift from repo truth; less suitable as CI-owned local gate. |
| Sourcegraph/Cody/code search | Code search and AI coding assistance over large codebases. | Enterprise search and developer workflow integrations. | Search is not the same as project-local truth hierarchy, generated maps, and no-SSOT audit gates. |
| Mintlify/Docusaurus/docs sites | Polished public documentation. | Excellent external docs presentation. | Presentation layer; not a source-grounded repo-control-plane or agent read model. |

## OpenWiki delta

Based on `langchain-ai/openwiki` README checked 2026-07-03:

- OpenWiki is a CLI that writes and maintains documentation for a codebase.
- It creates/updates `openwiki/` documentation.
- It supports interactive and one-shot modes.
- It configures inference providers and model/API keys.
- It can append prompting to `AGENTS.md` / `CLAUDE.md` or create those files.
- It saves provider configuration/secrets under `~/.openwiki/.env`.

GroundAtlas should intentionally differ:

| Dimension | OpenWiki-style approach | GroundAtlas approach |
| --- | --- | --- |
| Core job | Generate/maintain docs. | Build a source-grounded map and auditable truth route. |
| Dependency | LLM/provider path is central. | Deterministic path first; optional AI adapters later. |
| Writes | Generated docs plus agent prompt mutation. | `.groundatlas/**` plus `groundatlas.config.json` during init only. |
| SSOT stance | Wiki can become a perceived second truth. | Generated artifacts are explicitly deletable and non-authoritative. |
| CI value | Documentation refresh PRs. | Machine-readable source map, audit gate, impact route, future freshness gates. |
| Community value | Easier generated docs. | Safer agent onboarding and repo understanding without centralizing truth. |

## How far are we from OpenWiki?

Current GroundAtlas is ahead in boundary discipline and deterministic audit
posture, but behind in generated prose richness, interactive LLM UX, and mature
provider integrations. That is acceptable because the products do different
jobs. The commercial target is not "OpenWiki clone"; it is:

1. deterministic source map;
2. fact-scoped SSOT policy;
3. fleet adoption contract;
4. CI freshness/citation gates;
5. optional AI prose over validated sources;
6. public package with provenance and registry readback.

## Community value

GroundAtlas should be valuable even to teams that never use SylphxAI doctrine:

- a universal way to expose "what to read first" in any repo;
- safer AI-agent onboarding without requiring model credentials;
- generated artifacts that do not steal authority from maintainers;
- a typed library that other tools can compose instead of scraping Markdown;
- an open contract for future citation graphs, impact checks, and MCP/query
  surfaces.
