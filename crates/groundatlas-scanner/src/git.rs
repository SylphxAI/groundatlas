//! Git state probe — parity with `src/infrastructure/git.ts`.

use std::path::Path;
use std::process::Command;

use crate::types::GitState;

pub fn read_git_state(cwd: &Path) -> GitState {
    GitState {
        branch: git(cwd, &["branch", "--show-current"]),
        head: git(cwd, &["rev-parse", "HEAD"]),
        is_dirty: git(cwd, &["status", "--porcelain"])
            .map(|status| !status.is_empty())
            .unwrap_or(false),
        remote: git(cwd, &["remote", "get-url", "origin"]),
    }
}

fn git(cwd: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git").args(args).current_dir(cwd).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8(output.stdout).ok()?;
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}