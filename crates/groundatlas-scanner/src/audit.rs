//! Audit freshness helpers — parity with `src/application/audit.ts#freshnessFingerprint`.

use serde::Serialize;

use crate::types::AtlasMap;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FreshnessRepository<'a> {
    name: &'a str,
    package_manager: crate::types::PackageManager,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FreshnessPayload<'a> {
    schema_version: u32,
    generator: &'a crate::types::Generator,
    repository: FreshnessRepository<'a>,
    policy: &'a crate::types::Policy,
    truth: &'a crate::types::Truth,
    orientation: &'a [crate::types::OrientationStep],
    sources: &'a [crate::types::SourceEntry],
    public_surfaces: &'a [crate::types::PublicSurface],
    validation_commands: &'a [crate::types::ValidationCommand],
    risks: &'a [crate::types::Risk],
}

/// Deterministic freshness fingerprint used by `ga audit` stale-atlas detection.
///
/// Field selection and key order mirror `freshnessFingerprint()` in `audit.ts`.
#[must_use]
pub fn freshness_fingerprint(atlas: &AtlasMap) -> String {
    let payload = FreshnessPayload {
        schema_version: atlas.schema_version,
        generator: &atlas.generator,
        repository: FreshnessRepository {
            name: &atlas.repository.name,
            package_manager: atlas.repository.package_manager,
        },
        policy: &atlas.policy,
        truth: &atlas.truth,
        orientation: &atlas.orientation,
        sources: &atlas.sources,
        public_surfaces: &atlas.public_surfaces,
        validation_commands: &atlas.validation_commands,
        risks: &atlas.risks,
    };

    serde_json::to_string(&payload).unwrap_or_else(|error| {
        panic!("serialize freshness fingerprint: {error}");
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scan::scan_repository;
    use crate::ScanOptions;
    use std::path::Path;

    #[test]
    fn freshness_fingerprint_is_stable_on_basic_fixture() {
        let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/basic");
        let atlas = scan_repository(ScanOptions {
            cwd: &fixture,
            output_dir: ".groundatlas",
            generated_at: Some("2026-01-01T00:00:00.000Z"),
            generator_version: Some("0.1.3"),
        })
        .expect("scan basic fixture");

        let first = freshness_fingerprint(&atlas);
        let second = freshness_fingerprint(&atlas);
        assert_eq!(first, second);
        assert!(first.contains(r#""schemaVersion":2"#));
        assert!(first.contains(r#""packageManager":"unknown""#));
    }
}