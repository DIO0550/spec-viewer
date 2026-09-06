import { useEffect, useId, useState } from "react";

type MermaidDiagramProps = Readonly<{
  source: string;
}>;

type MermaidRenderState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "ready"; svg: string }>
  | Readonly<{ status: "error" }>;

type MermaidApi = typeof import("mermaid")["default"];

let mermaidApiPromise: Promise<MermaidApi> | null = null;

/** Loads and initializes Mermaid only when a diagram is actually rendered. */
function loadMermaid(): Promise<MermaidApi> {
  mermaidApiPromise ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      securityLevel: "strict",
      startOnLoad: false,
    });
    return mermaid;
  });

  return mermaidApiPromise;
}

/** Renders one fenced `mermaid` code block without blocking initial Markdown. */
export function MermaidDiagram({ source }: MermaidDiagramProps) {
  const reactId = useId();
  const diagramId = `mermaid-diagram-${reactId.replace(/:/g, "")}`;
  const [renderState, setRenderState] = useState<MermaidRenderState>({
    status: "loading",
  });

  useEffect(() => {
    let isCurrentRender = true;
    setRenderState({ status: "loading" });

    void loadMermaid()
      .then((mermaid) => mermaid.render(diagramId, source))
      .then(
        ({ svg }) => {
          if (isCurrentRender) {
            setRenderState({ status: "ready", svg });
          }
        },
        () => {
          if (isCurrentRender) {
            setRenderState({ status: "error" });
          }
        },
      );

    return () => {
      isCurrentRender = false;
    };
  }, [diagramId, source]);

  if (renderState.status === "loading") {
    return (
      <figure className="mermaid-diagram" aria-label="Mermaid図">
        <div className="mermaid-diagram__status" role="status">
          図を描画しています…
        </div>
      </figure>
    );
  }

  if (renderState.status === "error") {
    return (
      <figure className="mermaid-diagram mermaid-diagram--error">
        <figcaption className="mermaid-diagram__error" role="alert">
          Mermaid図を表示できませんでした。記法を確認してください。
        </figcaption>
        <pre>
          <code className="language-mermaid">{source}</code>
        </pre>
      </figure>
    );
  }

  return (
    <figure className="mermaid-diagram" aria-label="Mermaid図">
      <div
        className="mermaid-diagram__canvas"
        // Mermaid sanitizes generated SVG according to `securityLevel: strict`.
        dangerouslySetInnerHTML={{ __html: renderState.svg }}
      />
    </figure>
  );
}
