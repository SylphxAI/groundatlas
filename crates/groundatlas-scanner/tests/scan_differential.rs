//! TRUE differential parity: TS scan oracle vs native Rust SSOT.
//!
//! Fail-closed — no SKIP-as-pass. Oracle subprocess must succeed before comparison.
//! See scripts/run-groundatlas-differential.sh and rej-010 re-audit.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use groundatlas_scanner::{scan_repository_json, ScanOptions};
use serde::Deserialize;
use serde_json::Value;

const GENERATED_AT: &str = "2026-01-01T00:00:00.000Z";
const GENERATOR_VERSION: &str = "0.1.3";
const FIXTURE_GIT_COMMIT_DATE: &str = "2026-01-01T00:00:00Z";

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn corpus_fixture_path() -> PathBuf {
    repo_root().join("scripts/differential/fixtures/basic-scan-corpus.json")
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
    golden_baseline_hash: String,
    cases: Vec<OracleCase>,
}

fn run_ts_oracle() -> OracleCorpus {
    if let Ok(path) = std::env::var("GROUNDATLAS_ORACLE_JSON") {
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("read oracle at {path}: {error}"));
        return serde_json::from_str(&raw).expect("oracle file must be valid JSON");
    }

    let script = repo_root().join("scripts/differential/scan-oracle.ts");
    let output = Command::new("bun")
        .arg("run")
        .arg(&script)
        .current_dir(repo_root())
        .output()
        .unwrap_or_else(|error| panic!("spawn TS scan oracle at {}: {error}", script.display()));

    assert!(
        output.status.success(),
        "TS scan oracle failed:\nstdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    serde_json::from_slice(&output.stdout).expect("oracle output must be valid JSON")
}

fn prepare_fixture() -> PathBuf {
    let temp_root = std::env::temp_dir().join(format!(
        "groundatlas-scan-differential-{}",
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

fn normalize_root(value: &mut Value, root: &str) {
    if let Some(repository) = value.get_mut("repository").and_then(Value::as_object_mut) {
        repository.insert("root".to_string(), Value::String(root.to_string()));
    }
}

fn compare_scan_case(case: &OracleCase) {
    assert_eq!(case.domain, "scan", "unexpected oracle domain for {}", case.id);

    let fixture_root = prepare_fixture();
    let output_dir = case.input["outputDir"]
        .as_str()
        .unwrap_or(".groundatlas");

    let rust_json = scan_repository_json(ScanOptions {
        cwd: &fixture_root,
        output_dir,
        generated_at: Some(GENERATED_AT),
        generator_version: Some(GENERATOR_VERSION),
    })
    .unwrap_or_else(|error| panic!("rust scan must succeed for {}: {error}", case.id));

    let mut rust_value: Value =
        serde_json::from_str(&rust_json).expect("rust scan output must be valid json");
    let root = fixture_root.display().to_string();
    normalize_root(&mut rust_value, &root);

    let mut expected_atlas = case.output["atlas"].clone();
    normalize_root(&mut expected_atlas, &root);
    assert_eq!(
        rust_value, expected_atlas,
        "Rust scan diverged from TS oracle for case {}",
        case.id
    );

    let golden_hash = sha256_file(
        &repo_root().join("test/fixtures/basic/atlas.golden.json"),
    );
    let expected_golden_hash = case.output["goldenBaselineHash"]
        .as_str()
        .expect("goldenBaselineHash");
    assert_eq!(
        golden_hash, expected_golden_hash,
        "golden baseline hash drift for case {}",
        case.id
    );

    if let Some(parent) = fixture_root.parent() {
        let _ = fs::remove_dir_all(parent);
    }
}

fn sha256_file(path: &Path) -> String {
    use sha2::{Digest, Sha256};
    let raw = fs::read(path).unwrap_or_else(|error| panic!("read {}: {error}", path.display()));
    let digest = Sha256::digest(raw);
    format!("{digest:x}")
}

#[test]
fn scan_differential_matches_ts_oracle_on_basic_fixture() {
    let _corpus_fixture = corpus_fixture_path();
    assert!(
        _corpus_fixture.is_file(),
        "missing behavior spec at {}",
        _corpus_fixture.display()
    );

    let oracle = run_ts_oracle();
    assert!(
        !oracle.cases.is_empty(),
        "oracle must emit at least one scan case"
    );
    assert!(
        !oracle.fixture_corpus_hash.is_empty(),
        "oracle must bind fixtureCorpusHash"
    );
    assert!(
        !oracle.golden_baseline_hash.is_empty(),
        "oracle must bind goldenBaselineHash"
    );

    for case in &oracle.cases {
        compare_scan_case(case);
    }
}