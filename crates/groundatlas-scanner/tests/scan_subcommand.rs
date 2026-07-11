use std::process::Command;

#[test]
fn scan_subcommand_emits_atlas_map_json_with_schema_version() {
    let binary = env!("CARGO_BIN_EXE_groundatlas-scanner");
    let fixture = format!(
        "{}/../../test/fixtures/basic",
        env!("CARGO_MANIFEST_DIR")
    );
    let output = Command::new(binary)
        .args([
            "scan",
            "--cwd",
            &fixture,
            "--output-dir",
            ".groundatlas",
            "--generated-at",
            "2026-01-01T00:00:00.000Z",
            "--generator-version",
            "0.1.3",
        ])
        .output()
        .expect("binary must execute");

    assert!(
        output.status.success(),
        "scan failed: stderr={}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""schemaVersion":2"#));
    assert!(stdout.contains(r#""name":"GroundAtlas""#));
    assert!(stdout.contains(r#""name":"fixture-basic""#));
    assert!(!stdout.contains(r#""stub":true"#));
}