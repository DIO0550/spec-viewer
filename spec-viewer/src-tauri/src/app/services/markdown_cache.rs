//! Cache for parsed Markdown documents shared by read and comment commands.

use std::{
    collections::HashMap,
    fs, io,
    path::{Path, PathBuf},
    sync::{Arc, RwLock},
    time::SystemTime,
};

use crate::{
    domain::{
        spec::{MarkdownBlock, SpecArtifactIdentity, SpecDocumentFormat, SpecFileKey, SpecId},
        workspace::{WorkspaceConfig, WorkspaceLayout},
    },
    infrastructure::markdown::{
        resolve_spec_document_path, FilesystemMarkdownReader, MarkdownDocument, MarkdownReadError,
        MarkdownReadResult,
    },
};

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct MarkdownCacheKey {
    workspace_root: PathBuf,
    spec_id: SpecId,
    file_key: SpecFileKey,
    document_path: PathBuf,
}

impl MarkdownCacheKey {
    pub fn document_path(&self) -> &Path {
        &self.document_path
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FileStamp {
    modified: SystemTime,
    size_bytes: u64,
}

#[derive(Clone, Debug)]
pub struct CachedMarkdownDocument {
    identity: SpecArtifactIdentity,
    format: SpecDocumentFormat,
    path: String,
    contents: String,
    blocks: Vec<MarkdownBlock>,
    stamp: FileStamp,
    size_bytes: usize,
    last_accessed: u64,
}

impl CachedMarkdownDocument {
    fn from_document(document: MarkdownDocument, stamp: FileStamp, last_accessed: u64) -> Self {
        let contents = document.contents().to_string();
        let size_bytes = contents.len();

        Self {
            identity: document.identity().clone(),
            format: document.format(),
            path: document.path().to_string(),
            contents,
            blocks: document.blocks().to_vec(),
            stamp,
            size_bytes,
            last_accessed,
        }
    }

    fn into_document(self) -> MarkdownDocument {
        MarkdownDocument::new_artifact(
            self.identity,
            self.format,
            self.path,
            self.contents,
            self.blocks,
        )
    }
}

#[derive(Debug, Default)]
struct MarkdownCacheStore {
    documents: HashMap<MarkdownCacheKey, CachedMarkdownDocument>,
    next_access_id: u64,
}

#[derive(Clone, Debug, Default)]
pub struct MarkdownDocumentCache {
    entries: Arc<RwLock<MarkdownCacheStore>>,
}

const MAX_CACHE_ENTRY_COUNT: usize = 32;
const MAX_CACHE_TOTAL_BYTES: usize = 16 * 1024 * 1024;

impl MarkdownDocumentCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get_fresh(
        &self,
        key: &MarkdownCacheKey,
        current_stamp: &FileStamp,
    ) -> Option<CachedMarkdownDocument> {
        let mut store = self.entries.write().ok()?;
        let next_access_id = store.next_access_id();
        let document = store.documents.get_mut(key)?;

        if document.stamp == *current_stamp {
            document.last_accessed = next_access_id;
            return Some(document.clone());
        }

        None
    }

    pub fn insert(&self, key: MarkdownCacheKey, document: CachedMarkdownDocument) {
        if let Ok(mut store) = self.entries.write() {
            store.documents.insert(key, document);
            store.evict_over_limit();
        }
    }

    pub fn invalidate_path(&self, document_path: &Path) {
        let canonical_path =
            fs::canonicalize(document_path).unwrap_or_else(|_| document_path.into());

        if let Ok(mut store) = self.entries.write() {
            store.documents.retain(|key, _document| {
                key.document_path() != document_path && key.document_path() != canonical_path
            });
        }
    }

    pub fn clear_workspace(&self, workspace_root: &Path) {
        let canonical_root =
            fs::canonicalize(workspace_root).unwrap_or_else(|_| workspace_root.into());

        if let Ok(mut store) = self.entries.write() {
            store.documents.retain(|key, _document| {
                key.workspace_root != workspace_root && key.workspace_root != canonical_root
            });
        }
    }

    pub fn read_spec_file(
        &self,
        reader: &FilesystemMarkdownReader,
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
        spec_id: &str,
        key: SpecFileKey,
    ) -> Result<MarkdownReadResult, MarkdownReadError> {
        let resolved_path = resolve_spec_document_path(layout, config, spec_id, key)?;
        let metadata = match fs::metadata(resolved_path.path()) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                return reader.read(layout, config, spec_id, key);
            }
            Err(source) => {
                return Err(MarkdownReadError::InspectPath {
                    path: display_path(resolved_path.path()),
                    source,
                });
            }
        };
        let stamp = FileStamp::from_metadata(resolved_path.path(), &metadata)?;
        let cache_key = create_cache_key(layout, spec_id, key, resolved_path.path())?;

