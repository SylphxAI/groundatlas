//! groundatlas-scanner binary — S0 `health` subcommand + `--version`.

use std::io::{self, Write};
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use groundatlas_scanner::health_json;

#[derive(Parser)]
#[command(name = "groundatlas-scanner", version, about = "GroundAtlas Rust scanner CLI (ADR-168 S0 health + version)")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Dependency-free health probe (S0).
    Health,
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match cli.command {
        Some(Command::Health) => {
            if let Err(error) = writeln!(io::stdout(), "{}", health_json()) {
                eprintln!("write health: {error}");
                return ExitCode::from(1);
            }
            ExitCode::SUCCESS
        }
        None => {
            eprintln!("groundatlas-scanner: no subcommand specified; use `health` or `--help`");
            ExitCode::from(2)
        }
    }
}
