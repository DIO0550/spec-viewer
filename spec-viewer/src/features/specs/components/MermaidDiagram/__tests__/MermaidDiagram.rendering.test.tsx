import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { MermaidDiagram } from "@/features/specs/components/MermaidDiagram";

const mermaidMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}));

vi.mock("mermaid", () => ({
  default: mermaidMocks,
}));

type RenderResult = Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}>;

function renderComponent(component: ReactNode): RenderResult {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => root.render(component));

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function flushAsyncRender(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  mermaidMocks.initialize.mockReset();
  mermaidMocks.render.mockReset();
});

test("MermaidDiagramは遅延読み込みしたMermaidを安全設定でSVG描画する", async () => {
  mermaidMocks.render.mockResolvedValue({
    svg: '<svg role="graphics-document"><text>Rendered flow</text></svg>',
  });

  const result = renderComponent(
    <MermaidDiagram source={"flowchart LR\n  A --> B"} />,
  );
  await flushAsyncRender();

  expect(mermaidMocks.initialize).toHaveBeenCalledWith({
    securityLevel: "strict",
    startOnLoad: false,
  });
  expect(mermaidMocks.render).toHaveBeenCalledWith(
    expect.stringMatching(/^mermaid-diagram-/),
    "flowchart LR\n  A --> B",
  );
  expect(result.container.querySelector("svg")?.textContent).toBe(
    "Rendered flow",
  );
  result.unmount();
});

test("MermaidDiagramは構文エラー時も画面を落とさず元コードを表示する", async () => {
  mermaidMocks.render.mockRejectedValue(new Error("Parse error"));

  const result = renderComponent(<MermaidDiagram source="invalid diagram" />);
  await flushAsyncRender();

  expect(
    result.container.querySelector('[role="alert"]')?.textContent,
  ).toContain("Mermaid図を表示できませんでした");
  expect(result.container.querySelector("pre code")?.textContent).toBe(
    "invalid diagram",
  );
  result.unmount();
});
