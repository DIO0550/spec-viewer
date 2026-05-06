import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useRef } from "react";

import { uiText } from "../lib/uiText";

type Props = Readonly<{
  toolbar: ReactNode;
  sidebar: ReactNode;
  tabs: ReactNode;
  viewer: ReactNode;
  comments: ReactNode;
  isCommentsSidebarOpen?: boolean;
  onOpenCommentsSidebar?: () => void;
  onCloseCommentsSidebar?: () => void;
}>;

/** @returns The three-pane application shell for spec review. */
export function AppShell({
  toolbar,
  sidebar,
  tabs,
  viewer,
  comments,
  isCommentsSidebarOpen = true,
  onOpenCommentsSidebar,
  onCloseCommentsSidebar,
}: Props) {
  const reopenButtonRef = useRef<HTMLButtonElement>(null);
  const commentsAsideRef = useRef<HTMLElement>(null);

  const closeCommentsSidebar = (): void => {
    onCloseCommentsSidebar?.();
    requestAnimationFrame(() => {
      reopenButtonRef.current?.focus();
    });
  };

  const openCommentsSidebar = (): void => {
    onOpenCommentsSidebar?.();
    requestAnimationFrame(() => {
      commentsAsideRef.current
        ?.querySelector<HTMLElement>("button, input, textarea, [tabindex]")
        ?.focus();
    });
  };

  const dismissCommentsSidebar = (
    event: KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (
      event.defaultPrevented ||
      event.key !== "Escape" ||
      !isCommentsSidebarOpen
    ) {
      return;
    }

    event.preventDefault();
    closeCommentsSidebar();
  };

  return (
    <div className="app-shell">
      <header className="app-shell__toolbar">{toolbar}</header>
      <div
        className="app-shell__body"
        data-comments-sidebar={isCommentsSidebarOpen ? "open" : "collapsed"}
        onKeyDown={dismissCommentsSidebar}
      >
        <aside
          className="app-shell__sidebar"
          aria-label={uiText.appShell.specNavigation}
        >
          {sidebar}
        </aside>
        <main className="app-shell__main">
          <div className="app-shell__tabs">{tabs}</div>
          <div className="app-shell__viewer">{viewer}</div>
        </main>
        <aside
          ref={commentsAsideRef}
          className="app-shell__comments"
          aria-hidden={!isCommentsSidebarOpen}
          aria-label={uiText.appShell.commentSidebar}
        >
          <button
            className="icon-button app-shell__comments-close"
            type="button"
            aria-label={uiText.sidebar.close}
            title={uiText.sidebar.close}
            onClick={closeCommentsSidebar}
          >
            <PanelRightClose aria-hidden="true" size={16} />
          </button>
          {comments}
        </aside>
        <div className="app-shell__comments-rail">
          <button
            ref={reopenButtonRef}
            className="icon-button app-shell__comments-open"
            type="button"
            aria-label={uiText.sidebar.reopen}
            title={uiText.sidebar.reopen}
            onClick={openCommentsSidebar}
          >
            <PanelRightOpen aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
