//! Filesystem discovery for spec artifacts.

use std::{cmp::Ordering, collections::HashSet, fs, io, path::Path};

use thiserror::Error;

use crate::{
    domain::{
        spec::{SpecArtifactIdentity, SpecDocumentFormat, SpecDomainError, SpecFileKey},
        workspace::WorkspaceConfig,
    },
    infrastructure::spec_file_resolution::spec_file_path_candidates,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiscoveredSpecArtifact {
    pub identity: SpecArtifactIdentity,
    pub file_name: String,
    pub file_key: Option<SpecFileKey>,
    pub label: String,
    pub format: SpecDocumentFormat,
}

pub fn discover_spec_artifacts(
    spec_directory: &Path,
    effective_config: &WorkspaceConfig,
) -> Result<Vec<DiscoveredSpecArtifact>, SpecArtifactDiscoveryError> {
    ensure_safe_spec_directory(spec_directory)?;

    let configured_file_names = configured_candidate_file_names(spec_directory, effective_config);
    let mut artifacts = discover_standard_artifacts(spec_directory, effective_config)?;
    let direct_artifacts = discover_direct_artifacts(spec_directory, &configured_file_names)?;
    artifacts.extend(direct_artifacts);

    Ok(artifacts)
}

fn ensure_safe_spec_directory(spec_directory: &Path) -> Result<(), SpecArtifactDiscoveryError> {
    match fs::symlink_metadata(spec_directory) {
        Ok(metadata) if metadata.file_type().is_dir() => Ok(()),
        Ok(_) => Err(SpecArtifactDiscoveryError::UnsafeSpecDirectory {
            path: display_path(spec_directory),
        }),
        Err(source) => Err(inspect_path_error(spec_directory, source)),
    }
}

fn configured_candidate_file_names(
    spec_directory: &Path,
    effective_config: &WorkspaceConfig,
) -> HashSet<String> {
    effective_config
        .files()
        .iter()
        .flat_map(|mapping| {
            let configured_path = spec_directory.join(mapping.file_name());
            spec_file_path_candidates(mapping.key(), &configured_path)
        })
        .filter_map(|candidate| {
            candidate
                .path()
                .file_name()
                .and_then(|name| name.to_str())
                .map(str::to_string)
        })
        .collect()
}

fn discover_standard_artifacts(
    spec_directory: &Path,
    effective_config: &WorkspaceConfig,
) -> Result<Vec<DiscoveredSpecArtifact>, SpecArtifactDiscoveryError> {
    let mut artifacts = Vec::new();

    for mapping in effective_config.files() {
        let configured_path = spec_directory.join(mapping.file_name());

        for candidate in spec_file_path_candidates(mapping.key(), &configured_path) {
            match fs::symlink_metadata(candidate.path()) {
                Ok(metadata) if metadata.file_type().is_file() => {
                    let file_name = candidate
                        .path()
                        .file_name()
                        .expect("configured artifact candidate should have a file name")
                        .to_string_lossy()
                        .into_owned();
                    artifacts.push(DiscoveredSpecArtifact {
                        identity: SpecArtifactIdentity::Standard(mapping.key()),
                        file_name,
                        file_key: Some(mapping.key()),
                        label: mapping.key().display_label().to_string(),
                        format: candidate.format(),
                    });
                    break;
                }
                Ok(_) => {}
                Err(error) if error.kind() == io::ErrorKind::NotFound => {}
                Err(source) => return Err(inspect_path_error(candidate.path(), source)),
            }
        }
    }

    Ok(artifacts)
}

fn discover_direct_artifacts(
    spec_directory: &Path,
    configured_file_names: &HashSet<String>,
) -> Result<Vec<DiscoveredSpecArtifact>, SpecArtifactDiscoveryError> {
    let entries = fs::read_dir(spec_directory)
        .map_err(|source| read_directory_error(spec_directory, source))?;
    let mut artifacts = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|source| read_directory_error(spec_directory, source))?;
        let file_type = entry
            .file_type()
            .map_err(|source| inspect_path_error(&entry.path(), source))?;
        let Some(file_name) = entry.file_name().to_str().map(str::to_string) else {
            continue;
        };

        if !is_direct_markdown_candidate(&file_name, file_type, configured_file_names) {
            continue;
        }

        let identity = SpecArtifactIdentity::direct_markdown(&file_name).map_err(|source| {
            SpecArtifactDiscoveryError::InvalidIdentity {
                file_name: file_name.clone(),
                source,
            }
        })?;
        artifacts.push(DiscoveredSpecArtifact {
            identity,
            file_name: file_name.clone(),
            file_key: None,
            label: file_name,
            format: SpecDocumentFormat::Markdown,
        });
    }

    artifacts.sort_by(|left, right| compare_direct_file_names(&left.file_name, &right.file_name));
    Ok(artifacts)
}

