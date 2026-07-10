//! CLI explain query scoring — parity with `src/application/explain.ts`.

use crate::types::{SourceEntry, SourceKind};

const MAX_RESULTS: usize = 20;

fn kind_label(kind: SourceKind) -> String {
    serde_json::to_string(&kind)
        .expect("kind serializes")
        .trim_matches('"')
        .to_string()
}

/// Score a source entry against lowercase query terms (TS `scoreSource` parity).
#[must_use]
fn score_source(source: &SourceEntry, terms: &[String]) -> u32 {
    let haystack = format!(
        "{} {} {}",
        source.path.to_lowercase(),
        kind_label(source.kind),
        source.reason.to_lowercase()
    );
    terms
        .iter()
        .map(|term| u32::from(haystack.contains(term)))
        .sum()
}

/// Explain a query against atlas sources — returns top matches sorted by score then path.
#[must_use]
pub fn explain_query(sources: &[SourceEntry], query: &str) -> Vec<SourceEntry> {
    let terms: Vec<String> = query
        .to_lowercase()
        .split_whitespace()
        .filter(|term| !term.is_empty())
        .map(ToString::to_string)
        .collect();

    if terms.is_empty() {
        return Vec::new();
    }

    let mut scored: Vec<(u32, &SourceEntry)> = sources
        .iter()
        .map(|source| (score_source(source, &terms), source))
        .filter(|(score, _)| *score > 0)
        .collect();

    scored.sort_by(|left, right| {
        right
            .0
            .cmp(&left.0)
            .then_with(|| left.1.path.cmp(&right.1.path))
    });

    scored
        .into_iter()
        .take(MAX_RESULTS)
        .map(|(_, source)| source.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{SourceEntry, SourceKind};

    fn sample_source(path: &str, kind: SourceKind, reason: &str) -> SourceEntry {
        SourceEntry {
            path: path.to_string(),
            kind,
            reason: reason.to_string(),
            canonical: true,
            size_bytes: 1,
            content_sha256: "abc".to_string(),
        }
    }

    #[test]
    fn empty_query_returns_empty() {
        let sources = vec![sample_source("src/a.ts", SourceKind::Source, "entry")];
        assert!(explain_query(&sources, "   ").is_empty());
    }

    #[test]
    fn ranks_by_term_hits_then_path() {
        let sources = vec![
            sample_source("src/b.ts", SourceKind::Source, "typescript module"),
            sample_source("src/a.ts", SourceKind::Source, "typescript entry"),
        ];
        let hits = explain_query(&sources, "typescript");
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].path, "src/a.ts");
        assert_eq!(hits[1].path, "src/b.ts");
    }
}