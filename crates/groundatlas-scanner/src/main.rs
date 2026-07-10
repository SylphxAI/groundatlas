//! groundatlas-scanner binary — S0 `health` + S1 `scan` + `--version`.

use std::io::{self, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use groundatlas_scanner::{health_json, scan_repository_json, ScanOptions};

#[derive(Parser)]
#[command(
    name = "groundatlas-scanner",
    version,
    about = "GroundAtlas Rust scanner CLI (ADR-168 S1 scan parity)"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Dependency-free health probe (S0).
    Health,
    /// Deterministic repository scan (S1 TS parity on fixture corpus).
    Scan {
        /// Repository root to scan.
        #[arg(long, default_value = ".")]
        cwd: PathBuf,
        /// GroundAtlas output directory name.
        #[arg(long, default_value = ".groundatlas")]
        output_dir: String,
        /// Fixed RFC3339 timestamp for deterministic parity tests.
        #[arg(long)]
        generated_at: Option<String>,
        /// Generator version override (defaults to crate version).
        #[arg(long)]
        generator_version: Option<String>,
    },
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match cli.command {
        Some(Command::Health) => write_stdout(&health_json()),
        Some(Command::Scan {
            cwd,
            output_dir,
            generated_at,
            generator_version,
        }) => match scan_repository_json(ScanOptions {
            cwd: &cwd,
            output_dir: &output_dir,
            generated_at: generated_at.as_deref(),
            generator_version: generator_version.as_deref(),
        }) {
            Ok(json) => write_stdout(&json),
            Err(error) => {
                eprintln!("scan failed: {error}");
                ExitCode::from(1)
            }
        },
        None => {
            eprintln!(
                "groundatlas-scanner: no subcommand specified; use `health`, `scan`, or `--help`"
            );
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