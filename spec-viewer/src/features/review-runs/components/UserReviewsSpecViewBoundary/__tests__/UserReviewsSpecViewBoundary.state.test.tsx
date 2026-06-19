import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import {
  SpecViewIdentityProvider,
  useSpecViewIdentity,
} from "@/app/context/specViewIdentity";
import { UserReviewsSpecViewBoundary } from "@/features/review-runs/components/UserReviewsSpecViewBoundary";
import type { UseUserReviewsResult } from "@/features/review-runs/hooks/useUserReviews";
import type { SpecFileKey } from "@/features/specs/types/spec";
import { WorkspacePath } from "@/shared/domain/workspacePath";

function createContainerRoot(): Readonly<{
  container: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
}> {
  const container = document.createElement("div");
  const root = createRoot(container);

  return { container, root };
}

test("UserReviewsSpecViewBoundaryはprovider未配置なら明示errorを投げる", () => {
  const errorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  const { container, root } = createContainerRoot();

  expect(() => {
    act(() => {
      root.render(
        <UserReviewsSpecViewBoundary>{() => null}</UserReviewsSpecViewBoundary>,
      );
    });
  }).toThrow("SpecViewIdentityProvider is missing");

  root.unmount();
  container.remove();
  errorSpy.mockRestore();
});

test("UserReviewsSpecViewBoundaryはproviderが保持するselectionでuserReviewsをchildrenへ渡す", async () => {
  const received: UseUserReviewsResult[] = [];
  const { container, root } = createContainerRoot();

  function SelectionSetter(): null {
    const { setWorkspaceSelection } = useSpecViewIdentity();

    useEffect(() => {
      setWorkspaceSelection({
        workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
        specId: "auth",
        fileKey: "tasks" as SpecFileKey,
      });
    }, [setWorkspaceSelection]);

    return null;
  }

  await act(async () => {
    root.render(
      <SpecViewIdentityProvider>
        <SelectionSetter />
        <UserReviewsSpecViewBoundary>
          {(userReviews) => {
            received.push(userReviews);
            return <span>{userReviews.target?.specId ?? "none"}</span>;
          }}
        </UserReviewsSpecViewBoundary>
      </SpecViewIdentityProvider>,
    );
    await Promise.resolve();
  });

  expect(received[received.length - 1]?.target).toMatchObject({
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  });
  expect(container.textContent).toBe("auth");
  root.unmount();
  container.remove();
});
