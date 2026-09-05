#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  approvalBodyFromEvidence,
  joinVisualRecords,
  validateVisualApproval,
} from "./expand-vrt-leaves.mjs";

const requiredEnvironment = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const repository = requiredEnvironment("GITHUB_REPOSITORY");
const token = requiredEnvironment("GITHUB_TOKEN");
const [owner, repo] = repository.split("/");
const context = JSON.parse(readFileSync("visual-context.json", "utf8"));
const candidateDirectory =
  process.env.VISUAL_CANDIDATE_DIR ?? "visual-candidate";
const casesPath =
  process.env.VISUAL_CASES_PATH ??
  "spec-viewer/src/tests/acceptance/review-vrt-cases.json";
const evidencePath =
  process.env.VISUAL_EVIDENCE_PATH ?? "visual-approval-evidence.json";
const validatorBaseSha = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

const githubRequest = async (path, options = {}) => {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "spec-viewer-trusted-vrt",
      "x-github-api-version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!response.ok)
    throw new Error(`GitHub API ${path} failed with ${response.status}`);
  if (response.status === 204) return null;
  return response.json();
};

const githubGraphql = async ({ query, variables }) => {
  const response = await fetch("https://api.github.com/graphql", {
    body: JSON.stringify({ query, variables }),
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "spec-viewer-trusted-vrt",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`GitHub GraphQL failed with ${response.status}`);
  }
  const result = await response.json();
  if (result.errors?.length > 0) {
    throw new Error(`GitHub GraphQL failed: ${result.errors[0].message}`);
  }
  return result.data;
};

const githubPages = async (path) => {
  const records = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const pageRecords = await githubRequest(
      `${path}${separator}per_page=100&page=${page}`,
    );
    records.push(...pageRecords);
    if (pageRecords.length < 100) return records;
  }
};

const tupleKey = ({ storyId, theme, viewport }) =>
  `${storyId}|${theme}|${viewport}`;

const parseApproval = (record) => {
  if (!record.body || record.edited) return null;
  try {
    const approval = JSON.parse(record.body);
    if (!approval || Array.isArray(approval) || typeof approval !== "object")
      return null;
    return { approval, record };
  } catch {
    return null;
  }
};

const permissionFor = async (login, cache) => {
  if (cache.has(login)) return cache.get(login);
  const result = await githubRequest(
    `/repos/${owner}/${repo}/collaborators/${encodeURIComponent(login)}/permission`,
  );
  cache.set(login, result.permission);
  return result.permission;
};

const editedReviewIds = async (reviews) => {
  if (reviews.length === 0) return new Set();
  const result = await githubGraphql({
    query: `
      query ReviewEditTimes($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on PullRequestReview { id lastEditedAt }
        }
      }
    `,
    variables: { ids: reviews.map((review) => review.node_id) },
  });
  return new Set(
    result.nodes
      .filter((review) => review?.lastEditedAt)
      .map((review) => review.id),
  );
};

const collectApprovalRecords = async () => {
  const comments = await githubPages(
    `/repos/${owner}/${repo}/issues/${context.pullRequestNumber}/comments`,
  );
  const reviews = await githubPages(
    `/repos/${owner}/${repo}/pulls/${context.pullRequestNumber}/reviews`,
  );
  const editedReviews = await editedReviewIds(reviews);
  return [
    ...comments.map((comment) => ({
      actor: comment.user.login,
      body: comment.body,
      createdAt: comment.created_at,
      edited: comment.created_at !== comment.updated_at,
      eventId: `issue-comment:${comment.id}`,
    })),
    ...reviews
      .filter((review) => review.state !== "DISMISSED")
      .map((review) => ({
        actor: review.user.login,
        body: review.body,
        createdAt: review.submitted_at,
        edited: editedReviews.has(review.node_id),
        eventId: `pull-request-review:${review.id}`,
      })),
  ].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
};

