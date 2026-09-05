use std::path::Path;

use crate::{
    domain::{repository::RepositoryPortError, workspace::WorktreeId},
    infrastructure::git::GitWorktreeScanner,
};

#[derive(Debug, Clone, Default)]
pub struct WorkspaceWorktreeUseCases {
    scanner: GitWorktreeScanner,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListWorkspaceWorktreesResult {
    workspace_id: String,
    worktrees: Vec<ListedWorktree>,
}

impl ListWorkspaceWorktreesResult {
    pub fn workspace_id(&self) -> &str {
        &self.workspace_id
    }

    pub fn worktrees(&self) -> &[ListedWorktree] {
        &self.worktrees
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListedWorktree {
    id: WorktreeId,
    name: String,
}

impl ListedWorktree {
    pub fn id(&self) -> &WorktreeId {
        &self.id
    }

    pub fn name(&self) -> &str {
        &self.name
    }
}

impl WorkspaceWorktreeUseCases {
    pub fn list(
        &self,
        workspace_path: &str,
    ) -> Result<ListWorkspaceWorktreesResult, RepositoryPortError> {
        let workspace_path = workspace_path.trim();
        if workspace_path.is_empty() {
            return Err(RepositoryPortError::InvalidRepositoryPath);
        }

        let entries = self.scanner.list(Path::new(workspace_path))?;
        let worktrees = entries
            .into_iter()
            .map(|entry| {
                let path = entry
                    .path()
                    .to_str()
                    .ok_or(RepositoryPortError::UnsupportedPathEncoding)?;
                let id = WorktreeId::new(path.to_owned())
                    .map_err(|_| RepositoryPortError::InvalidRepositoryPath)?;

                Ok(ListedWorktree {
                    id,
                    name: entry.display_name(),
                })
            })
            .collect::<Result<Vec<_>, RepositoryPortError>>()?;

        Ok(ListWorkspaceWorktreesResult {
            workspace_id: workspace_path.to_owned(),
            worktrees,
        })
    }
}
