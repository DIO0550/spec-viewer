//! Strict JSON v1 codec for repository Diff comments.

use std::{cell::Cell, collections::HashSet, fmt, num::NonZeroU32, rc::Rc};

use chrono::{DateTime, Utc};
use serde::{
    de::{self, DeserializeOwned, MapAccess, SeqAccess, Visitor},
    Deserialize, Deserializer, Serialize,
};
use serde_json::Value;
use thiserror::Error;

use crate::domain::{
    comment::diff::{
        DiffAnchorTarget, DiffCommentRevision, DiffLineAnchor, DiffReviewIdentity, DiffSide,
        StoredDiffComment, StoredDiffCommentDocument, WorktreeStorageId,
    },
    repository::{CommitSha, RepositoryId, RepositoryRelativePath, SnapshotId},
};

pub const MAX_DIFF_COMMENT_JSON_BYTES: usize = 8 * 1024 * 1024;
const MAX_JSON_DEPTH: usize = 32;
const MAX_JSON_NODES: usize = 250_000;

#[derive(Debug, Error)]
pub enum DiffCommentJsonError {
    #[error("Diff comment JSON exceeds the byte limit")]
    TooLarge,
    #[error("invalid Diff comment JSON: {0}")]
    Invalid(String),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DocumentDto {
    version: u8,
    repository_id: String,
    worktree_id: String,
    revision: String,
    comments: Vec<CommentDto>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CommentDto {
    id: String,
    body: String,
    resolved: bool,
    created_at: DateTime<Utc>,
    anchor: AnchorDto,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AnchorDto {
    repository_id: String,
    worktree_id: String,
    base_sha: String,
    current_snapshot_id: String,
    side: SideDto,
    #[serde(skip_serializing_if = "Option::is_none")]
    old_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    new_path: Option<String>,
    line: u32,
    line_hash: String,
    snippet: String,
    context_before: Vec<String>,
    context_after: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum SideDto {
    Base,
    Current,
}

pub fn encode(document: &StoredDiffCommentDocument) -> Result<Vec<u8>, DiffCommentJsonError> {
    let dto = DocumentDto {
        version: 1,
        repository_id: document.scope().repository_id().as_str().into(),
        worktree_id: document.scope().worktree_id().as_str().into(),
        revision: document.revision().to_string(),
        comments: document.comments().iter().map(CommentDto::from).collect(),
    };
    let mut bytes = serde_json::to_vec_pretty(&dto)
        .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))?;
    bytes.push(b'\n');
    if bytes.len() > MAX_DIFF_COMMENT_JSON_BYTES {
        return Err(DiffCommentJsonError::TooLarge);
    }
    Ok(bytes)
}

pub fn decode(
    bytes: &[u8],
    expected: &DiffReviewIdentity,
) -> Result<StoredDiffCommentDocument, DiffCommentJsonError> {
    if bytes.len() > MAX_DIFF_COMMENT_JSON_BYTES {
        return Err(DiffCommentJsonError::TooLarge);
    }
    let mut deserializer = serde_json::Deserializer::from_slice(bytes);
    let value = (&mut deserializer)
        .deserialize_any(UniqueValueVisitor::root())
        .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))?;
    deserializer
        .end()
        .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))?;
    let dto: DocumentDto = from_value(value)?;
    if dto.version != 1
        || dto.repository_id != expected.repository_id().as_str()
        || dto.worktree_id != expected.worktree_id().as_str()
    {
        return Err(DiffCommentJsonError::Invalid(
            "identity or version mismatch".into(),
        ));
    }
    let revision = dto
        .revision
        .parse::<DiffCommentRevision>()
        .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))?;
    let comments = dto
        .comments
        .into_iter()
        .map(|comment| comment.into_domain(&expected.scope()))
        .collect::<Result<Vec<_>, _>>()?;
    StoredDiffCommentDocument::new(expected.scope(), revision, comments)
        .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))
}

fn from_value<T: DeserializeOwned>(value: Value) -> Result<T, DiffCommentJsonError> {
    serde_json::from_value(value).map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))
}

impl From<&StoredDiffComment> for CommentDto {
    fn from(comment: &StoredDiffComment) -> Self {
        let anchor = comment.anchor();
        let target = anchor.target();
        Self {
            id: comment.id().into(),
            body: comment.body().into(),
            resolved: comment.resolved(),
            created_at: comment.created_at(),
            anchor: AnchorDto {
                repository_id: anchor.identity().repository_id().as_str().into(),
                worktree_id: anchor.identity().worktree_id().as_str().into(),
                base_sha: anchor.identity().base_sha().as_str().into(),
                current_snapshot_id: anchor.identity().current_snapshot_id().as_str().into(),
                side: match target.side() {
                    DiffSide::Base => SideDto::Base,
                    DiffSide::Current => SideDto::Current,
                },
                old_path: target.old_path().map(|path| path.as_str().into()),
                new_path: target.new_path().map(|path| path.as_str().into()),
                line: target.line().get(),
                line_hash: anchor.line_hash().into(),
                snippet: anchor.snippet().into(),
                context_before: anchor.context_before().to_vec(),
                context_after: anchor.context_after().to_vec(),
            },
        }
    }
}

