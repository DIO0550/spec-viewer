use thiserror::Error;

use crate::domain::workspace::{
    SpecOverrideNodeKind, WorkspaceConfig, WorkspaceConfigSource, WorkspaceKind, WorkspaceTopology,
};

use super::{
    SpecDocumentFormat, SpecDomainError, SpecFile, SpecFileKey, SpecFileStatus, SpecNode,
    SpecNodeIdentity, SpecProgress, SpecTree,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecFileFact {
    key: SpecFileKey,
    file_name: String,
    status: SpecFileStatus,
    format: SpecDocumentFormat,
    config_source: WorkspaceConfigSource,
}

impl SpecFileFact {
    pub fn new(
        key: SpecFileKey,
        file_name: impl Into<String>,
        status: SpecFileStatus,
        format: SpecDocumentFormat,
        config_source: WorkspaceConfigSource,
    ) -> Self {
        Self {
            key,
            file_name: file_name.into(),
            status,
            format,
            config_source,
        }
    }

    pub fn key(&self) -> SpecFileKey {
        self.key
    }

    pub fn file_name(&self) -> &str {
        &self.file_name
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
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecDirectoryFact {
    name: String,
    files: Vec<SpecFileFact>,
    children: Vec<SpecDirectoryFact>,
    node_kind: Option<SpecOverrideNodeKind>,
    progress: SpecProgress,
}

impl SpecDirectoryFact {
    pub fn new(name: impl Into<String>, files: Vec<SpecFileFact>, children: Vec<Self>) -> Self {
        Self {
            name: name.into(),
            files,
            children,
            node_kind: None,
            progress: SpecProgress::Unknown,
        }
    }

    pub fn with_metadata(
        mut self,
        node_kind: Option<SpecOverrideNodeKind>,
        progress: SpecProgress,
    ) -> Self {
        self.node_kind = node_kind;
        self.progress = progress;
        self
    }

    pub fn name(&self) -> &str {
        &self.name
    }
    pub fn files(&self) -> &[SpecFileFact] {
        &self.files
    }
    pub fn children(&self) -> &[Self] {
        &self.children
    }

    pub fn inferred_kind(&self) -> Result<SpecOverrideNodeKind, SpecTreeAssemblyError> {
        let present = self
            .files
            .iter()
            .any(|file| file.status == SpecFileStatus::Present);
        if self.node_kind == Some(SpecOverrideNodeKind::Category) && present {
            return Err(SpecTreeAssemblyError::ConflictingNodeKind {
                name: self.name.clone(),
            });
        }
        let bytes = self.name.as_bytes();
        let numbered =
            bytes.len() > 4 && bytes[..3].iter().all(u8::is_ascii_digit) && bytes[3] == b'-';
        Ok(self
            .node_kind
            .unwrap_or(if present || numbered || self.children.is_empty() {
                SpecOverrideNodeKind::Spec
            } else {
                SpecOverrideNodeKind::Category
            }))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecRootFact {
    relative_path: String,
    children: Vec<SpecDirectoryFact>,
    archived_children: Vec<SpecDirectoryFact>,
}

impl SpecRootFact {
    pub fn new(relative_path: impl Into<String>, children: Vec<SpecDirectoryFact>) -> Self {
        Self {
            relative_path: relative_path.into(),
            children,
            archived_children: Vec::new(),
        }
    }
    pub fn with_archive(mut self, children: Vec<SpecDirectoryFact>) -> Self {
        self.archived_children = children;
        self
    }
    pub fn relative_path(&self) -> &str {
        &self.relative_path
    }
    pub fn children(&self) -> &[SpecDirectoryFact] {
        &self.children
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct SpecTreeFacts {
    roots: Vec<SpecRootFact>,
}

impl SpecTreeFacts {
    pub fn new(roots: Vec<SpecRootFact>) -> Self {
        Self { roots }
    }
    pub fn roots(&self) -> &[SpecRootFact] {
        &self.roots
    }
    pub fn into_roots(self) -> Vec<SpecRootFact> {
        self.roots
    }
}

#[derive(Debug, Clone)]
pub struct SpecTreeAssembler {
    topology: WorkspaceTopology,
}

impl SpecTreeAssembler {
    pub fn new(topology: WorkspaceTopology) -> Self {
        Self { topology }
    }

    pub fn includes_directory(config: &WorkspaceConfig, name: &str) -> bool {
        !name.starts_with('.')
            && !config
                .scan_excluded_directory_names()
                .iter()
                .any(|excluded| excluded == name)
    }

    pub fn assemble(
        &self,
        kind: WorkspaceKind,
        config: &WorkspaceConfig,
        facts: SpecTreeFacts,
    ) -> Result<SpecTree, SpecTreeAssemblyError> {
        let primary = self.topology.primary_spec_root(kind);
        let mut roots = facts.into_roots();
        roots.sort_by(|left, right| {
            (right.relative_path == primary.as_str())
                .cmp(&(left.relative_path == primary.as_str()))
                .then_with(|| left.relative_path.cmp(&right.relative_path))
        });
        let mut nodes = Vec::new();
        for root in roots {
            let is_primary = root.relative_path == primary.as_str();
            let group = self
                .topology
                .source_group_for_root(kind, &root.relative_path);
            if !is_primary && group.is_none() {
                return Err(SpecTreeAssemblyError::UnsupportedRoot {
                    relative_path: root.relative_path,
                });
            }
            let mut children =
                Self::assemble_directories(&root.relative_path, "", root.children, config)?;
            let archived = Self::assemble_directories(
                &root.relative_path,
                ".archive",
                root.archived_children,
                config,
            )?;
            children.push(SpecNode::archive(
                SpecNodeIdentity::new(&root.relative_path, ".archive")?,
                "Archive",
                archived,
            )?);
            if is_primary {
                nodes.extend(children);
            } else if let Some(group) = group {
                nodes.push(SpecNode::source_group(
                    SpecNodeIdentity::new(&root.relative_path, ".")?,
                    group.label(),
                    children,
                )?);
            }
        }
        Ok(SpecTree::new(nodes))
    }

    fn assemble_directories(
        source_group_id: &str,
        parent: &str,
        facts: Vec<SpecDirectoryFact>,
        config: &WorkspaceConfig,
    ) -> Result<Vec<SpecNode>, SpecTreeAssemblyError> {
        let mut included = facts
            .into_iter()
            .filter(|fact| Self::includes_directory(config, fact.name()))
            .collect::<Vec<_>>();
        included.sort_by(|left, right| left.name.cmp(&right.name));
        included
            .into_iter()
            .map(|fact| {
                let relative_id = if parent.is_empty() {
                    fact.name.clone()
                } else {
                    format!("{parent}/{}", fact.name)
                };
                let kind = fact.inferred_kind()?;
                let children = Self::assemble_directories(
                    source_group_id,
                    &relative_id,
                    fact.children,
                    config,
                )?;
                let identity = SpecNodeIdentity::new(source_group_id, &relative_id)?;
                match kind {
                    SpecOverrideNodeKind::Category => {
                        SpecNode::category(identity, fact.name, children)
                    }
                    SpecOverrideNodeKind::Spec => {
                        let files = fact
                            .files
                            .into_iter()
                            .map(|file| {
                                SpecFile::with_resolved_format(
                                    file.key,
                                    file.file_name,
                                    file.status,
                                    file.config_source,
                                    file.format,
                                )
                            })
                            .collect::<Result<Vec<_>, _>>()?;
                        SpecNode::spec_with_progress(
                            identity,
                            fact.name,
                            files,
                            children,
                            fact.progress,
                        )
                    }
                }
                .map_err(SpecTreeAssemblyError::from)
            })
            .collect()
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum SpecTreeAssemblyError {
    #[error("unsupported observed spec root: {relative_path}")]
    UnsupportedRoot { relative_path: String },
    #[error("explicit category contains configured documents: {name}")]
    ConflictingNodeKind { name: String },
    #[error("observed spec tree is invalid: {0}")]
    InvalidSpec(#[from] SpecDomainError),
}
