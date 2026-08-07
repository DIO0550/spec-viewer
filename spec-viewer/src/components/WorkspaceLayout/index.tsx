import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  type CSSProperties,
  createContext,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useContext,
  useRef,
} from "react";

import { uiText } from "@/utils/uiText";

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
  worktrees?: WorkspaceLayoutPanelControl;
  modeNavigation?: WorkspaceLayoutPanelControl;
  comments?: WorkspaceLayoutPanelControl;
}>;

type RequiredPanelControl = Required<
  Pick<
    WorkspaceLayoutPanelControl,
    "isOpen" | "width" | "minWidth" | "maxWidth"
  >
> &
  Omit<
    WorkspaceLayoutPanelControl,
    "isOpen" | "width" | "minWidth" | "maxWidth"
  >;

type LayoutContextValue = Readonly<{
  worktrees: RequiredPanelControl;
  modeNavigation: RequiredPanelControl;
  comments: RequiredPanelControl;
  bodyRef: RefObject<HTMLDivElement | null>;
  worktreesRef: RefObject<HTMLElement | null>;
  commentsRef: RefObject<HTMLElement | null>;
  worktreesOpenRef: RefObject<HTMLButtonElement | null>;
  worktreesCloseRef: RefObject<HTMLButtonElement | null>;
  commentsOpenRef: RefObject<HTMLButtonElement | null>;
  commentsCloseRef: RefObject<HTMLButtonElement | null>;
  /** Closes the worktrees panel and restores focus to its open control. */
  closeWorktrees: () => void;
  /** Opens the worktrees panel and moves focus to its close control. */
  openWorktrees: () => void;
  /** Closes the comments panel and restores focus to its open control. */
  closeComments: () => void;
  /** Opens the comments panel and moves focus to its close control. */
  openComments: () => void;
}>;

const LayoutContext = createContext<LayoutContextValue | null>(null);

export const WorkspaceLayout = {
  Root: WorkspaceLayoutRoot,
  Pathbar: WorkspaceLayoutPathbar,
  Worktrees: WorkspaceLayoutWorktrees,
  ModeNavigation: WorkspaceLayoutModeNavigation,
  Toolbar: WorkspaceLayoutToolbar,
  Content: WorkspaceLayoutContent,
  Comments: WorkspaceLayoutComments,
} as const;

/**
 * @param props - Controlled panel state and compound layout slots.
 * @returns The shared four-column workspace shell.
 */
function WorkspaceLayoutRoot(props: WorkspaceLayoutRootProps): ReactElement {
  const { children } = props;
  const bodyRef = useRef<HTMLDivElement>(null);
  const worktreesRef = useRef<HTMLElement>(null);
  const commentsRef = useRef<HTMLElement>(null);
  const worktreesOpenRef = useRef<HTMLButtonElement>(null);
  const worktreesCloseRef = useRef<HTMLButtonElement>(null);
  const commentsOpenRef = useRef<HTMLButtonElement>(null);
  const commentsCloseRef = useRef<HTMLButtonElement>(null);
  const worktrees = resolvePanelControl(props.worktrees, {
    isOpen: true,
    width: 240,
    minWidth: 216,
    maxWidth: 420,
  });
  const modeNavigation = resolvePanelControl(props.modeNavigation, {
    isOpen: true,
    width: 220,
    minWidth: 216,
    maxWidth: 420,
  });
  const comments = resolvePanelControl(props.comments, {
    isOpen: true,
    width: 300,
    minWidth: 280,
    maxWidth: 560,
  });
  const style = {
    "--worktrees-width": `${worktrees.width}px`,
    "--mode-navigation-width": `${modeNavigation.width}px`,
    "--comments-width": `${comments.width}px`,
  } as CSSProperties;

  const closeWorktrees = (): void => {
    worktrees.onClose?.();
    requestAnimationFrame(() => {
      worktreesOpenRef.current?.focus();
    });
  };
  const openWorktrees = (): void => {
    worktrees.onOpen?.();
    requestAnimationFrame(() => {
      worktreesCloseRef.current?.focus();
    });
  };
  const closeComments = (): void => {
    comments.onClose?.();
    requestAnimationFrame(() => {
      commentsOpenRef.current?.focus();
    });
  };
  const openComments = (): void => {
    comments.onOpen?.();
    requestAnimationFrame(() => {
      commentsCloseRef.current?.focus();
    });
  };

  const dismissPanel = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.defaultPrevented || event.key !== "Escape") {
      return;
    }

    const target = event.target;
    if (
      worktrees.isOpen &&
      target instanceof Node &&
      worktreesRef.current?.contains(target) === true
    ) {
      event.preventDefault();
      closeWorktrees();
      return;
    }
    if (comments.isOpen) {
      event.preventDefault();
      closeComments();
    }
  };

  return (
    <LayoutContext
      value={{
        worktrees,
        modeNavigation,
        comments,
        bodyRef,
        worktreesRef,
        commentsRef,
        worktreesOpenRef,
        worktreesCloseRef,
        commentsOpenRef,
        commentsCloseRef,
        closeWorktrees,
        openWorktrees,
        closeComments,
        openComments,
      }}
    >
      <div className="app-shell">
        <div
          ref={bodyRef}
          className="app-shell__body"
          data-worktrees={worktrees.isOpen ? "open" : "collapsed"}
          data-comments={comments.isOpen ? "open" : "collapsed"}
          style={style}
          onKeyDown={dismissPanel}
        >
          {children}
        </div>
      </div>
    </LayoutContext>
  );
}

