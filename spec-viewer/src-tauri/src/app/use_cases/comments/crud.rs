//! Comment create, update, delete, and status use cases.

use crate::{
    app::use_cases::AppUseCaseError,
    domain::{
        comment::{
            Comment, CommentAnchor, CommentBody, CommentId, CommentListQuery, CommentRepository,
            CommentRepositoryError, CommentScope, CommentStatusFilter,
        },
        spec::SpecFileKey,
    },
};

use super::{CommentUseCases, GenerateCommentId, GetCurrentTime};

impl<Repository, IdGenerator, Clock> CommentUseCases<Repository, IdGenerator, Clock>
where
    Repository: CommentRepository,
    IdGenerator: GenerateCommentId,
    Clock: GetCurrentTime,
{
    pub fn list_comments(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        status_filter: CommentStatusFilter,
    ) -> Result<Vec<Comment>, AppUseCaseError> {
        let query = CommentListQuery::with_status_filter(
            CommentScope::parse(spec_id, file_key)?,
            status_filter,
        );

        self.repository.list(&query).map_err(AppUseCaseError::from)
    }

    pub fn add_comment(
        &self,
        spec_id: &str,
        anchor: CommentAnchor,
        body: impl Into<String>,
    ) -> Result<Comment, AppUseCaseError> {
        let scope = CommentScope::parse(spec_id, anchor.file_key())?;
        let now = self.clock.now();
        let comment = Comment::new(
            self.id_generator.generate_comment_id()?,
            anchor,
            CommentBody::new(body)?,
            now,
            now,
        )?;

        self.repository
            .add(&scope, comment)
            .map_err(AppUseCaseError::from)
    }

    pub fn update_comment(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        id: &str,
        body: impl Into<String>,
    ) -> Result<Comment, AppUseCaseError> {
        let scope = CommentScope::parse(spec_id, file_key)?;
        let id = CommentId::new(id)?;
        let mut comment = self.get_comment(&scope, &id)?;

        comment.update_body(CommentBody::new(body)?, self.clock.now())?;

        self.repository
            .update(&scope, comment)
            .map_err(AppUseCaseError::from)
    }

    pub fn delete_comment(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        id: &str,
    ) -> Result<(), AppUseCaseError> {
        let scope = CommentScope::parse(spec_id, file_key)?;
        let id = CommentId::new(id)?;

        self.repository
            .delete(&scope, &id)
            .map_err(AppUseCaseError::from)
    }

    pub fn resolve_comment(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        id: &str,
    ) -> Result<Comment, AppUseCaseError> {
        self.set_comment_resolved(spec_id, file_key, id, true)
    }

    pub fn reopen_comment(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        id: &str,
    ) -> Result<Comment, AppUseCaseError> {
        self.set_comment_resolved(spec_id, file_key, id, false)
    }

    pub fn toggle_comment_resolved(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        id: &str,
    ) -> Result<Comment, AppUseCaseError> {
        let scope = CommentScope::parse(spec_id, file_key)?;
        let id = CommentId::new(id)?;
        let comment = self.get_comment(&scope, &id)?;

        self.set_comment_resolved(spec_id, file_key, id.as_str(), !comment.is_resolved())
    }

    fn set_comment_resolved(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        id: &str,
        resolved: bool,
    ) -> Result<Comment, AppUseCaseError> {
        let scope = CommentScope::parse(spec_id, file_key)?;
        let id = CommentId::new(id)?;
        let mut comment = self.get_comment(&scope, &id)?;
        let now = self.clock.now();

        if resolved {
            comment.resolve(now)?;
        } else {
            comment.reopen(now)?;
        }

        self.repository
            .update(&scope, comment)
            .map_err(AppUseCaseError::from)
    }

    pub(super) fn get_comment(
        &self,
        scope: &CommentScope,
        id: &CommentId,
    ) -> Result<Comment, AppUseCaseError> {
        self.repository
            .list(&CommentListQuery::new(scope.clone()))?
            .into_iter()
            .find(|comment| comment.id() == id)
            .ok_or_else(|| CommentRepositoryError::not_found(id.clone()).into())
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{
        anchor, comment, timestamp, use_cases, FakeCommentRepository,
    };
    use crate::app::use_cases::AppUseCaseError;
    use crate::domain::comment::{CommentStatus, CommentStatusFilter};
    use crate::domain::spec::SpecFileKey;

    #[test]
    fn list_comments_filters_by_scope_and_status() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().extend([
            comment(
                "cmt_open",
                SpecFileKey::Impl,
                "Open",
                CommentStatus::Open,
                1,
            ),
            comment(
                "cmt_resolved",
                SpecFileKey::Impl,
                "Resolved",
                CommentStatus::Resolved,
                2,
            ),
            comment(
                "cmt_tasks",
                SpecFileKey::Tasks,
                "Tasks",
                CommentStatus::Open,
                1,
            ),
        ]);
        let use_cases = use_cases(repository);

        let comments = use_cases
            .list_comments("auth-flow", SpecFileKey::Impl, CommentStatusFilter::Open)
            .expect("comments should list");

        assert_eq!(1, comments.len());
        assert_eq!("cmt_open", comments[0].id().as_str());
    }

    #[test]
    fn add_comment_generates_id_and_timestamps_in_app_layer() {
        let repository = FakeCommentRepository::default();
        let use_cases = use_cases(repository.clone());

        let added = use_cases
            .add_comment(
                "auth-flow",
                anchor(SpecFileKey::Impl),
                "  Please clarify.  ",
            )
            .expect("comment should be added");

        assert_eq!("cmt_generated", added.id().as_str());
        assert_eq!("Please clarify.", added.body().as_str());
        assert_eq!(timestamp(5), added.created_at());
        assert_eq!(timestamp(5), added.updated_at());
        assert_eq!(vec![added], *repository.comments.borrow());
    }

    #[test]
    fn add_comment_rejects_empty_body_before_persistence() {
        let repository = FakeCommentRepository::default();
        let use_cases = use_cases(repository.clone());

        let result = use_cases.add_comment("auth-flow", anchor(SpecFileKey::Impl), "   ");

        assert_eq!(
            Err(AppUseCaseError::InvalidComment {
                message: "comment body is required".to_string()
            }),
            result
        );
        assert!(repository.comments.borrow().is_empty());
    }

    #[test]
    fn update_comment_preserves_anchor_status_and_created_at() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment(
            "cmt_existing",
            SpecFileKey::Impl,
            "Old body",
            CommentStatus::Open,
            1,
        ));
        let use_cases = use_cases(repository);

        let updated = use_cases
            .update_comment(
                "auth-flow",
                SpecFileKey::Impl,
                "cmt_existing",
                "Updated body",
            )
            .expect("comment should update");

        assert_eq!("Updated body", updated.body().as_str());
        assert_eq!(SpecFileKey::Impl, updated.anchor().file_key());
        assert_eq!(CommentStatus::Open, updated.status());
        assert_eq!(timestamp(1), updated.created_at());
        assert_eq!(timestamp(5), updated.updated_at());
    }

    #[test]
    fn resolve_reopen_and_toggle_comment_status() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment(
            "cmt_existing",
            SpecFileKey::Impl,
            "Body",
            CommentStatus::Open,
            1,
        ));
        let use_cases = use_cases(repository.clone());

        let resolved = use_cases
            .resolve_comment("auth-flow", SpecFileKey::Impl, "cmt_existing")
            .expect("comment should resolve");
        let reopened = use_cases
            .reopen_comment("auth-flow", SpecFileKey::Impl, "cmt_existing")
            .expect("comment should reopen");
        let toggled = use_cases
            .toggle_comment_resolved("auth-flow", SpecFileKey::Impl, "cmt_existing")
            .expect("comment should toggle");

        assert_eq!(CommentStatus::Resolved, resolved.status());
        assert_eq!(CommentStatus::Open, reopened.status());
        assert_eq!(CommentStatus::Resolved, toggled.status());
        assert_eq!(timestamp(5), toggled.updated_at());
        assert_eq!(vec![toggled], *repository.comments.borrow());
    }

    #[test]
    fn delete_comment_removes_existing_comment() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment(
            "cmt_existing",
            SpecFileKey::Impl,
            "Body",
            CommentStatus::Open,
            1,
        ));
        let use_cases = use_cases(repository.clone());

        use_cases
            .delete_comment("auth-flow", SpecFileKey::Impl, "cmt_existing")
            .expect("comment should delete");

        assert!(repository.comments.borrow().is_empty());
    }
}
