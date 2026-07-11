//! Repository scan — parity with `src/application/scan.ts`.

use std::collections::HashSet;
use std::fs;
use std::path::Path;

use serde::Deserialize;

use crate::classify::classify_source;
use crate::fs::walk_files;
use crate::git::read_git_state;
use crate::types::{
    AtlasMap, Generator, OrientationStep, PackageManager, Policy, PublicSurface,
    PublicSurfaceType, RepoIdentity, Risk, RiskSeverity, ScanOptions, SourceEntry, Truth,
    TruthHome, ValidationCommand, ATLAS_SCHEMA_VERSION,
};

const CONFIG_FILE_NAME: &str = "groundatlas.config.json";

const MACHINE_PROJECT_MANIFEST_PATHS: &[&str] = &[
    "project.manifest.json",
    "groundatlas.project.json",
    ".project/manifest.json",
    ".doctrine/project.json",
];

const NEUTRAL_MANIFEST_PRIORITY: &[&str] = &[
    "project.manifest.json",
    "groundatlas.project.json",
    ".project/manifest.json",
];

const AGENT_ADAPTER_PATHS: &[&str] = &[
    "AGENTS.md",
    "CLAUDE.md",
    ".github/copilot-instructions.md",
    ".cursor/rules",
];

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackageJson {
    name: Option<String>,
    bin: Option<serde_json::Value>,
    exports: Option<serde_json::Value>,
    scripts: Option<serde_json::Map<String, serde_json::Value>>,
}

pub fn scan_repository(options: ScanOptions<'_>) -> Result<AtlasMap, ScanError> {
    let cwd = options
        .cwd
        .canonicalize()
        .unwrap_or_else(|_| options.cwd.to_path_buf());
    let files = walk_files(&cwd, options.output_dir).map_err(ScanError::WalkFiles)?;
    let package_json = read_package_json(&cwd.join("package.json"));
    let git = read_git_state(&cwd);

    let mut sources: Vec<SourceEntry> = files
        .iter()
        .map(|file| {
            let classified = classify_source(&file.path, file.size_bytes, &file.content_sha256);
            SourceEntry {
                path: classified.path,
                kind: classified.kind,
                reason: classified.reason,
                canonical: classified.canonical,
                size_bytes: classified.size_bytes,
                content_sha256: classified.content_sha256,
            }
        })
        .collect();

    sources.sort_by(compare_sources);

    let source_paths: HashSet<String> = sources.iter().map(|source| source.path.clone()).collect();
    let validation_commands = dedupe_validation_commands(
        infer_package_validation_commands(&package_json)
            .into_iter()
            .chain(read_neutral_manifest_validation_commands(&cwd, &source_paths))
            .collect(),
    );
    let risks = infer_risks(&source_paths, &validation_commands);
    let public_surfaces = infer_public_surfaces(&sources, &package_json);
    let truth_homes = truth_home_model();

    let generated_at = options
        .generated_at
        .map(str::to_string)
        .unwrap_or_else(chrono_now_iso);

    let generator_version = options
        .generator_version
        .map(str::to_string)
        .unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string());

    Ok(AtlasMap {
        schema_version: ATLAS_SCHEMA_VERSION,
        generated_at,
        generator: Generator {
            name: "GroundAtlas",
            version: generator_version,
        },
        repository: RepoIdentity {
            name: package_json
                .as_ref()
                .and_then(|json| json.name.clone())
                .unwrap_or_else(|| {
                    cwd.file_name()
                        .and_then(|segment| segment.to_str())
                        .unwrap_or("repository")
                        .to_string()
                }),
            root: cwd.display().to_string(),
            git,
            package_manager: infer_package_manager(&source_paths),
        },
        policy: Policy {
            generated_docs_are_not_ssot: true,
            canonical_truth_lives_in: vec![
                "source code",
                "schemas",
                "tests",
                "specs/design docs",
                "package manifests",
                "PROJECT.md",
                "machine project manifest adapters",
                "docs/adr/",
                "CI workflows",
            ],
            write_boundary: format!(
                "{}/ plus {CONFIG_FILE_NAME} during init only",
                options.output_dir
            ),
        },
        truth: Truth {
            model: "fact-scoped-ssot",
            conflict_rule: "Resolve each fact at its owning truth home; if sources disagree, change the owning source and regenerate GroundAtlas rather than editing generated maps.",
            generated_artifacts_are: "navigation-only",
            homes: truth_homes,
        },
        orientation: infer_orientation(&source_paths),
        sources,
        public_surfaces,
        validation_commands,
        risks,
    })
}

