//! Construction of persisted comment JSON documents that preserves unknown fields.

use std::collections::HashMap;

use serde_json::{Map, Value};

use crate::{
    domain::{
        comment::{Comment, CommentRepositoryError},
        spec::SpecFileKey,
    },
    infrastructure::persistence::comments::{serialize_comments, CommentJsonError},
};

/// Builds the JSON document persisted for a comment scope, merging unknown
/// fields from the previously stored document so external tooling data
/// survives rewrites.
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct CommentDocumentBuilder;

impl CommentDocumentBuilder {
    pub(crate) fn build(
        file_key: SpecFileKey,
        comments: &[Comment],
        previous_json: Option<&Value>,
    ) -> Result<Value, CommentRepositoryError> {
        let previous_records = Self::previous_comment_records_by_id(previous_json);
        let comments = comments
            .iter()
            .map(|comment| {
                let record = Self::serialize_comment_record(file_key, comment)?;
                let id = comment.id().as_str();

                Ok(match previous_records.get(id) {
                    Some(previous_record) => {
                        Self::merge_known_fields(previous_record.clone(), record)
                    }
                    None => record,
                })
            })
            .collect::<Result<Vec<_>, CommentRepositoryError>>()?;

        let mut document = match previous_json {
            Some(Value::Object(object)) => Value::Object(object.clone()),
            _ => Value::Object(Map::new()),
        };

        if let Value::Object(object) = &mut document {
            object.insert("version".to_string(), Value::from(1));
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
                        Self::merge_anchor_field(&mut previous_object, value);
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

    fn serialize_comment_record(
        file_key: SpecFileKey,
        comment: &Comment,
    ) -> Result<Value, CommentRepositoryError> {
        let document = serialize_comments(file_key, std::slice::from_ref(comment))
            .map_err(Self::json_error)?;
        let value: Value = serde_json::from_str(&document).map_err(|source| {
            CommentRepositoryError::invalid_data(format!(
                "serialized comment JSON did not parse: {source}"
            ))
        })?;

        value
            .get("comments")
            .and_then(Value::as_array)
            .and_then(|comments| comments.first())
            .cloned()
            .ok_or_else(|| {
                CommentRepositoryError::invalid_data("serialized comment JSON was empty")
            })
    }

    fn json_error(error: CommentJsonError) -> CommentRepositoryError {
        CommentRepositoryError::invalid_data(error.to_string())
    }
}
