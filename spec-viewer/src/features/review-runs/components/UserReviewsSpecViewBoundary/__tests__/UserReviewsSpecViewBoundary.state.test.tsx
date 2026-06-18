import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { SpecViewIdentityProvider } from "@/app/context/specViewIdentity";
import { UserReviewsSpecViewBoundary } from "@/features/review-runs/components/UserReviewsSpecViewBoundary";
import type { UseUserReviewsResult } from "@/features/review-runs/hooks/useUserReviews";
import type { SpecFileKey } from "@/features/specs/types/spec";

function createContainerRoot(): Readonly<{
  container: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
}> {
  const container = document.createElement("div");
  const root = createRoot(container);

  return { container, root };
}

const selection = {
  workspacePath: null,
  specId: "auth",
  fileKey: "tasks" as SpecFileKey,
  targetScope: "file" as const,
};

test("UserReviewsSpecViewBoundaryはprovider未配置なら明示errorを投げる", () => {
  const errorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  const { container, root } = createContainerRoot();

  expect(() => {
    act(() => {
      root.render(
        <UserReviewsSpecViewBoundary selection={selection}>
          {() => null}
        </UserReviewsSpecViewBoundary>,
      );
    });
  }).toThrow("SpecViewIdentityProvider is missing");

  root.unmount();
  container.remove();
  errorSpy.mockRestore();
});

test("UserReviewsSpecViewBoundaryはproviderのidentityでuserReviewsをchildrenへ渡す", async () => {
  const received: UseUserReviewsResult[] = [];
  const { container, root } = createContainerRoot();

  await act(async () => {
    root.render(
      <SpecViewIdentityProvider selection={selection}>
        <UserReviewsSpecViewBoundary selection={selection}>
          {(userReviews) => {
            received.push(userReviews);
            return <span>{userReviews.listState.status}</span>;
          }}
        </UserReviewsSpecViewBoundary>
      </SpecViewIdentityProvider>,
    );
    await Promise.resolve();
  });

  expect(received[received.length - 1]?.listState.status).toBe("idle");
  expect(container.textContent).toBe("idle");
  root.unmount();
  container.remove();
});
