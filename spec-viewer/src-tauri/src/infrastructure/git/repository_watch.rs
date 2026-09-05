use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
};

const WATCH_LIMIT: usize = 16;

type WatchKey = Vec<u8>;

struct RepositoryWatch {
    generation: Arc<AtomicU64>,
    _watcher: RecommendedWatcher,
}

impl std::fmt::Debug for RepositoryWatch {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("RepositoryWatch")
            .field("generation", &self.generation.load(Ordering::Acquire))
            .finish_non_exhaustive()
    }
}

#[derive(Debug, Clone, Default)]
pub struct RepositoryWatchRegistry {
    entries: Arc<Mutex<BTreeMap<WatchKey, RepositoryWatch>>>,
}

impl RepositoryWatchRegistry {
    pub fn generation(&self, root: &Path, git_dirs: &[PathBuf]) -> Option<u64> {
        let key = root.as_os_str().as_encoded_bytes().to_vec();
        let mut entries = self.entries.lock().ok()?;
        if !entries.contains_key(&key) {
            let watch = RepositoryWatch::new(root, git_dirs).ok()?;
            if entries.len() >= WATCH_LIMIT {
                entries.pop_first();
            }
            entries.insert(key.clone(), watch);
        }
        entries
            .get(&key)
            .map(|watch| watch.generation.load(Ordering::Acquire))
    }
}

impl RepositoryWatch {
    fn new(root: &Path, git_dirs: &[PathBuf]) -> notify::Result<Self> {
        let generation = Arc::new(AtomicU64::new(0));
        let changed_generation = Arc::clone(&generation);
        let mut watcher = notify::recommended_watcher(
            move |result: notify::Result<notify::Event>| match result {
                Ok(event) if matches!(event.kind, EventKind::Access(_)) => {}
                Ok(_) | Err(_) => {
                    changed_generation.fetch_add(1, Ordering::AcqRel);
                }
            },
        )?;
        watcher.watch(root, RecursiveMode::Recursive)?;
        for git_dir in git_dirs {
            if !git_dir.starts_with(root) {
                watcher.watch(git_dir, RecursiveMode::Recursive)?;
            }
        }
        Ok(Self {
            generation,
            _watcher: watcher,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs, thread,
        time::{Duration, Instant, SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn worktree_change_advances_repository_generation() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-repository-watch-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        let registry = RepositoryWatchRegistry::default();
        let initial = registry.generation(&root, &[]).unwrap();
        fs::write(root.join("changed.txt"), "changed\n").unwrap();
        let started_at = Instant::now();
        let observed = loop {
            let current = registry.generation(&root, &[]).unwrap();
            if current > initial || started_at.elapsed() >= Duration::from_secs(2) {
                break current;
            }
            thread::sleep(Duration::from_millis(10));
        };
        assert!(observed > initial);
        drop(registry);
        fs::remove_dir_all(root).unwrap();
    }
}
