import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  createContext,
  useContext,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useRef,
} from "react";

import { uiText } from "@/shared/lib/uiText";

const KeyboardResizeStep = 16;

export type WorkspaceLayoutPanelControl = Readonly<{
  isOpen?: boolean;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onWidthChange?: (width: number) => void;
}>;

export type WorkspaceLayoutRootProps = Readonly<{
  children: ReactNode;
  leftNavigation?: WorkspaceLayoutPanelControl;
  commentsSidebar?: WorkspaceLayoutPanelControl;
}>;

type WorkspaceLayoutMainProps = Readonly<{
  children: ReactNode;
}>;

type WorkspaceLayoutToolbarProps = Readonly<{
  children: ReactNode;
}>;

type WorkspaceLayoutLeftNavigationProps = Readonly<{
  children: ReactNode;
  header?: ReactNode;
}>;

type WorkspaceLayoutSectionProps = Readonly<{
  children: ReactNode;
}>;

type RequiredPanelControl = Readonly<{
  isOpen: boolean;
  width: number;
  minWidth: number;
  maxWidth: number;
  onOpen?: () => void;
  onClose?: () => void;
  onWidthChange?: (width: number) => void;
}>;

type WorkspaceLayoutContextValue = Readonly<{
  leftNavigation: RequiredPanelControl;
  commentsSidebar: RequiredPanelControl;
  openLeftNavigationButtonRef: RefObject<HTMLButtonElement | null>;
  closeLeftNavigationButtonRef: RefObject<HTMLButtonElement | null>;
  leftAsideRef: RefObject<HTMLElement | null>;
  reopenCommentsButtonRef: RefObject<HTMLButtonElement | null>;
  commentsAsideRef: RefObject<HTMLElement | null>;
  bodyRef: RefObject<HTMLDivElement | null>;
  isResizingLeftNavigationRef: RefObject<boolean>;
  isResizingCommentsSidebarRef: RefObject<boolean>;
  closeLeftNavigation: () => void;
  openLeftNavigation: () => void;
  closeCommentsSidebar: () => void;
  openCommentsSidebar: () => void;
}>;

const WorkspaceLayoutContext = createContext<WorkspaceLayoutContextValue | null>(
  null,
);

/** @returns Compound workspace layout components. */
export const WorkspaceLayout = {
  Root: WorkspaceLayoutRoot,
  Toolbar: WorkspaceLayoutToolbar,
  LeftNavigation: WorkspaceLayoutLeftNavigation,
  Main: WorkspaceLayoutMain,
  Tabs: WorkspaceLayoutTabs,
  Viewer: WorkspaceLayoutViewer,
  Comments: WorkspaceLayoutComments,
} as const;

/**
 * @param props - Root panel controls and compound children.
 * @returns The three-pane application workspace layout shell.
 */
