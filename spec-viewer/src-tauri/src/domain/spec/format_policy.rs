use super::{SpecDocumentFormat, SpecFileKey};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpecFileCandidateNameStrategy {
    PreserveConfigured,
    ReplaceExtension,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SpecFileCandidateRule {
    format: SpecDocumentFormat,
    name_strategy: SpecFileCandidateNameStrategy,
}

impl SpecFileCandidateRule {
    pub const fn new(
        format: SpecDocumentFormat,
        name_strategy: SpecFileCandidateNameStrategy,
    ) -> Self {
        Self {
            format,
            name_strategy,
        }
    }

    pub const fn format(self) -> SpecDocumentFormat {
        self.format
    }

    pub const fn name_strategy(self) -> SpecFileCandidateNameStrategy {
        self.name_strategy
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecFileFormatPolicy {
    candidate_rules: Vec<SpecFileCandidateRule>,
}

impl SpecFileFormatPolicy {
    fn new(candidate_rules: Vec<SpecFileCandidateRule>) -> Self {
        Self { candidate_rules }
    }

    pub fn candidate_rules(&self) -> &[SpecFileCandidateRule] {
        &self.candidate_rules
    }
}

impl SpecFileKey {
    pub fn format_policy(self, configured_format: SpecDocumentFormat) -> SpecFileFormatPolicy {
        if matches!(
            self,
            Self::Requirements | Self::TechReference | Self::TestCases
        ) {
            return SpecFileFormatPolicy::new(vec![
                SpecFileCandidateRule::new(
                    SpecDocumentFormat::Html,
                    SpecFileCandidateNameStrategy::ReplaceExtension,
                ),
                SpecFileCandidateRule::new(
                    SpecDocumentFormat::Markdown,
                    SpecFileCandidateNameStrategy::ReplaceExtension,
                ),
            ]);
        }

        match configured_format {
            SpecDocumentFormat::Markdown => SpecFileFormatPolicy::new(vec![
                SpecFileCandidateRule::new(
                    SpecDocumentFormat::Markdown,
                    SpecFileCandidateNameStrategy::PreserveConfigured,
                ),
                SpecFileCandidateRule::new(
                    SpecDocumentFormat::Html,
                    SpecFileCandidateNameStrategy::ReplaceExtension,
                ),
            ]),
            SpecDocumentFormat::Html => {
                SpecFileFormatPolicy::new(vec![SpecFileCandidateRule::new(
                    SpecDocumentFormat::Html,
                    SpecFileCandidateNameStrategy::PreserveConfigured,
                )])
            }
        }
    }
}

impl SpecDocumentFormat {
    pub const fn extension(self) -> &'static str {
        match self {
            Self::Markdown => "md",
            Self::Html => "html",
        }
    }
}