pub fn scan_repository_json(options: ScanOptions<'_>) -> Result<String, ScanError> {
    let atlas = scan_repository(options)?;
    serde_json::to_string(&atlas).map_err(ScanError::Serialize)
}

#[derive(Debug)]
pub enum ScanError {
    WalkFiles(std::io::Error),
    Serialize(serde_json::Error),
}

impl std::fmt::Display for ScanError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::WalkFiles(error) => write!(formatter, "walk files: {error}"),
            Self::Serialize(error) => write!(formatter, "serialize atlas: {error}"),
        }
    }
}

impl std::error::Error for ScanError {}

fn read_package_json(path: &Path) -> Option<PackageJson> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn infer_package_manager(source_paths: &HashSet<String>) -> PackageManager {
    if source_paths.contains("bun.lock") {
        PackageManager::Bun
    } else if source_paths.contains("pnpm-lock.yaml") {
        PackageManager::Pnpm
    } else if source_paths.contains("package-lock.json") {
        PackageManager::Npm
    } else if source_paths.contains("yarn.lock") {
        PackageManager::Yarn
    } else {
        PackageManager::Unknown
    }
}

fn infer_package_validation_commands(package_json: &Option<PackageJson>) -> Vec<ValidationCommand> {
    let Some(package_json) = package_json else {
        return Vec::new();
    };
    let scripts = package_json.scripts.as_ref();
    let preferred = ["check", "test", "typecheck", "lint", "build", "format"];
    preferred
        .iter()
        .filter_map(|script| {
            scripts.and_then(|map| map.get(*script)).map(|_| ValidationCommand {
                command: format!("bun run {script}"),
                source: "package.json".to_string(),
                reason: format!("package.json defines the {script} validation script."),
            })
        })
        .collect()
}

fn read_neutral_manifest_validation_commands(
    cwd: &Path,
    source_paths: &HashSet<String>,
) -> Vec<ValidationCommand> {
    let Some(manifest_path) = NEUTRAL_MANIFEST_PRIORITY
        .iter()
        .find(|path| source_paths.contains(**path))
    else {
        return Vec::new();
    };

    let absolute_path = cwd.join(manifest_path);
    let Ok(raw) = fs::read_to_string(&absolute_path) else {
        return Vec::new();
    };
    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return Vec::new();
    };
    let Some(commands) = parsed.get("commands").and_then(|value| value.as_array()) else {
        return Vec::new();
    };

    commands
        .iter()
        .filter_map(|entry| {
            let command = entry.get("command")?.as_str()?;
            let name = entry
                .get("name")
                .and_then(|value| value.as_str())
                .unwrap_or("command");
            Some(ValidationCommand {
                command: command.to_string(),
                source: (*manifest_path).to_string(),
                reason: format!(
                    "{manifest_path} defines the {name} validation command."
                ),
            })
        })
        .collect()
}

fn dedupe_validation_commands(commands: Vec<ValidationCommand>) -> Vec<ValidationCommand> {
    let mut seen = HashSet::new();
    commands
        .into_iter()
        .filter(|command| seen.insert(command.command.clone()))
        .collect()
}

