use super::{WorkspaceDomainError, WorkspaceKind};

const CLAUDE_WORKTREE_CONTAINERS: [&str; 2] = [".plugin-worktree", ".plugin-workspace"];

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct WorkspaceRelativePath {
    value: String,
}

impl WorkspaceRelativePath {
    pub fn new(value: impl Into<String>) -> Result<Self, WorkspaceDomainError> {
        let value = value.into();
        let trimmed = value.trim();
        let has_unsafe_segment = trimmed
            .split('/')
            .any(|segment| segment.is_empty() || matches!(segment, "." | ".."));

        if trimmed.is_empty()
            || trimmed.starts_with('/')
            || trimmed.contains('\0')
            || trimmed.contains('\\')
            || trimmed.contains(':')
            || has_unsafe_segment
        {
            return Err(WorkspaceDomainError::UnsafeRelativePath { value });
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

    pub fn join(&self, relative: &str) -> Result<Self, WorkspaceDomainError> {
        Self::new(format!("{}/{relative}", self.as_str()))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkspaceDetectionMode {
    Marker,
    NamedDirectoryMarker,
    ClaudeWorktreeCollection,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceDetectionRule {
    kind: WorkspaceKind,
    mode: WorkspaceDetectionMode,
    marker: WorkspaceRelativePath,
    required_directory_name: Option<&'static str>,
}

impl WorkspaceDetectionRule {
    fn marker_rule(kind: WorkspaceKind, marker: &str) -> Self {
        Self::new(kind, WorkspaceDetectionMode::Marker, marker, None)
    }

    fn named_directory_marker(
        kind: WorkspaceKind,
        marker: &str,
        required_directory_name: &'static str,
    ) -> Self {
        Self::new(
            kind,
            WorkspaceDetectionMode::NamedDirectoryMarker,
            marker,
            Some(required_directory_name),
        )
    }

    fn claude_worktree_collection(kind: WorkspaceKind, marker: &str) -> Self {
        Self::new(
            kind,
            WorkspaceDetectionMode::ClaudeWorktreeCollection,
            marker,
            None,
        )
    }

    fn new(
        kind: WorkspaceKind,
        mode: WorkspaceDetectionMode,
        marker: &str,
        required_directory_name: Option<&'static str>,
    ) -> Self {
        Self {
            kind,
            mode,
            marker: WorkspaceRelativePath::new(marker)
                .expect("built-in workspace marker should be valid"),
            required_directory_name,
        }
    }

    pub fn kind(&self) -> WorkspaceKind {
        self.kind
    }

    pub fn mode(&self) -> WorkspaceDetectionMode {
        self.mode
    }

    pub fn marker(&self) -> &WorkspaceRelativePath {
        &self.marker
    }

    pub fn required_directory_name(&self) -> Option<&'static str> {
        self.required_directory_name
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecSourceGroupDescriptor {
    id_prefix: String,
    label: String,
}

impl SpecSourceGroupDescriptor {
    fn new(id_prefix: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            id_prefix: id_prefix.into(),
            label: label.into(),
        }
    }

    pub fn id_prefix(&self) -> &str {
        &self.id_prefix
    }

    pub fn label(&self) -> &str {
        &self.label
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecLocationDescriptor {
    source_root: WorkspaceRelativePath,
    directory: WorkspaceRelativePath,
    relative_spec: String,
}

impl SpecLocationDescriptor {
    pub fn source_root(&self) -> &WorkspaceRelativePath {
        &self.source_root
    }

    pub fn directory(&self) -> &WorkspaceRelativePath {
        &self.directory
    }

    pub fn relative_spec(&self) -> &str {
        &self.relative_spec
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceTopology {
    detection_precedence: Vec<WorkspaceDetectionRule>,
}

impl Default for WorkspaceTopology {
    fn default() -> Self {
        Self {
            detection_precedence: vec![
                WorkspaceDetectionRule::marker_rule(
                    WorkspaceKind::PluginWorkspace,
                    ".plugin-workspace/.specs",
                ),
                WorkspaceDetectionRule::named_directory_marker(
                    WorkspaceKind::PluginWorktree,
                    ".specs",
                    ".plugin-worktree",
                ),
                WorkspaceDetectionRule::claude_worktree_collection(
                    WorkspaceKind::PluginWorkspace,
                    ".claude/worktrees",
                ),
                WorkspaceDetectionRule::marker_rule(
                    WorkspaceKind::SpecSkill,
                    ".spec-skill/features",
                ),
            ],
        }
    }
}

impl WorkspaceTopology {
    pub fn detection_precedence(&self) -> &[WorkspaceDetectionRule] {
        &self.detection_precedence
    }

    pub fn primary_spec_root(&self, kind: WorkspaceKind) -> WorkspaceRelativePath {
        let value = match kind {
            WorkspaceKind::PluginWorkspace => ".plugin-workspace/.specs",
            WorkspaceKind::PluginWorktree => ".specs",
            WorkspaceKind::SpecSkill => ".spec-skill/features",
        };

        WorkspaceRelativePath::new(value).expect("built-in spec root should be valid")
    }

    pub fn claude_worktree_collection_root(&self) -> WorkspaceRelativePath {
        WorkspaceRelativePath::new(".claude/worktrees")
            .expect("built-in Claude worktree root should be valid")
    }

    pub fn claude_worktree_containers(&self) -> &'static [&'static str] {
        &CLAUDE_WORKTREE_CONTAINERS
    }

    pub fn claude_worktree_spec_root(
        &self,
        worktree_name: &str,
        container: &str,
    ) -> Result<WorkspaceRelativePath, WorkspaceDomainError> {
        if !CLAUDE_WORKTREE_CONTAINERS.contains(&container) {
            return Err(WorkspaceDomainError::UnsupportedSpecSource {
                name: container.to_string(),
            });
        }

        self.claude_worktree_collection_root()
            .join(worktree_name)?
            .join(container)?
            .join(".specs")
    }

    pub fn source_group_for_root(
        &self,
        kind: WorkspaceKind,
        relative_root: &str,
    ) -> Option<SpecSourceGroupDescriptor> {
        if kind != WorkspaceKind::PluginWorkspace {
            return None;
        }

        if relative_root == self.primary_spec_root(kind).as_str() {
            return Some(SpecSourceGroupDescriptor::new(relative_root, "ルート"));
        }

        let components = relative_root.split('/').collect::<Vec<_>>();

        match components.as_slice() {
            [claude, worktrees, worktree_name, container, specs]
                if *claude == ".claude"
                    && *worktrees == "worktrees"
                    && !worktree_name.is_empty()
                    && CLAUDE_WORKTREE_CONTAINERS.contains(container)
                    && *specs == ".specs" =>
            {
                Some(SpecSourceGroupDescriptor::new(
                    relative_root,
                    format!("{worktree_name} ({container})"),
                ))
            }
            _ => None,
        }
    }

    pub fn locate_spec(
        &self,
        kind: WorkspaceKind,
        spec_id: &str,
    ) -> Result<SpecLocationDescriptor, WorkspaceDomainError> {
        let primary_root = self.primary_spec_root(kind);
        let spec_path = WorkspaceRelativePath::new(spec_id)?;
        let components = spec_path.segments().collect::<Vec<_>>();
        let worktree_source_root = match components.as_slice() {
            [claude, worktrees, worktree_name, container, specs, ..]
                if *claude == ".claude"
                    && *worktrees == "worktrees"
                    && !worktree_name.is_empty()
                    && CLAUDE_WORKTREE_CONTAINERS.contains(container)
                    && *specs == ".specs" =>
            {
                Some(components[..5].join("/"))
            }
            _ => None,
        };

        if let Some(source_root) = worktree_source_root {
            let relative_spec = components[5..].join("/");

            return Ok(SpecLocationDescriptor {
                source_root: WorkspaceRelativePath::new(source_root)?,
                directory: spec_path,
                relative_spec,
            });
        }

        if spec_id == primary_root.as_str()
            || spec_id
                .strip_prefix(primary_root.as_str())
                .is_some_and(|suffix| suffix.starts_with('/'))
        {
            let relative_spec = spec_id
                .strip_prefix(primary_root.as_str())
                .unwrap_or_default()
                .trim_start_matches('/')
                .to_string();

            return Ok(SpecLocationDescriptor {
                source_root: primary_root,
                directory: spec_path,
                relative_spec,
            });
        }

        Ok(SpecLocationDescriptor {
            source_root: primary_root.clone(),
            directory: primary_root.join(spec_id)?,
            relative_spec: spec_id.to_string(),
        })
    }
}
