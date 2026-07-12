use std::{
    cell::Cell,
    env, fs,
    path::PathBuf,
    rc::Rc,
    time::{SystemTime, UNIX_EPOCH},
};

use spec_reviewer_lib::{
    domain::{
        spec::{ScanSpecTree, SpecTreeAssembler},
        workspace::{
            LoadSpecConfigOverride, SpecConfigOverride, WorkspaceConfig,
            WorkspaceConfigLoadPortError, WorkspaceKind, WorkspaceLayout, WorkspaceRelativePath,
            WorkspaceRoot, WorkspaceTopology,
        },
    },
    infrastructure::filesystem::FilesystemSpecTreeScanner,
};

#[derive(Debug, Clone)]
struct RecordingOverrideLoader {
    calls: Rc<Cell<usize>>,
}

impl LoadSpecConfigOverride for RecordingOverrideLoader {
    fn load_spec_config_override_at(
        &self,
        _layout: &WorkspaceLayout,
        _relative_spec_directory: &WorkspaceRelativePath,
    ) -> Result<Option<SpecConfigOverride>, WorkspaceConfigLoadPortError> {
        self.calls.set(self.calls.get() + 1);
        Ok(None)
    }
}

struct TestWorkspace {
    root: PathBuf,
}

impl TestWorkspace {
    fn new() -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        let root = env::temp_dir().join(format!(
            "spec-reviewer-tree-compat-{}-{timestamp}",
            std::process::id()
        ));
        fs::create_dir_all(&root).expect("test root should be created");
        Self { root }
    }

    fn create_file(&self, relative_path: &str) {
        let path = self.root.join(relative_path);
        fs::create_dir_all(path.parent().expect("file should have parent"))
            .expect("parent should be created");
        fs::write(path, "# Test\n").expect("file should be written");
    }

    fn create_dir(&self, relative_path: &str) {
        fs::create_dir_all(self.root.join(relative_path)).expect("directory should be created");
    }

    fn layout(&self) -> WorkspaceLayout {
        WorkspaceLayout::new(
            WorkspaceRoot::new(self.root.to_string_lossy()).expect("root should be valid"),
            WorkspaceKind::PluginWorkspace,
        )
    }
}

impl Drop for TestWorkspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

#[test]
fn observed_facts_assemble_to_the_compatible_tree_shape() {
    let workspace = TestWorkspace::new();
    workspace.create_file(".plugin-workspace/.specs/zeta/tasks.md");
    workspace.create_file(".plugin-workspace/.specs/alpha/tasks.md");
    workspace.create_file(".plugin-workspace/.specs/.hidden/tasks.md");
    workspace.create_file(".plugin-workspace/.specs/plan-review/ignored/tasks.md");
    workspace.create_file(".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth/tasks.md");
    workspace.create_dir(".claude/worktrees/feature-auth/.plugin-workspace/.specs");

    let layout = workspace.layout();
    let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);
    let override_calls = Rc::new(Cell::new(0));
    let facts = FilesystemSpecTreeScanner::new(RecordingOverrideLoader {
        calls: Rc::clone(&override_calls),
    })
    .scan_spec_tree(&layout, &config)
    .expect("facts should be observed");
    let tree = SpecTreeAssembler::new(WorkspaceTopology::default())
        .assemble(layout.kind(), &config, facts)
        .expect("facts should assemble");

    assert_eq!(
        vec![
            (
                ".plugin-workspace/.specs",
                "ルート",
                vec![
                    ".plugin-workspace/.specs/alpha",
                    ".plugin-workspace/.specs/zeta",
                ],
            ),
            (
                ".claude/worktrees/feature-auth/.plugin-workspace/.specs",
                "feature-auth (.plugin-workspace)",
                vec![],
            ),
            (
                ".claude/worktrees/feature-auth/.plugin-worktree/.specs",
                "feature-auth (.plugin-worktree)",
                vec![".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth",],
            ),
        ],
        tree.roots()
            .iter()
            .map(|root| {
                (
                    root.id().as_str(),
                    root.label(),
                    root.children()
                        .iter()
                        .map(|child| child.id().as_str())
                        .collect::<Vec<_>>(),
                )
            })
            .collect::<Vec<_>>()
    );
    assert_eq!(3, override_calls.get());
}
