import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = Readonly<{
  children: ReactNode;
  variant?: "page" | "dialog";
}>;

type State = Readonly<{
  error: Error | null;
  isDialogOpen: boolean;
}>;

/** Catches unexpected render errors at the application root. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    isDialogOpen: false,
  };

  /** @returns The fallback state for an unexpected child render failure. */
  static getDerivedStateFromError(error: Error): State {
    return { error, isDialogOpen: true };
  }

  /** Reports unexpected render failures to the developer console. */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled React error", error, info);
  }

  /** Clears the captured error so React can attempt to render again. */
  retry = (): void => {
    this.setState({ error: null, isDialogOpen: false });
  };

  /** Closes the local error dialog without retrying the failed viewer. */
  dismiss = (): void => {
    this.setState({ isDialogOpen: false });
  };

  /** @returns Child content or a recoverable fatal error message. */
  render(): ReactNode {
    if (this.state.error === null) {
      return this.props.children;
    }

    if (this.props.variant === "dialog") {
      if (!this.state.isDialogOpen) {
        return (
          <section className="review-render-error review-render-error--dismissed">
            <p>レビュー本文を表示できません</p>
            <button type="button" onClick={this.retry}>
              再試行
            </button>
          </section>
        );
      }

      return (
        <div className="review-render-error__backdrop">
          <section
            className="review-render-error__dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="review-render-error-title"
            aria-describedby="review-render-error-description"
          >
            <div className="review-render-error__header">
              <h2 id="review-render-error-title">描画エラー</h2>
              <button
                className="review-render-error__close"
                type="button"
                aria-label="描画エラーダイアログを閉じる"
                autoFocus
                onClick={this.dismiss}
              >
                ×
              </button>
            </div>
            <p id="review-render-error-description">
              レビュー本文の描画中にエラーが発生しました。ほかの画面へ切り替えるか、再試行してください。
            </p>
            <pre>{this.state.error.message}</pre>
            <div className="review-render-error__actions">
              <button type="button" onClick={this.dismiss}>
                閉じる
              </button>
              <button
                className="button button--primary"
                type="button"
                onClick={this.retry}
              >
                再試行
              </button>
            </div>
          </section>
        </div>
      );
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
