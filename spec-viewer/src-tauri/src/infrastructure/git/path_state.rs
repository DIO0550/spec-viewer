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
            frame_submodule_state(&mut hasher, &head, &status);
        }
        Ok(_) => return Err(RepositoryPortError::InvalidRepositoryPath),
    }
    Ok(hasher.finalize().to_vec())
}

fn frame(hasher: &mut Sha256, bytes: &[u8]) {
    hasher.update((bytes.len() as u64).to_le_bytes());
    hasher.update(bytes);
}

pub(super) fn frame_submodule_state(hasher: &mut Sha256, head: &[u8], status: &[u8]) {
    let head = head.strip_suffix(b"\n").unwrap_or(head);
    let head = head.strip_suffix(b"\r").unwrap_or(head);
    frame(hasher, head);

    let mut records = status
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
        .collect::<Vec<_>>();
    records.sort_unstable();
    frame(hasher, &(records.len() as u64).to_le_bytes());
    for record in records {
        frame(hasher, record);
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn submodule_state_fingerprint_ignores_status_record_order() {
        let mut left = Sha256::new();
        frame_submodule_state(
            &mut left,
            b"0123456789abcdef\n",
            b" M tracked.txt\0?? untracked.txt\0",
        );
        let mut right = Sha256::new();
        frame_submodule_state(
            &mut right,
            b"0123456789abcdef\r\n",
            b"?? untracked.txt\0 M tracked.txt\0",
        );

        assert_eq!(left.finalize(), right.finalize());
    }
}
