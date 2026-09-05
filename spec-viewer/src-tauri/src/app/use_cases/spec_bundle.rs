//! Spec bundle orchestration.

use crate::{
    app::use_cases::{
        spec_config_for_directory, AppMarkdownDocument, AppUseCaseError, FilesystemAppUseCases,
        LoadWorkspaceResult,
    },
    domain::spec::{
        artifact_progress, progress_without_tasks, ArtifactConfiguration, ArtifactEvaluation,
        ArtifactEvaluationError, ArtifactPresence, SpecArtifactFact, SpecArtifactIdentity,
        SpecDocumentFormat, SpecFileKey, SpecProgress,
    },
    infrastructure::{
        filesystem::{discover_spec_artifacts, spec_directory_path, DiscoveredSpecArtifact},
        markdown::{parser::count_task_markers, MarkdownDocument, MarkdownReadError},
    },
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpecArtifactErrorCode {
    MarkdownRead,
    MarkdownParse,
    InvalidArtifact,
}

impl SpecArtifactErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::MarkdownRead => "markdownRead",
            Self::MarkdownParse => "markdownParse",
            Self::InvalidArtifact => "invalidArtifact",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecArtifactError {
    pub code: SpecArtifactErrorCode,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SpecArtifactOutcome {
    Loaded(AppMarkdownDocument),
    Failed(SpecArtifactError),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecArtifactBundleItem {
    pub identity: SpecArtifactIdentity,
    pub file_key: Option<SpecFileKey>,
    pub file_name: String,
    pub label: String,
    pub format: SpecDocumentFormat,
    pub progress: SpecProgress,
    /// Resolved artifact path in the same representation as
    /// [`AppMarkdownDocument::path`], preserved even when the document fails to
    /// load so the presentation layer can expose a stable path in both cases.
    pub path: String,
    pub outcome: SpecArtifactOutcome,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoadSpecBundleResult {
    pub spec_id: String,
    pub progress: SpecProgress,
    pub artifacts: Vec<SpecArtifactBundleItem>,
}

impl FilesystemAppUseCases {
    pub fn load_spec_bundle(
        &self,
        workspace: &LoadWorkspaceResult,
        spec_id: &str,
    ) -> Result<LoadSpecBundleResult, AppUseCaseError> {
        let effective_config = spec_config_for_directory(
            &self.config_loader,
            workspace.layout(),
            workspace.config(),
            spec_id,
        )?;
        let validated_spec_id = crate::domain::spec::SpecId::new(spec_id)?;
        let spec_directory = spec_directory_path(workspace.layout(), &validated_spec_id);
        let artifacts =
            discover_spec_artifacts(&spec_directory, &effective_config).map_err(|source| {
                AppUseCaseError::SpecTreeScan {
                    message: source.to_string(),
                }
            })?;
        let evaluated = artifacts
            .iter()
            .map(|artifact| self.evaluate_artifact(&spec_directory, artifact))
            .collect::<Vec<_>>();
        let configured_facts = effective_config
            .files()
            .iter()
            .map(|mapping| {
                evaluated
                    .iter()
                    .find_map(|(_, fact)| {
                        (fact.identity() == &SpecArtifactIdentity::Standard(mapping.key()))
                            .then(|| fact.clone())
                    })
                    .unwrap_or_else(|| {
                        SpecArtifactFact::new(
                            SpecArtifactIdentity::Standard(mapping.key()),
                            ArtifactConfiguration::Configured,
                            ArtifactPresence::Missing,
                            ArtifactEvaluation::Empty,
                        )
                    })
            })
            .collect::<Vec<_>>();
        let progress = configured_facts
            .iter()
            .find(|fact| fact.is_tasks() && fact.presence() == ArtifactPresence::Present)
            .map_or_else(
                || progress_without_tasks(&configured_facts),
                artifact_progress,
            );

        Ok(LoadSpecBundleResult {
            spec_id: spec_id.to_string(),
            progress,
            artifacts: evaluated.into_iter().map(|(item, _)| item).collect(),
        })
    }

    fn evaluate_artifact(
        &self,
        spec_directory: &std::path::Path,
        artifact: &DiscoveredSpecArtifact,
    ) -> (SpecArtifactBundleItem, SpecArtifactFact) {
        // Resolve the path the same way `read_artifact` does so failed reads keep
        // the identical representation returned by `document.path()` on success.
        let path = spec_directory
            .join(&artifact.file_name)
            .to_string_lossy()
            .into_owned();
        let read_result = self.markdown_reader.read_artifact(spec_directory, artifact);
        let (evaluation, outcome) = match read_result {
            Ok(document) => {
                let evaluation = evaluate_document(&document);
                (evaluation, SpecArtifactOutcome::Loaded(document.into()))
            }
            Err(error) => {
                let evaluation = ArtifactEvaluation::Error(evaluation_error(&error));
                let outcome = SpecArtifactOutcome::Failed(public_artifact_error(&error));
                (evaluation, outcome)
            }
        };
        let fact = SpecArtifactFact::new(
            artifact.identity.clone(),
            if artifact.file_key.is_some() {
                ArtifactConfiguration::Configured
            } else {
                ArtifactConfiguration::Discovered
            },
            ArtifactPresence::Present,
            evaluation,
        );
        let progress = artifact_progress(&fact);

        (
            SpecArtifactBundleItem {
                identity: artifact.identity.clone(),
                file_key: artifact.file_key,
                file_name: artifact.file_name.clone(),
                label: artifact.label.clone(),
                format: artifact.format,
                progress,
                path,
                outcome,
            },
            fact,
        )
    }
}

fn evaluate_document(document: &MarkdownDocument) -> ArtifactEvaluation {
    if document.contents().trim().is_empty() {
        return ArtifactEvaluation::Empty;
    }

    if !document.identity().is_tasks() {
        return ArtifactEvaluation::NonEmpty { task_counts: None };
    }

    match count_task_markers(document.contents()) {
        Ok(task_counts) => ArtifactEvaluation::NonEmpty {
            task_counts: Some(task_counts),
        },
        Err(_) => ArtifactEvaluation::Error(ArtifactEvaluationError::Parse),
    }
}

fn evaluation_error(error: &MarkdownReadError) -> ArtifactEvaluationError {
    match error {
        MarkdownReadError::ParseMarkdown { .. } => ArtifactEvaluationError::Parse,
        _ => ArtifactEvaluationError::Read,
    }
}

fn public_artifact_error(error: &MarkdownReadError) -> SpecArtifactError {
    let (code, message) = match error {
        MarkdownReadError::ParseMarkdown { .. } => (
            SpecArtifactErrorCode::MarkdownParse,
            "This Markdown artifact could not be parsed.",
        ),
        MarkdownReadError::InvalidArtifact { .. } => (
            SpecArtifactErrorCode::InvalidArtifact,
            "This artifact identity is invalid.",
        ),
        _ => (
            SpecArtifactErrorCode::MarkdownRead,
            "This artifact could not be read.",
        ),
    };

    SpecArtifactError {
        code,
        message: message.to_string(),
    }
}
#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;
    use crate::{
        app::use_cases::{FilesystemAppUseCases, LoadWorkspaceResult},
        domain::{
            spec::{SpecArtifactIdentity, SpecFileKey, SpecProgress},
            workspace::{
                WorkspaceConfig, WorkspaceFileMapping, WorkspaceKind, WorkspaceLayout,
                WorkspaceRoot,
            },
        },
    };

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
                "spec-viewer-bundle-{name}-{}-{timestamp}",
                std::process::id()
            ));
            fs::create_dir_all(&root).expect("test workspace should be created");

            Self { root }
        }

        fn write_file(&self, path: &str, contents: &str) {
            self.write_bytes(path, contents.as_bytes());
        }

        fn write_bytes(&self, path: &str, contents: &[u8]) {
            let path = self.root.join(path);
            fs::create_dir_all(path.parent().expect("test file should have a parent"))
                .expect("test file parent should be created");
            fs::write(path, contents).expect("test file should be written");
        }

        fn loaded(&self, config: WorkspaceConfig) -> LoadWorkspaceResult {
            let root = WorkspaceRoot::new(self.root.to_string_lossy())
                .expect("workspace root should be valid");
            LoadWorkspaceResult::new(
                WorkspaceLayout::new(root, WorkspaceKind::PluginWorkspace),
                config,
            )
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn loads_ordered_artifacts_with_documents_blocks_and_progress() {
        let workspace = TestWorkspace::new("success");
        workspace.write_file(
            ".plugin-workspace/.specs/001-feature/tasks.md",
            "# Tasks\n\n- [x] Done",
        );
        workspace.write_file(
            ".plugin-workspace/.specs/001-feature/implementation-plan.md",
            "# Plan",
        );
        workspace.write_file(".plugin-workspace/.specs/001-feature/notes.md", "# Notes");
        let config = WorkspaceConfig::new(vec![
            WorkspaceFileMapping::new(SpecFileKey::Tasks, "tasks.md")
                .expect("tasks mapping should be valid"),
            WorkspaceFileMapping::new(SpecFileKey::Impl, "implementation-plan.md")
                .expect("implementation mapping should be valid"),
        ])
        .expect("config should be valid");
        let loaded = workspace.loaded(config);

        let use_cases = FilesystemAppUseCases::default();

        let result = use_cases
            .load_spec_bundle(&loaded, "001-feature")
            .expect("bundle should load");

        assert_eq!("001-feature", result.spec_id);
        assert_eq!(SpecProgress::Completed, result.progress);
        assert_eq!(3, result.artifacts.len());
        assert_eq!(
            vec![
                SpecArtifactIdentity::Standard(SpecFileKey::Tasks),
                SpecArtifactIdentity::Standard(SpecFileKey::Impl),
                SpecArtifactIdentity::direct_markdown("notes.md")
                    .expect("direct identity should be valid"),
            ],
            result
                .artifacts
                .iter()
                .map(|artifact| artifact.identity.clone())
                .collect::<Vec<_>>(),
        );
        assert!(result
            .artifacts
            .iter()
            .all(|artifact| match &artifact.outcome {
                SpecArtifactOutcome::Loaded(document) => {
                    !document.contents().is_empty() && !document.blocks().is_empty()
                }
                SpecArtifactOutcome::Failed(_) => false,
            }));
        let tree = use_cases
            .list_specs(&loaded)
            .expect("tree should use the same progress policy");
        let node = tree
            .specs()
            .iter()
            .find(|node| node.label() == "001-feature")
            .expect("bundle spec should exist in the tree");
        assert_eq!(node.progress(), result.progress);
        assert_eq!(SpecProgress::Completed, result.artifacts[0].progress);
        assert_eq!(SpecProgress::Completed, result.artifacts[1].progress);
    }
    #[test]
    fn isolates_artifact_read_failure_without_failing_the_bundle() {
        let workspace = TestWorkspace::new("partial-failure");
        workspace.write_file(
            ".plugin-workspace/.specs/001-feature/tasks.md",
            "- [x] Done",
        );
        workspace.write_bytes(
            ".plugin-workspace/.specs/001-feature/broken.md",
            &[0xff, 0xfe],
        );
        let config = WorkspaceConfig::new(vec![WorkspaceFileMapping::new(
            SpecFileKey::Tasks,
            "tasks.md",
        )
        .expect("tasks mapping should be valid")])
        .expect("config should be valid");
        let loaded = workspace.loaded(config);

        let result = FilesystemAppUseCases::default()
            .load_spec_bundle(&loaded, "001-feature")
            .expect("one artifact failure should not fail the bundle");

        assert_eq!(SpecProgress::Completed, result.progress);
        assert_eq!(2, result.artifacts.len());
        let ok_artifact = &result.artifacts[0];
        let SpecArtifactOutcome::Loaded(document) = &ok_artifact.outcome else {
            panic!("tasks artifact should load");
        };
        // The success case keeps the path field aligned with `document.path()`.
        assert_eq!(document.path(), ok_artifact.path);
        let broken = &result.artifacts[1];
        assert_eq!(SpecProgress::Unknown, broken.progress);
        let SpecArtifactOutcome::Failed(error) = &broken.outcome else {
            panic!("broken artifact should fail");
        };
        // Even without a document, the failed artifact keeps the full resolved
        // path (spec directory + file name), not just the base file name.
        assert_ne!(broken.file_name, broken.path);
        assert!(std::path::Path::new(&broken.path)
            .ends_with(std::path::Path::new("001-feature").join("broken.md")));
        assert!(broken
            .path
            .starts_with(workspace.root.to_string_lossy().as_ref()));
        assert_eq!(SpecArtifactErrorCode::MarkdownRead, error.code);
        assert_eq!("This artifact could not be read.", error.message);
        assert!(!error
            .message
            .contains(workspace.root.to_string_lossy().as_ref()));
    }
    #[test]
    fn returns_empty_bundle_but_rejects_structural_spec_path_failure() {
        let workspace = TestWorkspace::new("empty-and-structural-failure");
        fs::create_dir_all(workspace.root.join(".plugin-workspace/.specs/001-empty"))
            .expect("empty spec directory should be created");
        let config = WorkspaceConfig::new(vec![WorkspaceFileMapping::new(
            SpecFileKey::Tasks,
            "tasks.md",
        )
        .expect("tasks mapping should be valid")])
        .expect("config should be valid");
        let loaded = workspace.loaded(config);
        let use_cases = FilesystemAppUseCases::default();

        let empty = use_cases
            .load_spec_bundle(&loaded, "001-empty")
            .expect("zero artifacts should be a successful bundle");
        assert!(empty.artifacts.is_empty());
        assert_eq!(SpecProgress::NotStarted, empty.progress);

        assert!(matches!(
            use_cases.load_spec_bundle(&loaded, "../outside"),
            Err(AppUseCaseError::InvalidSpec { .. })
        ));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_spec_directory_as_bundle_level_failure() {
        use std::os::unix::fs::symlink;

        let workspace = TestWorkspace::new("symlinked-spec");
        let outside = TestWorkspace::new("symlinked-spec-outside");
        outside.write_file("tasks.md", "- [x] secret");
        let specs_root = workspace.root.join(".plugin-workspace/.specs");
        fs::create_dir_all(&specs_root).expect("spec root should be created");
        symlink(&outside.root, specs_root.join("001-linked"))
            .expect("spec directory symlink should be created");
        let config = WorkspaceConfig::new(vec![WorkspaceFileMapping::new(
            SpecFileKey::Tasks,
            "tasks.md",
        )
        .expect("tasks mapping should be valid")])
        .expect("config should be valid");
        let loaded = workspace.loaded(config);

        assert!(matches!(
            FilesystemAppUseCases::default().load_spec_bundle(&loaded, "001-linked"),
            Err(AppUseCaseError::SpecTreeScan { .. })
        ));
    }
}
