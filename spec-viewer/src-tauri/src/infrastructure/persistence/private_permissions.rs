//! Creation-time/private permission policy with a Windows ACL implementation.

use std::{io, path::Path};

pub fn enforce(path: &Path, directory: bool) -> io::Result<()> {
    enforce_with(path, directory, platform_enforce)
}

fn enforce_with(
    path: &Path,
    directory: bool,
    policy: impl FnOnce(&Path, bool) -> io::Result<()>,
) -> io::Result<()> {
    policy(path, directory)
}

#[cfg(unix)]
fn platform_enforce(path: &Path, directory: bool) -> io::Result<()> {
    use std::{fs, os::unix::fs::PermissionsExt};
    fs::set_permissions(
        path,
        fs::Permissions::from_mode(if directory { 0o700 } else { 0o600 }),
    )
}

#[cfg(windows)]
fn platform_enforce(path: &Path, _directory: bool) -> io::Result<()> {
    use std::{ffi::c_void, os::windows::ffi::OsStrExt, ptr};
    use windows_sys::Win32::{
        Foundation::{CloseHandle, LocalFree, GENERIC_ALL, HANDLE},
        Security::{
            Authorization::{
                SetEntriesInAclW, SetNamedSecurityInfoW, EXPLICIT_ACCESS_W, SET_ACCESS,
                SE_FILE_OBJECT, TRUSTEE_IS_SID, TRUSTEE_IS_USER, TRUSTEE_W,
            },
            TokenUser, DACL_SECURITY_INFORMATION, NO_INHERITANCE,
            PROTECTED_DACL_SECURITY_INFORMATION, TOKEN_QUERY, TOKEN_USER,
        },
        System::Threading::{GetCurrentProcess, OpenProcessToken},
    };
    let mut token: HANDLE = ptr::null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let result = (|| {
        let mut length = 0;
        unsafe {
            windows_sys::Win32::Security::GetTokenInformation(
                token,
                TokenUser,
                ptr::null_mut(),
                0,
                &mut length,
            )
        };
        if length == 0 {
            return Err(io::Error::last_os_error());
        }
        let mut buffer = vec![0u8; length as usize];
        if unsafe {
            windows_sys::Win32::Security::GetTokenInformation(
                token,
                TokenUser,
                buffer.as_mut_ptr().cast::<c_void>(),
                length,
                &mut length,
            )
        } == 0
        {
            return Err(io::Error::last_os_error());
        }
        let sid = unsafe { ptr::read_unaligned(buffer.as_ptr().cast::<TOKEN_USER>()) }.User.Sid;
        let trustee = TRUSTEE_W {
            pMultipleTrustee: ptr::null_mut(),
            MultipleTrusteeOperation: 0,
            TrusteeForm: TRUSTEE_IS_SID,
            TrusteeType: TRUSTEE_IS_USER,
            ptstrName: sid.cast(),
        };
        let access = EXPLICIT_ACCESS_W {
            grfAccessPermissions: GENERIC_ALL,
            grfAccessMode: SET_ACCESS,
            grfInheritance: NO_INHERITANCE,
            Trustee: trustee,
        };
        let mut acl = ptr::null_mut();
        let status = unsafe { SetEntriesInAclW(1, &access, ptr::null(), &mut acl) };
        if status != 0 {
            return Err(io::Error::from_raw_os_error(status as i32));
        }
        let wide = path
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>();
        let status = unsafe {
            SetNamedSecurityInfoW(
                wide.as_ptr() as *mut u16,
                SE_FILE_OBJECT,
                DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
                ptr::null_mut(),
                ptr::null_mut(),
                acl,
                ptr::null(),
            )
        };
        unsafe { LocalFree(acl.cast()) };
        if status == 0 {
            Ok(())
        } else {
            Err(io::Error::from_raw_os_error(status as i32))
        }
    })();
    unsafe { CloseHandle(token) };
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn policy_seam_propagates_acl_failure() {
        let error = enforce_with(Path::new("store"), true, |path, directory| {
            assert_eq!(path, Path::new("store"));
            assert!(directory);
            Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "injected ACL failure",
            ))
        })
        .unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::PermissionDenied);
    }

    #[cfg(windows)]
    #[test]
    fn native_acl_is_protected_and_has_only_the_current_user_entry() {
        use std::{ffi::c_void, fs, os::windows::ffi::OsStrExt, ptr};
        use windows_sys::Win32::{
            Foundation::LocalFree,
            Security::{
                AclSizeInformation,
                Authorization::{GetNamedSecurityInfoW, SE_FILE_OBJECT},
                GetAclInformation, GetSecurityDescriptorControl, ACL_SIZE_INFORMATION,
                DACL_SECURITY_INFORMATION, SE_DACL_PROTECTED,
            },
        };

        let root = std::env::temp_dir().join(format!(
            "spec-viewer-private-acl-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&root).unwrap();
        let file = root.join("document.json");
        fs::File::create(&file).unwrap();

        for (path, directory) in [(&root, true), (&file, false)] {
            enforce(path, directory).unwrap();
            let wide = path
                .as_os_str()
                .encode_wide()
                .chain(Some(0))
                .collect::<Vec<_>>();
            let mut dacl = ptr::null_mut();
            let mut descriptor = ptr::null_mut();
            let status = unsafe {
                GetNamedSecurityInfoW(
                    wide.as_ptr(),
                    SE_FILE_OBJECT,
                    DACL_SECURITY_INFORMATION,
                    ptr::null_mut(),
                    ptr::null_mut(),
                    &mut dacl,
                    ptr::null_mut(),
                    &mut descriptor,
                )
            };
            assert_eq!(status, 0);
            assert!(!dacl.is_null());
            assert!(!descriptor.is_null());
            let mut control = 0u16;
            let mut revision = 0u32;
            assert_ne!(
                unsafe { GetSecurityDescriptorControl(descriptor, &mut control, &mut revision) },
                0
            );
            assert_ne!(control & SE_DACL_PROTECTED, 0);
            let mut size = ACL_SIZE_INFORMATION::default();
            assert_ne!(
                unsafe {
                    GetAclInformation(
                        dacl,
                        (&mut size as *mut ACL_SIZE_INFORMATION).cast::<c_void>(),
                        std::mem::size_of::<ACL_SIZE_INFORMATION>() as u32,
                        AclSizeInformation,
                    )
                },
                0
            );
            assert_eq!(size.AceCount, 1);
            unsafe { LocalFree(descriptor.cast()) };
        }
        fs::remove_file(file).unwrap();
        fs::remove_dir(root).unwrap();
    }
}
