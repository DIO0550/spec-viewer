use super::GitRunner;
use crate::domain::repository::{RepositoryPortError, RepositoryRelativePath};
use sha2::{Digest, Sha256};
use std::{fs, io::Read, path::Path};

pub fn selected_path_fingerprint(
    runner: &GitRunner,
    root: &Path,
    path: &RepositoryRelativePath,
) -> Result<Vec<u8>, RepositoryPortError> {
    let mut hasher = Sha256::new();
    hasher.update(b"spec-viewer.selected-path\0");
    frame(&mut hasher, path.as_str().as_bytes());
    let index = runner.run(
        root,
        "selected-path-index",
        &["ls-files", "--stage", "-z", "--", path.as_str()],
        false,
    )?;
    frame(&mut hasher, &index);
    let target = root.join(path.as_str());
    let parent = target
        .parent()
        .ok_or(RepositoryPortError::InvalidRepositoryPath)?;
    let canonical_parent = fs::canonicalize(parent).map_err(map_filesystem_error)?;
    if !canonical_parent.starts_with(root) {
        return Err(RepositoryPortError::InvalidRepositoryPath);
    }
    match fs::symlink_metadata(&target) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => hasher.update([0]),
        Err(error) => return Err(map_filesystem_error(error)),
        Ok(metadata) if metadata.file_type().is_symlink() => {
            hasher.update([1]);
            let link = fs::read_link(target).map_err(map_filesystem_error)?;
            frame(&mut hasher, link.as_os_str().as_encoded_bytes());
        }
        Ok(metadata) if metadata.is_file() => {
            hasher.update([2]);
            frame_file(&mut hasher, &target)?;
        }
        Ok(metadata) if metadata.is_dir() => {
            hasher.update([3]);
            let head = runner
                .run(
                    &target,
                    "selected-submodule-head",
                    &["rev-parse", "HEAD"],
                    false,
                )
                .unwrap_or_default();
            let status = runner
                .run(
                    &target,
                    "selected-submodule-status",
                    &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
                    false,
                )
                .unwrap_or_default();
            frame(&mut hasher, &head);
            frame(&mut hasher, &status);
        }
        Ok(_) => return Err(RepositoryPortError::InvalidRepositoryPath),
    }
    Ok(hasher.finalize().to_vec())
}

fn frame(hasher: &mut Sha256, bytes: &[u8]) {
    hasher.update((bytes.len() as u64).to_le_bytes());
    hasher.update(bytes);
}

fn frame_file(hasher: &mut Sha256, path: &Path) -> Result<(), RepositoryPortError> {
    let mut file = fs::File::open(path).map_err(map_filesystem_error)?;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(map_filesystem_error)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(())
}

fn map_filesystem_error(error: std::io::Error) -> RepositoryPortError {
    if error.kind() == std::io::ErrorKind::PermissionDenied {
        RepositoryPortError::PermissionDenied
    } else {
        RepositoryPortError::EntryChangedDuringRead
    }
}
