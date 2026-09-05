import { expect, it } from "vitest";

import cases from "./review-vrt-cases.json";
import {
  approvalBodyFromEvidence,
  joinVisualRecords,
  validateVisualApproval,
} from "../../../scripts/expand-vrt-leaves.mjs";

const candidates = cases.map((entry) => ({
  ...entry,
  imageHash: `sha256:${entry.leafId.toLowerCase()}`,
  headSha: "head-1",
}));
const evidence = candidates.map((entry) => ({
  ...entry,
  actor: "reviewer",
  eventId: `event-${entry.leafId}`,
  ready: true,
  round: 1,
  validatorBaseSha: "base-1",
}));

it("[R199-VRTCASE-017] joins every required tuple to exactly one candidate", () => {
  expect(joinVisualRecords(cases, candidates, evidence)).toHaveLength(16);
});

it("[R199-VRTCASE-018] rejects a required tuple without final evidence", () => {
  expect(() => joinVisualRecords(cases, candidates, evidence.slice(1))).toThrow(
    /evidence/i,
  );
});

it("[R199-VRT-001] accepts an authenticated exact tuple approval", () => {
  expect(
    validateVisualApproval({
      approval: evidence[0],
      candidate: candidates[0],
      prAuthor: "author",
      actorPermission: "write",
      body: JSON.stringify(approvalBodyFromEvidence(evidence[0])),
    }),
  ).toEqual(evidence[0]);
});

it("[R199-VRT-002] rejects a stale head approval", () => {
  expect(() =>
    validateVisualApproval({
      approval: { ...evidence[0], headSha: "stale" },
      candidate: candidates[0],
      prAuthor: "author",
      actorPermission: "write",
      body: JSON.stringify(
        approvalBodyFromEvidence({ ...evidence[0], headSha: "stale" }),
      ),
    }),
  ).toThrow(/head/i);
});

it("[R199-VRT-003] rejects self approval", () => {
  expect(() =>
    validateVisualApproval({
      approval: { ...evidence[0], actor: "author" },
      candidate: candidates[0],
      prAuthor: "author",
      actorPermission: "write",
      body: JSON.stringify(approvalBodyFromEvidence(evidence[0])),
    }),
  ).toThrow(/self/i);
});

it("[R199-VRT-004] rejects a third approval round", () => {
  expect(() =>
    validateVisualApproval({
      approval: { ...evidence[0], round: 3 },
      candidate: candidates[0],
      prAuthor: "author",
      actorPermission: "write",
      body: JSON.stringify(
        approvalBodyFromEvidence({ ...evidence[0], round: 3 }),
      ),
    }),
  ).toThrow(/round/i);
});

it("[R199-VRT-006] records the trusted base validator SHA", () => {
  expect(evidence[0].validatorBaseSha).toBe("base-1");
});

it("[R199-VRT-008] rejects a body that does not exactly encode the approval", () => {
  expect(() =>
    validateVisualApproval({
      approval: evidence[0],
      candidate: candidates[0],
      prAuthor: "author",
      actorPermission: "write",
      body: "ready",
    }),
  ).toThrow(/body/i);
});