impl CommentDto {
    fn into_domain(
        self,
        expected: &crate::domain::comment::diff::DiffCommentScope,
    ) -> Result<StoredDiffComment, DiffCommentJsonError> {
        let identity = DiffReviewIdentity::new(
            RepositoryId::parse(self.anchor.repository_id)
                .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))?,
            WorktreeStorageId::parse(self.anchor.worktree_id)
                .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))?,
            CommitSha::parse(self.anchor.base_sha)
                .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))?,
            SnapshotId::parse(self.anchor.current_snapshot_id)
                .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))?,
        );
        if identity.scope() != *expected {
            return Err(DiffCommentJsonError::Invalid(
                "anchor identity mismatch".into(),
            ));
        }
        let target = DiffAnchorTarget::new(
            match self.anchor.side {
                SideDto::Base => DiffSide::Base,
                SideDto::Current => DiffSide::Current,
            },
            self.anchor
                .old_path
                .map(RepositoryRelativePath::parse)
                .transpose()
                .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))?,
            self.anchor
                .new_path
                .map(RepositoryRelativePath::parse)
                .transpose()
                .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))?,
            NonZeroU32::new(self.anchor.line)
                .ok_or_else(|| DiffCommentJsonError::Invalid("line must be non-zero".into()))?,
        )
        .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))?;
        let anchor = DiffLineAnchor::new(
            identity,
            target,
            self.anchor.line_hash,
            self.anchor.snippet,
            self.anchor.context_before,
            self.anchor.context_after,
        )
        .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))?;
        StoredDiffComment::new(self.id, self.body, self.resolved, self.created_at, anchor)
            .map_err(|error| DiffCommentJsonError::Invalid(error.to_string()))
    }
}

#[derive(Clone)]
struct UniqueValueVisitor {
    nodes: Rc<Cell<usize>>,
    depth: usize,
}

impl UniqueValueVisitor {
    fn root() -> Self {
        Self {
            nodes: Rc::new(Cell::new(1)),
            depth: 0,
        }
    }
    fn seed<E: de::Error>(&self) -> Result<UniqueSeed, E> {
        let depth = self.depth + 1;
        let nodes = self.nodes.get().saturating_add(1);
        if depth > MAX_JSON_DEPTH || nodes > MAX_JSON_NODES {
            return Err(E::custom("JSON structural budget exceeded"));
        }
        self.nodes.set(nodes);
        Ok(UniqueSeed {
            visitor: Self {
                nodes: Rc::clone(&self.nodes),
                depth,
            },
        })
    }
}

impl<'de> Visitor<'de> for UniqueValueVisitor {
    type Value = Value;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("JSON without duplicate object keys")
    }

    fn visit_bool<E: de::Error>(self, value: bool) -> Result<Self::Value, E> {
        Ok(Value::Bool(value))
    }
    fn visit_i64<E: de::Error>(self, value: i64) -> Result<Self::Value, E> {
        Ok(Value::Number(value.into()))
    }
    fn visit_u64<E: de::Error>(self, value: u64) -> Result<Self::Value, E> {
        Ok(Value::Number(value.into()))
    }
    fn visit_f64<E: de::Error>(self, value: f64) -> Result<Self::Value, E> {
        serde_json::Number::from_f64(value)
            .map(Value::Number)
            .ok_or_else(|| E::custom("non-finite number"))
    }
    fn visit_str<E: de::Error>(self, value: &str) -> Result<Self::Value, E> {
        Ok(Value::String(value.into()))
    }
    fn visit_string<E: de::Error>(self, value: String) -> Result<Self::Value, E> {
        Ok(Value::String(value))
    }
    fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
        Ok(Value::Null)
    }
    fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
        Ok(Value::Null)
    }
    fn visit_some<D: serde::Deserializer<'de>>(
        self,
        deserializer: D,
    ) -> Result<Self::Value, D::Error> {
        deserializer.deserialize_any(self.seed::<D::Error>()?.visitor)
    }
    fn visit_seq<A: SeqAccess<'de>>(self, mut sequence: A) -> Result<Self::Value, A::Error> {
        let mut values = Vec::new();
        while let Some(value) = sequence.next_element_seed(self.seed::<A::Error>()?)? {
            values.push(value);
        }
        Ok(Value::Array(values))
    }
    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
        let mut seen = HashSet::new();
        let mut values = serde_json::Map::new();
        while let Some(key) = map.next_key::<String>()? {
            if !seen.insert(key.clone()) {
                return Err(de::Error::custom(format!("duplicate key: {key}")));
            }
            values.insert(key, map.next_value_seed(self.seed::<A::Error>()?)?);
        }
        Ok(Value::Object(values))
    }
}

