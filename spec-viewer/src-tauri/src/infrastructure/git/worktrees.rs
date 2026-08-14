use super::GitRunner;
use crate::domain::repository::RepositoryPortError;
use std::{
    fs,
    path::{Path, PathBuf},
};

const SHORT_HEAD_LENGTH: usize = 7;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GitWorktreeEntry {
    path: PathBuf,
    head: Option<String>,
    branch: Option<String>,
    is_bare: bool,
}

impl GitWorktreeEntry {
    #[cfg(test)]
    pub(crate) fn new(path: impl Into<PathBuf>, head: Option<&str>, branch: Option<&str>) -> Self {
        Self {
            path: path.into(),
            head: head.map(str::to_owned),
            branch: branch.map(str::to_owned),
            is_bare: false,
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn branch(&self) -> Option<&str> {
        self.branch.as_deref()
    }

    pub fn display_name(&self) -> String {
        if let Some(branch) = self.branch() {
            return branch
                .strip_prefix("refs/heads/")
                .unwrap_or(branch)
                .to_owned();
        }

        let path_name = self
            .path
            .file_name()
            .and_then(|name| name.to_str())
            .filter(|name| !name.is_empty())
            .unwrap_or("detached");
        let head = self.head.as_deref().map(short_head).unwrap_or("unknown");

        format!("{path_name} · {head}")
    }
}

#[derive(Debug, Clone, Default)]
pub struct GitWorktreeScanner {
    runner: GitRunner,
}

impl GitWorktreeScanner {
    pub fn list(&self, cwd: &Path) -> Result<Vec<GitWorktreeEntry>, RepositoryPortError> {
        let output = self.runner.run(
            cwd,
            "worktree-list",
            &["worktree", "list", "--porcelain"],
            false,
        )?;
        let mut entries = parse_worktree_list(&output)?;
        prioritize_containing_worktree(cwd, &mut entries);
        Ok(entries)
    }
}

fn short_head(head: &str) -> &str {
    head.get(..SHORT_HEAD_LENGTH).unwrap_or(head)
}

fn parse_worktree_list(output: &[u8]) -> Result<Vec<GitWorktreeEntry>, RepositoryPortError> {
    let text =
        std::str::from_utf8(output).map_err(|_| RepositoryPortError::UnsupportedPathEncoding)?;
    let mut entries = Vec::new();
    let mut current: Option<GitWorktreeEntry> = None;

    for raw_line in text.lines() {
        let line = raw_line.trim_end_matches('\r');

        if line.is_empty() {
            push_entry(&mut entries, current.take());
            continue;
        }

        if let Some(path) = line.strip_prefix("worktree ") {
            push_entry(&mut entries, current.take());
            if path.is_empty() {
                return Err(invalid_worktree_output());
            }
            current = Some(GitWorktreeEntry {
                path: PathBuf::from(path),
                head: None,
                branch: None,
                is_bare: false,
            });
            continue;
        }

        let Some(entry) = current.as_mut() else {
            continue;
        };

        if let Some(head) = line.strip_prefix("HEAD ") {
            entry.head = Some(head.to_owned());
            continue;
        }
        if let Some(branch) = line.strip_prefix("branch ") {
            entry.branch = Some(branch.to_owned());
            continue;
        }
        if line == "bare" {
            entry.is_bare = true;
        }
    }

    push_entry(&mut entries, current);

    if entries.is_empty() {
        return Err(invalid_worktree_output());
    }

    Ok(entries)
}

fn push_entry(entries: &mut Vec<GitWorktreeEntry>, entry: Option<GitWorktreeEntry>) {
    if let Some(entry) = entry.filter(|entry| !entry.is_bare) {
        entries.push(entry);
    }
}

fn invalid_worktree_output() -> RepositoryPortError {
    RepositoryPortError::GitFailed {
        operation: "worktree-list".to_owned(),
        code: None,
        stderr: "Git returned invalid worktree porcelain output".to_owned(),
    }
}

fn prioritize_containing_worktree(cwd: &Path, entries: &mut [GitWorktreeEntry]) {
    let requested_path = fs::canonicalize(cwd).unwrap_or_else(|_| cwd.to_path_buf());
    entries.sort_by_key(|entry| {
        let worktree_path =
            fs::canonicalize(entry.path()).unwrap_or_else(|_| entry.path().to_path_buf());
        let contains_requested_path =
            requested_path == worktree_path || requested_path.starts_with(&worktree_path);
        (!contains_requested_path, worktree_path)
    });
}

#[cfg(test)]
mod tests {
    use super::{parse_worktree_list, GitWorktreeEntry};

    #[test]
    fn parse_worktree_list_reads_branch_and_detached_records() {
        let output = b"worktree /workspace/main\nHEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nbranch refs/heads/main\n\nworktree /workspace/detached\nHEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\ndetached\n";

        let entries = parse_worktree_list(output).expect("porcelain output should parse");

        assert_eq!(2, entries.len());
        assert_eq!("/workspace/main", entries[0].path().to_string_lossy());
        assert_eq!(Some("refs/heads/main"), entries[0].branch());
        assert_eq!("main", entries[0].display_name());
        assert_eq!("detached · bbbbbbb", entries[1].display_name());
    }

    #[test]
    fn parse_worktree_list_ignores_unknown_lines_and_rejects_missing_records() {
        let output = b"worktree /workspace/main\nHEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nlocked\nunknown value\n";

        let entries = parse_worktree_list(output).expect("unknown porcelain lines are ignorable");

        assert_eq!(
            vec![GitWorktreeEntry::new(
                "/workspace/main",
                Some("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
                None,
            )],
            entries
        );
        assert!(parse_worktree_list(b"HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n").is_err());
    }
}