fn infer_public_surfaces(
    sources: &[SourceEntry],
    package_json: &Option<PackageJson>,
) -> Vec<PublicSurface> {
    let mut surfaces = Vec::new();
    for source in sources {
        if source.path == "README.md" {
            surfaces.push(PublicSurface {
                name: "README".to_string(),
                surface_type: PublicSurfaceType::Docs,
                path: source.path.clone(),
            });
        }
        if source.path == "PROJECT.md" {
            surfaces.push(PublicSurface {
                name: "Project manifest".to_string(),
                surface_type: PublicSurfaceType::Manifest,
                path: source.path.clone(),
            });
        }
        if is_machine_project_manifest_path(&source.path) {
            surfaces.push(PublicSurface {
                name: machine_manifest_name(&source.path),
                surface_type: PublicSurfaceType::Manifest,
                path: source.path.clone(),
            });
        }
        if source.kind == crate::types::SourceKind::CiWorkflow {
            surfaces.push(PublicSurface {
                name: source.path.clone(),
                surface_type: PublicSurfaceType::Workflow,
                path: source.path.clone(),
            });
        }
        if source.kind == crate::types::SourceKind::GithubAction {
            surfaces.push(PublicSurface {
                name: source.path.clone(),
                surface_type: PublicSurfaceType::GithubAction,
                path: source.path.clone(),
            });
        }
        if source.kind == crate::types::SourceKind::Schema {
            surfaces.push(PublicSurface {
                name: source.path.clone(),
                surface_type: PublicSurfaceType::Schema,
                path: source.path.clone(),
            });
        }
        if matches!(
            source.kind,
            crate::types::SourceKind::Spec
                | crate::types::SourceKind::DesignDoc
                | crate::types::SourceKind::Runbook
        ) {
            surfaces.push(PublicSurface {
                name: source.path.clone(),
                surface_type: PublicSurfaceType::Docs,
                path: source.path.clone(),
            });
        }
    }

    if package_json
        .as_ref()
        .and_then(|json| json.bin.as_ref())
        .is_some()
    {
        surfaces.push(PublicSurface {
            name: "package binaries".to_string(),
            surface_type: PublicSurfaceType::Cli,
            path: "package.json".to_string(),
        });
    }
    if package_json
        .as_ref()
        .and_then(|json| json.exports.as_ref())
        .is_some()
    {
        surfaces.push(PublicSurface {
            name: "package exports".to_string(),
            surface_type: PublicSurfaceType::Package,
            path: "package.json".to_string(),
        });
    }

    surfaces.sort_by(|left, right| {
        left.path
            .to_ascii_lowercase()
            .cmp(&right.path.to_ascii_lowercase())
    });
    surfaces
}

fn infer_risks(
    source_paths: &HashSet<String>,
    validation_commands: &[ValidationCommand],
) -> Vec<Risk> {
    let mut risks = Vec::new();
    if !source_paths.contains("PROJECT.md") {
        risks.push(Risk {
            severity: RiskSeverity::Error,
            code: "missing-project-md".to_string(),
            message: "PROJECT.md is missing; repo-local project identity has no human entry point."
                .to_string(),
        });
    }
    if !has_machine_project_manifest(source_paths) {
        risks.push(Risk {
            severity: RiskSeverity::Warning,
            code: "missing-machine-project-manifest".to_string(),
            message: "No recognized machine project manifest was found. Prefer project.manifest.json; groundatlas.project.json remains a compatibility alias; ecosystem adapters such as .doctrine/project.json are optional.".to_string(),
        });
    }
    if !has_any(source_paths, is_agent_adapter_path) {
        risks.push(Risk {
            severity: RiskSeverity::Warning,
            code: "missing-agent-adapter".to_string(),
            message: "No agent adapter was found. Prefer AGENTS.md as the tool-neutral default; tool-specific adapters are optional.".to_string(),
        });
    }
    if !source_paths.contains("README.md") {
        risks.push(Risk {
            severity: RiskSeverity::Warning,
            code: "missing-readme".to_string(),
            message: "README.md is missing; public human entry point is not explicit.".to_string(),
        });
    }
    if !has_any(source_paths, |path| path.starts_with("docs/adr/")) {
        risks.push(Risk {
            severity: RiskSeverity::Warning,
            code: "missing-adr-records".to_string(),
            message: "No docs/adr/ records were discovered; durable decisions may be buried in prose or chat.".to_string(),
        });
    }
    if !has_any(source_paths, |path| {
        path.starts_with("docs/specs/")
            || path.eq_ignore_ascii_case("design.md")
            || path.eq_ignore_ascii_case("design.mdx")
    }) {
        risks.push(Risk {
            severity: RiskSeverity::Warning,
            code: "missing-spec-or-design".to_string(),
            message: "No docs/specs/ or DESIGN.md was discovered; product intent may not be reviewable.".to_string(),
        });
    }
    if !has_any(source_paths, |path| path.starts_with(".github/workflows/")) {
        risks.push(Risk {
            severity: RiskSeverity::Warning,
            code: "missing-ci-workflows".to_string(),
            message: "No GitHub workflow was discovered; validation may rely on local discipline."
                .to_string(),
        });
    }
    if !source_paths.contains("SECURITY.md") {
        risks.push(Risk {
            severity: RiskSeverity::Warning,
            code: "missing-security-policy".to_string(),
            message: "SECURITY.md is missing; vulnerability reporting and security expectations are unclear.".to_string(),
        });
    }
    if validation_commands.is_empty() {
        risks.push(Risk {
            severity: RiskSeverity::Warning,
            code: "missing-validation-commands".to_string(),
            message: "No package or neutral manifest validation commands were discovered.".to_string(),
        });
    }
    if !has_any(source_paths, is_test_path) {
        risks.push(Risk {
            severity: RiskSeverity::Warning,
            code: "missing-tests".to_string(),
            message: "No tests were discovered in the scanned source set.".to_string(),
        });
    }
    risks
}

