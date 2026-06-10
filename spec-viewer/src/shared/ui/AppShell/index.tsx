import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useRef,
} from "react";

import { uiText } from "@/shared/lib/uiText";

type Props = Readonly<{
  toolbar: ReactNode;
  leftNavigationHeader?: ReactNode;
  sidebar: ReactNode;
  tabs: ReactNode;
  viewer: ReactNode;
  comments: ReactNode;
  isLeftNavigationOpen?: boolean;
  leftNavigationWidth?: number;
  leftNavigationMinWidth?: number;
  leftNavigationMaxWidth?: number;
  onOpenLeftNavigation?: () => void;
  onCloseLeftNavigation?: () => void;
  onLeftNavigationWidthChange?: (width: number) => void;
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
  leftNavigationHeader,
  sidebar,
  tabs,
  viewer,
  comments,
  isLeftNavigationOpen = false,
  leftNavigationWidth = 268,
  leftNavigationMinWidth = 216,
  leftNavigationMaxWidth = 420,
  onOpenLeftNavigation,
  onCloseLeftNavigation,
  onLeftNavigationWidthChange,
  isCommentsSidebarOpen = true,
  commentsSidebarWidth = 360,
  commentsSidebarMinWidth = 280,
  commentsSidebarMaxWidth = 560,
  onOpenCommentsSidebar,
  onCloseCommentsSidebar,
  onCommentsSidebarWidthChange,
}: Props) {
  const openLeftNavigationButtonRef = useRef<HTMLButtonElement>(null);
  const closeLeftNavigationButtonRef = useRef<HTMLButtonElement>(null);
  const leftAsideRef = useRef<HTMLElement>(null);
  const reopenButtonRef = useRef<HTMLButtonElement>(null);
  const commentsAsideRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isResizingLeftNavigationRef = useRef(false);
  const isResizingRef = useRef(false);
  const bodyStyle = {
    "--left-navigation-width": `${leftNavigationWidth}px`,
    "--comment-sidebar-width": `${commentsSidebarWidth}px`,
  } as CSSProperties;
  const leftNavigationHeaderContent = leftNavigationHeader ?? (
    <div className="left-navigation-brand">
      <span className="left-navigation-brand__mark" aria-hidden="true">
        S
      </span>
      <span className="left-navigation-brand__copy">
        <strong>Spec Reviewer</strong>
        <span>Spec workspace</span>
      </span>
    </div>
  );

  const closeLeftNavigation = (): void => {
    onCloseLeftNavigation?.();
    requestAnimationFrame(() => {
      openLeftNavigationButtonRef.current?.focus();
    });
  };

  const openLeftNavigation = (): void => {
    onOpenLeftNavigation?.();
    requestAnimationFrame(() => {
      closeLeftNavigationButtonRef.current?.focus();
    });
  };

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

  const dismissLeftNavigation = (
    event: KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (
      event.defaultPrevented ||
      event.key !== "Escape" ||
      !isLeftNavigationOpen
    ) {
      return;
    }

    const target = event.target;
    const isFromLeftNavigation =
      target instanceof Node && leftAsideRef.current?.contains(target) === true;

    if (!isFromLeftNavigation && !isNarrowViewport()) {
      return;
    }

    event.preventDefault();
    closeLeftNavigation();
  };

  const dismissPanels = (event: KeyboardEvent<HTMLDivElement>): void => {
    dismissLeftNavigation(event);
    dismissCommentsSidebar(event);
  };

  const resizeLeftNavigationFromPointer = (clientX: number): void => {
    const body = bodyRef.current;

    if (body === null || onLeftNavigationWidthChange === undefined) {
      return;
    }

    const nextWidth = clientX - body.getBoundingClientRect().left;

    onLeftNavigationWidthChange(nextWidth);
  };

  const startLeftNavigationResize = (
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    if (onLeftNavigationWidthChange === undefined) {
      return;
    }

    event.preventDefault();
    isResizingLeftNavigationRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeLeftNavigationFromPointer(event.clientX);
  };

  const continueLeftNavigationResize = (
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    if (!isResizingLeftNavigationRef.current) {
      return;
    }

    event.preventDefault();
    resizeLeftNavigationFromPointer(event.clientX);
  };

  const stopLeftNavigationResize = (
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    isResizingLeftNavigationRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const resizeLeftNavigationWithKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
  ): void => {
    if (onLeftNavigationWidthChange === undefined) {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      onLeftNavigationWidthChange(leftNavigationWidth + keyboardResizeStep);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onLeftNavigationWidthChange(leftNavigationWidth - keyboardResizeStep);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      onLeftNavigationWidthChange(leftNavigationMinWidth);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      onLeftNavigationWidthChange(leftNavigationMaxWidth);
    }
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
      <div
        ref={bodyRef}
        className="app-shell__body"
        data-left-navigation={isLeftNavigationOpen ? "open" : "collapsed"}
        data-comments-sidebar={isCommentsSidebarOpen ? "open" : "collapsed"}
        style={bodyStyle}
        onKeyDown={dismissPanels}
      >
        <aside
          ref={leftAsideRef}
          className="app-shell__sidebar"
          aria-hidden={!isLeftNavigationOpen}
          aria-label={uiText.leftNavigation.list}
        >
          <div className="app-shell__sidebar-masthead">
            <div className="app-shell__sidebar-brand">
              {leftNavigationHeaderContent}
            </div>
            <button
              ref={closeLeftNavigationButtonRef}
              className="icon-button app-shell__left-close"
              type="button"
              aria-label={uiText.leftNavigation.close}
              title={uiText.leftNavigation.close}
              onClick={closeLeftNavigation}
            >
              <PanelLeftClose aria-hidden="true" size={16} />
            </button>
          </div>
          <button
            className="app-shell__left-resize"
            type="button"
            role="separator"
            aria-label={uiText.leftNavigation.resize}
            aria-orientation="vertical"
            aria-valuemin={leftNavigationMinWidth}
            aria-valuemax={leftNavigationMaxWidth}
            aria-valuenow={leftNavigationWidth}
            title={uiText.leftNavigation.resize}
            onPointerDown={startLeftNavigationResize}
            onPointerMove={continueLeftNavigationResize}
            onPointerUp={stopLeftNavigationResize}
            onPointerCancel={stopLeftNavigationResize}
            onLostPointerCapture={() => {
              isResizingLeftNavigationRef.current = false;
            }}
            onKeyDown={resizeLeftNavigationWithKeyboard}
          />
          {sidebar}
        </aside>
        <main className="app-shell__main">
          <header
            className="app-shell__toolbar"
            data-left-navigation={isLeftNavigationOpen ? "open" : "collapsed"}
          >
            {!isLeftNavigationOpen ? (
              <button
                ref={openLeftNavigationButtonRef}
                className="icon-button app-shell__left-open"
                type="button"
                aria-label={uiText.leftNavigation.open}
                title={uiText.leftNavigation.open}
                aria-expanded={isLeftNavigationOpen}
                onClick={openLeftNavigation}
              >
                <PanelLeftOpen aria-hidden="true" size={16} />
              </button>
            ) : null}
            <div className="app-shell__toolbar-content">{toolbar}</div>
          </header>
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

/** @returns Whether the shell is currently using drawer-style narrow layout. */
function isNarrowViewport(): boolean {
  if (typeof window === "undefined" || window.matchMedia === undefined) {
    return false;
  }

  return window.matchMedia("(max-width: 900px)").matches;
}
