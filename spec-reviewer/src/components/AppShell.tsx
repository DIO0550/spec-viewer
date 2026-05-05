import type { ReactNode } from "react";

type Props = Readonly<{
  toolbar: ReactNode;
  sidebar: ReactNode;
  tabs: ReactNode;
  viewer: ReactNode;
}>;

/** @returns The three-pane application shell for spec review. */
export function AppShell({ toolbar, sidebar, tabs, viewer }: Props) {
  return (
    <div className="app-shell">
      <header className="app-shell__toolbar">{toolbar}</header>
      <div className="app-shell__body">
        <aside className="app-shell__sidebar" aria-label="Spec navigation">
          {sidebar}
        </aside>
        <main className="app-shell__main">
          <div className="app-shell__tabs">{tabs}</div>
          <div className="app-shell__viewer">{viewer}</div>
        </main>
        <aside className="app-shell__comments" aria-label="Comment sidebar">
          <div className="comment-sidebar">
            <h2>Comments</h2>
            <p>Comment threads are reserved for the review workflow.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
