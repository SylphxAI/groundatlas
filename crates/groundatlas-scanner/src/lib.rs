//! groundatlas-scanner — ADR-168 Rust scanner (S0 health + S1 scan parity).

mod audit;
mod classify;
mod explain;
mod fs;
mod git;
mod scan;
mod types;

pub use audit::freshness_fingerprint;
pub use explain::explain_query;
pub use scan::{scan_repository, scan_repository_json, ScanError};
pub use types::{
    health_body, health_json, AtlasMap, HealthBody, ScanOptions, SourceEntry, ATLAS_SCHEMA_VERSION,
};

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

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
    fn scan_basic_fixture_has_expected_sources() {
        let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/basic");
        let atlas = scan_repository(ScanOptions {
            cwd: &fixture,
            output_dir: ".groundatlas",
            generated_at: Some("2026-01-01T00:00:00.000Z"),
            generator_version: Some("0.1.3"),
        })
        .expect("scan basic fixture");

        assert_eq!(atlas.schema_version, ATLAS_SCHEMA_VERSION);
        assert_eq!(atlas.repository.name, "fixture-basic");
        assert!(
            atlas
                .sources
                .iter()
                .any(|source| source.path == "PROJECT.md")
        );
        assert!(!atlas.sources.iter().any(|source| source.path == ".env"));
    }
}