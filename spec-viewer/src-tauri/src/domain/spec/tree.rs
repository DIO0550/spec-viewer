use thiserror::Error;

use crate::domain::workspace::{
    WorkspaceConfig, WorkspaceConfigSource, WorkspaceKind, WorkspaceTopology,
};

use super::{
    SpecDocumentFormat, SpecDomainError, SpecFile, SpecFileKey, SpecFileStatus, SpecId, SpecNode,
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
}

impl SpecDirectoryFact {
    pub fn new(
        name: impl Into<String>,
        files: Vec<SpecFileFact>,
        children: Vec<SpecDirectoryFact>,
    ) -> Self {
        Self {
            name: name.into(),
            files,
            children,
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn files(&self) -> &[SpecFileFact] {
        &self.files
    }

    pub fn children(&self) -> &[SpecDirectoryFact] {
        &self.children
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecRootFact {
    relative_path: String,
    children: Vec<SpecDirectoryFact>,
}

impl SpecRootFact {
    pub fn new(relative_path: impl Into<String>, children: Vec<SpecDirectoryFact>) -> Self {
        Self {
            relative_path: relative_path.into(),
            children,
        }
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpecNodeKind {
    SourceGroup,
    Spec,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SpecNodeCapabilities {
    reviewable: bool,
    archiveable: bool,
}

impl SpecNodeCapabilities {
    pub const fn source_group() -> Self {
        Self {
            reviewable: false,
            archiveable: false,
        }
    }

    pub const fn spec(reviewable: bool) -> Self {
        Self {
            reviewable,
            archiveable: true,
        }
    }

    pub fn is_reviewable(self) -> bool {
        self.reviewable
    }

    pub fn is_archiveable(self) -> bool {
        self.archiveable
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
        self.nodes().find(|node| node.id() == spec_id)
    }

    pub fn nodes(&self) -> SpecTreeNodeIter<'_> {
        SpecTreeNodeIter::new(&self.roots)
    }

    pub fn reviewable_nodes(&self) -> impl Iterator<Item = &SpecNode> {
        self.nodes().filter(|node| node.is_reviewable())
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
                .any(|excluded_name| excluded_name == name)
    }

    pub fn assemble(
        &self,
        kind: WorkspaceKind,
        config: &WorkspaceConfig,
        facts: SpecTreeFacts,
    ) -> Result<SpecTree, SpecTreeAssemblyError> {
        let primary_root = self.topology.primary_spec_root(kind);
        let mut roots = facts.into_roots();
        roots.sort_by(|left, right| {
            let left_primary = left.relative_path() == primary_root.as_str();
            let right_primary = right.relative_path() == primary_root.as_str();
            right_primary
                .cmp(&left_primary)
                .then_with(|| left.relative_path().cmp(right.relative_path()))
        });
        let mut nodes = Vec::new();

        for root in roots {
            let relative_path = root.relative_path;
            let group = self.topology.source_group_for_root(kind, &relative_path);
            let parent_id = group
                .as_ref()
                .map_or("", |descriptor| descriptor.id_prefix());
            let children = Self::assemble_directories(parent_id, root.children, config)?;

            if let Some(group) = group {
                nodes.push(SpecNode::source_group(
                    SpecId::new(group.id_prefix())?,
                    group.label(),
                    children,
                )?);
            } else if relative_path == primary_root.as_str() {
                nodes.extend(children);
            } else {
                return Err(SpecTreeAssemblyError::UnsupportedRoot { relative_path });
            }
        }

        Ok(SpecTree::new(nodes))
    }

    fn assemble_directories(
        parent_id: &str,
        facts: Vec<SpecDirectoryFact>,
        config: &WorkspaceConfig,
    ) -> Result<Vec<SpecNode>, SpecTreeAssemblyError> {
        let mut included = facts
            .into_iter()
            .filter(|fact| Self::includes_directory(config, fact.name()))
            .collect::<Vec<_>>();
        included.sort_by(|left, right| left.name().cmp(right.name()));

        included
            .into_iter()
            .map(|fact| Self::assemble_directory(parent_id, fact, config))
            .collect()
    }

    fn assemble_directory(
        parent_id: &str,
        fact: SpecDirectoryFact,
        config: &WorkspaceConfig,
    ) -> Result<SpecNode, SpecTreeAssemblyError> {
        let id = if parent_id.is_empty() {
            fact.name.clone()
        } else {
            format!("{parent_id}/{}", fact.name)
        };
        let children = Self::assemble_directories(&id, fact.children, config)?;
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
                .map_err(SpecTreeAssemblyError::from)
            })
            .collect::<Result<Vec<_>, _>>()?;

        SpecNode::spec(SpecId::new(id)?, fact.name, files, children)
            .map_err(SpecTreeAssemblyError::from)
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum SpecTreeAssemblyError {
    #[error("unsupported observed spec root: {relative_path}")]
    UnsupportedRoot { relative_path: String },
    #[error("observed spec tree is invalid: {0}")]
    InvalidSpec(#[from] SpecDomainError),
}
