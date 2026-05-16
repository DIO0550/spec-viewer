//! Lightweight dev-only performance spans.

use std::{
    collections::BTreeMap,
    time::{Duration, Instant},
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PerformanceContext {
    correlation_id: String,
    command: &'static str,
}

impl PerformanceContext {
    pub fn new(correlation_id: impl Into<String>, command: &'static str) -> Self {
        Self {
            correlation_id: correlation_id.into(),
            command,
        }
    }

    pub fn correlation_id(&self) -> &str {
        &self.correlation_id
    }

    pub fn command(&self) -> &'static str {
        self.command
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PerformanceSpan {
    phase: &'static str,
    duration: Duration,
    metadata: BTreeMap<&'static str, String>,
}

impl PerformanceSpan {
    pub fn phase(&self) -> &'static str {
        self.phase
    }

    pub fn duration(&self) -> Duration {
        self.duration
    }

    pub fn metadata(&self) -> &BTreeMap<&'static str, String> {
        &self.metadata
    }
}

pub fn start_span(
    _context: &PerformanceContext,
    phase: &'static str,
) -> impl FnOnce(BTreeMap<&'static str, String>) -> PerformanceSpan {
    let started_at = Instant::now();

    move |metadata| PerformanceSpan {
        phase,
        duration: started_at.elapsed(),
        metadata,
    }
}

pub fn emit_span(context: &PerformanceContext, span: PerformanceSpan) {
    #[cfg(debug_assertions)]
    {
        eprintln!(
            "[spec-viewer:perf] correlation_id={} command={} phase={} duration_ms={} metadata={:?}",
            context.correlation_id(),
            context.command(),
            span.phase(),
            span.duration().as_millis(),
            span.metadata()
        );
    }

    #[cfg(not(debug_assertions))]
    {
        let _ = (context, span);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn performance_span_keeps_phase_duration_and_metadata() {
        let context = PerformanceContext::new("cid-1", "read_spec_file");
        let end_span = start_span(&context, "markdown.read");
        let mut metadata = BTreeMap::new();
        metadata.insert("bytes", "128".to_string());

        let span = end_span(metadata);

        assert_eq!("markdown.read", span.phase());
        assert_eq!(Some(&"128".to_string()), span.metadata().get("bytes"));
        assert!(span.duration() >= Duration::ZERO);
    }
}
