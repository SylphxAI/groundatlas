# Security Policy

GroundAtlas scans repository metadata and writes generated maps. The MVP uses no
network, no LLM provider, no remote tracing, and no credential store.

## Reporting vulnerabilities

Please report vulnerabilities privately through GitHub security advisories for
`SylphxAI/groundatlas` when available. If advisories are unavailable, contact the
SylphxAI maintainers through the organization security channel.

## Security boundaries

GroundAtlas must:

- skip `.env` and secret-looking files;
- avoid printing secret values;
- avoid mutating scanned source files;
- avoid writing outside the configured output directory, except
  `groundatlas.config.json` during `init`;
- fail audits when generated maps lose their non-SSOT boundary banner.
