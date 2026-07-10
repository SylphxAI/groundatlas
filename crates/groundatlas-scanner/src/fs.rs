//! Filesystem walk + secret-path filtering — parity with `src/infrastructure/fs.ts`.

use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::Path;

use sha2::{Digest, Sha256};

#[derive(Debug, Clone)]
pub struct FileEntry {
    pub path: String,
    pub size_bytes: u64,
    pub content_sha256: String,
}

const DEFAULT_EXCLUDES: &[&str] = &[
    ".git",
    ".hg",
    ".svn",
    ".DS_Store",
    ".cache",
    ".next",
    ".turbo",
    ".vercel",
    "coverage",
    "dist",
    "dist-types",
    "build",
    "node_modules",
    "vendor",
];

pub fn is_secret_path(relative_path: &str) -> bool {
    let normalized = relative_path.to_ascii_lowercase();
    let base = normalized
        .rsplit('/')
        .next()
        .unwrap_or(normalized.as_str())
        .to_string();

    if base == ".env" || base.starts_with(".env.") {
        return !(base.ends_with(".example")
            || base.ends_with(".sample")
            || base.ends_with(".template"));
    }

    normalized.contains("/secrets/")
        || normalized.contains("/private/")
        || base.contains("id_rsa")
        || base.contains("id_ed25519")
        || base.ends_with(".pem")
        || base.ends_with(".key")
        || base.ends_with(".p12")
        || base.ends_with(".pfx")
}

pub fn walk_files(root: &Path, output_dir: &str) -> Result<Vec<FileEntry>, std::io::Error> {
    let excludes: HashSet<&str> = DEFAULT_EXCLUDES.iter().copied().collect();
    let mut files = Vec::new();
    visit(
        root,
        root,
        "",
        output_dir,
        &excludes,
        &mut files,
    )?;
    Ok(files)
}

fn visit(
    root: &Path,
    directory: &Path,
    relative_directory: &str,
    output_dir: &str,
    excludes: &HashSet<&str>,
    files: &mut Vec<FileEntry>,
) -> Result<(), std::io::Error> {
    let mut entries: Vec<_> = fs::read_dir(directory)?.filter_map(Result::ok).collect();
    entries.sort_by(|left, right| left.file_name().cmp(&right.file_name()));

    for entry in entries {
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();
        let relative_path = if relative_directory.is_empty() {
            file_name.to_string()
        } else {
            format!("{relative_directory}/{file_name}")
        };

        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            if excludes.contains(file_name.as_ref()) || relative_path == output_dir {
                continue;
            }
            visit(
                root,
                &entry.path(),
                &relative_path,
                output_dir,
                excludes,
                files,
            )?;
            continue;
        }

        if !file_type.is_file() || is_secret_path(&relative_path) {
            continue;
        }

        let absolute_path = root.join(&relative_path);
        let metadata = fs::metadata(&absolute_path)?;
        let content_sha256 = sha256_file(&absolute_path)?;
        files.push(FileEntry {
            path: relative_path,
            size_bytes: metadata.len(),
            content_sha256,
        });
    }

    Ok(())
}

fn sha256_file(file_path: &Path) -> Result<String, std::io::Error> {
    let mut file = fs::File::open(file_path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 8192];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}