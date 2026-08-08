#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SpecProgress {
    NotStarted,
    InProgress,
    Completed,
    Unknown,
}

impl SpecProgress {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NotStarted => "notStarted",
            Self::InProgress => "inProgress",
            Self::Completed => "completed",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArtifactEvaluationError {
    Read,
    Parse,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TaskCounts {
    completed: usize,
    total: usize,
}

impl TaskCounts {
    pub fn new(completed: usize, total: usize) -> Result<Self, super::SpecDomainError> {
        if completed > total {
            return Err(super::SpecDomainError::InvalidTaskCounts { completed, total });
        }

        Ok(Self { completed, total })
    }

    pub fn completed(self) -> usize {
        self.completed
    }

    pub fn total(self) -> usize {
        self.total
    }
}

pub fn progress_for_present_tasks(
    is_empty: bool,
    task_counts: Result<TaskCounts, ArtifactEvaluationError>,
) -> SpecProgress {
    let Ok(task_counts) = task_counts else {
        return SpecProgress::Unknown;
    };

    if is_empty {
        return SpecProgress::NotStarted;
    }

    match (task_counts.total(), task_counts.completed()) {
        (0, _) => SpecProgress::InProgress,
        (_, 0) => SpecProgress::NotStarted,
        (total, completed) if total == completed => SpecProgress::Completed,
        _ => SpecProgress::InProgress,
    }
}

pub fn artifact_progress(fact: &super::SpecArtifactFact) -> SpecProgress {
    if fact.presence() == super::ArtifactPresence::Missing {
        return SpecProgress::NotStarted;
    }

    match fact.evaluation() {
        super::ArtifactEvaluation::Error(_) => SpecProgress::Unknown,
        super::ArtifactEvaluation::Empty => SpecProgress::NotStarted,
        super::ArtifactEvaluation::NonEmpty { task_counts } if fact.is_tasks() => {
            let Some(task_counts) = task_counts else {
                return SpecProgress::Unknown;
            };

            progress_for_present_tasks(false, Ok(task_counts))
        }
        super::ArtifactEvaluation::NonEmpty { .. } => SpecProgress::Completed,
    }
}

pub fn progress_without_tasks(facts: &[super::SpecArtifactFact]) -> SpecProgress {
    let configured_non_tasks = facts
        .iter()
        .filter(|fact| fact.is_configured_non_task())
        .collect::<Vec<_>>();
    let present_facts = configured_non_tasks
        .iter()
        .filter(|fact| fact.presence() == super::ArtifactPresence::Present)
        .collect::<Vec<_>>();

    if present_facts
        .iter()
        .any(|fact| matches!(fact.evaluation(), super::ArtifactEvaluation::Error(_)))
    {
        return SpecProgress::Unknown;
    }

    if present_facts.is_empty() {
        return SpecProgress::NotStarted;
    }

    let all_configured_artifacts_are_complete = configured_non_tasks.iter().all(|fact| {
        fact.presence() == super::ArtifactPresence::Present
            && matches!(
                fact.evaluation(),
                super::ArtifactEvaluation::NonEmpty { .. }
            )
    });

    if all_configured_artifacts_are_complete {
        return SpecProgress::Completed;
    }

    SpecProgress::InProgress
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::spec::{
        ArtifactEvaluation, ArtifactPresence, SpecArtifactFact, SpecArtifactIdentity, SpecFileKey,
    };

    #[test]
    fn tasks_read_or_parse_error_is_unknown() {
        assert_eq!(
            SpecProgress::Unknown,
            progress_for_present_tasks(false, Err(ArtifactEvaluationError::Read)),
        );
        assert_eq!(
            SpecProgress::Unknown,
            progress_for_present_tasks(false, Err(ArtifactEvaluationError::Parse)),
        );
    }

    #[test]
    fn tasks_empty_is_not_started() {
        let counts = TaskCounts::new(0, 0).expect("zero task counts should be valid");

        assert_eq!(
            SpecProgress::NotStarted,
            progress_for_present_tasks(true, Ok(counts)),
        );
    }
    #[test]
    fn tasks_no_checkboxes_is_in_progress() {
        let counts = TaskCounts::new(0, 0).expect("zero task counts should be valid");

        assert_eq!(
            SpecProgress::InProgress,
            progress_for_present_tasks(false, Ok(counts)),
        );
    }

    #[test]
    fn tasks_all_unchecked_is_not_started() {
        let counts = TaskCounts::new(0, 3).expect("task counts should be valid");

        assert_eq!(
            SpecProgress::NotStarted,
            progress_for_present_tasks(false, Ok(counts)),
        );
    }
    #[test]
    fn tasks_partially_checked_is_in_progress() {
        let counts = TaskCounts::new(1, 3).expect("task counts should be valid");

        assert_eq!(
            SpecProgress::InProgress,
            progress_for_present_tasks(false, Ok(counts)),
        );
    }

    #[test]
    fn tasks_all_checked_is_completed() {
        let counts = TaskCounts::new(3, 3).expect("task counts should be valid");

        assert_eq!(
            SpecProgress::Completed,
            progress_for_present_tasks(false, Ok(counts)),
        );
    }

    #[test]
    fn task_counts_rejects_completed_over_total() {
        assert!(TaskCounts::new(2, 1).is_err());
    }
    fn configured_non_task(
        presence: ArtifactPresence,
        evaluation: ArtifactEvaluation,
    ) -> SpecArtifactFact {
        SpecArtifactFact::new(
            SpecArtifactIdentity::Standard(SpecFileKey::Impl),
            true,
            false,
            presence,
            evaluation,
        )
    }

    #[test]
    fn no_tasks_any_unknown_is_unknown() {
        let facts = [configured_non_task(
            ArtifactPresence::Present,
            ArtifactEvaluation::Error(ArtifactEvaluationError::Read),
        )];

        assert_eq!(SpecProgress::Unknown, progress_without_tasks(&facts),);
    }

    #[test]
    fn no_tasks_none_present_is_not_started() {
        let facts = [configured_non_task(
            ArtifactPresence::Missing,
            ArtifactEvaluation::Empty,
        )];

        assert_eq!(SpecProgress::NotStarted, progress_without_tasks(&facts),);
    }
    #[test]
    fn no_tasks_aggregation_uses_only_configured_non_task_artifacts() {
        let cases = [
            (
                "all present and non-empty",
                vec![
                    configured_non_task(
                        ArtifactPresence::Present,
                        ArtifactEvaluation::NonEmpty { task_counts: None },
                    ),
                    SpecArtifactFact::new(
                        SpecArtifactIdentity::direct_markdown("notes.md")
                            .expect("direct Markdown name should be valid"),
                        false,
                        false,
                        ArtifactPresence::Present,
                        ArtifactEvaluation::Error(ArtifactEvaluationError::Read),
                    ),
                ],
                SpecProgress::Completed,
            ),
            (
                "a configured artifact is missing",
                vec![
                    configured_non_task(
                        ArtifactPresence::Present,
                        ArtifactEvaluation::NonEmpty { task_counts: None },
                    ),
                    configured_non_task(ArtifactPresence::Missing, ArtifactEvaluation::Empty),
                ],
                SpecProgress::InProgress,
            ),
            (
                "a configured artifact is empty",
                vec![configured_non_task(
                    ArtifactPresence::Present,
                    ArtifactEvaluation::Empty,
                )],
                SpecProgress::InProgress,
            ),
        ];

        for (case_name, facts, expected) in cases {
            assert_eq!(
                expected,
                progress_without_tasks(&facts),
                "case failed: {case_name}",
            );
        }
    }
    #[test]
    fn individual_non_task_progress_follows_evaluation() {
        let cases = [
            (
                ArtifactEvaluation::Error(ArtifactEvaluationError::Parse),
                SpecProgress::Unknown,
            ),
            (ArtifactEvaluation::Empty, SpecProgress::NotStarted),
            (
                ArtifactEvaluation::NonEmpty { task_counts: None },
                SpecProgress::Completed,
            ),
        ];

        for (evaluation, expected) in cases {
            let fact = configured_non_task(ArtifactPresence::Present, evaluation);

            assert_eq!(expected, artifact_progress(&fact));
        }
    }
}
