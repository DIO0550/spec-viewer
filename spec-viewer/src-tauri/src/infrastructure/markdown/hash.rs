//! Markdown block hashing helpers for stable anchor fallback.

use std::fmt::Write;

use sha2::{Digest, Sha256};

use crate::domain::{
    comment::{CommentDomainError, TextHash},
    spec::{MARKDOWN_ANCHOR_FINGERPRINT_ALGORITHM, MARKDOWN_ANCHOR_FINGERPRINT_PREFIX_LENGTH},
};

pub fn hash_normalized_block_text(normalized_text: &str) -> String {
    let digest = Sha256::digest(normalized_text.as_bytes());
    let mut full_hash = String::with_capacity(digest.len() * 2);

    for byte in digest {
        write!(&mut full_hash, "{byte:02x}").expect("writing to a string should not fail");
    }

    let hash_prefix = &full_hash[..MARKDOWN_ANCHOR_FINGERPRINT_PREFIX_LENGTH];

    format!("{MARKDOWN_ANCHOR_FINGERPRINT_ALGORITHM}:{hash_prefix}")
}

pub fn text_hash_from_normalized_block_text(
    normalized_text: &str,
) -> Result<TextHash, CommentDomainError> {
    TextHash::new_canonical(hash_normalized_block_text(normalized_text))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        domain::spec::{
            MarkdownBlockType, MARKDOWN_ANCHOR_FINGERPRINT_ALGORITHM,
            MARKDOWN_ANCHOR_FINGERPRINT_CONTRACT_ID, MARKDOWN_ANCHOR_FINGERPRINT_PREFIX_LENGTH,
            MARKDOWN_ANCHOR_FINGERPRINT_WIRE_FORMAT, MARKDOWN_BLOCK_NORMALIZATION_VERSION,
        },
        infrastructure::markdown::normalizer::normalize_markdown_block_text,
    };
    use serde::Deserialize;

    const EXPECTED_SNIPPET_PURPOSE: &str = "selected-text-display-and-fuzzy-recovery";
    const EXPECTED_SNIPPET_MAX_UNICODE_SCALARS: usize = 160;

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct GoldenFixture {
        contract: GoldenContract,
        cases: Vec<GoldenCase>,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct GoldenContract {
        id: String,
        normalization: String,
        algorithm: String,
        prefix_length: usize,
        wire_format: String,
        snippet_purpose: String,
        snippet_max_unicode_scalars: usize,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct GoldenCase {
        id: String,
        block_type: String,
        markdown: String,
        normalized_text: String,
        fingerprint: String,
        snippet_source: String,
        snippet: String,
    }

    fn create_fixture_text_snippet(text: &str) -> String {
        text.split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(EXPECTED_SNIPPET_MAX_UNICODE_SCALARS)
            .collect()
    }

    #[test]
    fn shared_golden_fixture_matches_normalization_and_fingerprint_contract() {
        let fixture: GoldenFixture = serde_json::from_str(include_str!(
            "../../../../test-fixtures/markdown-anchor-fingerprint-v1.json"
        ))
        .expect("golden fixture should parse");

        assert_eq!(MARKDOWN_ANCHOR_FINGERPRINT_CONTRACT_ID, fixture.contract.id);
        assert_eq!(
            MARKDOWN_BLOCK_NORMALIZATION_VERSION,
            fixture.contract.normalization
        );
        assert_eq!(
            MARKDOWN_ANCHOR_FINGERPRINT_ALGORITHM,
            fixture.contract.algorithm
        );
        assert_eq!(
            MARKDOWN_ANCHOR_FINGERPRINT_PREFIX_LENGTH,
            fixture.contract.prefix_length
        );
        assert_eq!(
            MARKDOWN_ANCHOR_FINGERPRINT_WIRE_FORMAT,
            fixture.contract.wire_format
        );
        assert_eq!(EXPECTED_SNIPPET_PURPOSE, fixture.contract.snippet_purpose);
        assert_eq!(
            EXPECTED_SNIPPET_MAX_UNICODE_SCALARS,
            fixture.contract.snippet_max_unicode_scalars
        );

        for case in fixture.cases {
            let block_type = match case.block_type.as_str() {
                "paragraph" => MarkdownBlockType::Paragraph,
                "code_block" => MarkdownBlockType::CodeBlock,
                unsupported => panic!("unsupported golden block type {unsupported} in {}", case.id),
            };
            let normalized = normalize_markdown_block_text(block_type, &case.markdown);

            assert_eq!(
                case.normalized_text, normalized,
                "normalization case {}",
                case.id
            );
            assert_eq!(
                case.fingerprint,
                hash_normalized_block_text(&normalized),
                "fingerprint case {}",
                case.id
            );
            let snippet = create_fixture_text_snippet(&case.snippet_source);

            assert_eq!(case.snippet, snippet, "snippet case {}", case.id);
            assert!(
                snippet.chars().count() <= EXPECTED_SNIPPET_MAX_UNICODE_SCALARS,
                "snippet scalar limit case {}",
                case.id
            );
        }
    }
    #[test]
    fn hashes_normalized_text_with_stable_sha256_prefix() {
        assert_eq!("sha256:d4b1ea57", hash_normalized_block_text("Overview"));
        assert_eq!(8, MARKDOWN_ANCHOR_FINGERPRINT_PREFIX_LENGTH);
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
