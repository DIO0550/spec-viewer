//! JSON-backed comment repository implementation.

use std::{
    collections::HashMap,
    fs, io,
    path::Path,
    sync::{Mutex, MutexGuard},
};

use serde_json::{Map, Value};
use uuid::Uuid;

use crate::{
    domain::{
        comment::{
            CommentRepository, CommentRepositoryError, CommentScope, ScopedComments,
            ScopedCommentsError,
        },
        workspace::WorkspaceLayout,
    },
    infrastructure::persistence::{
        comment_paths::{CommentStoragePath, CommentStoragePathError, CommentStoragePathResolver},
        comments::{deserialize_comments, serialize_comments, CommentJsonError},
    },
};

static COMMENT_STORE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone)]
pub struct JsonCommentRepository {
    layout: WorkspaceLayout,
    path_resolver: CommentStoragePathResolver,
}

impl JsonCommentRepository {
    pub fn new(layout: WorkspaceLayout) -> Self {
        Self {
            layout,
            path_resolver: CommentStoragePathResolver::new(),
        }
    }

    fn load_state(&self, scope: &CommentScope) -> Result<CommentFileState, CommentRepositoryError> {
        let path = self.resolve_path(scope)?;
        let contents = match fs::read_to_string(path.file_path()) {
            Ok(contents) => contents,
            Err(source) if source.kind() == io::ErrorKind::NotFound => {
                return Ok(CommentFileState {
                    path,
                    comments: ScopedComments::restore(scope.clone(), Vec::new())
                        .map_err(restored_data_error)?,
                    previous_json: None,
                });
            }
            Err(source) => {
                return Err(CommentRepositoryError::unavailable(format!(
                    "failed to read comment file {}: {source}",
                    display_path(path.file_path())
                )));
            }
        };

        let comments = deserialize_comments(scope.clone(), &contents).map_err(json_error)?;
        let previous_json = serde_json::from_str(&contents).map_err(|source| {
            CommentRepositoryError::invalid_data(format!(
                "comment JSON is malformed at {}: {source}",
                display_path(path.file_path())
            ))
        })?;

        Ok(CommentFileState {
            path,
            comments,
            previous_json: Some(previous_json),
        })
    }

    fn resolve_path(
        &self,
        scope: &CommentScope,
    ) -> Result<CommentStoragePath, CommentRepositoryError> {
        self.path_resolver
            .resolve(&self.layout, scope)
            .map_err(storage_path_error)
    }

    fn write(
        &self,
        state: &CommentFileState,
        comments: &ScopedComments,
    ) -> Result<(), CommentRepositoryError> {
        state
            .path
            .ensure_comments_directory()
            .map_err(storage_path_error)?;

        let document = build_comment_document(comments, state.previous_json.as_ref())?;
        let contents = serde_json::to_string_pretty(&document).map_err(|source| {
            CommentRepositoryError::invalid_data(format!(
                "failed to serialize comment JSON: {source}"
            ))
        })?;

        write_via_temp_file(state.path.file_path(), &contents)
    }
}

impl CommentRepository for JsonCommentRepository {
    fn load(&self, scope: &CommentScope) -> Result<ScopedComments, CommentRepositoryError> {
        let _store_guard = lock_comment_store()?;
        let state = self.load_state(scope)?;

        Ok(state.comments)
    }

    fn save(&self, comments: &ScopedComments) -> Result<(), CommentRepositoryError> {
        let _store_guard = lock_comment_store()?;
        let state = self.load_state(comments.scope())?;

        self.write(&state, comments)
    }

    fn transaction(
        &self,
        scope: &CommentScope,
        operation: &mut dyn FnMut(&mut ScopedComments) -> Result<(), ScopedCommentsError>,
    ) -> Result<(), CommentRepositoryError> {
        let _store_guard = lock_comment_store()?;
        let mut state = self.load_state(scope)?;
        operation(&mut state.comments).map_err(CommentRepositoryError::from)?;

        self.write(&state, &state.comments)
    }
}

#[derive(Debug)]
struct CommentFileState {
    path: CommentStoragePath,
    comments: ScopedComments,
    previous_json: Option<Value>,
}

