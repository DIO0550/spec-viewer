//! Spec document and tree domain concepts.

mod archive_policy;
mod artifact;
mod progress;

pub use archive_policy::{SpecArchivePolicy, SpecArchivePolicyError, SpecArchiveTarget};
pub use artifact::{
    ArtifactConfiguration, ArtifactEvaluation, ArtifactPresence, SpecArtifactFact,
    SpecArtifactIdentity,
};
pub use progress::{
    artifact_progress, progress_for_present_tasks, progress_without_tasks, ArtifactEvaluationError,
    SpecProgress, TaskCounts,
};

use std::{fmt, str::FromStr};

use thiserror::Error;

use crate::domain::workspace::WorkspaceConfigSource;

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

        let has_unsafe_segment = trimmed
            .split('/')
            .any(|segment| segment.is_empty() || matches!(segment, "." | ".."));

        if trimmed.contains('\\')
            || trimmed.contains('\0')
            || trimmed.contains(':')
            || has_unsafe_segment
        {
            return Err(SpecDomainError::UnsafeSpecId { value });
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }

    pub fn segments(&self) -> impl Iterator<Item = &str> {
        self.value.split('/')
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
    TechReference,
    TestCases,
    Requirements,
    QuizPlan,
    QuizImpl,
}

impl SpecFileKey {
    pub const DEFAULT_KEYS: [Self; 9] = [
        Self::Impl,
        Self::Tasks,
        Self::Requirements,
        Self::TechReference,
        Self::TestCases,
        Self::Exploration,
        Self::Hearing,
        Self::QuizPlan,
        Self::QuizImpl,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Exploration => "exploration",
            Self::Hearing => "hearing",
            Self::Impl => "impl",
            Self::Tasks => "tasks",
            Self::TechReference => "tech-reference",
            Self::TestCases => "test-cases",
            Self::Requirements => "requirements",
            Self::QuizPlan => "quiz-plan",
            Self::QuizImpl => "quiz-impl",
        }
    }

    pub fn display_label(self) -> &'static str {
        match self {
            Self::Exploration => "Exploration",
            Self::Hearing => "Hearing",
            Self::Impl => "Implementation",
            Self::Tasks => "Tasks",
            Self::TechReference => "Tech Reference",
            Self::TestCases => "Test Cases",
            Self::Requirements => "Requirements",
            Self::QuizPlan => "Understanding Quiz (Plan)",
            Self::QuizImpl => "Understanding Quiz (Impl)",
        }
    }

    pub fn default_keys() -> &'static [Self] {
        &Self::DEFAULT_KEYS
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
            "test-cases" => Ok(Self::TestCases),
            "requirements" => Ok(Self::Requirements),
            "quiz-plan" => Ok(Self::QuizPlan),
            "quiz-impl" => Ok(Self::QuizImpl),
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum MarkdownBlockType {
    Paragraph,
    Heading,
    ListItem,
    CodeBlock,
    BlockQuote,
    Table,
    ThematicBreak,
    Html,
    Other,
}

impl MarkdownBlockType {
    pub const SUPPORTED_TYPES: [Self; 9] = [
        Self::Paragraph,
        Self::Heading,
        Self::ListItem,
        Self::CodeBlock,
        Self::BlockQuote,
        Self::Table,
        Self::ThematicBreak,
        Self::Html,
        Self::Other,
    ];

    pub fn supported_types() -> &'static [Self] {
        &Self::SUPPORTED_TYPES
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Paragraph => "paragraph",
            Self::Heading => "heading",
            Self::ListItem => "list_item",
            Self::CodeBlock => "code_block",
            Self::BlockQuote => "block_quote",
            Self::Table => "table",
            Self::ThematicBreak => "thematic_break",
            Self::Html => "html",
            Self::Other => "other",
        }
    }
}

impl fmt::Display for MarkdownBlockType {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct MarkdownBlockIndex {
    value: usize,
}

impl MarkdownBlockIndex {
    pub fn new(value: usize) -> Self {
        Self { value }
    }