fn has_any<F>(source_paths: &HashSet<String>, predicate: F) -> bool
where
    F: Fn(&str) -> bool,
{
    source_paths.iter().any(|path| predicate(path))
}

fn has_machine_project_manifest(source_paths: &HashSet<String>) -> bool {
    has_any(source_paths, is_machine_project_manifest_path)
}

fn is_machine_project_manifest_path(source_path: &str) -> bool {
    MACHINE_PROJECT_MANIFEST_PATHS
        .iter()
        .any(|candidate| candidate.eq_ignore_ascii_case(source_path))
}

fn machine_manifest_name(source_path: &str) -> String {
    if source_path == ".doctrine/project.json" {
        "Machine project manifest (Doctrine adapter)".to_string()
    } else {
        "Machine project manifest".to_string()
    }
}

fn is_agent_adapter_path(source_path: &str) -> bool {
    let normalized = source_path.to_ascii_lowercase();
    AGENT_ADAPTER_PATHS
        .iter()
        .any(|candidate| candidate.eq_ignore_ascii_case(&normalized))
}

fn is_test_path(source_path: &str) -> bool {
    let base = source_path
        .rsplit('/')
        .next()
        .unwrap_or(source_path)
        .to_ascii_lowercase();
    source_path.starts_with("test/")
        || source_path.starts_with("tests/")
        || source_path.contains("/test/")
        || source_path.contains("/tests/")
        || base.contains(".test.")
        || base.contains(".spec.")
}

fn truth_home_model() -> Vec<TruthHome> {
    vec![
        TruthHome {
            domain: "Project identity and boundaries",
            owns: "What the project is, lifecycle, owner boundary, public surfaces, adoption state, and delivery proof.",
            examples: vec![
                "PROJECT.md",
                "project.manifest.json",
                "groundatlas.project.json",
                ".project/manifest.json",
                ".doctrine/project.json",
            ],
            precedence: 10,
            required_for_commercial_grade: true,
        },
        TruthHome {
            domain: "Durable decisions",
            owns: "Architecture, product, data, security, operations, or commercial decisions that must survive beyond one edit.",
            examples: vec!["docs/adr/"],
            precedence: 20,
            required_for_commercial_grade: true,
        },
        TruthHome {
            domain: "Product intent and operating contracts",
            owns: "Requirements, adoption rules, operating models, design intent, and acceptance criteria.",
            examples: vec!["docs/specs/", "DESIGN.md", "design.md"],
            precedence: 30,
            required_for_commercial_grade: true,
        },
        TruthHome {
            domain: "Machine-checkable contracts",
            owns: "Schemas, type contracts, migrations, package exports, command surfaces, and dependency boundaries.",
            examples: vec!["src/domain/types.ts", "*.schema.json", "package.json"],
            precedence: 40,
            required_for_commercial_grade: true,
        },
        TruthHome {
            domain: "Implemented behavior",
            owns: "What the product actually does at runtime.",
            examples: vec!["src/", "lib/"],
            precedence: 50,
            required_for_commercial_grade: true,
        },
        TruthHome {
            domain: "Behavior proof",
            owns: "Expected behavior, regressions, evals, validation commands, and release gates.",
            examples: vec![
                "test/",
                "tests/",
                "package.json scripts",
                ".github/workflows/",
            ],
            precedence: 60,
            required_for_commercial_grade: true,
        },
        TruthHome {
            domain: "Operations, security, and support",
            owns: "Repeatable procedures, vulnerability reporting, incident handling, and customer support expectations.",
            examples: vec!["docs/runbooks/", "SECURITY.md", "CHANGELOG.md"],
            precedence: 70,
            required_for_commercial_grade: true,
        },
    ]
}