fn lock_comment_store() -> Result<MutexGuard<'static, ()>, CommentRepositoryError> {
    COMMENT_STORE_LOCK
        .lock()
        .map_err(|_| CommentRepositoryError::unavailable("comment store lock is poisoned"))
}

fn restored_data_error(error: ScopedCommentsError) -> CommentRepositoryError {
    CommentRepositoryError::invalid_data(error.to_string())
}

fn build_comment_document(
    comments: &ScopedComments,
    previous_json: Option<&Value>,
) -> Result<Value, CommentRepositoryError> {
    let previous_records = previous_comment_records_by_id(previous_json);
    let serialized = serialize_comments(comments).map_err(json_error)?;
    let canonical_document: Value = serde_json::from_str(&serialized).map_err(|source| {
        CommentRepositoryError::invalid_data(format!(
            "serialized comment JSON did not parse: {source}"
        ))
    })?;
    let canonical_version = canonical_document.get("version").cloned().ok_or_else(|| {
        CommentRepositoryError::invalid_data("serialized comment JSON had no version")
    })?;
    let canonical_records = canonical_document
        .get("comments")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            CommentRepositoryError::invalid_data("serialized comment JSON had no comments array")
        })?;
    let comments = canonical_records
        .iter()
        .map(|record| {
            let id = record.get("id").and_then(Value::as_str).ok_or_else(|| {
                CommentRepositoryError::invalid_data("serialized comment record had no id")
            })?;

            Ok(match previous_records.get(id) {
                Some(previous_record) => {
                    merge_known_fields(previous_record.clone(), record.clone())
                }
                None => record.clone(),
            })
        })
        .collect::<Result<Vec<_>, CommentRepositoryError>>()?;

    let mut document = match previous_json {
        Some(Value::Object(object)) => Value::Object(object.clone()),
        _ => Value::Object(Map::new()),
    };

    if let Value::Object(object) = &mut document {
        object.insert("version".to_string(), canonical_version);
        object.insert("comments".to_string(), Value::Array(comments));
    }

    Ok(document)
}

fn previous_comment_records_by_id(previous_json: Option<&Value>) -> HashMap<String, Value> {
    let Some(previous_json) = previous_json else {
        return HashMap::new();
    };
    let comments = match previous_json {
        Value::Object(object) => object.get("comments").and_then(Value::as_array),
        Value::Array(comments) => Some(comments),
        _ => None,
    };
    let Some(comments) = comments else {
        return HashMap::new();
    };

    comments
        .iter()
        .filter_map(|record| {
            record
                .get("id")
                .and_then(Value::as_str)
                .map(|id| (id.to_string(), record.clone()))
        })
        .collect()
}

fn merge_known_fields(previous: Value, current: Value) -> Value {
    match (previous, current) {
        (Value::Object(mut previous_object), Value::Object(current_object)) => {
            for (key, value) in current_object {
                if key == "anchor" {
                    merge_anchor_field(&mut previous_object, value);
                } else {
                    previous_object.insert(key, value);
                }
            }

            Value::Object(previous_object)
        }
        (_, current) => current,
    }
}

fn merge_anchor_field(previous_object: &mut Map<String, Value>, current_anchor: Value) {
    match (previous_object.get_mut("anchor"), current_anchor) {
        (Some(Value::Object(previous_anchor_object)), Value::Object(current_anchor_object)) => {
            for (key, value) in current_anchor_object {
                previous_anchor_object.insert(key, value);
            }
        }
        (_, current_anchor) => {
            previous_object.insert("anchor".to_string(), current_anchor);
        }
    }
}