        if let Some(document) = self.get_fresh(&cache_key, &stamp) {
            return Ok(MarkdownReadResult::Found(document.into_document()));
        }

        let result = reader.read(layout, config, spec_id, key)?;

        if let MarkdownReadResult::Found(document) = result {
            let cached_document = CachedMarkdownDocument::from_document(
                document.clone(),
                stamp,
                self.next_access_id(),
            );
            self.insert(cache_key, cached_document);
            return Ok(MarkdownReadResult::Found(document));
        }

        Ok(result)
    }
}

impl MarkdownDocumentCache {
    fn next_access_id(&self) -> u64 {
        if let Ok(mut store) = self.entries.write() {
            return store.next_access_id();
        }

        0
    }
}

impl MarkdownCacheStore {
    fn next_access_id(&mut self) -> u64 {
        self.next_access_id = self.next_access_id.saturating_add(1);
        self.next_access_id
    }

    fn evict_over_limit(&mut self) {
        while self.documents.len() > MAX_CACHE_ENTRY_COUNT
            || self.total_size_bytes() > MAX_CACHE_TOTAL_BYTES
        {
            let Some(oldest_key) = self.oldest_key() else {
                return;
            };

            self.documents.remove(&oldest_key);
        }
    }

    fn total_size_bytes(&self) -> usize {
        self.documents
            .values()
            .map(|document| document.size_bytes)
            .sum()
    }

    fn oldest_key(&self) -> Option<MarkdownCacheKey> {
        self.documents
            .iter()
            .min_by_key(|(_key, document)| document.last_accessed)
            .map(|(key, _document)| key.clone())
    }
}

impl FileStamp {
    fn from_metadata(path: &Path, metadata: &fs::Metadata) -> Result<Self, MarkdownReadError> {
        let modified = metadata
            .modified()
            .map_err(|source| MarkdownReadError::InspectPath {
                path: display_path(path),
                source,
            })?;

        Ok(Self {
            modified,
            size_bytes: metadata.len(),
        })
    }
}

