use super::process::isolate_git_environment;
use crate::domain::repository::RepositoryPortError;
use std::{
    collections::{BTreeMap, VecDeque},
    io::{BufRead, BufReader, Read, Write},
    path::Path,
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::{Arc, Mutex},
};

const BLOB_CACHE_ENTRY_LIMIT: usize = 32;
const BLOB_CACHE_BYTE_LIMIT: usize = 16 * 1024 * 1024;

#[derive(Debug, PartialEq, Eq)]
pub enum GitObjectRead {
    Available(Vec<u8>),
    TooLarge(u64),
}

#[derive(Debug, Default)]
struct BlobCache {
    entries: BTreeMap<String, Vec<u8>>,
    order: VecDeque<String>,
    byte_length: usize,
}

impl BlobCache {
    fn get(&mut self, oid: &str) -> Option<Vec<u8>> {
        let value = self.entries.get(oid)?.clone();
        self.order.retain(|candidate| candidate != oid);
        self.order.push_back(oid.to_owned());
        Some(value)
    }

    fn insert(&mut self, oid: String, bytes: Vec<u8>) {
        if bytes.len() > BLOB_CACHE_BYTE_LIMIT {
            return;
        }
        if let Some(previous) = self.entries.remove(&oid) {
            self.byte_length = self.byte_length.saturating_sub(previous.len());
            self.order.retain(|candidate| candidate != &oid);
        }
        self.byte_length += bytes.len();
        self.entries.insert(oid.clone(), bytes);
        self.order.push_back(oid);
        while self.entries.len() > BLOB_CACHE_ENTRY_LIMIT
            || self.byte_length > BLOB_CACHE_BYTE_LIMIT
        {
            let Some(oldest) = self.order.pop_front() else {
                break;
            };
            if let Some(removed) = self.entries.remove(&oldest) {
                self.byte_length = self.byte_length.saturating_sub(removed.len());
            }
        }
    }
}

#[derive(Debug)]
struct BatchSession {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

impl BatchSession {
    fn spawn(root: &Path) -> Result<Self, RepositoryPortError> {
        let mut command = Command::new("git");
        isolate_git_environment(&mut command);
        let mut child = command
            .arg("-C")
            .arg(root)
            .args(["cat-file", "--batch-command"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| {
                if error.kind() == std::io::ErrorKind::NotFound {
                    RepositoryPortError::GitUnavailable
                } else {
                    RepositoryPortError::Io
                }
            })?;
        let stdin = child.stdin.take().ok_or(RepositoryPortError::Io)?;
        let stdout = child.stdout.take().ok_or(RepositoryPortError::Io)?;
        Ok(Self {
            child,
            stdin,
            stdout: BufReader::new(stdout),
        })
    }

    fn command(&mut self, command: &str) -> Result<String, RepositoryPortError> {
        self.stdin
            .write_all(command.as_bytes())
            .and_then(|_| self.stdin.write_all(b"\n"))
            .and_then(|_| self.stdin.flush())
            .map_err(|_| RepositoryPortError::Io)?;
        let mut header = String::new();
        self.stdout
            .read_line(&mut header)
            .map_err(|_| RepositoryPortError::Io)?;
        if header.is_empty() {
            return Err(RepositoryPortError::Io);
        }
        Ok(header)
    }

    fn read_bytes(&mut self, size: usize) -> Result<Vec<u8>, RepositoryPortError> {
        let mut bytes = vec![0; size];
        self.stdout
            .read_exact(&mut bytes)
            .map_err(|_| RepositoryPortError::Io)?;
        let mut delimiter = [0_u8; 1];
        self.stdout
            .read_exact(&mut delimiter)
            .map_err(|_| RepositoryPortError::Io)?;
        if delimiter != *b"\n" {
            return Err(RepositoryPortError::Io);
        }
        Ok(bytes)
    }
}

impl Drop for BatchSession {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Debug, Clone, Default)]
pub struct GitObjectBatch {
    #[cfg(not(windows))]
    sessions: Arc<Mutex<BTreeMap<Vec<u8>, BatchSession>>>,
    cache: Arc<Mutex<BlobCache>>,
}

impl GitObjectBatch {
    pub fn read(
        &self,
        root: &Path,
        object: &str,
        content_limit: usize,
    ) -> Result<GitObjectRead, RepositoryPortError> {
        if object.contains(['\n', '\r']) {
            return Err(RepositoryPortError::InvalidRepositoryPath);
        }
        #[cfg(windows)]
        {
            let mut session = BatchSession::spawn(root)?;
            return self.read_from_session(&mut session, object, content_limit);
        }
        #[cfg(not(windows))]
        {
            self.read_from_persistent_session(root, object, content_limit)
        }
    }

    #[cfg(not(windows))]
    fn read_from_persistent_session(
        &self,
        root: &Path,
        object: &str,
        content_limit: usize,
    ) -> Result<GitObjectRead, RepositoryPortError> {
        let key = root.as_os_str().as_encoded_bytes().to_vec();
        let mut sessions = self.sessions.lock().map_err(|_| RepositoryPortError::Io)?;
        if !sessions.contains_key(&key) {
            sessions.insert(key.clone(), BatchSession::spawn(root)?);
        }
        let result = self.read_from_session(
            sessions.get_mut(&key).ok_or(RepositoryPortError::Io)?,
            object,
            content_limit,
        );
        if result.is_err() {
            sessions.remove(&key);
        }
        result
    }

    fn read_from_session(
        &self,
        session: &mut BatchSession,
        object: &str,
        content_limit: usize,
    ) -> Result<GitObjectRead, RepositoryPortError> {
        let header = session.command(&format!("info {object}"))?;
        let (oid, size) = parse_header(&header)?;
        if size > content_limit as u64 {
            return Ok(GitObjectRead::TooLarge(size));
        }
        if let Some(bytes) = self
            .cache
            .lock()
            .map_err(|_| RepositoryPortError::Io)?
            .get(&oid)
        {
            return Ok(GitObjectRead::Available(bytes));
        }
        let contents_header = session.command(&format!("contents {oid}"))?;
        let (contents_oid, contents_size) = parse_header(&contents_header)?;
        if contents_oid != oid || contents_size != size {
            return Err(RepositoryPortError::Io);
        }
        let bytes = session.read_bytes(size as usize)?;
        self.cache
            .lock()
            .map_err(|_| RepositoryPortError::Io)?
            .insert(oid, bytes.clone());
        Ok(GitObjectRead::Available(bytes))
    }
}

fn parse_header(header: &str) -> Result<(String, u64), RepositoryPortError> {
    let mut fields = header.trim_end().split(' ');
    let oid = fields.next().ok_or(RepositoryPortError::RevisionNotFound)?;
    let kind = fields.next().ok_or(RepositoryPortError::RevisionNotFound)?;
    let size = fields
        .next()
        .ok_or(RepositoryPortError::RevisionNotFound)?
        .parse()
        .map_err(|_| RepositoryPortError::RevisionNotFound)?;
    if kind != "blob" || fields.next().is_some() {
        return Err(RepositoryPortError::RevisionNotFound);
    }
    Ok((oid.to_owned(), size))
}