fn infer_orientation(source_paths: &HashSet<String>) -> Vec<OrientationStep> {
    let has_project = source_paths.contains("PROJECT.md");
    let has_machine_manifest = has_machine_project_manifest(source_paths);
    let has_agent_adapter = has_any(source_paths, is_agent_adapter_path);
    let has_specs = has_any(source_paths, |path| path.starts_with("docs/specs/"));
    let has_design =
        source_paths.contains("DESIGN.md") || source_paths.contains("design.md");
    let has_adr = has_any(source_paths, |path| path.starts_with("docs/adr/"));
    let has_schema = has_any(source_paths, |path| {
        path.contains("schema") || path.ends_with(".schema.json")
    });
    let has_source = has_any(source_paths, |path| {
        path.starts_with("src/") || path.starts_with("lib/")
    });
    let has_tests = has_any(source_paths, is_test_path);
    let has_workflows = has_any(source_paths, |path| path.starts_with(".github/workflows/"));
    let has_runbooks = has_any(source_paths, |path| {
        path.starts_with("docs/runbooks/") || path.starts_with("runbooks/")
    });

    vec![
        OrientationStep {
            order: 1,
            title: "Agent adapter",
            paths: AGENT_ADAPTER_PATHS.to_vec(),
            required: true,
            present: has_agent_adapter,
            reason: "Start with local agent rules so automation follows the repository boundary.",
            ssot_role: "Runtime adapter; prefer AGENTS.md as the tool-neutral entry point and treat tool-specific files as optional adapters.",
        },
        OrientationStep {
            order: 2,
            title: "Project identity and machine manifest",
            paths: vec![
                "PROJECT.md",
                "project.manifest.json",
                "groundatlas.project.json",
                ".project/manifest.json",
                ".doctrine/project.json",
            ],
            required: true,
            present: has_project && has_machine_manifest,
            reason: "Find the project goal, lifecycle, owner boundary, public surfaces, and adoption state.",
            ssot_role: "Canonical truth for project identity and boundaries.",
        },
        OrientationStep {
            order: 3,
            title: "Public start-here documentation",
            paths: vec!["README.md"],
            required: true,
            present: source_paths.contains("README.md"),
            reason: "Read the product promise, install path, and user-facing contract.",
            ssot_role: "Canonical public entry point; lower authority than schemas, tests, ADRs, and source.",
        },
        OrientationStep {
            order: 4,
            title: "Specs and design intent",
            paths: vec!["docs/specs/", "DESIGN.md", "design.md"],
            required: true,
            present: has_specs || has_design,
            reason: "Understand intended behavior, adoption rules, and design constraints before editing.",
            ssot_role: "Canonical for intended product/operating contracts until implemented facts disagree.",
        },
        OrientationStep {
            order: 5,
            title: "Architecture and decision records",
            paths: vec!["docs/adr/"],
            required: true,
            present: has_adr,
            reason: "Find durable choices and trade-offs before inventing a new pattern.",
            ssot_role: "Canonical for durable decisions; newer ADRs supersede older conflicting prose.",
        },
        OrientationStep {
            order: 6,
            title: "Machine contracts and build surfaces",
            paths: vec![
                "package.json",
                "schemas",
                "migrations",
                "src/domain/types.ts",
            ],
            required: true,
            present: source_paths.contains("package.json") || has_schema,
            reason: "Identify commands, exports, schemas, and machine-readable contracts.",
            ssot_role: "Canonical for package, schema, API, and type contracts.",
        },
        OrientationStep {
            order: 7,
            title: "Implementation and behavior proof",
            paths: vec!["src/", "lib/", "test/", "tests/"],
            required: true,
            present: has_source && has_tests,
            reason: "Verify how the product actually behaves and what regressions are protected.",
            ssot_role: "Canonical for implemented behavior and expected behavior.",
        },
        OrientationStep {
            order: 8,
            title: "CI, release, security, and operations",
            paths: vec![
                ".github/workflows/",
                "docs/runbooks/",
                "SECURITY.md",
                "CHANGELOG.md",
            ],
            required: true,
            present: has_workflows && (has_runbooks || source_paths.contains("SECURITY.md")),
            reason: "Prove the delivery path, release gates, operational procedures, and support boundary.",
            ssot_role: "Canonical for validation automation, release operations, and support procedures.",
        },
    ]
}

fn compare_sources(left: &SourceEntry, right: &SourceEntry) -> std::cmp::Ordering {
    left.kind
        .cmp(&right.kind)
        .then_with(|| left.path.cmp(&right.path))
}

fn chrono_now_iso() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}