fn create_cache_key(
    layout: &WorkspaceLayout,
    spec_id: &str,
    file_key: SpecFileKey,
    document_path: &Path,
) -> Result<MarkdownCacheKey, MarkdownReadError> {
    let workspace_root = PathBuf::from(layout.root().as_str());
    let canonical_root =
        fs::canonicalize(&workspace_root).map_err(|source| MarkdownReadError::InspectPath {
            path: display_path(&workspace_root),
            source,
        })?;
    let canonical_document =
        fs::canonicalize(document_path).map_err(|source| MarkdownReadError::InspectPath {
            path: display_path(document_path),
            source,
        })?;

    Ok(MarkdownCacheKey {
        workspace_root: canonical_root,
        spec_id: SpecId::new(spec_id).map_err(|source| MarkdownReadError::InvalidSpecId {
            spec_id: source.to_string(),
        })?,
        file_key,
        document_path: canonical_document,
    })
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use crate::domain::workspace::{
        WorkspaceConfig, WorkspaceKind, WorkspaceLayout, WorkspaceRoot,
    };

    use super::*;

    struct TestWorkspace {
        root: PathBuf,
    }

    impl TestWorkspace {
        fn new(name: &str) -> Self {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time should be after unix epoch")
                .as_nanos();
            let root = env::temp_dir().join(format!(
                "spec-viewer-markdown-cache-{name}-{}-{timestamp}",
                std::process::id()
            ));
            fs::create_dir_all(root.join(".plugin-workspace/.specs/auth"))
                .expect("spec directory should be created");

            Self { root }
        }

        fn layout(&self) -> WorkspaceLayout {
            let root = WorkspaceRoot::new(self.root.to_string_lossy())
                .expect("workspace root should be valid");

            WorkspaceLayout::new(root, WorkspaceKind::PluginWorkspace)
        }

        fn path(&self, relative_path: &str) -> PathBuf {
            self.root.join(relative_path)
        }

        fn write(&self, relative_path: &str, contents: &str) {
            fs::write(self.path(relative_path), contents).expect("file should be written");
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn cache_returns_fresh_document_when_mtime_and_size_match() {
        let workspace = TestWorkspace::new("hit");
        workspace.write(".plugin-workspace/.specs/auth/tasks.md", "# Tasks");
        let cache = MarkdownDocumentCache::new();
        let reader = FilesystemMarkdownReader::new();
        let layout = workspace.layout();
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let first = cache
            .read_spec_file(&reader, &layout, &config, "auth", SpecFileKey::Tasks)
            .expect("first read should succeed");
        let second = cache
            .read_spec_file(&reader, &layout, &config, "auth", SpecFileKey::Tasks)
            .expect("second read should succeed");

        assert_eq!(first, second);
    }

    #[test]
    fn cache_invalidates_matching_path() {
        let workspace = TestWorkspace::new("invalidate-path");
        workspace.write(".plugin-workspace/.specs/auth/tasks.md", "# Tasks");
        let cache = MarkdownDocumentCache::new();
        let reader = FilesystemMarkdownReader::new();
        let layout = workspace.layout();
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);
        let document_path = workspace.path(".plugin-workspace/.specs/auth/tasks.md");

        cache
            .read_spec_file(&reader, &layout, &config, "auth", SpecFileKey::Tasks)
            .expect("read should populate cache");
        cache.invalidate_path(document_path.as_path());

        let entries = cache.entries.read().expect("cache lock should be readable");
        assert!(entries.documents.is_empty());
    }

    #[test]
    fn cache_clear_workspace_removes_workspace_entries() {
        let workspace = TestWorkspace::new("clear-workspace");
        workspace.write(".plugin-workspace/.specs/auth/tasks.md", "# Tasks");
        let cache = MarkdownDocumentCache::new();
        let reader = FilesystemMarkdownReader::new();
        let layout = workspace.layout();
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        cache
            .read_spec_file(&reader, &layout, &config, "auth", SpecFileKey::Tasks)
            .expect("read should populate cache");
        cache.clear_workspace(workspace.root.as_path());

        let entries = cache.entries.read().expect("cache lock should be readable");
        assert!(entries.documents.is_empty());
    }

    #[test]
    fn cache_evicts_old_entries_when_count_limit_is_exceeded() {
        let workspace = TestWorkspace::new("count-limit");
        let cache = MarkdownDocumentCache::new();
        let reader = FilesystemMarkdownReader::new();
        let layout = workspace.layout();
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        for index in 0..=MAX_CACHE_ENTRY_COUNT {
            let spec_id = format!("auth-{index}");
            fs::create_dir_all(workspace.path(&format!(".plugin-workspace/.specs/{spec_id}")))
                .expect("spec directory should be created");
            workspace.write(
                &format!(".plugin-workspace/.specs/{spec_id}/tasks.md"),
                "# Tasks",
            );
            cache
                .read_spec_file(&reader, &layout, &config, &spec_id, SpecFileKey::Tasks)
                .expect("read should populate cache");
        }

        let entries = cache.entries.read().expect("cache lock should be readable");
        assert_eq!(MAX_CACHE_ENTRY_COUNT, entries.documents.len());
    }
}
