//! Markdown block hashing helpers for stable anchor fallback.

use std::fmt::Write;

use sha2::{Digest, Sha256};

use crate::domain::comment::{CommentDomainError, TextHash};

pub const SHA256_TEXT_HASH_PREFIX_LENGTH: usize = 8;
const SHA256_TEXT_HASH_ALGORITHM: &str = "sha256";

pub fn hash_normalized_block_text(normalized_text: &str) -> String {
    let digest = Sha256::digest(normalized_text.as_bytes());
    let mut full_hash = String::with_capacity(digest.len() * 2);

    for byte in digest {
        write!(&mut full_hash, "{byte:02x}").expect("writing to a string should not fail");
    }

    let hash_prefix = &full_hash[..SHA256_TEXT_HASH_PREFIX_LENGTH];

    format!("{SHA256_TEXT_HASH_ALGORITHM}:{hash_prefix}")
}

pub fn text_hash_from_normalized_block_text(
    normalized_text: &str,
) -> Result<TextHash, CommentDomainError> {
    TextHash::new(hash_normalized_block_text(normalized_text))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        domain::spec::MarkdownBlockType,
        infrastructure::markdown::normalizer::normalize_markdown_block_text,
    };

    #[test]
    fn hashes_normalized_text_with_stable_sha256_prefix() {
        assert_eq!("sha256:d4b1ea57", hash_normalized_block_text("Overview"));
        assert_eq!(8, SHA256_TEXT_HASH_PREFIX_LENGTH);
    }

    #[test]
    fn empty_text_has_deterministic_sha256_hash() {
        let hash = hash_normalized_block_text("");
        let text_hash = text_hash_from_normalized_block_text("").expect("hash should be valid");

        assert_eq!("sha256:e3b0c442", hash);
        assert_eq!("sha256:e3b0c442", text_hash.as_str());
    }

    #[test]
    fn changed_normalized_text_changes_hash() {
        assert_ne!(
            hash_normalized_block_text("Overview"),
            hash_normalized_block_text("Overview updated")
        );
        assert_eq!(
            "sha256:36e19211",
            hash_normalized_block_text("Overview updated")
        );
    }

    #[test]
    fn equivalent_normalized_text_hashes_the_same() {
        let heading_with_markers =
            normalize_markdown_block_text(MarkdownBlockType::Heading, "### Overview ###");
        let heading_without_markers =
            normalize_markdown_block_text(MarkdownBlockType::Heading, "Overview");

        assert_eq!(heading_with_markers, heading_without_markers);
        assert_eq!(
            hash_normalized_block_text(&heading_with_markers),
            hash_normalized_block_text(&heading_without_markers)
        );
    }

    #[test]
    fn code_and_prose_normalization_differences_change_hash() {
        let prose = normalize_markdown_block_text(MarkdownBlockType::Paragraph, "**bold**");
        let code =
            normalize_markdown_block_text(MarkdownBlockType::CodeBlock, "```\n**bold**\n```");

        assert_eq!("bold", prose);
        assert_eq!("**bold**", code);
        assert_ne!(
            hash_normalized_block_text(&prose),
            hash_normalized_block_text(&code)
        );
    }
}
