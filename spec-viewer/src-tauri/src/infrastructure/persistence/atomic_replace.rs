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

#[cfg(any(windows, test))]
fn replace_windows_with<Exists, ReplaceExisting, CreateNew>(
    mut destination_exists: Exists,
    replace_existing: ReplaceExisting,
    create_new: CreateNew,
) -> io::Result<()>
where
    Exists: FnMut() -> io::Result<bool>,
    ReplaceExisting: FnOnce() -> io::Result<()>,
    CreateNew: FnOnce() -> io::Result<()>,
{
    if !destination_exists()? {
        return create_new();
    }

    match replace_existing() {
        Ok(()) => Ok(()),
        Err(error) if is_replace_missing_error(error.raw_os_error()) => {
            // ReplaceFileW can lose a race with deletion. Re-probe before falling
            // back to first-create; the create primitive itself must still reject
            // a destination recreated after this probe.
            if destination_exists()? {
                return Err(io::Error::new(
                    io::ErrorKind::AlreadyExists,
                    "destination was recreated during atomic replace",
                ));
            }
            create_new()
        }
        Err(error) => Err(error),
    }
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
        MoveFileExW, ReplaceFileW, MOVEFILE_WRITE_THROUGH, REPLACEFILE_WRITE_THROUGH,
    };

    fn wide(path: &Path) -> Vec<u16> {
        path.as_os_str().encode_wide().chain(Some(0)).collect()
    }

    let source = wide(temp);
    let target = wide(destination);

    replace_windows_with(
        || destination.try_exists(),
        || {
            let result = unsafe {
                ReplaceFileW(
                    target.as_ptr(),
                    source.as_ptr(),
                    ptr::null(),
                    REPLACEFILE_WRITE_THROUGH,
                    ptr::null_mut(),
                    ptr::null_mut(),
                )
            };
            if result == 0 {
                Err(io::Error::last_os_error())
            } else {
                Ok(())
            }
        },
        || {
            let result =
                unsafe { MoveFileExW(source.as_ptr(), target.as_ptr(), MOVEFILE_WRITE_THROUGH) };
            if result == 0 {
                Err(io::Error::last_os_error())
            } else {
                Ok(())
            }
        },
    )
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

    #[test]
    fn first_create_never_overwrites_a_concurrent_destination() {
        let create_calls = std::cell::Cell::new(0);

        let error = replace_windows_with(
            || Ok(false),
            || panic!("replace-existing must not run for first create"),
            || {
                create_calls.set(create_calls.get() + 1);
                Err(io::Error::from(io::ErrorKind::AlreadyExists))
            },
        )
        .unwrap_err();

        assert_eq!(io::ErrorKind::AlreadyExists, error.kind());
        assert_eq!(1, create_calls.get());
    }

    #[test]
    fn retry_never_overwrites_a_destination_recreated_after_reprobe() {
        let probes = std::cell::Cell::new(0);
        let create_calls = std::cell::Cell::new(0);

        let error = replace_windows_with(
            || {
                let probe = probes.get();
                probes.set(probe + 1);
                Ok(probe == 0)
            },
            || Err(io::Error::from_raw_os_error(2)),
            || {
                create_calls.set(create_calls.get() + 1);
                Err(io::Error::from(io::ErrorKind::AlreadyExists))
            },
        )
        .unwrap_err();

        assert_eq!(io::ErrorKind::AlreadyExists, error.kind());
        assert_eq!(2, probes.get());
        assert_eq!(1, create_calls.get());
    }

    #[test]
    fn retry_stops_when_destination_exists_at_reprobe() {
        let error = replace_windows_with(
            || Ok(true),
            || Err(io::Error::from_raw_os_error(2)),
            || panic!("first-create retry must not run when destination exists"),
        )
        .unwrap_err();

        assert_eq!(io::ErrorKind::AlreadyExists, error.kind());
    }
}