fn write_via_temp_file(path: &Path, contents: &str) -> Result<(), CommentRepositoryError> {
    let parent = path.parent().ok_or_else(|| {
        CommentRepositoryError::unavailable(format!(
            "comment file has no parent directory: {}",
            display_path(path)
        ))
    })?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| {
            CommentRepositoryError::unavailable(format!(
                "comment file name is not valid UTF-8: {}",
                display_path(path)
            ))
        })?;
    let temp_path = parent.join(format!(".{file_name}.{}.tmp", Uuid::new_v4()));

    fs::write(&temp_path, contents).map_err(|source| {
        CommentRepositoryError::unavailable(format!(
            "failed to write temp comment file {}: {source}",
            display_path(&temp_path)
        ))
    })?;

    match fs::rename(&temp_path, path) {
        Ok(()) => Ok(()),
        Err(source) if source.kind() == io::ErrorKind::AlreadyExists => {
            fs::remove_file(path).map_err(|remove_source| {
                let _ = fs::remove_file(&temp_path);
                CommentRepositoryError::unavailable(format!(
                    "failed to replace comment file {}: {remove_source}",
                    display_path(path)
                ))
            })?;
            fs::rename(&temp_path, path).map_err(|rename_source| {
                let _ = fs::remove_file(&temp_path);
                CommentRepositoryError::unavailable(format!(
                    "failed to move temp comment file {} into place: {rename_source}",
                    display_path(&temp_path)
                ))
            })
        }
        Err(source) => {
            let _ = fs::remove_file(&temp_path);
            Err(CommentRepositoryError::unavailable(format!(
                "failed to move temp comment file {} into place: {source}",
                display_path(&temp_path)
            )))
        }
    }
}

fn storage_path_error(error: CommentStoragePathError) -> CommentRepositoryError {
    match error {
        CommentStoragePathError::PathEscapesSpecDirectory { path } => {
            CommentRepositoryError::invalid_data(format!(
                "comment storage path escapes selected spec folder: {path}"
            ))
        }
        CommentStoragePathError::CreateCommentsDirectory { path, source } => {
            CommentRepositoryError::unavailable(format!(
                "failed to create comment storage directory {path}: {source}"
            ))
        }
    }
}