struct UniqueSeed {
    visitor: UniqueValueVisitor,
}
impl<'de> de::DeserializeSeed<'de> for UniqueSeed {
    type Value = Value;
    fn deserialize<D: serde::Deserializer<'de>>(
        self,
        deserializer: D,
    ) -> Result<Self::Value, D::Error> {
        deserializer.deserialize_any(self.visitor)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn identity() -> DiffReviewIdentity {
        DiffReviewIdentity::new(
            RepositoryId::parse(format!("rr1_{}", "1".repeat(64))).unwrap(),
            WorktreeStorageId::parse(format!("rw1_{}", "2".repeat(64))).unwrap(),
            CommitSha::parse("3".repeat(40)).unwrap(),
            SnapshotId::parse(format!("rs1_{}", "4".repeat(64))).unwrap(),
        )
    }

    fn refreshed_identity() -> DiffReviewIdentity {
        DiffReviewIdentity::new(
            identity().repository_id().clone(),
            identity().worktree_id().clone(),
            CommitSha::parse("5".repeat(40)).unwrap(),
            SnapshotId::parse(format!("rs1_{}", "6".repeat(64))).unwrap(),
        )
    }

    fn historical_document() -> StoredDiffCommentDocument {
        let target = DiffAnchorTarget::new(
            DiffSide::Current,
            None,
            Some(RepositoryRelativePath::parse("src/lib.rs").unwrap()),
            NonZeroU32::new(1).unwrap(),
        )
        .unwrap();
        let anchor = DiffLineAnchor::new(
            identity(),
            target,
            crate::domain::comment::diff::line_hash("line"),
            "line".into(),
            vec![],
            vec![],
        )
        .unwrap();
        let comment = StoredDiffComment::new(
            "historical".into(),
            "body".into(),
            false,
            Utc::now(),
            anchor,
        )
        .unwrap();
        StoredDiffCommentDocument::new(identity().scope(), DiffCommentRevision::ZERO, vec![comment])
            .unwrap()
    }

    #[test]
    fn duplicate_keys_are_rejected_before_typed_decode() {
        let bytes = br#"{"version":1,"version":1}"#;
        assert!(decode(bytes, &identity())
            .unwrap_err()
            .to_string()
            .contains("duplicate key"));
    }

    #[test]
    fn trailing_json_value_is_rejected() {
        let bytes = br#"{"version":1} {"version":1}"#;
        assert!(decode(bytes, &identity()).is_err());
    }

    #[test]
    fn deeply_nested_json_hits_streaming_structural_budget() {
        let bytes = format!(
            "{}null{}",
            "[".repeat(MAX_JSON_DEPTH + 1),
            "]".repeat(MAX_JSON_DEPTH + 1)
        );
        assert!(decode(bytes.as_bytes(), &identity())
            .unwrap_err()
            .to_string()
            .contains("structural budget"));
    }

    #[test]
    fn unknown_runtime_storage_fields_are_rejected() {
        let value = format!(
            r#"{{"version":1,"repositoryId":"{}","worktreeId":"{}","revision":"0","comments":[],"status":"exact"}}"#,
            identity().repository_id().as_str(),
            identity().worktree_id().as_str(),
        );
        assert!(decode(value.as_bytes(), &identity()).is_err());
    }

    #[test]
    fn refreshed_base_and_snapshot_accept_historical_anchor_in_same_scope() {
        let decoded = decode(
            &encode(&historical_document()).unwrap(),
            &refreshed_identity(),
        )
        .unwrap();
        assert_eq!(decoded.scope(), &refreshed_identity().scope());
        assert_eq!(decoded.comments()[0].anchor().identity(), &identity());
    }

    #[test]
    fn historical_anchor_from_another_repository_scope_is_rejected() {
        let mut value: Value =
            serde_json::from_slice(&encode(&historical_document()).unwrap()).unwrap();
        value["comments"][0]["anchor"]["repositoryId"] =
            Value::String(format!("rr1_{}", "9".repeat(64)));
        assert!(decode(&serde_json::to_vec(&value).unwrap(), &refreshed_identity()).is_err());
    }
}
