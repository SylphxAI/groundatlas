//! Atlas map types — camelCase JSON parity with `src/domain/types.ts`.

use serde::de::Deserializer;
use serde::{Deserialize, Serialize};

fn leak_str(value: String) -> &'static str {
    Box::leak(value.into_boxed_str())
}

fn leak_str_vec(values: Vec<String>) -> Vec<&'static str> {
    values.into_iter().map(leak_str).collect()
}

pub const ATLAS_SCHEMA_VERSION: u32 = 2;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct HealthBody {
    pub status: &'static str,
    pub stub: bool,
}

/// Build the S0 health response (dependency-free).
#[must_use]
pub fn health_body() -> HealthBody {
    HealthBody {
        status: "ok",
        stub: true,
    }
}

/// Serialize health JSON to stdout (no trailing newline required by contract).
#[must_use]
pub fn health_json() -> String {
    match serde_json::to_string(&health_body()) {
        Ok(json) => json,
        Err(error) => panic!("serialize health json: {error}"),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AtlasMap {
    pub schema_version: u32,
    pub generated_at: String,
    pub generator: Generator,
    pub repository: RepoIdentity,
    pub policy: Policy,
    pub truth: Truth,
    pub orientation: Vec<OrientationStep>,
    pub sources: Vec<SourceEntry>,
    pub public_surfaces: Vec<PublicSurface>,
    pub validation_commands: Vec<ValidationCommand>,
    pub risks: Vec<Risk>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Generator {
    pub name: &'static str,
    pub version: String,
}

impl<'de> Deserialize<'de> for Generator {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct Helper {
            name: String,
            version: String,
        }

        let helper = Helper::deserialize(deserializer)?;
        Ok(Self {
            name: leak_str(helper.name),
            version: helper.version,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepoIdentity {
    pub name: String,
    pub root: String,
    pub git: GitState,
    pub package_manager: PackageManager,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitState {
    pub branch: Option<String>,
    pub head: Option<String>,
    pub is_dirty: bool,
    pub remote: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PackageManager {
    Bun,
    Pnpm,
    Npm,
    Yarn,
    Unknown,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Policy {
    pub generated_docs_are_not_ssot: bool,
    pub canonical_truth_lives_in: Vec<&'static str>,
    pub write_boundary: String,
}

impl<'de> Deserialize<'de> for Policy {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Helper {
            generated_docs_are_not_ssot: bool,
            canonical_truth_lives_in: Vec<String>,
            write_boundary: String,
        }

        let helper = Helper::deserialize(deserializer)?;
        Ok(Self {
            generated_docs_are_not_ssot: helper.generated_docs_are_not_ssot,
            canonical_truth_lives_in: leak_str_vec(helper.canonical_truth_lives_in),
            write_boundary: helper.write_boundary,
        })
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Truth {
    pub model: &'static str,
    pub conflict_rule: &'static str,
    pub generated_artifacts_are: &'static str,
    pub homes: Vec<TruthHome>,
}

impl<'de> Deserialize<'de> for Truth {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Helper {
            model: String,
            conflict_rule: String,
            generated_artifacts_are: String,
            homes: Vec<TruthHome>,
        }

        let helper = Helper::deserialize(deserializer)?;
        Ok(Self {
            model: leak_str(helper.model),
            conflict_rule: leak_str(helper.conflict_rule),
            generated_artifacts_are: leak_str(helper.generated_artifacts_are),
            homes: helper.homes,
        })
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TruthHome {
    pub domain: &'static str,
    pub owns: &'static str,
    pub examples: Vec<&'static str>,
    pub precedence: u32,
    pub required_for_commercial_grade: bool,
}

impl<'de> Deserialize<'de> for TruthHome {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Helper {
            domain: String,
            owns: String,
            examples: Vec<String>,
            precedence: u32,
            required_for_commercial_grade: bool,
        }

        let helper = Helper::deserialize(deserializer)?;
        Ok(Self {
            domain: leak_str(helper.domain),
            owns: leak_str(helper.owns),
            examples: leak_str_vec(helper.examples),
            precedence: helper.precedence,
            required_for_commercial_grade: helper.required_for_commercial_grade,
        })
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OrientationStep {
    pub order: u32,
    pub title: &'static str,
    pub paths: Vec<&'static str>,
    pub required: bool,
    pub present: bool,
    pub reason: &'static str,
    pub ssot_role: &'static str,
}

impl<'de> Deserialize<'de> for OrientationStep {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Helper {
            order: u32,
            title: String,
            paths: Vec<String>,
            required: bool,
            present: bool,
            reason: String,
            ssot_role: String,
        }

        let helper = Helper::deserialize(deserializer)?;
        Ok(Self {
            order: helper.order,
            title: leak_str(helper.title),
            paths: leak_str_vec(helper.paths),
            required: helper.required,
            present: helper.present,
            reason: leak_str(helper.reason),
            ssot_role: leak_str(helper.ssot_role),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SourceEntry {
    pub path: String,
    pub kind: SourceKind,
    pub reason: String,
    pub canonical: bool,
    pub size_bytes: u64,
    pub content_sha256: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "kebab-case")]
pub enum SourceKind {
    Adr,
    AgentAdapter,
    BuildConfig,
    CiWorkflow,
    DesignDoc,
    Documentation,
    GeneratedMap,
    GithubAction,
    License,
    PackageManifest,
    ProjectManifest,
    Runbook,
    Schema,
    SecurityPolicy,
    Source,
    Spec,
    Test,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PublicSurface {
    pub name: String,
    #[serde(rename = "type")]
    pub surface_type: PublicSurfaceType,
    pub path: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PublicSurfaceType {
    Cli,
    Docs,
    GithubAction,
    Manifest,
    Package,
    Schema,
    Workflow,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ValidationCommand {
    pub command: String,
    pub source: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Risk {
    pub severity: RiskSeverity,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RiskSeverity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone)]
pub struct ScanOptions<'a> {
    pub cwd: &'a std::path::Path,
    pub output_dir: &'a str,
    pub generated_at: Option<&'a str>,
    pub generator_version: Option<&'a str>,
}