fn json_error(error: CommentJsonError) -> CommentRepositoryError {
    CommentRepositoryError::invalid_data(error.to_string())
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::PathBuf,
        sync::{Arc, Barrier},
        thread,
        time::{SystemTime, UNIX_EPOCH},
    };

    use chrono::{DateTime, Utc};

    use super::*;
    use crate::domain::{
        comment::{
            BlockIndex, BlockType, CharRange, Comment, CommentAnchor, CommentBody, CommentId,
            CommentListQuery, CommentStatus, TextHash, TextSnippet,
        },
        spec::{SpecFileKey, SpecId},
        workspace::{WorkspaceKind, WorkspaceRoot},
    };

    trait CommentRepositoryTestExt: CommentRepository {
        fn list(&self, query: &CommentListQuery) -> Result<Vec<Comment>, CommentRepositoryError> {
            let comments = self.load(query.scope())?;

            Ok(comments
                .comments()
                .iter()
                .filter(|comment| query.includes(comment))
                .cloned()
                .collect())
        }

        fn add(
            &self,
            scope: &CommentScope,
            comment: Comment,
        ) -> Result<Comment, CommentRepositoryError> {
            let added = comment.clone();
            self.transaction(scope, &mut |comments| {
                comments.add(comment.clone()).map(drop)
            })?;

            Ok(added)
        }

        fn update(
            &self,
            scope: &CommentScope,
            comment: Comment,
        ) -> Result<Comment, CommentRepositoryError> {
            let updated = comment.clone();
            self.transaction(scope, &mut |comments| {
                comments.update(comment.clone()).map(drop)
            })?;

            Ok(updated)
        }

        fn delete(
            &self,
            scope: &CommentScope,
            id: &CommentId,
        ) -> Result<(), CommentRepositoryError> {
            self.transaction(scope, &mut |comments| comments.delete(id).map(drop))
        }
    }

    impl<Repository> CommentRepositoryTestExt for Repository where Repository: CommentRepository {}

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
                "spec-reviewer-comment-store-{name}-{}-{timestamp}",
                std::process::id()
            ));
            fs::create_dir_all(&root).expect("test workspace root should be created");

            Self { root }
        }

        fn layout(&self, kind: WorkspaceKind) -> WorkspaceLayout {
            let root = WorkspaceRoot::new(self.root.to_string_lossy())
                .expect("test workspace root should be valid");

            WorkspaceLayout::new(root, kind)
        }

        fn repository(&self) -> JsonCommentRepository {
            JsonCommentRepository::new(self.layout(WorkspaceKind::PluginWorkspace))
        }

        fn create_spec(&self, spec_id: &str) {
            fs::create_dir_all(
                self.root
                    .join(".plugin-workspace/.specs")
                    .join(spec_id)
                    .join(".comments"),
            )
            .expect("test spec comments directory should be created");
        }

        fn write_comment_file(&self, spec_id: &str, file_key: SpecFileKey, contents: &str) {
            self.create_spec(spec_id);
            fs::write(self.comment_file_path(spec_id, file_key), contents)
                .expect("test comment file should be written");
        }

        fn write_unknown_comment_file(&self, spec_id: &str, file_name: &str, contents: &str) {
            self.create_spec(spec_id);
            fs::write(
                self.root
                    .join(".plugin-workspace/.specs")
                    .join(spec_id)
                    .join(".comments")
                    .join(file_name),
                contents,
            )
            .expect("unknown test comment file should be written");
        }

        fn comment_file_path(&self, spec_id: &str, file_key: SpecFileKey) -> PathBuf {
            self.root
                .join(".plugin-workspace/.specs")
                .join(spec_id)
                .join(".comments")
                .join(format!("{}.json", file_key.as_str()))
        }

        fn read_comment_json(&self, spec_id: &str, file_key: SpecFileKey) -> Value {
            let contents = fs::read_to_string(self.comment_file_path(spec_id, file_key))
                .expect("comment file should be readable");

            serde_json::from_str(&contents).expect("comment file should parse")
        }

        fn comments_directory_entries(&self, spec_id: &str) -> Vec<String> {
            let mut entries = fs::read_dir(
                self.root
                    .join(".plugin-workspace/.specs")
                    .join(spec_id)
                    .join(".comments"),
            )
            .expect("comments directory should exist")
            .map(|entry| {
                entry
                    .expect("directory entry should be readable")
                    .file_name()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect::<Vec<_>>();
            entries.sort();
            entries
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn timestamp(second: u32) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(&format!("2026-05-05T12:00:{second:02}Z"))
            .expect("timestamp should parse")
            .with_timezone(&Utc)
    }

    fn scope(spec_id: &str, file_key: SpecFileKey) -> CommentScope {
        CommentScope::new(
            SpecId::new(spec_id).expect("spec id should be valid"),
            file_key,
        )
    }

    fn comment(
        id: &str,
        file_key: SpecFileKey,
        body: &str,
        status: CommentStatus,
        updated_second: u32,
    ) -> Comment {
        Comment::restore(
            CommentId::new(id).expect("comment id should be valid"),
            CommentAnchor::new(
                file_key,
                BlockType::Paragraph,
                BlockIndex::new(2),
                TextHash::new("sha256_prefix_8chars").expect("hash should be valid"),
                TextSnippet::new("selected text").expect("snippet should be valid"),
                CharRange::new(3, 16).expect("range should be valid"),
            ),
            CommentBody::new(body).expect("body should be valid"),
            status,
            timestamp(1),
            timestamp(updated_second),
        )
        .expect("comment should be valid")
    }

    #[test]
    fn list_returns_empty_comments_when_file_is_missing() {
        let workspace = TestWorkspace::new("missing");
        let repository = workspace.repository();
        let query = CommentListQuery::new(scope("auth-flow", SpecFileKey::Impl));

        let comments = repository
            .list(&query)
            .expect("missing comment file should read as empty");

        assert!(comments.is_empty());
    }

    #[test]
    fn add_update_delete_and_list_comments() {
        let workspace = TestWorkspace::new("crud");
        let repository = workspace.repository();
        let scope = scope("auth-flow", SpecFileKey::Impl);
        let open_comment = comment(
            "cmt_open",
            SpecFileKey::Impl,
            "Clarify token expiry",
            CommentStatus::Open,
            1,
        );
        let resolved_comment = comment(
            "cmt_resolved",
            SpecFileKey::Impl,
            "Already answered",
            CommentStatus::Resolved,
            2,
        );

        repository
            .add(&scope, open_comment.clone())
            .expect("open comment should be added");
        repository
            .add(&scope, resolved_comment.clone())
            .expect("resolved comment should be added");

        assert_eq!(
            vec![open_comment.clone(), resolved_comment.clone()],
            repository
                .list(&CommentListQuery::new(scope.clone()))
                .expect("comments should list")
        );
        assert_eq!(
            vec![open_comment.clone()],
            repository
                .list(&CommentListQuery::open(scope.clone()))
                .expect("open comments should list")
        );

        let updated = comment(
            "cmt_open",
            SpecFileKey::Impl,
            "Clarify access token expiry",
            CommentStatus::Resolved,
            3,
        );
        repository
            .update(&scope, updated.clone())
            .expect("comment should update by id");
        repository
            .delete(&scope, resolved_comment.id())
            .expect("comment should delete by id");

        assert_eq!(
            vec![updated],
            repository
                .list(&CommentListQuery::new(scope))
                .expect("updated comments should list")
        );
    }

    #[test]
    fn update_rejects_older_timestamp_without_overwriting_newer_persisted_comment() {
        let workspace = TestWorkspace::new("stale-update");
        let repository = workspace.repository();
        let scope = scope("auth-flow", SpecFileKey::Impl);
        let initial = comment(
            "cmt_stale",
            SpecFileKey::Impl,
            "Initial body",
            CommentStatus::Open,
            1,
        );
        let newer = comment(
            "cmt_stale",
            SpecFileKey::Impl,
            "Newer body",
            CommentStatus::Resolved,
            3,
        );
        let stale = comment(
            "cmt_stale",
            SpecFileKey::Impl,
            "Stale body",
            CommentStatus::Open,
            2,
        );
        repository
            .add(&scope, initial)
            .expect("initial comment should be added");
        repository
            .update(&scope, newer.clone())
            .expect("newer comment should be persisted");

        let result = repository.update(&scope, stale.clone());

        assert_eq!(
            Err(CommentRepositoryError::StaleUpdate {
                id: stale.id().clone(),
                current: timestamp(3),
                attempted: timestamp(2),
            }),
            result
        );
        assert_eq!(
            vec![newer],
            repository
                .list(&CommentListQuery::new(scope))
                .expect("newer persisted comment should remain")
        );
    }

    #[test]
    fn concurrent_updates_keep_the_greatest_persisted_timestamp() {
        let workspace = TestWorkspace::new("concurrent-update");
        let repository = workspace.repository();
        let scope = scope("auth-flow", SpecFileKey::Impl);
        repository
            .add(
                &scope,
                comment(
                    "cmt_concurrent",
                    SpecFileKey::Impl,
                    "Initial body",
                    CommentStatus::Open,
                    1,
                ),
            )
            .expect("initial comment should be added");

        let barrier = Arc::new(Barrier::new(3));
        let stale_repository = repository.clone();
        let stale_scope = scope.clone();
        let stale_barrier = barrier.clone();
        let stale = comment(
            "cmt_concurrent",
            SpecFileKey::Impl,
            "Stale body",
            CommentStatus::Open,
            2,
        );
        let stale_for_thread = stale.clone();
        let stale_update = thread::spawn(move || {
            stale_barrier.wait();
            stale_repository.update(&stale_scope, stale_for_thread)
        });
        let newer_repository = repository.clone();
        let newer_scope = scope.clone();
        let newer_barrier = barrier.clone();
        let newer = comment(
            "cmt_concurrent",
            SpecFileKey::Impl,
            "Newer body",
            CommentStatus::Resolved,
            3,
        );
        let newer_for_thread = newer.clone();
        let newer_update = thread::spawn(move || {
            newer_barrier.wait();
            newer_repository.update(&newer_scope, newer_for_thread)
        });

        barrier.wait();
        let stale_result = stale_update.join().expect("stale thread should finish");
        let newer_result = newer_update.join().expect("newer thread should finish");

        assert!(
            stale_result == Ok(stale.clone())
                || stale_result
                    == Err(CommentRepositoryError::StaleUpdate {
                        id: stale.id().clone(),
                        current: timestamp(3),
                        attempted: timestamp(2),
                    })
        );
        assert_eq!(Ok(newer.clone()), newer_result);
        assert_eq!(
            vec![newer],
            repository
                .list(&CommentListQuery::new(scope))
                .expect("greatest timestamp should remain")
        );
    }

    #[test]
    fn add_rejects_duplicate_ids_without_overwriting_file() {
        let workspace = TestWorkspace::new("duplicate-add");
        let repository = workspace.repository();
        let scope = scope("auth-flow", SpecFileKey::Tasks);
        let first = comment(
            "cmt_duplicate",
            SpecFileKey::Tasks,
            "First body",
            CommentStatus::Open,
            1,
        );
        let duplicate = comment(
            "cmt_duplicate",
            SpecFileKey::Tasks,
            "Second body",
            CommentStatus::Open,
            2,
        );

        repository
            .add(&scope, first.clone())
            .expect("first comment should be added");
        let result = repository.add(&scope, duplicate.clone());

        assert_eq!(
            Err(CommentRepositoryError::DuplicateComment {
                id: duplicate.id().clone()
            }),
            result
        );
        assert_eq!(
            vec![first],
            repository
                .list(&CommentListQuery::new(scope))
                .expect("original comment should remain")
        );
    }

    #[test]
    fn update_and_delete_return_typed_errors_for_missing_ids() {
        let workspace = TestWorkspace::new("missing-id");
        let repository = workspace.repository();
        let scope = scope("auth-flow", SpecFileKey::Impl);
        let missing = comment(
            "cmt_missing",
            SpecFileKey::Impl,
            "Missing",
            CommentStatus::Open,
            1,
        );

        assert_eq!(
            Err(CommentRepositoryError::CommentNotFound {
                id: missing.id().clone()
            }),
            repository.update(&scope, missing.clone())
        );
        assert_eq!(
            Err(CommentRepositoryError::CommentNotFound {
                id: missing.id().clone()
            }),
            repository.delete(&scope, missing.id())
        );
    }

    #[test]
    fn add_and_update_reject_comments_for_another_scope_file() {
        let workspace = TestWorkspace::new("scope-mismatch");
        let repository = workspace.repository();
        let scope = scope("auth-flow", SpecFileKey::Impl);
        let mismatched = comment(
            "cmt_mismatch",
            SpecFileKey::Tasks,
            "Wrong file",
            CommentStatus::Open,
            1,
        );

        assert_eq!(
            Err(CommentRepositoryError::ScopeMismatch {
                expected_file_key: SpecFileKey::Impl,
                actual_file_key: SpecFileKey::Tasks
            }),
            repository.add(&scope, mismatched.clone())
        );
        assert_eq!(
            Err(CommentRepositoryError::ScopeMismatch {
                expected_file_key: SpecFileKey::Impl,
                actual_file_key: SpecFileKey::Tasks
            }),
            repository.update(&scope, mismatched)
        );
    }

    #[test]
    fn malformed_json_returns_invalid_data() {
        let workspace = TestWorkspace::new("malformed");
        let repository = workspace.repository();
        workspace.write_comment_file("auth-flow", SpecFileKey::Impl, "{");

        let result = repository.list(&CommentListQuery::new(scope(
            "auth-flow",
            SpecFileKey::Impl,
        )));

        assert!(matches!(
            result,
            Err(CommentRepositoryError::InvalidData { message }) if message.contains("malformed")
        ));
    }

    #[test]
    fn duplicate_ids_in_existing_json_return_invalid_data_without_overwriting_file() {
        let workspace = TestWorkspace::new("duplicate-existing");
        let repository = workspace.repository();
        let scope = scope("auth-flow", SpecFileKey::Impl);
        workspace.write_comment_file(
            "auth-flow",
            SpecFileKey::Impl,
            r#"
{
  "version": 1,
  "comments": [
    {
      "id": "cmt_duplicate",
      "anchor": {
        "blockType": "paragraph",
        "blockIndex": 2,
        "textHash": "sha256_prefix_8chars",
        "textSnippet": "selected text",
        "charOffset": [3, 16]
      },
      "body": "First body",
      "resolved": false,
      "createdAt": "2026-05-05T12:00:01Z",
      "updatedAt": "2026-05-05T12:00:01Z"
    },
    {
      "id": "cmt_duplicate",
      "anchor": {
        "blockType": "paragraph",
        "blockIndex": 2,
        "textHash": "sha256_prefix_8chars",
        "textSnippet": "selected text",
        "charOffset": [3, 16]
      },
      "body": "Second body",
      "resolved": false,
      "createdAt": "2026-05-05T12:00:01Z",
      "updatedAt": "2026-05-05T12:00:02Z"
    }
  ]
}
"#,
        );
        let original =
            fs::read_to_string(workspace.comment_file_path("auth-flow", SpecFileKey::Impl))
                .expect("corrupt comment file should be readable");

        let result = repository.add(
            &scope,
            comment(
                "cmt_new",
                SpecFileKey::Impl,
                "New body",
                CommentStatus::Open,
                3,
            ),
        );

        assert!(matches!(
            result,
            Err(CommentRepositoryError::InvalidData { message })
                if message.contains("duplicate comment id")
        ));
        assert_eq!(
            original,
            fs::read_to_string(workspace.comment_file_path("auth-flow", SpecFileKey::Impl))
                .expect("corrupt comment file should remain readable")
        );
    }

    #[test]
    fn writes_via_temp_file_and_preserves_unknown_files_and_json_fields() {
        let workspace = TestWorkspace::new("preserve");
        let repository = workspace.repository();
        let scope = scope("auth-flow", SpecFileKey::Impl);
        workspace.write_unknown_comment_file("auth-flow", "notes.txt", "keep me");
        workspace.write_comment_file(
            "auth-flow",
            SpecFileKey::Impl,
            r#"
{
  "version": 1,
  "source": "external-tool",
  "comments": [
    {
      "id": "cmt_keep_metadata",
      "externalCommentField": "preserve",
      "anchor": {
        "blockType": "paragraph",
        "blockIndex": 2,
        "textHash": "sha256_prefix_8chars",
        "textSnippet": "selected text",
        "charOffset": [3, 16],
        "externalAnchorField": "preserve"
      },
      "body": "Old body",
      "resolved": false,
      "createdAt": "2026-05-05T12:00:01Z",
      "updatedAt": "2026-05-05T12:00:01Z"
    }
  ]
}
"#,
        );

        repository
            .update(
                &scope,
                comment(
                    "cmt_keep_metadata",
                    SpecFileKey::Impl,
                    "New body",
                    CommentStatus::Resolved,
                    2,
                ),
            )
            .expect("comment should update");

        let json = workspace.read_comment_json("auth-flow", SpecFileKey::Impl);
        assert_eq!(serde_json::json!("external-tool"), json["source"]);
        assert_eq!(
            serde_json::json!("preserve"),
            json["comments"][0]["externalCommentField"]
        );
        assert_eq!(
            serde_json::json!("preserve"),
            json["comments"][0]["anchor"]["externalAnchorField"]
        );
        assert_eq!(serde_json::json!("New body"), json["comments"][0]["body"]);
        assert_eq!(serde_json::json!(true), json["comments"][0]["resolved"]);
        assert_eq!(
            vec!["impl.json".to_string(), "notes.txt".to_string()],
            workspace.comments_directory_entries("auth-flow")
        );
    }

    #[test]
    fn first_write_creates_comment_directory_and_leaves_no_temp_file() {
        let workspace = TestWorkspace::new("temp");
        let repository = workspace.repository();
        let scope = scope("auth-flow", SpecFileKey::Impl);

        repository
            .add(
                &scope,
                comment(
                    "cmt_first",
                    SpecFileKey::Impl,
                    "First write",
                    CommentStatus::Open,
                    1,
                ),
            )
            .expect("comment should be added");

        assert_eq!(
            vec!["impl.json".to_string()],
            workspace.comments_directory_entries("auth-flow")
        );
        assert!(workspace
            .comment_file_path("auth-flow", SpecFileKey::Impl)
            .is_file());
    }
}
