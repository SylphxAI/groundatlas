//! S1 parity: Rust scan must match TS golden baseline on `test/fixtures/basic`.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use groundatlas_scanner::{scan_repository_json, ScanOptions};
use serde_json::Value;

const GENERATED_AT: &str = "2026-01-01T00:00:00.000Z";
const GENERATOR_VERSION: &str = "0.1.3";
const FIXTURE_GIT_COMMIT_DATE: &str = "2026-01-01T00:00:00Z";

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn golden_path() -> PathBuf {
    repo_root().join("test/fixtures/basic/atlas.golden.json")
}

fn load_golden() -> Value {
    let path = golden_path();
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("read golden atlas {}: {error}", path.display()));
    serde_json::from_str(&raw)
        .unwrap_or_else(|error| panic!("parse golden atlas {}: {error}", path.display()))
}

fn prepare_fixture() -> PathBuf {
    let temp_root = std::env::temp_dir().join(format!(
        "groundatlas-rust-parity-{}",
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

#[test]
fn rust_scan_matches_ts_golden_on_prepared_basic_fixture() {
    let fixture_root = prepare_fixture();
    let golden = load_golden();

    let rust_json = scan_repository_json(ScanOptions {
        cwd: &fixture_root,
        output_dir: ".groundatlas",
        generated_at: Some(GENERATED_AT),
        generator_version: Some(GENERATOR_VERSION),
    })
    .expect("rust scan must succeed");

    let mut rust_value: Value =
        serde_json::from_str(&rust_json).expect("rust scan output must be valid json");

    let root = fixture_root.display().to_string();
    normalize_root(&mut rust_value, &root);
    let mut expected = golden;
    normalize_root(&mut expected, &root);

    assert_eq!(
        rust_value, expected,
        "Rust scan diverged from TS golden baseline"
    );

    if let Some(parent) = fixture_root.parent() {
        let _ = fs::remove_dir_all(parent);
    }
}