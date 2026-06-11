//! Spec file concepts: logical file keys, status, format, and file metadata.

use std::{fmt, str::FromStr};

use crate::domain::{spec::SpecDomainError, workspace::WorkspaceConfigSource};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum SpecFileKey {
    Exploration,
    Hearing,
    Impl,
    Tasks,
    TechReference,
    Requirements,
    Design,
}

impl SpecFileKey {
    pub const DEFAULT_KEYS: [Self; 5] = [
        Self::Impl,
        Self::Tasks,
        Self::TechReference,
        Self::Exploration,
        Self::Hearing,
    ];
    pub const COMPATIBILITY_KEYS: [Self; 3] = [Self::Requirements, Self::Design, Self::Tasks];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Exploration => "exploration",
            Self::Hearing => "hearing",
            Self::Impl => "impl",
            Self::Tasks => "tasks",
            Self::TechReference => "tech-reference",
            Self::Requirements => "requirements",
            Self::Design => "design",
        }
    }

    pub fn display_label(self) -> &'static str {
        match self {
            Self::Exploration => "Exploration",
            Self::Hearing => "Hearing",
            Self::Impl => "Implementation",
            Self::Tasks => "Tasks",
            Self::TechReference => "Tech Reference",
            Self::Requirements => "Requirements",
            Self::Design => "Design",
        }
    }

    pub fn default_keys() -> &'static [Self] {
        &Self::DEFAULT_KEYS
    }

    pub fn compatibility_keys() -> &'static [Self] {
        &Self::COMPATIBILITY_KEYS
    }
}

impl fmt::Display for SpecFileKey {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl FromStr for SpecFileKey {
    type Err = SpecDomainError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "exploration" => Ok(Self::Exploration),
            "hearing" => Ok(Self::Hearing),
            "impl" => Ok(Self::Impl),
            "tasks" => Ok(Self::Tasks),
            "tech-reference" => Ok(Self::TechReference),
            "requirements" => Ok(Self::Requirements),
            "design" => Ok(Self::Design),
            _ => Err(SpecDomainError::UnsupportedFileKey {
                key: value.to_string(),
            }),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SpecFileStatus {
    Present,
    Missing,
}

impl SpecFileStatus {
    pub fn is_missing(self) -> bool {
        matches!(self, Self::Missing)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SpecDocumentFormat {
    Markdown,
    Html,
}

impl SpecDocumentFormat {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Markdown => "markdown",
            Self::Html => "html",
        }
    }

