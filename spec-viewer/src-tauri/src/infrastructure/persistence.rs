//! Persistence adapters.
pub mod atomic_replace;
pub mod diff_comment_backend;
pub mod diff_comment_json;
pub mod diff_comment_paths;
pub mod diff_comment_store;
#[cfg(feature = "native-test-control")]
pub(crate) mod native_test_control;
pub mod private_permissions;

pub mod comment_paths;
pub mod comment_store;

#[cfg(all(test, not(feature = "native-test-control")))]
mod release_exclusion_tests {
    #[test]
    fn r199_native_005_release_exclusion() {
        assert!(!cfg!(feature = "native-test-control"));
    }
}
pub mod comments;
pub mod config;
