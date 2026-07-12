use spec_reviewer_lib::domain::{
    spec::SpecFileKey,
    workspace::{WorkspaceConfig, WorkspaceConfigError, WorkspaceFileMapping},
};

#[test]
fn workspace_file_mapping_rejects_windows_drive_relative_name() {
    let result = WorkspaceFileMapping::new(SpecFileKey::Tasks, "C:tasks.md");

    assert_eq!(
        Err(WorkspaceConfigError::UnsafeFileName {
            key: SpecFileKey::Tasks,
            file_name: "C:tasks.md".to_string(),
        }),
        result
    );
}

#[test]
fn scan_exclusion_rejects_windows_drive_relative_name() {
    let result = WorkspaceConfig::with_scan_excluded_directory_names(
        Vec::new(),
        vec!["C:plan-review".to_string()],
    );

    assert_eq!(
        Err(WorkspaceConfigError::UnsafeScanExcludedDirectoryName {
            name: "C:plan-review".to_string(),
        }),
        result
    );
}