    pub fn from_file_name(file_name: &str) -> Self {
        if file_name
            .rsplit_once('.')
            .is_some_and(|(_, extension)| extension.eq_ignore_ascii_case("html"))
        {
            return Self::Html;
        }

        Self::Markdown
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecFile {
    key: SpecFileKey,
    file_name: String,
    status: SpecFileStatus,
    format: SpecDocumentFormat,
    config_source: WorkspaceConfigSource,
}

impl SpecFile {
    pub fn new(
        key: SpecFileKey,
        file_name: impl Into<String>,
        status: SpecFileStatus,
    ) -> Result<Self, SpecDomainError> {
        Self::with_config_source(
            key,
            file_name,
            status,
            WorkspaceConfigSource::WorkspaceConfig,
        )
    }

    pub fn with_config_source(
        key: SpecFileKey,
        file_name: impl Into<String>,
        status: SpecFileStatus,
        config_source: WorkspaceConfigSource,
    ) -> Result<Self, SpecDomainError> {
        let file_name = file_name.into();
        let trimmed = file_name.trim();

        if trimmed.is_empty() {
            return Err(SpecDomainError::MissingFileName { key });
        }

        Ok(Self {
            key,
            file_name: trimmed.to_string(),
            status,
            format: SpecDocumentFormat::from_file_name(trimmed),
            config_source,
        })
    }

    pub fn with_resolved_format(
        key: SpecFileKey,
        file_name: impl Into<String>,
        status: SpecFileStatus,
        config_source: WorkspaceConfigSource,
        format: SpecDocumentFormat,
    ) -> Result<Self, SpecDomainError> {
        let mut file = Self::with_config_source(key, file_name, status, config_source)?;
        file.format = format;

        Ok(file)
    }

    pub fn present(
        key: SpecFileKey,
        file_name: impl Into<String>,
    ) -> Result<Self, SpecDomainError> {
        Self::new(key, file_name, SpecFileStatus::Present)
    }

    pub fn missing(
        key: SpecFileKey,
        file_name: impl Into<String>,
    ) -> Result<Self, SpecDomainError> {
        Self::new(key, file_name, SpecFileStatus::Missing)
    }

    pub fn key(&self) -> SpecFileKey {
        self.key
    }

    pub fn file_name(&self) -> &str {
        &self.file_name
    }

    pub fn display_label(&self) -> &'static str {
        self.key.display_label()
    }

    pub fn status(&self) -> SpecFileStatus {
        self.status
    }

    pub fn format(&self) -> SpecDocumentFormat {
        self.format
    }

    pub fn config_source(&self) -> WorkspaceConfigSource {
        self.config_source
    }

    pub fn is_missing(&self) -> bool {
        self.status.is_missing()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spec_file_key_lists_default_keys_in_tab_order() {
        assert_eq!(
            &[
                SpecFileKey::Impl,
                SpecFileKey::Tasks,
                SpecFileKey::TechReference,
                SpecFileKey::Exploration,
                SpecFileKey::Hearing,
            ],
            SpecFileKey::default_keys()
        );
    }

    #[test]
    fn spec_file_key_lists_compatibility_keys_in_tab_order() {
        assert_eq!(
            &[
                SpecFileKey::Requirements,
                SpecFileKey::Design,
                SpecFileKey::Tasks,
            ],
            SpecFileKey::compatibility_keys()
        );
    }

    #[test]
    fn spec_file_key_provides_stable_identifiers_and_labels() {
        assert_eq!("exploration", SpecFileKey::Exploration.as_str());
        assert_eq!("Exploration", SpecFileKey::Exploration.display_label());
        assert_eq!("impl", SpecFileKey::Impl.as_str());
        assert_eq!("Implementation", SpecFileKey::Impl.display_label());
        assert_eq!("tech-reference", SpecFileKey::TechReference.as_str());
        assert_eq!("Tech Reference", SpecFileKey::TechReference.display_label());
    }

    #[test]
    fn spec_file_key_parses_supported_identifiers() {
        assert_eq!(
            Ok(SpecFileKey::Requirements),
            SpecFileKey::from_str("requirements")
        );
        assert_eq!(Ok(SpecFileKey::Design), SpecFileKey::from_str("design"));
        assert_eq!(
            Ok(SpecFileKey::TechReference),
            SpecFileKey::from_str("tech-reference")
        );
    }

    #[test]
    fn spec_file_key_rejects_unsupported_identifiers() {
        let result = SpecFileKey::from_str("notes");

        assert_eq!(
            Err(SpecDomainError::UnsupportedFileKey {
                key: "notes".to_string()
            }),
            result
        );
    }

    #[test]
    fn spec_file_keeps_key_file_name_label_and_status() {
        let file = SpecFile::present(SpecFileKey::Exploration, " exploration-report.md ")
            .expect("file should be valid");

        assert_eq!(SpecFileKey::Exploration, file.key());
        assert_eq!("exploration-report.md", file.file_name());
        assert_eq!("Exploration", file.display_label());
        assert_eq!(SpecFileStatus::Present, file.status());
        assert!(!file.is_missing());
    }

    #[test]
    fn spec_file_represents_missing_status_per_key() {
        let file = SpecFile::missing(SpecFileKey::Tasks, "tasks.md").expect("file should be valid");

        assert_eq!(SpecFileKey::Tasks, file.key());
        assert_eq!("tasks.md", file.file_name());
        assert_eq!(SpecFileStatus::Missing, file.status());
        assert!(file.is_missing());
    }

    #[test]
    fn spec_file_rejects_empty_file_name() {
        let result = SpecFile::present(SpecFileKey::Design, "   ");

        assert_eq!(
            Err(SpecDomainError::MissingFileName {
                key: SpecFileKey::Design
            }),
            result
        );
    }
}
