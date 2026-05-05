//! Spec document and tree domain concepts.

use std::{fmt, str::FromStr};

use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct SpecId {
    value: String,
}

impl SpecId {
    pub fn new(value: impl Into<String>) -> Result<Self, SpecDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() {
            return Err(SpecDomainError::MissingSpecId);
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for SpecId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum SpecFileKey {
    Exploration,
    Hearing,
    Impl,
    Tasks,
    Requirements,
    Design,
}

impl SpecFileKey {
    pub const DEFAULT_KEYS: [Self; 4] = [Self::Exploration, Self::Hearing, Self::Impl, Self::Tasks];
    pub const COMPATIBILITY_KEYS: [Self; 3] = [Self::Requirements, Self::Design, Self::Tasks];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Exploration => "exploration",
            Self::Hearing => "hearing",
            Self::Impl => "impl",
            Self::Tasks => "tasks",
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecFile {
    key: SpecFileKey,
    file_name: String,
    status: SpecFileStatus,
}

impl SpecFile {
    pub fn new(
        key: SpecFileKey,
        file_name: impl Into<String>,
        status: SpecFileStatus,
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
        })
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

    pub fn is_missing(&self) -> bool {
        self.status.is_missing()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecNode {
    id: String,
    label: String,
    files: Vec<SpecFile>,
    children: Vec<SpecNode>,
}

impl SpecNode {
    pub fn new(
        id: impl Into<String>,
        label: impl Into<String>,
        files: Vec<SpecFile>,
        children: Vec<SpecNode>,
    ) -> Result<Self, SpecDomainError> {
        let id = id.into();
        let label = label.into();
        let trimmed_id = id.trim();
        let trimmed_label = label.trim();

        if trimmed_id.is_empty() {
            return Err(SpecDomainError::MissingNodeId);
        }

        if trimmed_label.is_empty() {
            return Err(SpecDomainError::MissingNodeLabel);
        }

        Ok(Self {
            id: trimmed_id.to_string(),
            label: trimmed_label.to_string(),
            files,
            children,
        })
    }

    pub fn leaf(
        id: impl Into<String>,
        label: impl Into<String>,
        files: Vec<SpecFile>,
    ) -> Result<Self, SpecDomainError> {
        Self::new(id, label, files, Vec::new())
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn label(&self) -> &str {
        &self.label
    }

    pub fn files(&self) -> &[SpecFile] {
        &self.files
    }

    pub fn children(&self) -> &[SpecNode] {
        &self.children
    }

    pub fn file_for_key(&self, key: SpecFileKey) -> Option<&SpecFile> {
        self.files.iter().find(|file| file.key() == key)
    }

    pub fn is_leaf(&self) -> bool {
        self.children.is_empty()
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum SpecDomainError {
    #[error("spec id is required")]
    MissingSpecId,
    #[error("unsupported spec file key: {key}")]
    UnsupportedFileKey { key: String },
    #[error("file name is required for spec file key: {key}")]
    MissingFileName { key: SpecFileKey },
    #[error("spec node id is required")]
    MissingNodeId,
    #[error("spec node label is required")]
    MissingNodeLabel,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spec_id_accepts_and_trims_non_empty_value() {
        let id = SpecId::new("  auth-flow  ").expect("id should be valid");

        assert_eq!("auth-flow", id.as_str());
        assert_eq!("auth-flow", id.to_string());
    }

    #[test]
    fn spec_id_rejects_empty_value() {
        let result = SpecId::new("   ");

        assert_eq!(Err(SpecDomainError::MissingSpecId), result);
    }

    #[test]
    fn spec_file_key_lists_default_keys_in_tab_order() {
        assert_eq!(
            &[
                SpecFileKey::Exploration,
                SpecFileKey::Hearing,
                SpecFileKey::Impl,
                SpecFileKey::Tasks,
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
    }

    #[test]
    fn spec_file_key_parses_supported_identifiers() {
        assert_eq!(
            Ok(SpecFileKey::Requirements),
            SpecFileKey::from_str("requirements")
        );
        assert_eq!(Ok(SpecFileKey::Design), SpecFileKey::from_str("design"));
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
        let file = SpecFile::present(SpecFileKey::Exploration, " exploration.md ")
            .expect("file should be valid");

        assert_eq!(SpecFileKey::Exploration, file.key());
        assert_eq!("exploration.md", file.file_name());
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

    #[test]
    fn spec_node_keeps_tree_compatible_metadata() {
        let child_file =
            SpecFile::missing(SpecFileKey::Impl, "impl.md").expect("file should be valid");
        let child = SpecNode::leaf("auth/code-review", "code-review", vec![child_file])
            .expect("child should be valid");
        let root_file =
            SpecFile::present(SpecFileKey::Tasks, "tasks.md").expect("file should be valid");
        let node = SpecNode::new(" auth ", " Auth ", vec![root_file], vec![child])
            .expect("node should be valid");

        assert_eq!("auth", node.id());
        assert_eq!("Auth", node.label());
        assert_eq!(1, node.files().len());
        assert_eq!(1, node.children().len());
        assert!(!node.is_leaf());
        assert!(node.file_for_key(SpecFileKey::Tasks).is_some());
        assert!(node.file_for_key(SpecFileKey::Exploration).is_none());
    }

    #[test]
    fn spec_node_rejects_missing_identity() {
        let result = SpecNode::leaf(" ", "Feature", Vec::new());

        assert_eq!(Err(SpecDomainError::MissingNodeId), result);
    }

    #[test]
    fn spec_node_rejects_missing_label() {
        let result = SpecNode::leaf("feature", " ", Vec::new());

        assert_eq!(Err(SpecDomainError::MissingNodeLabel), result);
    }
}
