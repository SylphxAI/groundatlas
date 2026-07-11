//! TRUE differential parity: TS audit freshness oracle vs native Rust SSOT.
//!
//! Fail-closed — no SKIP-as-pass. Oracle subprocess must succeed before comparison.
//! See scripts/run-groundatlas-differential.sh and rej-010 re-audit.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use groundatlas_scanner::{freshness_fingerprint, scan_repository, ScanOptions};
use serde::Deserialize;
use serde_json::Value;

const GENERATED_AT: &str = "2026-01-01T00:00:00.000Z";
const GENERATOR_VERSION: &str = "0.1.3";
const FIXTURE_GIT_COMMIT_DATE: &str = "2026-01-01T00:00:00Z";

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn corpus_fixture_path() -> PathBuf {
    repo_root().join("scripts/differential/fixtures/basic-audit-corpus.json")
}

#[derive(Debug, Deserialize)]
struct OracleCase {
    id: String,
    domain: String,
    input: Value,
    output: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OracleCorpus {
    corpus_version: u32,
    fixture_corpus_hash: String,
    cases: Vec<OracleCase>,
}

#[derive(Debug, Deserialize)]
struct AuditMutation {
    path: String,
    content: String,
}

fn run_ts_oracle() -> OracleCorpus {
    if let Ok(path) = std::env::var("GROUNDATLAS_AUDIT_ORACLE_JSON") {
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("read audit oracle at {path}: {error}"));
        return serde_json::from_str(&raw).expect("audit oracle file must be valid JSON");
    }

    let script = repo_root().join("scripts/differential/audit-oracle.ts");
    let output = Command::new("bun")
        .arg("run")
        .arg(&script)
        .current_dir(repo_root())
        .output()
        .unwrap_or_else(|error| panic!("spawn TS audit oracle at {}: {error}", script.display()));

    assert!(
        output.status.success(),
        "TS audit oracle failed:\nstdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    serde_json::from_slice(&output.stdout).expect("audit oracle output must be valid JSON")
}

fn prepare_fixture() -> PathBuf {
    let temp_root = std::env::temp_dir().join(format!(
        "groundatlas-audit-differential-{}",
        std::process::id()
    ));
    let fixture_root = temp_root.join("fixture");
    if fixture_root.exists() {
        fs::remove_dir_all(&fixture_root).expect("remove stale fixture");
    }
    fs::create_dir_all(&fixture_root).expect("create fixture dir");

    let basic = repo_root().join("test/fixtures/basic");
    copy_dir_recursive(&basic, &fixture_root).expect("copy basic fixture");
    fs::write(fixture_root.join(".env"), "SHOULD_NOT_BE_SCANNED=secret\n").expect("write secret");

    run_git(&fixture_root, &["init", "-b", "main"]);
    run_git(&fixture_root, &["add", "."]);
    run_git_with_dates(
        &fixture_root,
        &[
            "-c",
            "user.email=test@example.com",
            "-c",
            "user.name=Test",
            "commit",
            "-m",
            "init",
        ],
    );

    fixture_root
}

const EXCLUDED_SCAN_BASELINE: &str = "atlas.golden.json";

fn copy_dir_recursive(source: &Path, destination: &Path) -> std::io::Result<()> {
    fs::create_dir_all(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        if entry.file_name() == EXCLUDED_SCAN_BASELINE {
            continue;
        }
        let target = destination.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

fn run_git(cwd: &Path, args: &[&str]) {
    let status = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .status()
        .unwrap_or_else(|error| panic!("spawn git {args:?} in {}: {error}", cwd.display()));
    assert!(status.success(), "git {args:?} failed in {}", cwd.display());
}

fn run_git_with_dates(cwd: &Path, args: &[&str]) {
    let status = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .env("GIT_AUTHOR_DATE", FIXTURE_GIT_COMMIT_DATE)
        .env("GIT_COMMITTER_DATE", FIXTURE_GIT_COMMIT_DATE)
        .status()
        .unwrap_or_else(|error| panic!("spawn git {args:?} in {}: {error}", cwd.display()));
    assert!(status.success(), "git {args:?} failed in {}", cwd.display());
}

fn scan_fixture(fixture_root: &Path, output_dir: &str) -> groundatlas_scanner::AtlasMap {
    scan_repository(ScanOptions {
        cwd: fixture_root,
        output_dir,
        generated_at: Some(GENERATED_AT),
        generator_version: Some(GENERATOR_VERSION),
    })
    .unwrap_or_else(|error| panic!("rust scan must succeed in {}: {error}", fixture_root.display()))
}

fn compare_audit_case(case: &OracleCase) {
    assert_eq!(
        case.domain, "audit",
        "unexpected oracle domain for {}",
        case.id
    );

    let fixture_root = prepare_fixture();
    let output_dir = case.input["outputDir"]
        .as_str()
        .unwrap_or(".groundatlas");

    let baseline_atlas = scan_fixture(&fixture_root, output_dir);
    let baseline_fingerprint = freshness_fingerprint(&baseline_atlas);

    let expected_baseline = case.output["baselineFingerprint"]
        .as_str()
        .expect("baselineFingerprint");
    assert_eq!(
        baseline_fingerprint, expected_baseline,
        "Rust baseline freshness diverged from TS oracle for case {}",
        case.id
    );

    let mut current_fingerprint = baseline_fingerprint.clone();
    let mut is_stale = false;

    if !case.input["mutation"].is_null() {
        let mutation: AuditMutation =
            serde_json::from_value(case.input["mutation"].clone()).expect("audit mutation shape");
        fs::write(fixture_root.join(&mutation.path), &mutation.content)
            .unwrap_or_else(|error| panic!("write mutation for {}: {error}", case.id));

        let current_atlas = scan_fixture(&fixture_root, output_dir);
        current_fingerprint = freshness_fingerprint(&current_atlas);
        is_stale = baseline_fingerprint != current_fingerprint;
    }

    let expected_current = case.output["currentFingerprint"]
        .as_str()
        .expect("currentFingerprint");
    let expected_is_stale = case.output["isStale"].as_bool().expect("isStale");

    assert_eq!(
        current_fingerprint, expected_current,
        "Rust current freshness diverged from TS oracle for case {}",
        case.id
    );
    assert_eq!(
        is_stale, expected_is_stale,
        "Rust stale detection diverged from TS oracle for case {}",
        case.id
    );

    if let Some(parent) = fixture_root.parent() {
        let _ = fs::remove_dir_all(parent);
    }
}

#[test]
fn audit_differential_matches_ts_oracle_on_basic_fixture() {
    let corpus_fixture = corpus_fixture_path();
    assert!(
        corpus_fixture.is_file(),
        "missing behavior spec at {}",
        corpus_fixture.display()
    );

    let oracle = run_ts_oracle();
    assert!(
        !oracle.cases.is_empty(),
        "audit oracle must emit at least one case"
    );
    assert!(
        !oracle.fixture_corpus_hash.is_empty(),
        "audit oracle must bind fixtureCorpusHash"
    );

    for case in &oracle.cases {
        compare_audit_case(case);
    }
}