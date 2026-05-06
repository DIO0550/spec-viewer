import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = Readonly<{
  children: ReactNode;
}>;

type State = Readonly<{
  error: Error | null;
}>;

/** Catches unexpected render errors at the application root. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
  };

  /** @returns The fallback state for an unexpected child render failure. */
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  /** Reports unexpected render failures to the developer console. */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled React error", error, info);
  }

  /** Clears the captured error so React can attempt to render again. */
  retry = (): void => {
    this.setState({ error: null });
  };

  /** @returns Child content or a recoverable fatal error message. */
  render(): ReactNode {
    if (this.state.error === null) {
      return this.props.children;
    }

    return (
      <main className="root-error-boundary" role="alert">
        <section className="root-error-boundary__panel">
          <h1>問題が発生しました</h1>
          <p>
            レビュー画面で予期しない描画エラーが発生しました。再試行して現在のセッションを復旧してください。
          </p>
          <pre>{this.state.error.message}</pre>
          <button
            className="button button--primary"
            type="button"
            onClick={this.retry}
          >
            再試行
          </button>
        </section>
      </main>
    );
  }
}