    pub fn value(self) -> usize {
        self.value
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkdownBlockText {
    raw: String,
    normalized: String,
}

impl MarkdownBlockText {
    pub fn new(
        raw: impl Into<String>,
        normalized: impl Into<String>,
    ) -> Result<Self, SpecDomainError> {
        let raw = raw.into();
        let normalized = normalized.into();
        let trimmed_normalized = normalized.trim();

        if raw.trim().is_empty() {
            return Err(SpecDomainError::MissingMarkdownBlockText);
        }

        if trimmed_normalized.is_empty() {
            return Err(SpecDomainError::MissingNormalizedMarkdownBlockText);
        }

        Ok(Self { raw, normalized })
    }

    pub fn raw(&self) -> &str {
        &self.raw
    }

    pub fn normalized(&self) -> &str {
        &self.normalized
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct MarkdownBlockHash {
    value: String,
}

impl MarkdownBlockHash {
    pub fn new(value: impl Into<String>) -> Result<Self, SpecDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() {
            return Err(SpecDomainError::MissingMarkdownBlockHash);
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for MarkdownBlockHash {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct MarkdownBlockSourceRange {
    start_byte_offset: usize,
    end_byte_offset: usize,
}

impl MarkdownBlockSourceRange {
    pub fn new(start_byte_offset: usize, end_byte_offset: usize) -> Result<Self, SpecDomainError> {
        if end_byte_offset < start_byte_offset {
            return Err(SpecDomainError::InvalidMarkdownBlockSourceRange {
                start_byte_offset,
                end_byte_offset,
            });
        }

        Ok(Self {
            start_byte_offset,
            end_byte_offset,
        })
    }

    pub fn start_byte_offset(self) -> usize {
        self.start_byte_offset
    }

    pub fn end_byte_offset(self) -> usize {
        self.end_byte_offset
    }

    pub fn len(self) -> usize {
        self.end_byte_offset - self.start_byte_offset
    }

    pub fn is_empty(self) -> bool {
        self.len() == 0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkdownBlock {
    block_type: MarkdownBlockType,
    index: MarkdownBlockIndex,
    text: MarkdownBlockText,
    text_hash: MarkdownBlockHash,
    source_range: Option<MarkdownBlockSourceRange>,
}

impl MarkdownBlock {
    pub fn new(
        block_type: MarkdownBlockType,
        index: MarkdownBlockIndex,
        text: MarkdownBlockText,
        text_hash: MarkdownBlockHash,
        source_range: Option<MarkdownBlockSourceRange>,
    ) -> Self {
        Self {
            block_type,
            index,
            text,
            text_hash,
            source_range,
        }
    }

    pub fn block_type(&self) -> MarkdownBlockType {
        self.block_type
    }

    pub fn index(&self) -> MarkdownBlockIndex {
        self.index
    }

    pub fn text(&self) -> &MarkdownBlockText {
        &self.text
    }

    pub fn text_hash(&self) -> &MarkdownBlockHash {
        &self.text_hash
    }

    pub fn source_range(&self) -> Option<MarkdownBlockSourceRange> {
        self.source_range
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SpecNodeKind {
    Spec,
    Category,
    Archive,
    SourceGroup,
}

impl SpecNodeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Spec => "spec",
            Self::Category => "category",
            Self::Archive => "archive",
            Self::SourceGroup => "sourceGroup",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SpecNodeIdentity {
    source_group_id: String,
    relative_id: String,
}

impl SpecNodeIdentity {
    pub fn new(
        source_group_id: impl Into<String>,
        relative_id: impl Into<String>,
    ) -> Result<Self, SpecDomainError> {
        let source_group_id = source_group_id.into();
        let relative_id = relative_id.into();
        let trimmed_source_group_id = source_group_id.trim().trim_end_matches('/');
        let trimmed_relative_id = relative_id.trim().trim_matches('/');

        if trimmed_source_group_id.is_empty() {
            return Err(SpecDomainError::MissingSourceGroupId);
        }

        if trimmed_relative_id.is_empty() {
            return Err(SpecDomainError::MissingRelativeNodeId);
        }

        Ok(Self {
            source_group_id: trimmed_source_group_id.to_string(),
            relative_id: trimmed_relative_id.to_string(),
        })
    }

    pub fn source_group_id(&self) -> &str {
        &self.source_group_id
    }

    pub fn relative_id(&self) -> &str {
        &self.relative_id
    }

    pub fn global_id(&self) -> String {
        if self.relative_id == "." {
            return self.source_group_id.clone();
        }

        format!("{}/{}", self.source_group_id, self.relative_id)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecNode {
    id: String,
    label: String,
    kind: SpecNodeKind,
    source_group_id: String,
    relative_id: String,
    files: Vec<SpecFile>,
    children: Vec<SpecNode>,
    present_document_count: usize,
    progress: SpecProgress,
    descendant_spec_count: usize,
}

impl SpecNode {
    pub fn new(
        id: impl Into<String>,
        label: impl Into<String>,
        files: Vec<SpecFile>,
        children: Vec<SpecNode>,
    ) -> Result<Self, SpecDomainError> {
        let id = id.into();
        let trimmed_id = id.trim();
        if trimmed_id.is_empty() {
            return Err(SpecDomainError::MissingNodeId);
        }

        Self::build(
            trimmed_id.to_string(),
            label,
            SpecNodeKind::Spec,
            "legacy".to_string(),
            trimmed_id.to_string(),
            files,
            children,
        )
    }

    pub fn leaf(
        id: impl Into<String>,
        label: impl Into<String>,
        files: Vec<SpecFile>,
    ) -> Result<Self, SpecDomainError> {
        Self::new(id, label, files, Vec::new())
    }

    pub fn spec(
        identity: SpecNodeIdentity,
        label: impl Into<String>,
        files: Vec<SpecFile>,
        children: Vec<SpecNode>,
    ) -> Result<Self, SpecDomainError> {
        Self::from_identity(identity, label, SpecNodeKind::Spec, files, children)
    }

    pub fn spec_with_progress(
        identity: SpecNodeIdentity,
        label: impl Into<String>,
        files: Vec<SpecFile>,
        children: Vec<SpecNode>,
        progress: SpecProgress,
    ) -> Result<Self, SpecDomainError> {
        let mut node = Self::from_identity(identity, label, SpecNodeKind::Spec, files, children)?;
        node.progress = progress;
        Ok(node)
    }

    pub fn category(
        identity: SpecNodeIdentity,
        label: impl Into<String>,
        children: Vec<SpecNode>,
    ) -> Result<Self, SpecDomainError> {
        Self::from_identity(
            identity,
            label,
            SpecNodeKind::Category,
            Vec::new(),
            children,
        )
    }

    pub fn archive(
        identity: SpecNodeIdentity,
        label: impl Into<String>,
        children: Vec<SpecNode>,
    ) -> Result<Self, SpecDomainError> {
        Self::from_identity(identity, label, SpecNodeKind::Archive, Vec::new(), children)
    }

    pub fn source_group(
        identity: SpecNodeIdentity,
        label: impl Into<String>,
        children: Vec<SpecNode>,
    ) -> Result<Self, SpecDomainError> {
        Self::from_identity(
            identity,
            label,
            SpecNodeKind::SourceGroup,
            Vec::new(),
            children,
        )
    }

    fn from_identity(
        identity: SpecNodeIdentity,
        label: impl Into<String>,
        kind: SpecNodeKind,
        files: Vec<SpecFile>,
        children: Vec<SpecNode>,
    ) -> Result<Self, SpecDomainError> {
        let id = identity.global_id();
        Self::build(
            id,
            label,
            kind,
            identity.source_group_id,
            identity.relative_id,
            files,
            children,
        )
    }

    fn build(
        id: String,
        label: impl Into<String>,
        kind: SpecNodeKind,
        source_group_id: String,
        relative_id: String,
        files: Vec<SpecFile>,
        children: Vec<SpecNode>,
    ) -> Result<Self, SpecDomainError> {
        let label = label.into();
        let trimmed_label = label.trim();
        if trimmed_label.is_empty() {
            return Err(SpecDomainError::MissingNodeLabel);
        }

        let present_document_count = files
            .iter()
            .filter(|file| file.status() == SpecFileStatus::Present)
            .count();
        let descendant_spec_count = children
            .iter()
            .map(|child| {
                usize::from(child.kind == SpecNodeKind::Spec) + child.descendant_spec_count
            })
            .sum();

        Ok(Self {
            id,
            label: trimmed_label.to_string(),
            kind,
            source_group_id,
            relative_id,
            files,
            children,
            present_document_count,
            progress: SpecProgress::NotStarted,
            descendant_spec_count,
        })
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn label(&self) -> &str {
        &self.label
    }

    pub fn kind(&self) -> SpecNodeKind {
        self.kind
    }

    pub fn source_group_id(&self) -> &str {
        &self.source_group_id
    }
    pub fn progress(&self) -> SpecProgress {
        self.progress
    }

    pub fn relative_id(&self) -> &str {
        &self.relative_id
    }

    pub fn files(&self) -> &[SpecFile] {
        &self.files
    }

    pub fn children(&self) -> &[SpecNode] {
        &self.children
    }

    pub fn present_document_count(&self) -> usize {
        self.present_document_count
    }

    pub fn descendant_spec_count(&self) -> usize {
        self.descendant_spec_count
    }

    pub fn is_reviewable(&self) -> bool {
        self.present_document_count > 0
    }

    pub fn is_archiveable(&self) -> bool {
        self.is_reviewable()
    }

    pub fn file_for_key(&self, key: SpecFileKey) -> Option<&SpecFile> {
        self.files.iter().find(|file| file.key() == key)
    }

    pub fn is_leaf(&self) -> bool {
        self.children.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct SpecTree {
    roots: Vec<SpecNode>,
}

impl SpecTree {
    pub fn new(roots: Vec<SpecNode>) -> Self {
        Self { roots }
    }

    pub fn roots(&self) -> &[SpecNode] {
        &self.roots
    }

    pub fn into_roots(self) -> Vec<SpecNode> {
        self.roots
    }

    pub fn find(&self, spec_id: &SpecId) -> Option<&SpecNode> {
        self.nodes().find(|node| node.id() == spec_id.as_str())
    }

    pub fn nodes(&self) -> SpecTreeNodeIter<'_> {
        SpecTreeNodeIter::new(&self.roots)
    }
}

pub struct SpecTreeNodeIter<'a> {
    pending: Vec<&'a SpecNode>,
}

impl<'a> SpecTreeNodeIter<'a> {
    fn new(roots: &'a [SpecNode]) -> Self {
        Self {
            pending: roots.iter().rev().collect(),
        }
    }
}

impl<'a> Iterator for SpecTreeNodeIter<'a> {
    type Item = &'a SpecNode;

    fn next(&mut self) -> Option<Self::Item> {
        let node = self.pending.pop()?;
        self.pending.extend(node.children().iter().rev());
        Some(node)
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum SpecDomainError {
    #[error("spec id is required")]
    MissingSpecId,
    #[error("unsafe spec id: {value}")]
    UnsafeSpecId { value: String },
    #[error("unsupported spec file key: {key}")]
    UnsupportedFileKey { key: String },
    #[error("file name is required for spec file key: {key}")]
    MissingFileName { key: SpecFileKey },
    #[error("invalid direct Markdown artifact file name: {file_name}")]
    InvalidArtifactFileName { file_name: String },
    #[error("completed task count {completed} cannot exceed total task count {total}")]
    InvalidTaskCounts { completed: usize, total: usize },
    #[error("spec node id is required")]
    MissingNodeId,
    #[error("spec source group id is required")]
    MissingSourceGroupId,
    #[error("spec relative node id is required")]
    MissingRelativeNodeId,
    #[error("spec node label is required")]
    MissingNodeLabel,
    #[error("markdown block text is required")]
    MissingMarkdownBlockText,
    #[error("normalized markdown block text is required")]
    MissingNormalizedMarkdownBlockText,
    #[error("markdown block hash is required")]
    MissingMarkdownBlockHash,
    #[error(
        "markdown block source range end byte offset {end_byte_offset} cannot be before start byte offset {start_byte_offset}"
    )]
    InvalidMarkdownBlockSourceRange {
        start_byte_offset: usize,
        end_byte_offset: usize,
    },
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
                SpecFileKey::Impl,
                SpecFileKey::Tasks,
                SpecFileKey::Requirements,
                SpecFileKey::TechReference,
                SpecFileKey::TestCases,
                SpecFileKey::Exploration,
                SpecFileKey::Hearing,
                SpecFileKey::QuizPlan,
                SpecFileKey::QuizImpl,
            ],
            SpecFileKey::default_keys()
        );
    }

    #[test]
    fn spec_id_rejects_unsafe_paths() {
        for value in [
            "../outside",
            "auth/../../outside",
            "/absolute",
            "auth\\flow",
            "C:relative",
            "auth\0flow",
        ] {
            assert_eq!(
                Err(SpecDomainError::UnsafeSpecId {
                    value: value.to_string(),
                }),
                SpecId::new(value),
            );
        }
    }

    #[test]
    fn spec_file_key_provides_stable_identifiers_and_labels() {
        assert_eq!("exploration", SpecFileKey::Exploration.as_str());
        assert_eq!("Exploration", SpecFileKey::Exploration.display_label());
        assert_eq!("impl", SpecFileKey::Impl.as_str());
        assert_eq!("Implementation", SpecFileKey::Impl.display_label());
        assert_eq!("tech-reference", SpecFileKey::TechReference.as_str());
        assert_eq!("Tech Reference", SpecFileKey::TechReference.display_label());
        assert_eq!("test-cases", SpecFileKey::TestCases.as_str());
        assert_eq!("quiz-plan", SpecFileKey::QuizPlan.as_str());
        assert_eq!(
            "Understanding Quiz (Plan)",
            SpecFileKey::QuizPlan.display_label()
        );
        assert_eq!("quiz-impl", SpecFileKey::QuizImpl.as_str());
        assert_eq!(
            "Understanding Quiz (Impl)",
            SpecFileKey::QuizImpl.display_label()
        );
        assert_eq!("Test Cases", SpecFileKey::TestCases.display_label());
    }

    #[test]
    fn spec_file_key_parses_supported_identifiers() {
        assert_eq!(
            Ok(SpecFileKey::Requirements),
            SpecFileKey::from_str("requirements")
        );
        assert!(matches!(
            SpecFileKey::from_str("design"),
            Err(SpecDomainError::UnsupportedFileKey { key }) if key == "design"
        ));
        assert_eq!(
            Ok(SpecFileKey::TechReference),
            SpecFileKey::from_str("tech-reference")
        );
        assert_eq!(
            Ok(SpecFileKey::TestCases),
            SpecFileKey::from_str("test-cases")
        );
        assert_eq!(
            Ok(SpecFileKey::QuizPlan),
            SpecFileKey::from_str("quiz-plan")
        );
        assert_eq!(
            Ok(SpecFileKey::QuizImpl),
            SpecFileKey::from_str("quiz-impl")
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
        let result = SpecFile::present(SpecFileKey::Requirements, "   ");

        assert_eq!(
            Err(SpecDomainError::MissingFileName {
                key: SpecFileKey::Requirements
            }),
            result
        );
    }

    #[test]
    fn markdown_block_type_lists_supported_types_in_stable_order() {
        assert_eq!(
            &[
                MarkdownBlockType::Paragraph,
                MarkdownBlockType::Heading,
                MarkdownBlockType::ListItem,
                MarkdownBlockType::CodeBlock,
                MarkdownBlockType::BlockQuote,
                MarkdownBlockType::Table,
                MarkdownBlockType::ThematicBreak,
                MarkdownBlockType::Html,
                MarkdownBlockType::Other,
            ],
            MarkdownBlockType::supported_types()
        );
        assert_eq!("code_block", MarkdownBlockType::CodeBlock.as_str());
        assert_eq!("code_block", MarkdownBlockType::CodeBlock.to_string());
    }

    #[test]
    fn markdown_block_index_keeps_zero_based_position() {
        let index = MarkdownBlockIndex::new(3);

        assert_eq!(3, index.value());
    }

    #[test]
    fn markdown_block_text_preserves_raw_and_normalized_representation() {
        let text = MarkdownBlockText::new("  **Selected** text  ", " selected text ")
            .expect("block text should be valid");

        assert_eq!("  **Selected** text  ", text.raw());
        assert_eq!(" selected text ", text.normalized());
    }

    #[test]
    fn markdown_block_text_rejects_empty_raw_text() {
        let result = MarkdownBlockText::new("   ", "selected text");

        assert_eq!(Err(SpecDomainError::MissingMarkdownBlockText), result);
    }

    #[test]
    fn markdown_block_text_rejects_empty_normalized_text() {
        let result = MarkdownBlockText::new("Selected text", "   ");

        assert_eq!(
            Err(SpecDomainError::MissingNormalizedMarkdownBlockText),
            result
        );
    }

    #[test]
    fn markdown_block_hash_accepts_and_trims_non_empty_value() {
        let hash = MarkdownBlockHash::new("  sha256:d4b1ea57  ").expect("hash should be valid");

        assert_eq!("sha256:d4b1ea57", hash.as_str());
        assert_eq!("sha256:d4b1ea57", hash.to_string());
    }

    #[test]
    fn markdown_block_hash_rejects_empty_value() {
        let result = MarkdownBlockHash::new("   ");

        assert_eq!(Err(SpecDomainError::MissingMarkdownBlockHash), result);
    }

    #[test]
    fn markdown_block_source_range_keeps_byte_offsets() {
        let range = MarkdownBlockSourceRange::new(4, 17).expect("range should be valid");

        assert_eq!(4, range.start_byte_offset());
        assert_eq!(17, range.end_byte_offset());
        assert_eq!(13, range.len());
        assert!(!range.is_empty());
    }

    #[test]
    fn markdown_block_source_range_accepts_empty_range() {
        let range = MarkdownBlockSourceRange::new(4, 4).expect("range should be valid");

        assert!(range.is_empty());
    }

    #[test]
    fn markdown_block_source_range_rejects_end_before_start() {
        let result = MarkdownBlockSourceRange::new(17, 4);

        assert_eq!(
            Err(SpecDomainError::InvalidMarkdownBlockSourceRange {
                start_byte_offset: 17,
                end_byte_offset: 4,
            }),
            result
        );
    }

    #[test]
    fn markdown_block_keeps_parser_independent_block_metadata() {
        let source_range = MarkdownBlockSourceRange::new(10, 30).expect("range should be valid");
        let text =
            MarkdownBlockText::new("## Overview", "overview").expect("block text should be valid");
        let text_hash = MarkdownBlockHash::new("sha256:d4b1ea57").expect("hash should be valid");
        let block = MarkdownBlock::new(
            MarkdownBlockType::Heading,
            MarkdownBlockIndex::new(1),
            text,
            text_hash,
            Some(source_range),
        );

        assert_eq!(MarkdownBlockType::Heading, block.block_type());
        assert_eq!(1, block.index().value());
        assert_eq!("## Overview", block.text().raw());
        assert_eq!("overview", block.text().normalized());
        assert_eq!("sha256:d4b1ea57", block.text_hash().as_str());
        assert_eq!(Some(source_range), block.source_range());
    }

    #[test]
    fn markdown_block_source_range_is_optional() {
        let text = MarkdownBlockText::new("Paragraph text", "paragraph text")
            .expect("block text should be valid");
        let block = MarkdownBlock::new(
            MarkdownBlockType::Paragraph,
            MarkdownBlockIndex::new(0),
            text,
            MarkdownBlockHash::new("sha256:a5dd5c34").expect("hash should be valid"),
            None,
        );

        assert_eq!(None, block.source_range());
    }

    #[test]
    fn spec_node_kind_and_counts_distinguish_specs_from_containers() {
        let present =
            SpecFile::present(SpecFileKey::Tasks, "tasks.md").expect("file should be valid");
        let missing = SpecFile::missing(SpecFileKey::Impl, "implementation-plan.md")
            .expect("file should be valid");
        let spec = SpecNode::spec(
            SpecNodeIdentity::new(".plugin-workspace/.specs", "074-issue-193")
                .expect("identity should be valid"),
            "Issue 193",
            vec![present, missing],
            Vec::new(),
        )
        .expect("spec should be valid");
        let archive = SpecNode::archive(
            SpecNodeIdentity::new(".plugin-workspace/.specs", ".archive")
                .expect("identity should be valid"),
            "Archive",
            vec![spec.clone()],
        )
        .expect("archive should be valid");

        assert_eq!(SpecNodeKind::Spec, spec.kind());
        assert_eq!(1, spec.present_document_count());
        assert_eq!(0, spec.descendant_spec_count());
        assert_eq!(SpecNodeKind::Archive, archive.kind());
        assert_eq!(0, archive.present_document_count());
        assert_eq!(1, archive.descendant_spec_count());
    }

    #[test]
    fn spec_node_identity_is_unique_across_source_groups() {
        let primary = SpecNodeIdentity::new(".plugin-workspace/.specs", "auth")
            .expect("primary identity should be valid");
        let secondary = SpecNodeIdentity::new(
            ".claude/worktrees/feature-auth/.plugin-worktree/.specs",
            "auth",
        )
        .expect("secondary identity should be valid");

        assert_ne!(primary.global_id(), secondary.global_id());
        assert_eq!(".plugin-workspace/.specs/auth", primary.global_id());
    }

    #[test]
    fn spec_node_identity_rejects_missing_source_group_or_relative_id() {
        assert_eq!(
            Err(SpecDomainError::MissingSourceGroupId),
            SpecNodeIdentity::new(" ", "auth"),
        );
        assert_eq!(
            Err(SpecDomainError::MissingRelativeNodeId),
            SpecNodeIdentity::new("primary", " "),
        );
    }

    #[test]
    fn category_counts_three_descendant_specs() {
        let children = ["one", "two", "three"]
            .into_iter()
            .map(|relative_id| {
                SpecNode::spec(
                    SpecNodeIdentity::new("primary", relative_id)
                        .expect("identity should be valid"),
                    relative_id,
                    Vec::new(),
                    Vec::new(),
                )
                .expect("spec should be valid")
            })
            .collect();
        let category = SpecNode::category(
            SpecNodeIdentity::new("primary", "planning").expect("identity should be valid"),
            "Planning",
            children,
        )
        .expect("category should be valid");

        assert_eq!(3, category.descendant_spec_count());
    }

    #[test]
    fn category_counts_nested_specs_bottom_up() {
        let nested_spec = SpecNode::spec(
            SpecNodeIdentity::new("primary", "planning/auth").expect("identity should be valid"),
            "Auth",
            Vec::new(),
            Vec::new(),
        )
        .expect("spec should be valid");
        let nested_category = SpecNode::category(
            SpecNodeIdentity::new("primary", "planning").expect("identity should be valid"),
            "Planning",
            vec![nested_spec],
        )
        .expect("category should be valid");
        let root_category = SpecNode::category(
            SpecNodeIdentity::new("primary", "root-category").expect("identity should be valid"),
            "Root category",
            vec![nested_category],
        )
        .expect("category should be valid");

        assert_eq!(1, root_category.descendant_spec_count());
    }

    #[test]
    fn spec_node_keeps_tree_compatible_metadata() {
        let child_file = SpecFile::missing(SpecFileKey::Impl, "implementation-plan.md")
            .expect("file should be valid");
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
