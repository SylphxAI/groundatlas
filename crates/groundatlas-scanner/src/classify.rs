//! Source classification — parity with `src/domain/classify.ts`.

use crate::types::SourceKind;

const MACHINE_PROJECT_MANIFEST_PATHS: &[&str] = &[
    "project.manifest.json",
    "groundatlas.project.json",
    ".project/manifest.json",
    ".doctrine/project.json",
];

const AGENT_ADAPTER_PATHS: &[&str] = &[
    "AGENTS.md",
    "CLAUDE.md",
    ".github/copilot-instructions.md",
    ".cursor/rules",
];

pub fn classify_source(relative_path: &str, size_bytes: u64, content_sha256: &str) -> ClassifiedSource {
    let normalized = relative_path.to_ascii_lowercase();
    let base = normalized
        .rsplit('/')
        .next()
        .unwrap_or(normalized.as_str())
        .to_string();
    let kind = classify_kind(&normalized, &base);
    ClassifiedSource {
        path: relative_path.to_string(),
        kind,
        reason: reason_for_kind(kind, relative_path),
        canonical: is_canonical(kind, &normalized),
        size_bytes,
        content_sha256: content_sha256.to_string(),
    }
}

#[derive(Debug, Clone)]
pub struct ClassifiedSource {
    pub path: String,
    pub kind: SourceKind,
    pub reason: String,
    pub canonical: bool,
    pub size_bytes: u64,
    pub content_sha256: String,
}

fn classify_kind(normalized: &str, base: &str) -> SourceKind {
    if normalized == "project.md" || is_machine_project_manifest_path(normalized) {
        return SourceKind::ProjectManifest;
    }
    if is_agent_adapter_path(normalized, base) {
        return SourceKind::AgentAdapter;
    }
    if normalized.starts_with("docs/adr/") || base.starts_with("adr-") {
        return SourceKind::Adr;
    }
    if normalized.starts_with("docs/specs/") || normalized.starts_with("specs/") {
        return SourceKind::Spec;
    }
    if ["design.md", "design.mdx", "architecture.md", "architecture.mdx"].contains(&base)
        || normalized.starts_with("docs/design/")
        || normalized.starts_with("design/")
    {
        return SourceKind::DesignDoc;
    }
    if normalized.starts_with("runbooks/") || normalized.starts_with("docs/runbooks/") {
        return SourceKind::Runbook;
    }
    if normalized.contains("schema") || normalized.ends_with(".schema.json") {
        return SourceKind::Schema;
    }
    if normalized.starts_with(".github/workflows/")
        && (normalized.ends_with(".yml") || normalized.ends_with(".yaml"))
    {
        return SourceKind::CiWorkflow;
    }
    if normalized == "action.yml" || normalized == "action.yaml" {
        return SourceKind::GithubAction;
    }
    if [
        "package.json",
        "bun.lock",
        "pnpm-lock.yaml",
        "package-lock.json",
        "yarn.lock",
    ]
    .contains(&base)
    {
        return SourceKind::PackageManifest;
    }
    if [
        "tsconfig.json",
        "biome.json",
        "eslint.config.js",
        "eslint.config.mjs",
        "vite.config.js",
    ]
    .contains(&base)
        || normalized.starts_with(".github/")
    {
        return SourceKind::BuildConfig;
    }
    if base == "license" || base.starts_with("license.") {
        return SourceKind::License;
    }
    if base == "security.md" {
        return SourceKind::SecurityPolicy;
    }
    if is_test_path(normalized, base) {
        return SourceKind::Test;
    }
    if normalized.starts_with("docs/")
        || ["readme.md", "contributing.md", "governance.md"].contains(&base)
    {
        return SourceKind::Documentation;
    }
    if normalized.starts_with("src/") || normalized.starts_with("lib/") {
        return SourceKind::Source;
    }
    if normalized.starts_with(".groundatlas/") {
        return SourceKind::GeneratedMap;
    }
    SourceKind::Unknown
}

fn is_machine_project_manifest_path(normalized: &str) -> bool {
    MACHINE_PROJECT_MANIFEST_PATHS
        .iter()
        .any(|candidate| candidate.eq_ignore_ascii_case(normalized))
}

fn is_agent_adapter_path(normalized: &str, base: &str) -> bool {
    base == "agents.md"
        || AGENT_ADAPTER_PATHS
            .iter()
            .any(|candidate| candidate.eq_ignore_ascii_case(normalized))
}

fn is_test_path(normalized: &str, base: &str) -> bool {
    normalized.starts_with("test/")
        || normalized.starts_with("tests/")
        || normalized.contains("/test/")
        || normalized.contains("/tests/")
        || base.contains(".test.")
        || base.contains(".spec.")
}

fn is_canonical(kind: SourceKind, normalized: &str) -> bool {
    matches!(
        kind,
        SourceKind::ProjectManifest
            | SourceKind::AgentAdapter
            | SourceKind::Adr
            | SourceKind::DesignDoc
            | SourceKind::Spec
            | SourceKind::Schema
            | SourceKind::PackageManifest
            | SourceKind::CiWorkflow
            | SourceKind::GithubAction
            | SourceKind::Runbook
            | SourceKind::SecurityPolicy
            | SourceKind::Source
            | SourceKind::Test
            | SourceKind::License
    ) || normalized == "readme.md"
}

fn reason_for_kind(kind: SourceKind, relative_path: &str) -> String {
    match kind {
        SourceKind::ProjectManifest => {
            "Defines repository identity, lifecycle, boundary, or project-local truth.".to_string()
        }
        SourceKind::AgentAdapter => "Bootstraps agents into repo-local context; AGENTS.md is preferred and tool-specific adapters are optional.".to_string(),
        SourceKind::Adr => "Records durable architecture or product decisions.".to_string(),
        SourceKind::DesignDoc => "Explains product or system design intent; durable decisions should graduate into ADRs, specs, schemas, or tests.".to_string(),
        SourceKind::Spec => "Defines product, behavior, adoption, or operating contracts that implementation must satisfy.".to_string(),
        SourceKind::Schema => "Defines machine-checkable contracts.".to_string(),
        SourceKind::CiWorkflow => "Defines validation and automation gates.".to_string(),
        SourceKind::GithubAction => "Defines a reusable GitHub Action contract for downstream CI adoption.".to_string(),
        SourceKind::PackageManifest => "Defines package metadata, binaries, scripts, and dependency surface.".to_string(),
        SourceKind::BuildConfig => "Configures build, lint, test, or tooling behavior.".to_string(),
        SourceKind::License => "Defines open-source distribution terms.".to_string(),
        SourceKind::SecurityPolicy => "Defines vulnerability reporting and security contact process.".to_string(),
        SourceKind::Test => "Proves expected behavior or regression coverage.".to_string(),
        SourceKind::Documentation => "Explains usage, contribution, or operational context.".to_string(),
        SourceKind::Runbook => "Explains repeatable operational procedure.".to_string(),
        SourceKind::Source => "Implements product behavior.".to_string(),
        SourceKind::GeneratedMap => "Generated navigation aid; not canonical truth.".to_string(),
        SourceKind::Unknown => format!("Unclassified repository file: {relative_path}."),
    }
}