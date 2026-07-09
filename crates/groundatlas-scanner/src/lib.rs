//! groundatlas-scanner — ADR-168 S0 scaffold: health probe + version surface.

use std::path::Path;

use serde::Serialize;

pub const ATLAS_SCHEMA_VERSION: u32 = 2;

/// Health probe body emitted by the `health` subcommand.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct HealthBody {
    pub status: &'static str,
    pub stub: bool,
}

/// S0 scan stub body — deterministic placeholder until S1 TS parity.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ScanStubBody {
    pub schema_version: u32,
    pub stub: bool,
    pub repository: ScanStubRepository,
    pub generator: ScanStubGenerator,
    pub risks: Vec<ScanStubRisk>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ScanStubRepository {
    pub name: String,
    pub root: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ScanStubGenerator {
    pub name: &'static str,
    pub version: &'static str,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ScanStubRisk {
    pub severity: &'static str,
    pub code: &'static str,
    pub message: String,
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

/// Build the S0 scan stub for a repository root (no filesystem walk yet).
#[must_use]
pub fn scan_stub_body(cwd: &Path, output_dir: &str) -> ScanStubBody {
    let root = cwd
        .canonicalize()
        .unwrap_or_else(|_| cwd.to_path_buf())
        .display()
        .to_string();
    let name = cwd
        .file_name()
        .and_then(|segment| segment.to_str())
        .unwrap_or("repository")
        .to_string();

    ScanStubBody {
        schema_version: ATLAS_SCHEMA_VERSION,
        stub: true,
        repository: ScanStubRepository { name, root },
        generator: ScanStubGenerator {
            name: "groundatlas-scanner",
            version: env!("CARGO_PKG_VERSION"),
        },
        risks: vec![ScanStubRisk {
            severity: "warning",
            code: "rust-scan-stub",
            message: format!(
                "Rust scanner S0 stub for output dir `{output_dir}`; TS scanner remains authority until S1 parity."
            ),
        }],
    }
}

/// Serialize scan stub JSON for CLI delegation.
#[must_use]
pub fn scan_stub_json(cwd: &Path, output_dir: &str) -> String {
    match serde_json::to_string(&scan_stub_body(cwd, output_dir)) {
        Ok(json) => json,
        Err(error) => panic!("serialize scan stub json: {error}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_body_is_ok_stub() {
        let body = health_body();
        assert_eq!(body.status, "ok");
        assert!(body.stub);
    }

    #[test]
    fn health_json_round_trips() {
        let json = health_json();
        assert!(json.contains(r#""status":"ok""#));
        assert!(json.contains(r#""stub":true"#));
    }

    #[test]
    fn scan_stub_marks_schema_and_warning() {
        let body = scan_stub_body(Path::new("."), ".groundatlas");
        assert_eq!(body.schema_version, ATLAS_SCHEMA_VERSION);
        assert!(body.stub);
        assert_eq!(body.generator.name, "groundatlas-scanner");
        assert_eq!(body.risks[0].code, "rust-scan-stub");
    }

    #[test]
    fn scan_stub_json_round_trips() {
        let json = scan_stub_json(Path::new("."), ".groundatlas");
        assert!(json.contains(r#""schema_version":2"#));
        assert!(json.contains(r#""stub":true"#));
        assert!(json.contains(r#""code":"rust-scan-stub""#));
    }
}
