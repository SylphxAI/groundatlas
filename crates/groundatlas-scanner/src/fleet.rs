//! Fleet adoption pure core — status/summary parity with `src/application/fleet.ts`.
//! I/O (scan/audit) remains TS/bridge; this module owns deterministic scoring (TICK038).

use std::collections::BTreeSet;

/// Dogfood-blocking risk codes (match TS DOGFOOD_BLOCKING_RISK_CODES).
pub const DOGFOOD_BLOCKING_RISK_CODES: &[&str] = &[
    "missing-project-md",
    "missing-machine-project-manifest",
    "missing-agent-adapter",
    "missing-validation-commands",
    "invalid-project-manifest",
    "invalid-project-manifest-json",
    "project-manifest-adoption-blocked",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FleetAdoptionStatus {
    Adopted,
    Warning,
    Blocked,
}

impl FleetAdoptionStatus {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Adopted => "adopted",
            Self::Warning => "warning",
            Self::Blocked => "blocked",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FleetIssue {
    pub severity: String,
    pub code: String,
    pub message: String,
    pub source: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct FleetSummary {
    pub adopted: u32,
    pub warning: u32,
    pub blocked: u32,
    pub total: u32,
}

/// Compute adoption status from issues (pure; parity with TS `adoptionStatus`).
#[must_use]
pub fn adoption_status(issues: &[FleetIssue]) -> FleetAdoptionStatus {
    let blocking_codes: BTreeSet<&str> = DOGFOOD_BLOCKING_RISK_CODES.iter().copied().collect();
    let blocking = issues.iter().any(|issue| {
        issue.severity == "error" || blocking_codes.contains(issue.code.as_str())
    });
    if blocking {
        return FleetAdoptionStatus::Blocked;
    }
    if !issues.is_empty() {
        return FleetAdoptionStatus::Warning;
    }
    FleetAdoptionStatus::Adopted
}

/// Summarize project statuses (pure; parity with TS `summarizeFleet`).
#[must_use]
pub fn summarize_fleet(statuses: &[FleetAdoptionStatus]) -> FleetSummary {
    let mut summary = FleetSummary {
        total: statuses.len() as u32,
        ..Default::default()
    };
    for status in statuses {
        match status {
            FleetAdoptionStatus::Adopted => summary.adopted += 1,
            FleetAdoptionStatus::Warning => summary.warning += 1,
            FleetAdoptionStatus::Blocked => summary.blocked += 1,
        }
    }
    summary
}

/// Deduplicate + severity-sort issues (parity with TS `uniqueIssues`/`compareIssues`).
#[must_use]
pub fn unique_sorted_issues(issues: &[FleetIssue]) -> Vec<FleetIssue> {
    let mut seen = BTreeSet::new();
    let mut result: Vec<FleetIssue> = Vec::new();
    for issue in issues {
        let key = format!(
            "{}:{}:{}:{}",
            issue.severity,
            issue.code,
            issue.source.as_deref().unwrap_or(""),
            issue.message
        );
        if !seen.insert(key) {
            continue;
        }
        result.push(issue.clone());
    }
    result.sort_by(|left, right| {
        let rank = |s: &str| match s {
            "error" => 0,
            "warning" => 1,
            "info" => 2,
            _ => 3,
        };
        rank(&left.severity)
            .cmp(&rank(&right.severity))
            .then_with(|| left.code.cmp(&right.code))
    });
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn issue(severity: &str, code: &str) -> FleetIssue {
        FleetIssue {
            severity: severity.into(),
            code: code.into(),
            message: "m".into(),
            source: None,
        }
    }

    #[test]
    fn empty_issues_are_adopted() {
        assert_eq!(adoption_status(&[]), FleetAdoptionStatus::Adopted);
    }

    #[test]
    fn warning_severity_without_blocking_code() {
        assert_eq!(
            adoption_status(&[issue("warning", "generated-atlas-not-checked")]),
            FleetAdoptionStatus::Warning
        );
    }

    #[test]
    fn dogfood_code_blocks_even_if_warning() {
        assert_eq!(
            adoption_status(&[issue("warning", "missing-project-md")]),
            FleetAdoptionStatus::Blocked
        );
    }

    #[test]
    fn error_severity_blocks() {
        assert_eq!(
            adoption_status(&[issue("error", "fleet-scan-failed")]),
            FleetAdoptionStatus::Blocked
        );
    }

    #[test]
    fn summarize_counts() {
        let s = summarize_fleet(&[
            FleetAdoptionStatus::Adopted,
            FleetAdoptionStatus::Warning,
            FleetAdoptionStatus::Blocked,
            FleetAdoptionStatus::Adopted,
        ]);
        assert_eq!(s.total, 4);
        assert_eq!(s.adopted, 2);
        assert_eq!(s.warning, 1);
        assert_eq!(s.blocked, 1);
    }

    #[test]
    fn unique_issues_dedup_and_sort() {
        let issues = unique_sorted_issues(&[
            issue("info", "z"),
            issue("error", "a"),
            issue("error", "a"),
            issue("warning", "b"),
        ]);
        assert_eq!(issues.len(), 3);
        assert_eq!(issues[0].severity, "error");
        assert_eq!(issues[1].severity, "warning");
        assert_eq!(issues[2].severity, "info");
    }
}
