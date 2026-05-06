import { PanelRightClose, PanelRightOpen } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useRef,
} from "react";

import { uiText } from "../lib/uiText";

type Props = Readonly<{
  toolbar: ReactNode;
  sidebar: ReactNode;
  tabs: ReactNode;
  viewer: ReactNode;
  comments: ReactNode;
  isCommentsSidebarOpen?: boolean;
  commentsSidebarWidth?: number;
  commentsSidebarMinWidth?: number;
  commentsSidebarMaxWidth?: number;
  onOpenCommentsSidebar?: () => void;
  onCloseCommentsSidebar?: () => void;
  onCommentsSidebarWidthChange?: (width: number) => void;
}>;

const keyboardResizeStep = 16;

/** @returns The three-pane application shell for spec review. */
export function AppShell({
  toolbar,
  sidebar,
  tabs,
  viewer,
  comments,
  isCommentsSidebarOpen = true,
  commentsSidebarWidth = 360,
  commentsSidebarMinWidth = 280,
  commentsSidebarMaxWidth = 560,
  onOpenCommentsSidebar,
  onCloseCommentsSidebar,
  onCommentsSidebarWidthChange,
}: Props) {
  const reopenButtonRef = useRef<HTMLButtonElement>(null);
  const commentsAsideRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const bodyStyle = {
    "--comment-sidebar-width": `${commentsSidebarWidth}px`,
  } as CSSProperties;

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

  const resizeSidebarFromPointer = (clientX: number): void => {
    const body = bodyRef.current;

    if (body === null || onCommentsSidebarWidthChange === undefined) {
      return;
    }

    const nextWidth = body.getBoundingClientRect().right - clientX;

    onCommentsSidebarWidthChange(nextWidth);
  };

  const startSidebarResize = (event: PointerEvent<HTMLButtonElement>): void => {
    if (onCommentsSidebarWidthChange === undefined) {
      return;
    }

    event.preventDefault();
    isResizingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeSidebarFromPointer(event.clientX);
  };

  const continueSidebarResize = (
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    if (!isResizingRef.current) {
      return;
    }

    event.preventDefault();
    resizeSidebarFromPointer(event.clientX);
  };

  const stopSidebarResize = (event: PointerEvent<HTMLButtonElement>): void => {
    isResizingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const resizeSidebarWithKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
  ): void => {
    if (onCommentsSidebarWidthChange === undefined) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onCommentsSidebarWidthChange(commentsSidebarWidth + keyboardResizeStep);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      onCommentsSidebarWidthChange(commentsSidebarWidth - keyboardResizeStep);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      onCommentsSidebarWidthChange(commentsSidebarMinWidth);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      onCommentsSidebarWidthChange(commentsSidebarMaxWidth);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-shell__toolbar">{toolbar}</header>
      <div
        ref={bodyRef}
        className="app-shell__body"
        data-comments-sidebar={isCommentsSidebarOpen ? "open" : "collapsed"}
        style={bodyStyle}
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
            className="app-shell__comments-resize"
            type="button"
            role="separator"
            aria-label={uiText.sidebar.resize}
            aria-orientation="vertical"
            aria-valuemin={commentsSidebarMinWidth}
            aria-valuemax={commentsSidebarMaxWidth}
            aria-valuenow={commentsSidebarWidth}
            title={uiText.sidebar.resize}
            onPointerDown={startSidebarResize}
            onPointerMove={continueSidebarResize}
            onPointerUp={stopSidebarResize}
            onPointerCancel={stopSidebarResize}
            onLostPointerCapture={() => {
              isResizingRef.current = false;
            }}
            onKeyDown={resizeSidebarWithKeyboard}
          />
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
