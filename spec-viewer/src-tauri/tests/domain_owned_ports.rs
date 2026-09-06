use spec_reviewer_lib::{
    domain::{
        spec::{
            MissingSpecDocument, ReadSpecFile, ReadSpecFileResult, ScanSpecTree, SpecDocument,
            SpecDocumentFormat, SpecFileKey, SpecFileReadPortError, SpecId, SpecTreeScanPortError,
        },
        workspace::{
            DetectWorkspace, LoadSpecConfigOverride, LoadWorkspaceConfig,
            WorkspaceConfigLoadPortError, WorkspaceDetectionPortError,
        },
    },
    infrastructure::{
        filesystem::{FilesystemSpecTreeScanner, FilesystemWorkspaceDetector},
        markdown::FilesystemMarkdownReader,
        persistence::config::WorkspaceConfigLoader,
    },
};

fn assert_workspace_detector<T: DetectWorkspace>() {}
fn assert_workspace_config_loader<T: LoadWorkspaceConfig>() {}
fn assert_spec_config_override_loader<T: LoadSpecConfigOverride>() {}
fn assert_spec_tree_scanner<T: ScanSpecTree>() {}
fn assert_spec_file_reader<T: ReadSpecFile>() {}

#[test]
fn filesystem_adapters_implement_domain_owned_ports() {
    assert_workspace_detector::<FilesystemWorkspaceDetector>();
    assert_workspace_config_loader::<WorkspaceConfigLoader>();
    assert_spec_config_override_loader::<WorkspaceConfigLoader>();
    assert_spec_tree_scanner::<FilesystemSpecTreeScanner>();
    assert_spec_file_reader::<FilesystemMarkdownReader>();
}

#[test]
fn domain_port_errors_keep_adapter_neutral_messages() {
    let detection = WorkspaceDetectionPortError::new("workspace unavailable");
    let config = WorkspaceConfigLoadPortError::new("config unavailable");
    let scan = SpecTreeScanPortError::scan("tree unavailable");
    let read = SpecFileReadPortError::new("document unavailable");

    assert_eq!("workspace unavailable", detection.message());
    assert_eq!("config unavailable", config.message());
    assert_eq!("tree unavailable", scan.message());
    assert_eq!("document unavailable", read.message());
}

#[test]
fn spec_read_result_is_owned_by_domain_and_keeps_body_and_blocks() {
    let document = SpecDocument::with_format_and_blocks(
        SpecFileKey::Requirements,
        SpecDocumentFormat::Html,
        "/workspace/.specs/auth/requirements.html",
        "<h1>Requirements</h1>",
        Vec::new(),
    );
    let result = ReadSpecFileResult::Found(document.clone());

    assert_eq!(Some(SpecFileKey::Requirements), document.file_key());
    assert_eq!(SpecDocumentFormat::Html, document.format());
    assert_eq!("<h1>Requirements</h1>", document.contents());
    assert!(document.blocks().is_empty());
    assert_eq!(ReadSpecFileResult::Found(document), result);
    assert!(!result.is_missing());
}
#[test]
fn spec_read_result_represents_missing_domain_document() {
    let missing = MissingSpecDocument::with_format(
        SpecFileKey::Requirements,
        SpecDocumentFormat::Html,
        "/workspace/.specs/auth/requirements.html",
    );
    let result = ReadSpecFileResult::Missing(missing.clone());

    assert_eq!(SpecFileKey::Requirements, missing.key());
    assert_eq!(SpecDocumentFormat::Html, missing.format());
    assert_eq!("/workspace/.specs/auth/requirements.html", missing.path());
    assert_eq!(ReadSpecFileResult::Missing(missing), result);
    assert!(result.is_missing());
}

#[test]
fn read_spec_file_port_accepts_validated_spec_identity() {
    fn accepts_typed_spec_id<Reader: ReadSpecFile>(
        reader: &Reader,
        layout: &spec_reviewer_lib::domain::workspace::WorkspaceLayout,
        config: &spec_reviewer_lib::domain::workspace::WorkspaceConfig,
        spec_id: &SpecId,
    ) -> Result<ReadSpecFileResult, SpecFileReadPortError> {
        reader.read_spec_file(layout, config, spec_id, SpecFileKey::Tasks)
    }

    let _ = accepts_typed_spec_id::<FilesystemMarkdownReader>;
}
