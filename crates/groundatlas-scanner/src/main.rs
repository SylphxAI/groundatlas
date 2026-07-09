//! groundatlas-scanner binary — S0 `health` + `scan` stub + `--version`.

use std::io::{self, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use groundatlas_scanner::{health_json, scan_stub_json};

#[derive(Parser)]
#[command(
    name = "groundatlas-scanner",
    version,
    about = "GroundAtlas Rust scanner CLI (ADR-168 S0 health + scan stub + version)"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Dependency-free health probe (S0).
    Health,
    /// Deterministic scan stub for npm CLI delegation (S0; S1 adds parity).
    Scan {
        /// Repository root to scan.
        #[arg(long, default_value = ".")]
        cwd: PathBuf,
        /// GroundAtlas output directory name.
        #[arg(long, default_value = ".groundatlas")]
        output_dir: String,
    },
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match cli.command {
        Some(Command::Health) => write_stdout(&health_json()),
        Some(Command::Scan { cwd, output_dir }) => write_stdout(&scan_stub_json(&cwd, &output_dir)),
        None => {
            eprintln!("groundatlas-scanner: no subcommand specified; use `health`, `scan`, or `--help`");
            ExitCode::from(2)
        }
    }
}

fn write_stdout(payload: &str) -> ExitCode {
    if let Err(error) = writeln!(io::stdout(), "{payload}") {
        eprintln!("write stdout: {error}");
        return ExitCode::from(1);
    }
    ExitCode::SUCCESS
}