/**
 * @param props - Workspace path controls.
 * @returns The full-width pathbar above the shared four-column shell.
 */
function WorkspaceLayoutPathbar(
  props: Readonly<{ children: ReactNode }>,
): ReactElement {
  return <header className="app-shell__pathbar">{props.children}</header>;
}

/**
 * @param props - Toolbar children.
 * @returns The toolbar spanning mode navigation and central content.
 */
function WorkspaceLayoutToolbar(
  props: Readonly<{ children: ReactNode }>,
): ReactElement {
  const layout = useLayout();

  return (
    <header className="app-shell__toolbar">
      {!layout.worktrees.isOpen ? (
        <button
          ref={layout.worktreesOpenRef}
          className="icon-button app-shell__worktrees-open"
          type="button"
          aria-label={uiText.leftNavigation.open}
          aria-expanded={false}
          onClick={layout.openWorktrees}
        >
          <PanelLeftOpen aria-hidden="true" size={16} />
        </button>
      ) : null}
      <div className="app-shell__toolbar-content">{props.children}</div>
      {!layout.comments.isOpen ? (
        <button
          ref={layout.commentsOpenRef}
          className="icon-button app-shell__comments-open"
          type="button"
          aria-label={uiText.sidebar.reopen}
          aria-expanded={false}
          onClick={layout.openComments}
        >
          <PanelRightOpen aria-hidden="true" size={16} />
        </button>
      ) : null}
    </header>
  );
}

/**
 * @param props - Worktree header and content.
 * @returns The first-column resizable worktree panel.
 */
function WorkspaceLayoutWorktrees(
  props: Readonly<{ children: ReactNode; header?: ReactNode }>,
): ReactElement {
  const layout = useLayout();

  return (
    <aside
      ref={layout.worktreesRef}
      className="app-shell__worktrees"
      aria-label={uiText.leftNavigation.list}
      aria-hidden={!layout.worktrees.isOpen}
    >
      <div className="app-shell__worktrees-header">
        {props.header === undefined ? <strong>Worktrees</strong> : props.header}
        <button
          ref={layout.worktreesCloseRef}
          className="icon-button app-shell__worktrees-close"
          type="button"
          aria-label={uiText.leftNavigation.close}
          onClick={layout.closeWorktrees}
        >
          <PanelLeftClose aria-hidden="true" size={16} />
        </button>
      </div>
      {props.children}
      <PanelResizeHandle
        className="app-shell__worktrees-resize"
        label={uiText.leftNavigation.resize}
        control={layout.worktrees}
        direction="from-left"
      />
    </aside>
  );
}

/**
 * @param props - Specs or Changes navigation.
 * @returns The second-column resizable mode navigation.
 */
function WorkspaceLayoutModeNavigation(
  props: Readonly<{ children: ReactNode }>,
): ReactElement {
  const layout = useLayout();

  return (
    <aside className="app-shell__mode-navigation" aria-label="Mode navigation">
      {props.children}
      <PanelResizeHandle
        className="app-shell__mode-navigation-resize"
        label="Mode navigation の幅を変更"
        control={layout.modeNavigation}
        direction="from-left"
      />
    </aside>
  );
}

/**
 * @param props - Central viewer content.
 * @returns The central independently scrollable content.
 */
function WorkspaceLayoutContent(
  props: Readonly<{ children: ReactNode }>,
): ReactElement {
  return <main className="app-shell__content">{props.children}</main>;
}

/**
 * @param props - Comments content.
 * @returns The fourth-column resizable comments panel.
 */
function WorkspaceLayoutComments(
  props: Readonly<{ children: ReactNode }>,
): ReactElement {
  const layout = useLayout();

  return (
    <aside
      ref={layout.commentsRef}
      className="app-shell__comments"
      aria-label={uiText.appShell.commentSidebar}
      aria-hidden={!layout.comments.isOpen}
    >
      <PanelResizeHandle
        className="app-shell__comments-resize"
        label={uiText.sidebar.resize}
        control={layout.comments}
        direction="from-right"
      />
      <button
        ref={layout.commentsCloseRef}
        className="icon-button app-shell__comments-close"
        type="button"
        aria-label={uiText.sidebar.close}
        onClick={layout.closeComments}
      >
        <PanelRightClose aria-hidden="true" size={16} />
      </button>
      {props.children}
    </aside>
  );
}

