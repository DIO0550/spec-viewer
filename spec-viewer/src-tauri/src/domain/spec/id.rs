//! Spec identifier value object.

use std::fmt;

use crate::domain::spec::SpecDomainError;

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct SpecId {
    value: String,
}

impl SpecId {
    pub fn new(value: impl Into<String>) -> Result<Self, SpecDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() {
            return Err(SpecDomainError::MissingSpecId);
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for SpecId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spec_id_accepts_and_trims_non_empty_value() {
        let id = SpecId::new("  auth-flow  ").expect("id should be valid");

        assert_eq!("auth-flow", id.as_str());
        assert_eq!("auth-flow", id.to_string());
    }

    #[test]
    fn spec_id_rejects_empty_value() {
        let result = SpecId::new("   ");

        assert_eq!(Err(SpecDomainError::MissingSpecId), result);
    }
}