function WorkspaceLayoutRoot(props: WorkspaceLayoutRootProps): ReactElement {
  const { children, leftNavigation, commentsSidebar } = props;
  const openLeftNavigationButtonRef = useRef<HTMLButtonElement>(null);
  const closeLeftNavigationButtonRef = useRef<HTMLButtonElement>(null);
  const leftAsideRef = useRef<HTMLElement>(null);
  const reopenCommentsButtonRef = useRef<HTMLButtonElement>(null);
  const commentsAsideRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isResizingLeftNavigationRef = useRef(false);
  const isResizingCommentsSidebarRef = useRef(false);
  const resolvedLeftNavigation = resolvePanelControl(leftNavigation, {
    isOpen: false,
    width: 268,
    minWidth: 216,
    maxWidth: 420,
  });
  const resolvedCommentsSidebar = resolvePanelControl(commentsSidebar, {
    isOpen: true,
    width: 360,
    minWidth: 280,
    maxWidth: 560,
  });
  const bodyStyle = {
    "--left-navigation-width": `${resolvedLeftNavigation.width}px`,
    "--comment-sidebar-width": `${resolvedCommentsSidebar.width}px`,
  } as CSSProperties;

  const closeLeftNavigation = (): void => {
    resolvedLeftNavigation.onClose?.();
    requestAnimationFrame(() => {
      openLeftNavigationButtonRef.current?.focus();
    });
  };

  const openLeftNavigation = (): void => {
    resolvedLeftNavigation.onOpen?.();
    requestAnimationFrame(() => {
      closeLeftNavigationButtonRef.current?.focus();
    });
  };

  const closeCommentsSidebar = (): void => {
    resolvedCommentsSidebar.onClose?.();
    requestAnimationFrame(() => {
      reopenCommentsButtonRef.current?.focus();
    });
  };

  const openCommentsSidebar = (): void => {
    resolvedCommentsSidebar.onOpen?.();
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
      !resolvedCommentsSidebar.isOpen
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
      !resolvedLeftNavigation.isOpen
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

  return (
    <WorkspaceLayoutContext
      value={{
        leftNavigation: resolvedLeftNavigation,
        commentsSidebar: resolvedCommentsSidebar,
        openLeftNavigationButtonRef,
        closeLeftNavigationButtonRef,
        leftAsideRef,
        reopenCommentsButtonRef,
        commentsAsideRef,
        bodyRef,
        isResizingLeftNavigationRef,
        isResizingCommentsSidebarRef,
        closeLeftNavigation,
        openLeftNavigation,
        closeCommentsSidebar,
        openCommentsSidebar,
      }}
    >
      <div className="app-shell">
        <div
          ref={bodyRef}
          className="app-shell__body"
          data-left-navigation={
            resolvedLeftNavigation.isOpen ? "open" : "collapsed"
          }
          data-comments-sidebar={
            resolvedCommentsSidebar.isOpen ? "open" : "collapsed"
          }
          style={bodyStyle}
          onKeyDown={dismissPanels}
        >
          {children}
        </div>
      </div>
    </WorkspaceLayoutContext>
  );
}

/**
 * @param props - Main column children.
 * @returns Main content column for toolbar, tabs, and viewer.
 */
function WorkspaceLayoutMain(props: WorkspaceLayoutMainProps): ReactElement {
  const { children } = props;

  return <main className="app-shell__main">{children}</main>;
}

/**
 * @param props - Toolbar content.
 * @returns Toolbar row with left navigation reopen control.
 */
function WorkspaceLayoutToolbar(
  props: WorkspaceLayoutToolbarProps,
): ReactElement {
  const { children } = props;
  const layout = useWorkspaceLayoutContext();

  return (
    <header
      className="app-shell__toolbar"
      data-left-navigation={layout.leftNavigation.isOpen ? "open" : "collapsed"}
    >
      {!layout.leftNavigation.isOpen ? (
        <button
          ref={layout.openLeftNavigationButtonRef}
          className="icon-button app-shell__left-open"
          type="button"
          aria-label={uiText.leftNavigation.open}
          title={uiText.leftNavigation.open}
          aria-expanded={layout.leftNavigation.isOpen}
          onClick={layout.openLeftNavigation}
        >
          <PanelLeftOpen aria-hidden="true" size={16} />
        </button>
      ) : null}
      <div className="app-shell__toolbar-content">{children}</div>
    </header>
  );
}

/**
 * @param props - Left navigation header and content.
 * @returns Resizable left navigation pane.
 */
function WorkspaceLayoutLeftNavigation(
  props: WorkspaceLayoutLeftNavigationProps,
): ReactElement {
  const { children, header } = props;
  const layout = useWorkspaceLayoutContext();
  const headerContent = header ?? (
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

  const resizeLeftNavigationFromPointer = (clientX: number): void => {
    const body = layout.bodyRef.current;

    if (body === null || layout.leftNavigation.onWidthChange === undefined) {
      return;
    }

    const nextWidth = clientX - body.getBoundingClientRect().left;

    layout.leftNavigation.onWidthChange(nextWidth);
  };

  const startLeftNavigationResize = (
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    if (layout.leftNavigation.onWidthChange === undefined) {
      return;
    }

    event.preventDefault();
    layout.isResizingLeftNavigationRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeLeftNavigationFromPointer(event.clientX);
  };

  const continueLeftNavigationResize = (
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    if (!layout.isResizingLeftNavigationRef.current) {
      return;
    }

    event.preventDefault();
    resizeLeftNavigationFromPointer(event.clientX);
  };

  const stopLeftNavigationResize = (
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    layout.isResizingLeftNavigationRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const resizeLeftNavigationWithKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
  ): void => {
    if (layout.leftNavigation.onWidthChange === undefined) {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      layout.leftNavigation.onWidthChange(
        layout.leftNavigation.width + KeyboardResizeStep,
      );
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      layout.leftNavigation.onWidthChange(
        layout.leftNavigation.width - KeyboardResizeStep,
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      layout.leftNavigation.onWidthChange(layout.leftNavigation.minWidth);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      layout.leftNavigation.onWidthChange(layout.leftNavigation.maxWidth);
    }
  };

  return (
    <aside
      ref={layout.leftAsideRef}
      className="app-shell__sidebar"
      aria-hidden={!layout.leftNavigation.isOpen}
      aria-label={uiText.leftNavigation.list}
    >
      <div className="app-shell__sidebar-masthead">
        <div className="app-shell__sidebar-brand">{headerContent}</div>
        <button
          ref={layout.closeLeftNavigationButtonRef}
          className="icon-button app-shell__left-close"
          type="button"
          aria-label={uiText.leftNavigation.close}
          title={uiText.leftNavigation.close}
          onClick={layout.closeLeftNavigation}
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
        aria-valuemin={layout.leftNavigation.minWidth}
        aria-valuemax={layout.leftNavigation.maxWidth}
        aria-valuenow={layout.leftNavigation.width}
        title={uiText.leftNavigation.resize}
        onPointerDown={startLeftNavigationResize}
        onPointerMove={continueLeftNavigationResize}
        onPointerUp={stopLeftNavigationResize}
        onPointerCancel={stopLeftNavigationResize}
        onLostPointerCapture={() => {
          layout.isResizingLeftNavigationRef.current = false;
        }}
        onKeyDown={resizeLeftNavigationWithKeyboard}
      />
      {children}
    </aside>
  );
}

/**
 * @param props - Tabs content.
 * @returns Tabs region.
 */
function WorkspaceLayoutTabs(props: WorkspaceLayoutSectionProps): ReactElement {
  const { children } = props;

  return <div className="app-shell__tabs">{children}</div>;
}

/**
 * @param props - Viewer content.
 * @returns Document viewer region.
 */
function WorkspaceLayoutViewer(
  props: WorkspaceLayoutSectionProps,
): ReactElement {
  const { children } = props;

  return <div className="app-shell__viewer">{children}</div>;
}

/**
 * @param props - Comments sidebar content.
 * @returns Resizable right comments sidebar and reopen rail.
 */
function WorkspaceLayoutComments(
  props: WorkspaceLayoutSectionProps,
): ReactElement {
  const { children } = props;
  const layout = useWorkspaceLayoutContext();

  const resizeSidebarFromPointer = (clientX: number): void => {
    const body = layout.bodyRef.current;

    if (body === null || layout.commentsSidebar.onWidthChange === undefined) {
      return;
    }

    const nextWidth = body.getBoundingClientRect().right - clientX;

    layout.commentsSidebar.onWidthChange(nextWidth);
  };

  const startSidebarResize = (
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    if (layout.commentsSidebar.onWidthChange === undefined) {
      return;
    }

    event.preventDefault();
    layout.isResizingCommentsSidebarRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeSidebarFromPointer(event.clientX);
  };

  const continueSidebarResize = (
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    if (!layout.isResizingCommentsSidebarRef.current) {
      return;
    }

    event.preventDefault();
    resizeSidebarFromPointer(event.clientX);
  };

  const stopSidebarResize = (event: PointerEvent<HTMLButtonElement>): void => {
    layout.isResizingCommentsSidebarRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const resizeSidebarWithKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
  ): void => {
    if (layout.commentsSidebar.onWidthChange === undefined) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      layout.commentsSidebar.onWidthChange(
        layout.commentsSidebar.width + KeyboardResizeStep,
      );
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      layout.commentsSidebar.onWidthChange(
        layout.commentsSidebar.width - KeyboardResizeStep,
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      layout.commentsSidebar.onWidthChange(layout.commentsSidebar.minWidth);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      layout.commentsSidebar.onWidthChange(layout.commentsSidebar.maxWidth);
    }
  };

  return (
    <>
      <aside
        ref={layout.commentsAsideRef}
        className="app-shell__comments"
        aria-hidden={!layout.commentsSidebar.isOpen}
        aria-label={uiText.appShell.commentSidebar}
      >
        <button
          className="app-shell__comments-resize"
          type="button"
          role="separator"
          aria-label={uiText.sidebar.resize}
          aria-orientation="vertical"
          aria-valuemin={layout.commentsSidebar.minWidth}
          aria-valuemax={layout.commentsSidebar.maxWidth}
          aria-valuenow={layout.commentsSidebar.width}
          title={uiText.sidebar.resize}
          onPointerDown={startSidebarResize}
          onPointerMove={continueSidebarResize}
          onPointerUp={stopSidebarResize}
          onPointerCancel={stopSidebarResize}
          onLostPointerCapture={() => {
            layout.isResizingCommentsSidebarRef.current = false;
          }}
          onKeyDown={resizeSidebarWithKeyboard}
        />
        <button
          className="icon-button app-shell__comments-close"
          type="button"
          aria-label={uiText.sidebar.close}
          title={uiText.sidebar.close}
          onClick={layout.closeCommentsSidebar}
        >
          <PanelRightClose aria-hidden="true" size={16} />
        </button>
        {children}
      </aside>
      <div className="app-shell__comments-rail">
        <button
          ref={layout.reopenCommentsButtonRef}
          className="icon-button app-shell__comments-open"
          type="button"
          aria-label={uiText.sidebar.reopen}
          title={uiText.sidebar.reopen}
          onClick={layout.openCommentsSidebar}
        >
          <PanelRightOpen aria-hidden="true" size={16} />
        </button>
      </div>
    </>
  );
}

/** @returns Context for WorkspaceLayout compound components. */
function useWorkspaceLayoutContext(): WorkspaceLayoutContextValue {
  const context = useContext(WorkspaceLayoutContext);

  if (context === null) {
    throw new Error("WorkspaceLayout.Root is missing");
  }

  return context;
}

/** @returns Panel control with default values filled. */
function resolvePanelControl(
  control: WorkspaceLayoutPanelControl | undefined,
  defaults: RequiredPanelControl,
): RequiredPanelControl {
  return {
    isOpen: control?.isOpen ?? defaults.isOpen,
    width: control?.width ?? defaults.width,
    minWidth: control?.minWidth ?? defaults.minWidth,
    maxWidth: control?.maxWidth ?? defaults.maxWidth,
    onOpen: control?.onOpen,
    onClose: control?.onClose,
    onWidthChange: control?.onWidthChange,
  };
}

/** @returns Whether the shell is currently using drawer-style narrow layout. */
function isNarrowViewport(): boolean {
  if (typeof window === "undefined" || window.matchMedia === undefined) {
    return false;
  }

  return window.matchMedia("(max-width: 900px)").matches;
}
