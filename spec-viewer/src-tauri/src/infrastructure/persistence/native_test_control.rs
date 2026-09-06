//! Test-only, out-of-band crash barriers for packaged native smoke tests.
//!
//! This module is compiled only with the non-default `native-test-control`
//! feature. A mutation remains blocked while the harness observes a
//! nonce-scoped ready file and terminates the application process.

use std::{
    env, fs, io,
    path::{Path, PathBuf},
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use sha2::{Digest, Sha256};

const CONTROL_DIR: &str = "SPEC_VIEWER_NATIVE_TEST_CONTROL_DIR";
const CONTROL_NONCE: &str = "SPEC_VIEWER_NATIVE_TEST_CONTROL_NONCE";
const CONTROL_PHASE: &str = "SPEC_VIEWER_NATIVE_TEST_CONTROL_PHASE";
const RELEASE_TIMEOUT: Duration = Duration::from_secs(60);
const POLL_INTERVAL: Duration = Duration::from_millis(10);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CrashPhase {
    PreReplace,
    PostReplace,
}

impl CrashPhase {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "preReplace" => Some(Self::PreReplace),
            "postReplace" => Some(Self::PostReplace),
            _ => None,
        }
    }
}

#[derive(Debug)]
struct Control {
    directory: PathBuf,
    nonce: String,
    phase: CrashPhase,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Ready<'a> {
    nonce: &'a str,
    pid: u32,
    phase: CrashPhase,
    document_hash: String,
}

pub(crate) fn wait_if_armed(phase: CrashPhase, document: &[u8]) -> io::Result<()> {
    let Some(control) = Control::from_environment()? else {
        return Ok(());
    };
    if control.phase != phase {
        return Ok(());
    }
    control.wait(document)
}

impl Control {
    fn from_environment() -> io::Result<Option<Self>> {
        let directory = env::var_os(CONTROL_DIR);
        let nonce = env::var(CONTROL_NONCE).ok();
        let phase = env::var(CONTROL_PHASE).ok();
        if directory.is_none() && nonce.is_none() && phase.is_none() {
            return Ok(None);
        }
        let directory = directory.ok_or_else(invalid_control)?;
        let nonce = nonce.ok_or_else(invalid_control)?;
        let phase = phase
            .as_deref()
            .and_then(CrashPhase::parse)
            .ok_or_else(invalid_control)?;
        if !valid_nonce(&nonce) || !nonce.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(invalid_control());
        }
        let directory = PathBuf::from(directory);
        validate_directory(&directory)?;
        Ok(Some(Self {
            directory,
            nonce,
            phase,
        }))
    }

    fn wait(&self, document: &[u8]) -> io::Result<()> {
        let ready = self.directory.join(format!("ready-{}.json", self.nonce));
        let temporary =
            self.directory
                .join(format!("ready-{}.tmp-{}", self.nonce, std::process::id()));
        let release = self.directory.join(format!("release-{}", self.nonce));
        if ready.try_exists()? || temporary.try_exists()? || release.try_exists()? {
            return Err(io::Error::new(
                io::ErrorKind::AlreadyExists,
                "native crash control contains a stale nonce",
            ));
        }
        let payload = Ready {
            nonce: &self.nonce,
            pid: std::process::id(),
            phase: self.phase,
            document_hash: hex(Sha256::digest(document).as_slice()),
        };
        let bytes = serde_json::to_vec(&payload).map_err(io::Error::other)?;
        write_private_new(&temporary, &bytes)?;
        fs::rename(&temporary, &ready)?;

        let deadline = Instant::now() + RELEASE_TIMEOUT;
        loop {
            if release.try_exists()? {
                return Ok(());
            }
            if Instant::now() >= deadline {
                return Err(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "native crash control release timed out",
                ));
            }
            thread::sleep(POLL_INTERVAL);
        }
    }
}

fn invalid_control() -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, "invalid native crash control")
}

fn validate_directory(path: &Path) -> io::Result<()> {
    if !path.is_absolute() {
        return Err(invalid_control());
    }
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "unsafe native crash control directory",
        ));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if metadata.permissions().mode() & 0o077 != 0 {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "native crash control directory is not owner-only",
            ));
        }
    }
    Ok(())
}

fn valid_nonce(nonce: &str) -> bool {
    (32..=128).contains(&nonce.len()) && nonce.bytes().all(|byte| byte.is_ascii_hexdigit())
}
fn write_private_new(path: &Path, bytes: &[u8]) -> io::Result<()> {
    use std::io::Write;
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path)?;
    file.write_all(bytes)?;
    file.sync_all()
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    fn control_root(label: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-native-control-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&root).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
        }
        root
    }

    #[test]
    fn nonce_validation_rejects_ambiguous_control_names() {
        assert!(valid_nonce(&"a".repeat(32)));
        for nonce in [
            "a".repeat(31),
            "a".repeat(129),
            format!("{}g", "a".repeat(31)),
        ] {
            assert!(!valid_nonce(&nonce));
        }
    }

    #[test]
    fn r199_native_006_mutation_remains_pending_after_out_of_band_ready() {
        let directory = control_root("pending");
        let nonce = "a".repeat(32);
        let control = Control {
            directory: directory.clone(),
            nonce: nonce.clone(),
            phase: CrashPhase::PreReplace,
        };
        let (completed_tx, completed_rx) = mpsc::channel();
        let worker = thread::spawn(move || {
            let result = control.wait(b"document");
            completed_tx.send(result).unwrap();
        });
        let ready = directory.join(format!("ready-{nonce}.json"));
        let deadline = Instant::now() + Duration::from_secs(5);
        while !ready.exists() && Instant::now() < deadline {
            thread::sleep(POLL_INTERVAL);
        }
        assert!(ready.exists());
        assert!(completed_rx.try_recv().is_err());
        fs::write(directory.join(format!("release-{nonce}")), b"").unwrap();
        worker.join().unwrap();
        completed_rx.recv().unwrap().unwrap();
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn r199_native_007_wrong_nonce_ready_signal_is_rejected() {
        let directory = control_root("wrong-nonce");
        let nonce = "b".repeat(32);
        fs::write(directory.join(format!("ready-{nonce}.json")), b"stale").unwrap();
        let control = Control {
            directory: directory.clone(),
            nonce,
            phase: CrashPhase::PreReplace,
        };
        assert_eq!(
            control.wait(b"document").unwrap_err().kind(),
            io::ErrorKind::AlreadyExists
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn r199_native_008_crash_control_files_are_nonce_scoped_for_cleanup() {
        let directory = control_root("cleanup");
        let nonce = "c".repeat(32);
        for name in [
            format!("ready-{nonce}.json"),
            format!("release-{nonce}"),
            format!("ready-{nonce}.tmp-{}", std::process::id()),
        ] {
            fs::write(directory.join(name), b"").unwrap();
        }
        let prefix = format!("ready-{nonce}");
        for entry in fs::read_dir(&directory).unwrap().flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name.starts_with(&prefix) || name == format!("release-{nonce}") {
                fs::remove_file(entry.path()).unwrap();
            }
        }
        assert_eq!(fs::read_dir(&directory).unwrap().count(), 0);
        let _ = fs::remove_dir_all(directory);
    }
}
