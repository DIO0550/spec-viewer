//! Generated storage paths under the trusted canonical Git common directory.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use sha2::{Digest, Sha256};

use crate::domain::comment::diff::WorktreeStorageId;

#[derive(Debug)]
pub struct DiffCommentPaths {
    root: PathBuf,
    document: PathBuf,
    lock: PathBuf,
    temp_prefix: String,
}

impl DiffCommentPaths {
    pub fn create(common_dir: &Path, worktree_id: &WorktreeStorageId) -> io::Result<Self> {
        let metadata = fs::symlink_metadata(common_dir)?;
        if !metadata.is_dir() || is_link_or_reparse(&metadata) {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "unsafe Git common directory",
            ));
        }
        let application_root = ensure_private_component(common_dir, "spec-viewer")?;
        let root = ensure_private_component(&application_root, "diff-comments")?;
        let root_metadata = fs::symlink_metadata(&root)?;
        if !root_metadata.is_dir() || is_link_or_reparse(&root_metadata) {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "unsafe Diff comment store root",
            ));
        }
        set_private_permissions(&root)?;
        let key = storage_file_key(worktree_id);
        let stem = format!("df1_{key}");
        Ok(Self {
            document: root.join(format!("{stem}.v1.json")),
            lock: root.join(format!("{stem}.lock")),
            temp_prefix: format!("{stem}.tmp."),
            root,
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }
    pub fn document(&self) -> &Path {
        &self.document
    }
    pub fn lock(&self) -> &Path {
        &self.lock
    }
    pub fn temp_prefix(&self) -> &str {
        &self.temp_prefix
    }
    pub fn temp(&self, nonce: &str) -> PathBuf {
        self.root.join(format!("{}{nonce}", self.temp_prefix))
    }
}

fn ensure_private_component(parent: &Path, name: &str) -> io::Result<PathBuf> {
    let path = parent.join(name);
    match fs::symlink_metadata(&path) {
        Ok(metadata) if !metadata.is_dir() || is_link_or_reparse(&metadata) => {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "unsafe store component",
            ));
        }
        Ok(_) => {}
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            if let Err(create_error) = create_private_dir(&path) {
                if create_error.kind() != io::ErrorKind::AlreadyExists {
                    return Err(create_error);
                }
            }
        }
        Err(error) => return Err(error),
    }
    let metadata = fs::symlink_metadata(&path)?;
    if !metadata.is_dir() || is_link_or_reparse(&metadata) {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "unsafe store component",
        ));
    }
    set_private_permissions(&path)?;
    Ok(path)
}

#[cfg(unix)]
fn create_private_dir(path: &Path) -> io::Result<()> {
    use std::os::unix::fs::DirBuilderExt;
    fs::DirBuilder::new().mode(0o700).create(path)
}

#[cfg(not(unix))]
fn create_private_dir(path: &Path) -> io::Result<()> {
    fs::create_dir(path)
}

#[cfg(windows)]
fn is_link_or_reparse(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    metadata.file_type().is_symlink()
        || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_link_or_reparse(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

pub fn storage_file_key(worktree_id: &WorktreeStorageId) -> String {
    let bytes = worktree_id.as_str().as_bytes();
    let mut hash = Sha256::new();
    hash.update((bytes.len() as u64).to_be_bytes());
    hash.update(bytes);
    hash.finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(unix)]
pub fn set_private_permissions(path: &Path) -> io::Result<()> {
    super::private_permissions::enforce(path, true)
}

#[cfg(not(unix))]
pub fn set_private_permissions(_path: &Path) -> io::Result<()> {
    super::private_permissions::enforce(_path, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_key_is_length_framed_and_not_the_raw_identity() {
        let id = WorktreeStorageId::parse(format!("rw1_{}", "a".repeat(64))).unwrap();
        let key = storage_file_key(&id);
        assert_eq!(key.len(), 64);
        assert!(!key.contains(id.as_str()));
    }

    #[cfg(unix)]
    #[test]
    fn generated_store_components_reject_symlinks_before_descent() {
        use std::os::unix::fs::symlink;
        let common = std::env::temp_dir().join(format!("spec-viewer-paths-{}", std::process::id()));
        let outside =
            std::env::temp_dir().join(format!("spec-viewer-paths-outside-{}", std::process::id()));
        let _ = fs::remove_dir_all(&common);
        let _ = fs::remove_dir_all(&outside);
        fs::create_dir_all(&common).unwrap();
        fs::create_dir_all(&outside).unwrap();
        symlink(&outside, common.join("spec-viewer")).unwrap();
        let id = WorktreeStorageId::parse(format!("rw1_{}", "a".repeat(64))).unwrap();
        assert_eq!(
            DiffCommentPaths::create(&common, &id).unwrap_err().kind(),
            io::ErrorKind::PermissionDenied
        );
        fs::remove_file(common.join("spec-viewer")).unwrap();
        fs::create_dir(common.join("spec-viewer")).unwrap();
        symlink(&outside, common.join("spec-viewer/diff-comments")).unwrap();
        assert_eq!(
            DiffCommentPaths::create(&common, &id).unwrap_err().kind(),
            io::ErrorKind::PermissionDenied
        );
        let _ = fs::remove_dir_all(common);
        let _ = fs::remove_dir_all(outside);
    }

    #[cfg(windows)]
    fn assert_windows_junction_boundary(label: &str) {
        use std::process::Command;
        let root =
            std::env::temp_dir().join(format!("spec-viewer-r199-{label}-{}", uuid::Uuid::new_v4()));
        let common = root.join("common");
        let outside = root.join("outside");
        fs::create_dir_all(&common).unwrap();
        fs::create_dir_all(&outside).unwrap();
        let link = common.join("spec-viewer");
        let output = Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(&link)
            .arg(&outside)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "mklink /J failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        let id = WorktreeStorageId::parse(format!("rw1_{}", "a".repeat(64))).unwrap();
        assert_eq!(
            DiffCommentPaths::create(&common, &id).unwrap_err().kind(),
            io::ErrorKind::PermissionDenied
        );
        fs::remove_dir(&link).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn r199_git_008_junction_escape() {
        assert_windows_junction_boundary("junction");
    }

    #[cfg(windows)]
    #[test]
    fn r199_git_009_reparse_boundary() {
        assert_windows_junction_boundary("reparse");
    }
}
