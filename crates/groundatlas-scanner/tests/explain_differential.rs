//! TRUE differential parity: TS explain oracle vs native Rust `explain_query` SSOT.
//!
//! Fail-closed — no SKIP-as-pass. Oracle subprocess must succeed before comparison.
//! Bounded slice: `cli/explain` (rej-010 cycle51).

use std::fs;
use std::path::PathBuf;
use std::process::Command;

use groundatlas_scanner::{explain_query, AtlasMap, SourceEntry};
use serde::Deserialize;
use serde_json::Value;

const EXPLAIN_SLICE: &str = "cli/explain";

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn corpus_fixture_path() -> PathBuf {
    repo_root().join("scripts/differential/fixtures/basic-explain-corpus.json")
}

#[derive(Debug, Deserialize)]
struct OracleCase {
    id: String,
    slice: String,
    domain: String,
    input: Value,
    output: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OracleCorpus {
    corpus_version: u32,
    fixture_corpus_hash: String,
    atlas_golden_hash: String,
    cases: Vec<OracleCase>,
}

fn run_ts_oracle() -> OracleCorpus {
    if let Ok(path) = std::env::var("GROUNDATLAS_EXPLAIN_ORACLE_JSON") {
        let raw = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("read explain oracle at {path}: {error}"));
        return serde_json::from_str(&raw).expect("explain oracle file must be valid JSON");
    }

    let script = repo_root().join("scripts/differential/explain-oracle.ts");
    let output = Command::new("bun")
        .arg("run")
        .arg(&script)
        .current_dir(repo_root())
        .output()
        .unwrap_or_else(|error| panic!("spawn TS explain oracle at {}: {error}", script.display()));

    assert!(
        output.status.success(),
        "TS explain oracle failed:\nstdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    serde_json::from_slice(&output.stdout).expect("explain oracle output must be valid JSON")
}

fn load_atlas_sources() -> Vec<SourceEntry> {
    let atlas_path = repo_root().join("test/fixtures/basic/atlas.golden.json");
    let raw = fs::read_to_string(&atlas_path).expect("read atlas golden");
    let atlas: AtlasMap = serde_json::from_str(&raw).expect("parse atlas golden");
    atlas.sources
}

fn compare_explain_case(case: &OracleCase, sources: &[SourceEntry]) {
    let query = case.input["query"].as_str().expect("query");
    let matches = explain_query(sources, query);
    let native_paths: Vec<&str> = matches.iter().map(|entry| entry.path.as_str()).collect();
    let expected: Vec<String> = case.output["paths"]
        .as_array()
        .expect("paths array")
        .iter()
        .map(|value| value.as_str().expect("path string").to_string())
        .collect();
    let expected_refs: Vec<&str> = expected.iter().map(String::as_str).collect();
    assert_eq!(
        native_paths, expected_refs,
        "explain case {} query {:?}",
        case.id, query
    );
}

#[test]
fn cli_explain_differential_matches_ts_oracle() {
    let _ = fs::read_to_string(corpus_fixture_path()).expect("read explain corpus fixture");
    let oracle = run_ts_oracle();
    assert_eq!(oracle.corpus_version, 1);
    assert!(!oracle.fixture_corpus_hash.is_empty());
    assert!(!oracle.atlas_golden_hash.is_empty());

    let cases: Vec<&OracleCase> = oracle
        .cases
        .iter()
        .filter(|case| case.slice == EXPLAIN_SLICE)
        .collect();
    assert!(
        cases.len() >= 5,
        "cli/explain must have at least 5 oracle cases, got {}",
        cases.len()
    );

    let sources = load_atlas_sources();
    for case in cases {
        assert_eq!(case.domain, "explain-query");
        compare_explain_case(case, &sources);
    }
}