use super::{ArtifactEvaluationError, SpecDomainError, SpecFileKey, TaskCounts};

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum SpecArtifactIdentity {
    Standard(SpecFileKey),
    DirectMarkdown(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArtifactPresence {
    Present,
    Missing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArtifactEvaluation {
    Empty,
    NonEmpty { task_counts: Option<TaskCounts> },
    Error(ArtifactEvaluationError),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecArtifactFact {
    identity: SpecArtifactIdentity,
    configured: bool,
    is_tasks: bool,
    presence: ArtifactPresence,
    evaluation: ArtifactEvaluation,
}

impl SpecArtifactFact {
    pub fn new(
        identity: SpecArtifactIdentity,
        configured: bool,
        is_tasks: bool,
        presence: ArtifactPresence,
        evaluation: ArtifactEvaluation,
    ) -> Self {
        Self {
            identity,
            configured,
            is_tasks,
            presence,
            evaluation,
        }
    }

    pub fn identity(&self) -> &SpecArtifactIdentity {
        &self.identity
    }

    pub fn is_tasks(&self) -> bool {
        self.is_tasks
    }

    pub fn is_configured_non_task(&self) -> bool {
        self.configured && !self.is_tasks
    }

    pub fn presence(&self) -> ArtifactPresence {
        self.presence
    }

    pub fn evaluation(&self) -> ArtifactEvaluation {
        self.evaluation
    }
}

impl SpecArtifactIdentity {
    pub fn direct_markdown(file_name: impl Into<String>) -> Result<Self, SpecDomainError> {
        let file_name = file_name.into();

        if !is_valid_direct_file_name(&file_name) {
            return Err(SpecDomainError::InvalidArtifactFileName { file_name });
        }

        Ok(Self::DirectMarkdown(file_name))
    }

    pub fn standard_key(&self) -> Option<SpecFileKey> {
        match self {
            Self::Standard(key) => Some(*key),
            Self::DirectMarkdown(_) => None,
        }
    }

    pub fn stable_id(&self) -> String {
        match self {
            Self::Standard(key) => format!("standard:{key}"),
            Self::DirectMarkdown(file_name) => format!("direct:{file_name}"),
        }
    }
}

fn is_valid_direct_file_name(file_name: &str) -> bool {
    !file_name.trim().is_empty()
        && !matches!(file_name, "." | "..")
        && !file_name.contains(['/', '\\'])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::spec::{SpecDomainError, SpecFileKey};

    #[test]
    fn standard_artifact_identity_uses_the_fixed_file_key() {
        let identity = SpecArtifactIdentity::Standard(SpecFileKey::Tasks);

        assert_eq!(Some(SpecFileKey::Tasks), identity.standard_key());
        assert_eq!("standard:tasks", identity.stable_id());
    }

    #[test]
    fn direct_markdown_identity_preserves_the_validated_exact_file_name() {
        let identity = SpecArtifactIdentity::direct_markdown("Notes.MD")
            .expect("direct Markdown file name should be valid");

        assert_eq!(None, identity.standard_key());
        assert_eq!("direct:Notes.MD", identity.stable_id());
    }

    #[test]
    fn direct_markdown_identity_rejects_empty_or_path_like_names() {
        for invalid_name in ["", "  ", ".", "..", "nested/notes.md", "nested\\notes.md"] {
            assert_eq!(
                Err(SpecDomainError::InvalidArtifactFileName {
                    file_name: invalid_name.to_string(),
                }),
                SpecArtifactIdentity::direct_markdown(invalid_name),
            );
        }
    }
}