type PanelResizeHandleProps = Readonly<{
  className: string;
  label: string;
  control: RequiredPanelControl;
  direction: "from-left" | "from-right";
}>;

/**
 * @param props - Panel control and resize direction.
 * @returns A pointer and keyboard accessible separator.
 */
function PanelResizeHandle(props: PanelResizeHandleProps): ReactElement {
  const { className, label, control, direction } = props;
  const layout = useLayout();
  const resizingRef = useRef(false);

  const resizeAt = (clientX: number): void => {
    const body = layout.bodyRef.current;
    if (body === null || control.onWidthChange === undefined) {
      return;
    }
    const bounds = body.getBoundingClientRect();
    const rawWidth =
      direction === "from-left"
        ? clientX - bounds.left
        : bounds.right - clientX;
    const viewportMaximum =
      direction === "from-left"
        ? Math.min(control.maxWidth, window.innerWidth * 0.42)
        : control.maxWidth;
    control.onWidthChange(
      Math.min(Math.max(rawWidth, control.minWidth), viewportMaximum),
    );
  };

  const handlePointer = (event: PointerEvent<HTMLButtonElement>): void => {
    if (event.type === "pointerdown") {
      if (control.onWidthChange === undefined) {
        return;
      }
      event.preventDefault();
      resizingRef.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      resizeAt(event.clientX);
      return;
    }
    if (event.type === "pointermove" && resizingRef.current) {
      event.preventDefault();
      resizeAt(event.clientX);
      return;
    }
    if (event.type === "pointerup" || event.type === "pointercancel") {
      resizingRef.current = false;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (control.onWidthChange === undefined) {
      return;
    }
    const increaseKey = direction === "from-left" ? "ArrowRight" : "ArrowLeft";
    const decreaseKey = direction === "from-left" ? "ArrowLeft" : "ArrowRight";
    let nextWidth: number | undefined;

    if (event.key === increaseKey) {
      nextWidth = control.width + KeyboardResizeStep;
    } else if (event.key === decreaseKey) {
      nextWidth = control.width - KeyboardResizeStep;
    } else if (event.key === "Home") {
      nextWidth = control.minWidth;
    } else if (event.key === "End") {
      nextWidth = control.maxWidth;
    }
    if (nextWidth === undefined) {
      return;
    }
    event.preventDefault();
    control.onWidthChange(
      Math.min(Math.max(nextWidth, control.minWidth), control.maxWidth),
    );
  };

  return (
    <button
      className={className}
      type="button"
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={control.minWidth}
      aria-valuemax={control.maxWidth}
      aria-valuenow={control.width}
      onPointerDown={handlePointer}
      onPointerMove={handlePointer}
      onPointerUp={handlePointer}
      onPointerCancel={handlePointer}
      onLostPointerCapture={() => {
        resizingRef.current = false;
      }}
      onKeyDown={handleKeyboard}
    />
  );
}

/**
 * Merges caller-provided panel control overrides with defaults, clamping width to the resolved bounds.
 *
 * @param control - Caller-provided panel control, or undefined to use only defaults.
 * @param defaults - Fallback isOpen, width, minWidth, and maxWidth used for any unset fields.
 * @returns A fully resolved panel control with isOpen, width, minWidth, and maxWidth always defined.
 */
function resolvePanelControl(
  control: WorkspaceLayoutPanelControl | undefined,
  defaults: Required<
    Pick<
      WorkspaceLayoutPanelControl,
      "isOpen" | "width" | "minWidth" | "maxWidth"
    >
  >,
): RequiredPanelControl {
  const minWidth = control?.minWidth ?? defaults.minWidth;
  const maxWidth = Math.max(control?.maxWidth ?? defaults.maxWidth, minWidth);
  const width = Math.min(
    Math.max(control?.width ?? defaults.width, minWidth),
    maxWidth,
  );

  return {
    isOpen: control?.isOpen ?? defaults.isOpen,
    width,
    minWidth,
    maxWidth,
    onOpen: control?.onOpen,
    onClose: control?.onClose,
    onWidthChange: control?.onWidthChange,
  };
}

/**
 * @returns The shared layout context provided by the nearest WorkspaceLayout.Root.
 * @throws Error when called outside a WorkspaceLayout.Root subtree.
 */
function useLayout(): LayoutContextValue {
  const value = useContext(LayoutContext);
  if (value === null) {
    throw new Error("WorkspaceLayout slots must be used inside Root");
  }
  return value;
}
