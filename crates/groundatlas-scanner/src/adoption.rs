//! Pure project-manifest adoption status classification (ADR-168 rust_impl residual).
//!
//! Oracle: src/application/projectManifest.ts adoption.status handling.
//! No filesystem I/O.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AdoptionStatus {
    Unknown,
    Healthy,
    Warning,
    Exception,
    Blocked,
}

impl AdoptionStatus {
    pub fn parse(raw: Option<&str>) -> Self {
        match raw.map(str::trim).filter(|s| !s.is_empty()) {
            None => Self::Unknown,
            Some(s) => match s.to_ascii_lowercase().as_str() {
                "healthy" | "ok" | "adopted" | "ready" => Self::Healthy,
                "warning" | "warn" => Self::Warning,
                "exception" => Self::Exception,
                "blocked" | "block" | "failed" => Self::Blocked,
                _ => Self::Unknown,
            },
        }
    }

    /// Issue code emitted for non-healthy explicit statuses.
    pub fn issue_code(self) -> Option<&'static str> {
        match self {
            Self::Blocked => Some("project-manifest-adoption-blocked"),
            Self::Warning => Some("project-manifest-adoption-warning"),
            Self::Exception => Some("project-manifest-adoption-exception"),
            Self::Healthy | Self::Unknown => None,
        }
    }

    pub fn severity(self) -> Option<&'static str> {
        match self {
            Self::Blocked => Some("error"),
            Self::Warning | Self::Exception => Some("warning"),
            Self::Healthy | Self::Unknown => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdoptionIssue {
    pub code: String,
    pub severity: String,
    pub message: String,
}

/// Pure: map adoption.status field to zero/one issue (no path IO).
pub fn adoption_issues(status_raw: Option<&str>, manifest_path: &str) -> Vec<AdoptionIssue> {
    let status = AdoptionStatus::parse(status_raw);
    match (status.issue_code(), status.severity()) {
        (Some(code), Some(sev)) => {
            let label = status_raw.unwrap_or("");
            vec![AdoptionIssue {
                code: code.into(),
                severity: sev.into(),
                message: format!("{manifest_path} declares adoption.status={label}."),
            }]
        }
        _ => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_aliases() {
        assert_eq!(
            AdoptionStatus::parse(Some("blocked")),
            AdoptionStatus::Blocked
        );
        assert_eq!(AdoptionStatus::parse(Some("WARN")), AdoptionStatus::Warning);
        assert_eq!(
            AdoptionStatus::parse(Some("healthy")),
            AdoptionStatus::Healthy
        );
        assert_eq!(AdoptionStatus::parse(None), AdoptionStatus::Unknown);
    }

    #[test]
    fn blocked_emits_error_issue() {
        let issues = adoption_issues(Some("blocked"), "project.manifest.json");
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].code, "project-manifest-adoption-blocked");
        assert_eq!(issues[0].severity, "error");
    }

    #[test]
    fn warning_and_exception() {
        assert_eq!(
            adoption_issues(Some("warning"), "m.json")[0].code,
            "project-manifest-adoption-warning"
        );
        assert_eq!(
            adoption_issues(Some("exception"), "m.json")[0].code,
            "project-manifest-adoption-exception"
        );
    }

    #[test]
    fn healthy_silent() {
        assert!(adoption_issues(Some("healthy"), "m.json").is_empty());
        assert!(adoption_issues(None, "m.json").is_empty());
    }
}
