use std::process::Command;

#[test]
fn scan_subcommand_emits_stub_json_with_schema_version() {
    let binary = env!("CARGO_BIN_EXE_groundatlas-scanner");
    let output = Command::new(binary)
        .args(["scan", "--cwd", ".", "--output-dir", ".groundatlas"])
        .output()
        .expect("binary must execute");

    assert!(
        output.status.success(),
        "scan failed: stderr={}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""schema_version":2"#));
    assert!(stdout.contains(r#""stub":true"#));
    assert!(stdout.contains(r#""code":"rust-scan-stub""#));
    assert!(stdout.contains(r#""name":"groundatlas-scanner""#));
}