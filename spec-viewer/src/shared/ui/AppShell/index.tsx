import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";

import { uiText } from "@/shared/lib/uiText";

import { LeftNavigationBrand } from "./LeftNavigationBrand";
import { usePanelResize } from "./usePanelResize";

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
  const leftNavigationResize = usePanelResize({
    side: "left",
    width: leftNavigationWidth,
    minWidth: leftNavigationMinWidth,
    maxWidth: leftNavigationMaxWidth,
    bodyRef,
    onWidthChange: onLeftNavigationWidthChange,
  });
  const commentsSidebarResize = usePanelResize({
    side: "right",
    width: commentsSidebarWidth,
    minWidth: commentsSidebarMinWidth,
    maxWidth: commentsSidebarMaxWidth,
    bodyRef,
    onWidthChange: onCommentsSidebarWidthChange,
  });
  const bodyStyle = {
    "--left-navigation-width": `${leftNavigationWidth}px`,
    "--comment-sidebar-width": `${commentsSidebarWidth}px`,
  } as CSSProperties;
  const leftNavigationHeaderContent = leftNavigationHeader ?? (
    <LeftNavigationBrand />
  );

  const closeLeftNavigation = useCallback((): void => {
    onCloseLeftNavigation?.();
    requestAnimationFrame(() => {
      openLeftNavigationButtonRef.current?.focus();
    });
  }, [onCloseLeftNavigation]);

  const openLeftNavigation = (): void => {
    onOpenLeftNavigation?.();
    requestAnimationFrame(() => {
      closeLeftNavigationButtonRef.current?.focus();
    });
  };

  const closeCommentsSidebar = useCallback((): void => {
    onCloseCommentsSidebar?.();
    requestAnimationFrame(() => {
      reopenButtonRef.current?.focus();
    });
  }, [onCloseCommentsSidebar]);

  const openCommentsSidebar = (): void => {
    onOpenCommentsSidebar?.();
    requestAnimationFrame(() => {
      commentsAsideRef.current
        ?.querySelector<HTMLElement>("button, input, textarea, [tabindex]")
        ?.focus();
    });
  };

  useEffect(() => {
    const dismissCommentsSidebar = (event: KeyboardEvent): void => {
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

    const dismissLeftNavigation = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        event.key !== "Escape" ||
        !isLeftNavigationOpen
      ) {
        return;
      }

      const target = event.target;
      const isFromLeftNavigation =
        target instanceof Node &&
        leftAsideRef.current?.contains(target) === true;

      if (!isFromLeftNavigation && !isNarrowViewport()) {
        return;
      }

      event.preventDefault();
      closeLeftNavigation();
    };

    const dismissPanels = (event: KeyboardEvent): void => {
      dismissLeftNavigation(event);
      dismissCommentsSidebar(event);
    };

    document.addEventListener("keydown", dismissPanels);

    return () => {
      document.removeEventListener("keydown", dismissPanels);
    };
  }, [
    closeCommentsSidebar,
    closeLeftNavigation,
    isCommentsSidebarOpen,
    isLeftNavigationOpen,
  ]);

  return (
    <div className="app-shell">
      <div
        ref={bodyRef}
        className="app-shell__body"
        data-left-navigation={isLeftNavigationOpen ? "open" : "collapsed"}
        data-comments-sidebar={isCommentsSidebarOpen ? "open" : "collapsed"}
        style={bodyStyle}
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
          <hr
            className="app-shell__left-resize"
            tabIndex={0}
            aria-label={uiText.leftNavigation.resize}
            aria-orientation="vertical"
            aria-valuemin={leftNavigationMinWidth}
            aria-valuemax={leftNavigationMaxWidth}
            aria-valuenow={leftNavigationWidth}
            title={uiText.leftNavigation.resize}
            onPointerDown={leftNavigationResize.startResize}
            onPointerMove={leftNavigationResize.continueResize}
            onPointerUp={leftNavigationResize.stopResize}
            onPointerCancel={leftNavigationResize.stopResize}
            onLostPointerCapture={leftNavigationResize.releaseResize}
            onKeyDown={leftNavigationResize.resizeWithKeyboard}
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
          <hr
            className="app-shell__comments-resize"
            tabIndex={0}
            aria-label={uiText.sidebar.resize}
            aria-orientation="vertical"
            aria-valuemin={commentsSidebarMinWidth}
            aria-valuemax={commentsSidebarMaxWidth}
            aria-valuenow={commentsSidebarWidth}
            title={uiText.sidebar.resize}
            onPointerDown={commentsSidebarResize.startResize}
            onPointerMove={commentsSidebarResize.continueResize}
            onPointerUp={commentsSidebarResize.stopResize}
            onPointerCancel={commentsSidebarResize.stopResize}
            onLostPointerCapture={commentsSidebarResize.releaseResize}
            onKeyDown={commentsSidebarResize.resizeWithKeyboard}
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
