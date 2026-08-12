//! Platform atomic replacement. Successful replacement is the persistence commit point.

use std::{fs, io, path::Path};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReplaceDurability {
    Durable,
    Uncertain,
}

#[cfg(any(windows, test))]
fn is_replace_missing_error(code: Option<i32>) -> bool {
    matches!(code, Some(2 | 3))
}

pub fn replace(temp: &Path, destination: &Path) -> io::Result<ReplaceDurability> {
    replace_platform(temp, destination)?;
    let parent = destination
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "destination has no parent"))?;
    match fs::File::open(parent).and_then(|directory| directory.sync_all()) {
        Ok(()) => Ok(ReplaceDurability::Durable),
        Err(_) => Ok(ReplaceDurability::Uncertain),
    }
}

#[cfg(unix)]
fn replace_platform(temp: &Path, destination: &Path) -> io::Result<()> {
    fs::rename(temp, destination)
}

#[cfg(windows)]
fn replace_platform(temp: &Path, destination: &Path) -> io::Result<()> {
    use std::{os::windows::ffi::OsStrExt, ptr};
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, ReplaceFileW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
        REPLACEFILE_WRITE_THROUGH,
    };

    fn wide(path: &Path) -> Vec<u16> {
        path.as_os_str().encode_wide().chain(Some(0)).collect()
    }

    let source = wide(temp);
    let target = wide(destination);
    let existed = destination.try_exists()?;
    let result = unsafe {
        if existed {
            ReplaceFileW(
                target.as_ptr(),
                source.as_ptr(),
                ptr::null(),
                REPLACEFILE_WRITE_THROUGH,
                ptr::null_mut(),
                ptr::null_mut(),
            )
        } else {
            MoveFileExW(
                source.as_ptr(),
                target.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        }
    };
    if result != 0 {
        return Ok(());
    }

    let error = io::Error::last_os_error();
    if !existed || !is_replace_missing_error(error.raw_os_error()) {
        return Err(error);
    }
    // ReplaceFileW may report that an existing destination disappeared in a race.
    // Only a freshly verified absent destination may use the first-create primitive.
    if destination.try_exists()? {
        return Err(error);
    }
    let retried = unsafe {
        MoveFileExW(
            source.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if retried == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replace_retry_allowlist_is_only_file_or_path_missing() {
        assert!(is_replace_missing_error(Some(2)));
        assert!(is_replace_missing_error(Some(3)));
        for code in [None, Some(0), Some(5), Some(32), Some(80), Some(183)] {
            assert!(!is_replace_missing_error(code));
        }
    }
}
