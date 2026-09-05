//! Strict version 1 JSON boundary for user review records.

use std::{collections::HashSet, fmt, str::FromStr};

use chrono::{DateTime, SecondsFormat, Utc};
use serde::{
    de::{self, MapAccess, SeqAccess, Visitor},
    Deserialize, Deserializer, Serialize,
};
use serde_json::{Map, Number, Value};
use thiserror::Error;

use crate::domain::{
    comment::{CommentBody, CommentId, CommentStatus, TextSnippet},
    spec::{MarkdownBlockHash, MarkdownBlockType, SpecFileKey, SpecId},
    user_review::{
        PositiveLineNumber, UserReview, UserReviewComment, UserReviewDomainError, UserReviewId,
        UserReviewSource, UserReviewStatus, UserReviewTarget,
    },
    workspace::WorkspaceRelativePath,
};

pub const USER_REVIEW_DOCUMENT_SCHEMA_VERSION: &str = "spec-reviewer.user-review.v1";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UserReviewDocument {
    pub schema_version: String,
    pub id: String,
    pub status: UserReviewStatusDocument,
    pub created_at: String,
    pub updated_at: String,
    pub archived_at: UserReviewArchivedAtDocument,
    pub target: UserReviewTargetDocument,
    pub comments: Vec<UserReviewCommentDocument>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum UserReviewArchivedAtDocument {
    Timestamp(String),
    Null,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UserReviewStatusDocument {
    Active,
    Archived,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "scope",
    deny_unknown_fields
)]
pub enum UserReviewTargetDocument {
    File { spec_id: String, file_key: String },
    Spec { spec_id: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UserReviewCommentDocument {
    pub id: String,
    pub status: UserReviewCommentStatusDocument,
    pub source: UserReviewSourceDocument,
    pub block_type: MarkdownBlockTypeDocument,
    pub line_start: u32,
    pub line_end: u32,
    pub text_snippet: String,
    pub text_hash: String,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UserReviewCommentStatusDocument {
    Open,
    Resolved,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UserReviewSourceDocument {
    pub spec_id: String,
    pub file_key: String,
    pub file_path: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarkdownBlockTypeDocument {
    Paragraph,
    Heading,
    ListItem,
    CodeBlock,
    BlockQuote,
    Table,
    ThematicBreak,
    Html,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserReviewRecordInput<'a> {
    Document(&'a str),
    LegacyFolderBundle,
    LegacyReport,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum UserReviewRecordProblem {
    #[error("legacy user review record")]
    LegacyRecord,
    #[error("unsupported user review record version: {version}")]
    UnsupportedRecordVersion { version: String },
    #[error("malformed user review record: {reason}")]
    MalformedRecord { reason: String },
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum UserReviewDocumentConversionError {
    #[error("unsupported user review record version: {version}")]
    UnsupportedRecordVersion { version: String },
    #[error("invalid {field}: {reason}")]
    InvalidValue { field: &'static str, reason: String },
    #[error("user review invariant violation: {reason}")]
    DomainInvariant { reason: String },
}

#[derive(Debug, Error)]
pub enum UserReviewDocumentEncodeError {
    #[error("failed to encode user review document: {0}")]
    Serialize(#[from] serde_json::Error),
}

pub fn decode_user_review_record(
    input: UserReviewRecordInput<'_>,
) -> Result<UserReview, UserReviewRecordProblem> {
    match input {
        UserReviewRecordInput::Document(contents) => decode_user_review_document(contents),
        UserReviewRecordInput::LegacyFolderBundle | UserReviewRecordInput::LegacyReport => {
            Err(UserReviewRecordProblem::LegacyRecord)
        }
    }
}

pub fn decode_user_review_document(contents: &str) -> Result<UserReview, UserReviewRecordProblem> {
    let unique_value = serde_json::from_str::<UniqueJsonValue>(contents)
        .map_err(|error| malformed_record(error.to_string()))?;
    let root = unique_value
        .0
        .as_object()
        .ok_or_else(|| malformed_record("document root must be an object"))?;
    let schema_version = root
        .get("schemaVersion")
        .ok_or_else(|| malformed_record("schemaVersion is required"))?
        .as_str()
        .ok_or_else(|| malformed_record("schemaVersion must be a string"))?;

    if schema_version != USER_REVIEW_DOCUMENT_SCHEMA_VERSION {
        return Err(UserReviewRecordProblem::UnsupportedRecordVersion {
            version: schema_version.to_string(),
        });
    }

    let document = serde_json::from_value::<UserReviewDocument>(unique_value.0)
        .map_err(|error| malformed_record(error.to_string()))?;

    UserReview::try_from(document).map_err(|error| match error {
        UserReviewDocumentConversionError::UnsupportedRecordVersion { version } => {
            UserReviewRecordProblem::UnsupportedRecordVersion { version }
        }
        error => malformed_record(error.to_string()),
    })
}

pub fn encode_user_review_document(
    review: &UserReview,
) -> Result<String, UserReviewDocumentEncodeError> {
    let document = UserReviewDocument::from(review);
    let mut contents = serde_json::to_string_pretty(&document)?;
    contents.push('\n');
    Ok(contents)
}

impl From<&UserReview> for UserReviewDocument {
    fn from(review: &UserReview) -> Self {
        Self {
            schema_version: USER_REVIEW_DOCUMENT_SCHEMA_VERSION.to_string(),
            id: review.id().as_str().to_string(),
            status: review.status().into(),
            created_at: format_timestamp(review.created_at()),
            updated_at: format_timestamp(review.updated_at()),
            archived_at: review
                .archived_at()
                .map(format_timestamp)
                .map_or(UserReviewArchivedAtDocument::Null, |timestamp| {
                    UserReviewArchivedAtDocument::Timestamp(timestamp)
                }),
            target: review.target().into(),
            comments: review.comments().iter().map(Into::into).collect(),
        }
    }
}

impl TryFrom<UserReviewDocument> for UserReview {
    type Error = UserReviewDocumentConversionError;

    fn try_from(document: UserReviewDocument) -> Result<Self, Self::Error> {
        if document.schema_version != USER_REVIEW_DOCUMENT_SCHEMA_VERSION {
            return Err(
                UserReviewDocumentConversionError::UnsupportedRecordVersion {
                    version: document.schema_version,
                },
            );
        }

        let id = parse_user_review_id(document.id)?;
        let status = document.status.into();
        let target = UserReviewTarget::try_from(document.target)?;
        let comments = document
            .comments
            .into_iter()
            .map(UserReviewComment::try_from)
            .collect::<Result<Vec<_>, _>>()?;
        let created_at = parse_timestamp("createdAt", &document.created_at)?;
        let updated_at = parse_timestamp("updatedAt", &document.updated_at)?;
        let archived_at = match document.archived_at {
            UserReviewArchivedAtDocument::Timestamp(value) => {
                Some(parse_timestamp("archivedAt", &value)?)
            }
            UserReviewArchivedAtDocument::Null => None,
        };

        UserReview::restore(
            id,
            status,
            target,
            comments,
            created_at,
            updated_at,
            archived_at,
        )
        .map_err(domain_invariant)
    }
}

impl From<UserReviewStatus> for UserReviewStatusDocument {
    fn from(status: UserReviewStatus) -> Self {
        match status {
            UserReviewStatus::Active => Self::Active,
            UserReviewStatus::Archived => Self::Archived,
        }
    }
}

impl From<UserReviewStatusDocument> for UserReviewStatus {
    fn from(status: UserReviewStatusDocument) -> Self {
        match status {
            UserReviewStatusDocument::Active => Self::Active,
            UserReviewStatusDocument::Archived => Self::Archived,
        }
    }
}

impl From<&UserReviewTarget> for UserReviewTargetDocument {
    fn from(target: &UserReviewTarget) -> Self {
        match target {
            UserReviewTarget::File { spec_id, file_key } => Self::File {
                spec_id: spec_id.as_str().to_string(),
                file_key: file_key.as_str().to_string(),
            },
            UserReviewTarget::Spec { spec_id } => Self::Spec {
                spec_id: spec_id.as_str().to_string(),
            },
        }
    }
}

impl TryFrom<UserReviewTargetDocument> for UserReviewTarget {
    type Error = UserReviewDocumentConversionError;

    fn try_from(target: UserReviewTargetDocument) -> Result<Self, Self::Error> {
        match target {
            UserReviewTargetDocument::File { spec_id, file_key } => Ok(Self::file(
                parse_spec_id("target.specId", spec_id)?,
                parse_file_key("target.fileKey", &file_key)?,
            )),
            UserReviewTargetDocument::Spec { spec_id } => {
                Ok(Self::spec(parse_spec_id("target.specId", spec_id)?))
            }
        }
    }
}

impl From<&UserReviewComment> for UserReviewCommentDocument {
    fn from(comment: &UserReviewComment) -> Self {
        Self {
            id: comment.id().as_str().to_string(),
            status: comment.status().into(),
            source: comment.source().into(),
            block_type: comment.block_type().into(),
            line_start: comment.line_start().value(),
            line_end: comment.line_end().value(),
            text_snippet: comment.text_snippet().as_str().to_string(),
            text_hash: comment.text_hash().as_str().to_string(),
            body: comment.body().as_str().to_string(),
            created_at: format_timestamp(comment.created_at()),
            updated_at: format_timestamp(comment.updated_at()),
        }
    }
}

impl TryFrom<UserReviewCommentDocument> for UserReviewComment {
    type Error = UserReviewDocumentConversionError;

    fn try_from(comment: UserReviewCommentDocument) -> Result<Self, Self::Error> {
        let id = parse_comment_id(comment.id)?;
        let status = comment.status.into();
        let source = UserReviewSource::try_from(comment.source)?;
        let block_type = comment.block_type.into();
        let line_start = PositiveLineNumber::new(comment.line_start).map_err(domain_invariant)?;
        let line_end = PositiveLineNumber::new(comment.line_end).map_err(domain_invariant)?;
        let text_snippet = TextSnippet::new(comment.text_snippet)
            .map_err(|error| invalid_value("comments[].textSnippet", error))?;
        let text_hash = parse_text_hash(comment.text_hash)?;
        let body = CommentBody::new(comment.body)
            .map_err(|error| invalid_value("comments[].body", error))?;
        let created_at = parse_timestamp("comments[].createdAt", &comment.created_at)?;
        let updated_at = parse_timestamp("comments[].updatedAt", &comment.updated_at)?;

        Self::new(
            id,
            status,
            source,
            block_type,
            line_start,
            line_end,
            text_snippet,
            text_hash,
            body,
            created_at,
            updated_at,
        )
        .map_err(domain_invariant)
    }
}

impl From<CommentStatus> for UserReviewCommentStatusDocument {
    fn from(status: CommentStatus) -> Self {
        match status {
            CommentStatus::Open => Self::Open,
            CommentStatus::Resolved => Self::Resolved,
        }
    }
}

impl From<UserReviewCommentStatusDocument> for CommentStatus {
    fn from(status: UserReviewCommentStatusDocument) -> Self {
        match status {
            UserReviewCommentStatusDocument::Open => Self::Open,
            UserReviewCommentStatusDocument::Resolved => Self::Resolved,
        }
    }
}

impl From<&UserReviewSource> for UserReviewSourceDocument {
    fn from(source: &UserReviewSource) -> Self {
        Self {
            spec_id: source.spec_id().as_str().to_string(),
            file_key: source.file_key().as_str().to_string(),
            file_path: source.file_path().as_str().to_string(),
        }
    }
}

impl TryFrom<UserReviewSourceDocument> for UserReviewSource {
    type Error = UserReviewDocumentConversionError;

    fn try_from(source: UserReviewSourceDocument) -> Result<Self, Self::Error> {
        Ok(Self::new(
            parse_spec_id("comments[].source.specId", source.spec_id)?,
            parse_file_key("comments[].source.fileKey", &source.file_key)?,
            WorkspaceRelativePath::new(source.file_path)
                .map_err(|error| invalid_value("comments[].source.filePath", error))?,
        ))
    }
}

impl From<MarkdownBlockType> for MarkdownBlockTypeDocument {
    fn from(block_type: MarkdownBlockType) -> Self {
        match block_type {
            MarkdownBlockType::Paragraph => Self::Paragraph,
            MarkdownBlockType::Heading => Self::Heading,
            MarkdownBlockType::ListItem => Self::ListItem,
            MarkdownBlockType::CodeBlock => Self::CodeBlock,
            MarkdownBlockType::BlockQuote => Self::BlockQuote,
            MarkdownBlockType::Table => Self::Table,
            MarkdownBlockType::ThematicBreak => Self::ThematicBreak,
            MarkdownBlockType::Html => Self::Html,
            MarkdownBlockType::Other => Self::Other,
        }
    }
}

impl From<MarkdownBlockTypeDocument> for MarkdownBlockType {
    fn from(block_type: MarkdownBlockTypeDocument) -> Self {
        match block_type {
            MarkdownBlockTypeDocument::Paragraph => Self::Paragraph,
            MarkdownBlockTypeDocument::Heading => Self::Heading,
            MarkdownBlockTypeDocument::ListItem => Self::ListItem,
            MarkdownBlockTypeDocument::CodeBlock => Self::CodeBlock,
            MarkdownBlockTypeDocument::BlockQuote => Self::BlockQuote,
            MarkdownBlockTypeDocument::Table => Self::Table,
            MarkdownBlockTypeDocument::ThematicBreak => Self::ThematicBreak,
            MarkdownBlockTypeDocument::Html => Self::Html,
            MarkdownBlockTypeDocument::Other => Self::Other,
        }
    }
}

fn parse_user_review_id(value: String) -> Result<UserReviewId, UserReviewDocumentConversionError> {
    UserReviewId::new(value).map_err(|error| invalid_value("id", error))
}

fn parse_comment_id(value: String) -> Result<CommentId, UserReviewDocumentConversionError> {
    let parsed =
        CommentId::new(value.clone()).map_err(|error| invalid_value("comments[].id", error))?;

    if parsed.as_str() != value {
        return Err(invalid_value(
            "comments[].id",
            "must not contain surrounding whitespace",
        ));
    }

    Ok(parsed)
}

fn parse_spec_id(
    field: &'static str,
    value: String,
) -> Result<SpecId, UserReviewDocumentConversionError> {
    let parsed = SpecId::new(value.clone()).map_err(|error| invalid_value(field, error))?;

    if parsed.as_str() != value {
        return Err(invalid_value(
            field,
            "must not contain surrounding whitespace",
        ));
    }

    Ok(parsed)
}

fn parse_file_key(
    field: &'static str,
    value: &str,
) -> Result<SpecFileKey, UserReviewDocumentConversionError> {
    SpecFileKey::from_str(value).map_err(|error| invalid_value(field, error))
}

fn parse_text_hash(value: String) -> Result<MarkdownBlockHash, UserReviewDocumentConversionError> {
    let bytes = value.as_bytes();
    let is_canonical = bytes.len() == "sha256:".len() + 8
        && bytes.starts_with(b"sha256:")
        && bytes["sha256:".len()..]
            .iter()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(byte));

    if !is_canonical {
        return Err(invalid_value(
            "comments[].textHash",
            "must match ^sha256:[0-9a-f]{8}$",
        ));
    }

    MarkdownBlockHash::new(value).map_err(|error| invalid_value("comments[].textHash", error))
}

fn parse_timestamp(
    field: &'static str,
    value: &str,
) -> Result<DateTime<Utc>, UserReviewDocumentConversionError> {
    let parsed =
        DateTime::parse_from_rfc3339(value).map_err(|error| invalid_value(field, error))?;
    let parsed = parsed.with_timezone(&Utc);

    if format_timestamp(parsed) != value {
        return Err(invalid_value(
            field,
            "must be UTC RFC 3339 with exactly millisecond precision",
        ));
    }

    Ok(parsed)
}

fn format_timestamp(value: DateTime<Utc>) -> String {
    value.to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn invalid_value(
    field: &'static str,
    error: impl fmt::Display,
) -> UserReviewDocumentConversionError {
    UserReviewDocumentConversionError::InvalidValue {
        field,
        reason: error.to_string(),
    }
}

fn domain_invariant(error: UserReviewDomainError) -> UserReviewDocumentConversionError {
    UserReviewDocumentConversionError::DomainInvariant {
        reason: error.to_string(),
    }
}

fn malformed_record(reason: impl Into<String>) -> UserReviewRecordProblem {
    UserReviewRecordProblem::MalformedRecord {
        reason: reason.into(),
    }
}

struct UniqueJsonValue(Value);

impl<'de> Deserialize<'de> for UniqueJsonValue {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_any(UniqueJsonValueVisitor)
    }
}

struct UniqueJsonValueVisitor;

impl<'de> Visitor<'de> for UniqueJsonValueVisitor {
    type Value = UniqueJsonValue;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON value without duplicate object keys")
    }

    fn visit_bool<E>(self, value: bool) -> Result<Self::Value, E> {
        Ok(UniqueJsonValue(Value::Bool(value)))
    }

    fn visit_i64<E>(self, value: i64) -> Result<Self::Value, E> {
        Ok(UniqueJsonValue(Value::Number(value.into())))
    }

    fn visit_u64<E>(self, value: u64) -> Result<Self::Value, E> {
        Ok(UniqueJsonValue(Value::Number(value.into())))
    }

    fn visit_f64<E>(self, value: f64) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Number::from_f64(value)
            .map(Value::Number)
            .map(UniqueJsonValue)
            .ok_or_else(|| E::custom("JSON number must be finite"))
    }

    fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        self.visit_string(value.to_string())
    }

    fn visit_string<E>(self, value: String) -> Result<Self::Value, E> {
        Ok(UniqueJsonValue(Value::String(value)))
    }

    fn visit_none<E>(self) -> Result<Self::Value, E> {
        Ok(UniqueJsonValue(Value::Null))
    }

    fn visit_unit<E>(self) -> Result<Self::Value, E> {
        Ok(UniqueJsonValue(Value::Null))
    }

    fn visit_some<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: Deserializer<'de>,
    {
        UniqueJsonValue::deserialize(deserializer)
    }

    fn visit_seq<A>(self, mut sequence: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut values = Vec::new();
        while let Some(value) = sequence.next_element::<UniqueJsonValue>()? {
            values.push(value.0);
        }
        Ok(UniqueJsonValue(Value::Array(values)))
    }

    fn visit_map<A>(self, mut object: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut values = Map::new();
        let mut keys = HashSet::new();

        while let Some(key) = object.next_key::<String>()? {
            if !keys.insert(key.clone()) {
                return Err(de::Error::custom(format!(
                    "duplicate JSON object key: {key}"
                )));
            }

            let value = object.next_value::<UniqueJsonValue>()?;
            values.insert(key, value.0);
        }

        Ok(UniqueJsonValue(Value::Object(values)))
    }
}