const validateCandidates = (required, candidates) => {
  const requiredByTuple = new Map(
    required.map((entry) => [tupleKey(entry), entry]),
  );
  if (requiredByTuple.size !== required.length)
    throw new Error("required visual cases contain a duplicate tuple");
  const candidatesByTuple = new Map();
  for (const candidate of candidates) {
    const key = tupleKey(candidate);
    if (!requiredByTuple.has(key))
      throw new Error(`candidate contains undeclared tuple ${key}`);
    if (candidatesByTuple.has(key))
      throw new Error(`candidate contains duplicate tuple ${key}`);
    if (candidate.headSha !== context.headSha)
      throw new Error(`candidate head is stale for ${key}`);
    if (candidate.leafId !== requiredByTuple.get(key).leafId)
      throw new Error(`candidate leaf identity mismatch for ${key}`);
    candidatesByTuple.set(key, candidate);
  }
  if (candidatesByTuple.size !== required.length)
    throw new Error("candidate does not contain every required visual tuple");
};

const buildEvidence = async ({ required, candidates, records }) => {
  const permissionCache = new Map();
  const parsed = records.map(parseApproval).filter(Boolean);
  const evidence = [];
  for (const candidate of candidates) {
    const attempts = parsed.filter(
      ({ approval }) =>
        approval.leafId === candidate.leafId &&
        approval.headSha === candidate.headSha &&
        tupleKey(approval) === tupleKey(candidate),
    );
    if (attempts.length > 2)
      throw new Error(`approval round exceeds two for ${candidate.leafId}`);
    let accepted = null;
    for (let index = 0; index < attempts.length; index += 1) {
      const { approval, record } = attempts[index];
      if (approval.round !== index + 1) continue;
      const enriched = {
        ...approval,
        actor: record.actor,
        eventId: record.eventId,
        validatorBaseSha,
      };
      const permission = await permissionFor(record.actor, permissionCache);
      try {
        accepted = validateVisualApproval({
          actorPermission: permission,
          approval: enriched,
          body: record.body,
          candidate,
          prAuthor: context.prAuthor,
        });
      } catch {
        continue;
      }
    }
    if (!accepted)
      throw new Error(`authenticated approval missing for ${candidate.leafId}`);
    evidence.push(accepted);
  }
  joinVisualRecords(required, candidates, evidence);
  return evidence;
};

const approvalTemplates = (candidates) =>
  candidates
    .map((candidate) =>
      JSON.stringify(
        approvalBodyFromEvidence({ ...candidate, ready: true, round: 1 }),
      ),
    )
    .join("\n");

const updateCheck = async ({ conclusion, summary, text }) => {
  const checkName = "Trusted visual approval";
  const existing = await githubRequest(
    `/repos/${owner}/${repo}/commits/${context.headSha}/check-runs?check_name=${encodeURIComponent(checkName)}&filter=latest`,
  );
  const body = {
    conclusion,
    completed_at: new Date().toISOString(),
    name: checkName,
    output: { summary, text, title: checkName },
    status: "completed",
  };
  const latest = existing.check_runs[0];
  if (latest) {
    await githubRequest(`/repos/${owner}/${repo}/check-runs/${latest.id}`, {
      body: JSON.stringify(body),
      method: "PATCH",
    });
    return;
  }
  await githubRequest(`/repos/${owner}/${repo}/check-runs`, {
    body: JSON.stringify({ ...body, head_sha: context.headSha }),
    method: "POST",
  });
};

const required = JSON.parse(readFileSync(casesPath, "utf8"));
const candidates = JSON.parse(
  readFileSync(join(candidateDirectory, "candidate.json"), "utf8"),
);
validateCandidates(required, candidates);

try {
  const records = await collectApprovalRecords();
  const evidence = await buildEvidence({ required, candidates, records });
  const artifact = {
    candidateRunId: context.candidateRunId,
    headSha: context.headSha,
    pullRequestNumber: context.pullRequestNumber,
    records: evidence,
    validatorBaseSha,
  };
  writeFileSync(evidencePath, `${JSON.stringify(artifact, null, 2)}\n`);
  await updateCheck({
    conclusion: "success",
    summary: `${evidence.length} visual tuples have authenticated approval.`,
    text: `Candidate run ${context.candidateRunId}; validator ${validatorBaseSha}.`,
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeFileSync(
    evidencePath,
    `${JSON.stringify({ error: message, headSha: context.headSha, validatorBaseSha }, null, 2)}\n`,
  );
  await updateCheck({
    conclusion: "failure",
    summary: message,
    text: `Post exact JSON approvals as separate PR comments or reviews (maximum two rounds per tuple):\n\n${approvalTemplates(candidates)}`,
  });
  throw error;
}
