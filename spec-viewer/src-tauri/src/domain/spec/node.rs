//! Spec tree node entity.

use crate::domain::spec::{SpecDomainError, SpecFile, SpecFileKey};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecNode {
    id: String,
    label: String,
    files: Vec<SpecFile>,
    children: Vec<SpecNode>,
}

impl SpecNode {
    pub fn new(
        id: impl Into<String>,
        label: impl Into<String>,
        files: Vec<SpecFile>,
        children: Vec<SpecNode>,
    ) -> Result<Self, SpecDomainError> {
        let id = id.into();
        let label = label.into();
        let trimmed_id = id.trim();
        let trimmed_label = label.trim();

        if trimmed_id.is_empty() {
            return Err(SpecDomainError::MissingNodeId);
        }

        if trimmed_label.is_empty() {
            return Err(SpecDomainError::MissingNodeLabel);
        }

        Ok(Self {
            id: trimmed_id.to_string(),
            label: trimmed_label.to_string(),
            files,
            children,
        })
    }

    pub fn leaf(
        id: impl Into<String>,
        label: impl Into<String>,
        files: Vec<SpecFile>,
    ) -> Result<Self, SpecDomainError> {
        Self::new(id, label, files, Vec::new())
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn label(&self) -> &str {
        &self.label
    }

    pub fn files(&self) -> &[SpecFile] {
        &self.files
    }

    pub fn children(&self) -> &[SpecNode] {
        &self.children
    }

    pub fn file_for_key(&self, key: SpecFileKey) -> Option<&SpecFile> {
        self.files.iter().find(|file| file.key() == key)
    }

    pub fn is_leaf(&self) -> bool {
        self.children.is_empty()
    }

    /// Composes the id of a child node from its parent id and label.
    pub fn child_id(parent_id: &str, label: &str) -> String {
        if parent_id.is_empty() {
            return label.to_string();
        }

        format!("{parent_id}/{label}")
    }

    /// Finds the spec node with the given id within a spec tree, searching recursively.
    pub fn find_by_id<'a>(specs: &'a [SpecNode], spec_id: &str) -> Option<&'a SpecNode> {
        specs.iter().find_map(|spec| {
            if spec.id() == spec_id {
                return Some(spec);
            }

            Self::find_by_id(spec.children(), spec_id)
        })
    }

    /// Collects the spec nodes in this subtree that own files, searching recursively.
    pub fn collect_nodes_with_files(&self) -> Vec<&SpecNode> {
        let mut nodes = Vec::new();

        if !self.files.is_empty() {
            nodes.push(self);
        }

        for child in &self.children {
            nodes.extend(child.collect_nodes_with_files());
        }

        nodes
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spec_node_keeps_tree_compatible_metadata() {
        let child_file = SpecFile::missing(SpecFileKey::Impl, "implementation-plan.md")
            .expect("file should be valid");
        let child = SpecNode::leaf("auth/code-review", "code-review", vec![child_file])
            .expect("child should be valid");
        let root_file =
            SpecFile::present(SpecFileKey::Tasks, "tasks.md").expect("file should be valid");
        let node = SpecNode::new(" auth ", " Auth ", vec![root_file], vec![child])
            .expect("node should be valid");

        assert_eq!("auth", node.id());
        assert_eq!("Auth", node.label());
        assert_eq!(1, node.files().len());
        assert_eq!(1, node.children().len());
        assert!(!node.is_leaf());
        assert!(node.file_for_key(SpecFileKey::Tasks).is_some());
        assert!(node.file_for_key(SpecFileKey::Exploration).is_none());
    }

    #[test]
    fn spec_node_rejects_missing_identity() {
        let result = SpecNode::leaf(" ", "Feature", Vec::new());

        assert_eq!(Err(SpecDomainError::MissingNodeId), result);
    }

    #[test]
    fn spec_node_rejects_missing_label() {
        let result = SpecNode::leaf("feature", " ", Vec::new());

        assert_eq!(Err(SpecDomainError::MissingNodeLabel), result);
    }
}