fn is_direct_markdown_candidate(
    file_name: &str,
    file_type: fs::FileType,
    configured_file_names: &HashSet<String>,
) -> bool {
    file_type.is_file()
        && !file_name.starts_with('.')
        && !configured_file_names.contains(file_name)
        && Path::new(file_name)
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
}

fn compare_direct_file_names(left: &str, right: &str) -> Ordering {
    left.to_ascii_lowercase()
        .cmp(&right.to_ascii_lowercase())
        .then_with(|| left.cmp(right))
}

fn read_directory_error(path: &Path, source: io::Error) -> SpecArtifactDiscoveryError {
    SpecArtifactDiscoveryError::ReadDirectory {
        path: display_path(path),
        source,
    }
}

fn inspect_path_error(path: &Path, source: io::Error) -> SpecArtifactDiscoveryError {
    SpecArtifactDiscoveryError::InspectPath {
        path: display_path(path),
        source,
    }
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[derive(Debug, Error)]
pub enum SpecArtifactDiscoveryError {
    #[error("failed to read spec artifact directory: {path}")]
    ReadDirectory { path: String, source: io::Error },
    #[error("unsafe spec artifact directory: {path}")]
    UnsafeSpecDirectory { path: String },
    #[error("failed to inspect spec artifact path: {path}")]
    InspectPath { path: String, source: io::Error },
    #[error("invalid direct spec artifact identity: {file_name}")]
    InvalidIdentity {
        file_name: String,
        source: SpecDomainError,
    },
}
#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;
    use crate::domain::{
        spec::{SpecArtifactIdentity, SpecFileKey},
        workspace::{WorkspaceConfig, WorkspaceFileMapping},
    };

    struct TestSpecDirectory {
        path: PathBuf,
    }

    impl TestSpecDirectory {
        fn new(name: &str) -> Self {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time should be after unix epoch")
                .as_nanos();
            let path = env::temp_dir().join(format!(
                "spec-viewer-artifact-discovery-{name}-{}-{timestamp}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("test spec directory should be created");

            Self { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }

        fn write_file(&self, file_name: &str) {
            fs::write(self.path.join(file_name), "# Content")
                .expect("test artifact should be written");
        }
    }

    impl Drop for TestSpecDirectory {
        fn drop(&mut self) {
            if self.path.is_symlink() {
                let _ = fs::remove_file(&self.path);
            } else {
                let _ = fs::remove_dir_all(&self.path);
            }
        }
    }

    #[test]
    fn discovers_present_standard_artifacts_in_config_definition_order() {
        let directory = TestSpecDirectory::new("standard-order");
        directory.write_file("tasks-custom.md");
        directory.write_file("implementation-custom.md");
        let config = WorkspaceConfig::new(vec![
            WorkspaceFileMapping::new(SpecFileKey::Tasks, "tasks-custom.md")
                .expect("tasks mapping should be valid"),
            WorkspaceFileMapping::new(SpecFileKey::Requirements, "requirements-custom.md")
                .expect("requirements mapping should be valid"),
            WorkspaceFileMapping::new(SpecFileKey::Impl, "implementation-custom.md")
                .expect("implementation mapping should be valid"),
        ])
        .expect("config should be valid");

        let artifacts = discover_spec_artifacts(directory.path(), &config)
            .expect("artifact discovery should succeed");

        assert_eq!(
            vec![
                SpecArtifactIdentity::Standard(SpecFileKey::Tasks),
                SpecArtifactIdentity::Standard(SpecFileKey::Impl),
            ],
            artifacts
                .iter()
                .map(|artifact| artifact.identity.clone())
                .collect::<Vec<_>>(),
        );
        assert_eq!(
            vec!["tasks-custom.md", "implementation-custom.md"],
            artifacts
                .iter()
                .map(|artifact| artifact.file_name.as_str())
                .collect::<Vec<_>>(),
        );
    }
    #[test]
    fn appends_direct_markdown_artifacts_in_stable_ascii_order() {
        let directory = TestSpecDirectory::new("direct-order");
        for file_name in [
            "tasks.md",
            "Zulu.md",
            "alpha.md",
            "Beta.md",
            "Ä-notes.md",
            "Ö-notes.md",
        ] {
            directory.write_file(file_name);
        }
        let config = WorkspaceConfig::new(vec![WorkspaceFileMapping::new(
            SpecFileKey::Tasks,
            "tasks.md",
        )
        .expect("tasks mapping should be valid")])
        .expect("config should be valid");

        let artifacts = discover_spec_artifacts(directory.path(), &config)
            .expect("artifact discovery should succeed");

        assert_eq!(
            vec![
                "tasks.md",
                "alpha.md",
                "Beta.md",
                "Zulu.md",
                "Ä-notes.md",
                "Ö-notes.md",
            ],
            artifacts
                .iter()
                .map(|artifact| artifact.file_name.as_str())
                .collect::<Vec<_>>(),
        );
        assert!(matches!(
            artifacts[1].identity,
            SpecArtifactIdentity::DirectMarkdown(ref file_name) if file_name == "alpha.md"
        ));
    }
    #[cfg(unix)]
    #[test]
    fn excludes_non_artifacts_and_rejects_a_symlinked_spec_directory() {
        use std::os::unix::fs::symlink;

        let directory = TestSpecDirectory::new("filters");
        directory.write_file("tasks.md");
        directory.write_file("valid.md");
        directory.write_file(".hidden.md");
        directory.write_file("notes.txt");
        fs::create_dir(directory.path().join("nested"))
            .expect("nested directory should be created");
        fs::write(directory.path().join("nested/nested.md"), "# Nested")
            .expect("nested Markdown should be written");
        fs::create_dir(directory.path().join("directory.md"))
            .expect("non-regular Markdown path should be created");
        symlink(
            directory.path().join("valid.md"),
            directory.path().join("linked.md"),
        )
        .expect("Markdown symlink should be created");
        let config = WorkspaceConfig::new(vec![WorkspaceFileMapping::new(
            SpecFileKey::Tasks,
            "tasks.md",
        )
        .expect("tasks mapping should be valid")])
        .expect("config should be valid");

        let artifacts = discover_spec_artifacts(directory.path(), &config)
            .expect("artifact discovery should succeed");
        assert_eq!(
            vec!["tasks.md", "valid.md"],
            artifacts
                .iter()
                .map(|artifact| artifact.file_name.as_str())
                .collect::<Vec<_>>(),
        );

        let linked_directory = TestSpecDirectory::new("linked-directory");
        fs::remove_dir_all(linked_directory.path())
            .expect("placeholder directory should be removed");
        symlink(directory.path(), linked_directory.path())
            .expect("spec directory symlink should be created");

        assert!(matches!(
            discover_spec_artifacts(linked_directory.path(), &config),
            Err(SpecArtifactDiscoveryError::UnsafeSpecDirectory { .. })
        ));
    }
}
