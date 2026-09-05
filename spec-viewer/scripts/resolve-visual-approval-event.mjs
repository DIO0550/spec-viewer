#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const requiredEnvironment = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const repository = requiredEnvironment("GITHUB_REPOSITORY");
const token = requiredEnvironment("GITHUB_TOKEN");
const eventName = requiredEnvironment("GITHUB_EVENT_NAME");
const event = JSON.parse(
  readFileSync(requiredEnvironment("GITHUB_EVENT_PATH"), "utf8"),
);
const [owner, repo] = repository.split("/");

const githubRequest = async (path) => {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "spec-viewer-trusted-vrt",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${path} failed with ${response.status}`);
  }
  return response.json();
};

const resolvePullRequestNumber = () => {
  if (eventName === "workflow_run") {
    const pullRequests = event.workflow_run?.pull_requests ?? [];
    if (event.workflow_run?.conclusion !== "success") {
      throw new Error("visual candidate workflow did not succeed");
    }
    if (pullRequests.length !== 1) {
      throw new Error("candidate run must belong to exactly one pull request");
    }
    return pullRequests[0].number;
  }
  if (eventName === "issue_comment") {
    if (!event.issue?.pull_request) {
      throw new Error(
        "visual approval comments are only valid on pull requests",
      );
    }
    return event.issue.number;
  }
  if (eventName === "pull_request_review") {
    return event.pull_request?.number;
  }
  throw new Error(`unsupported trusted visual event ${eventName}`);
};

const findCandidateRun = async ({ pullRequestNumber, headSha }) => {
  if (eventName === "workflow_run") {
    const run = event.workflow_run;
    if (run.head_sha !== headSha) {
      throw new Error("candidate workflow head is stale");
    }
    return run;
  }
  const query = new URLSearchParams({
    event: "pull_request",
    status: "success",
    head_sha: headSha,
    per_page: "100",
  });
  const result = await githubRequest(
    `/repos/${owner}/${repo}/actions/workflows/storybook-visual-candidate.yml/runs?${query}`,
  );
  const matching = result.workflow_runs
    .filter((run) =>
      run.pull_requests.some(
        (pullRequest) => pullRequest.number === pullRequestNumber,
      ),
    )
    .sort((left, right) => right.id - left.id);
  if (matching.length === 0) {
    throw new Error(
      "no successful visual candidate exists for the current PR head",
    );
  }
  return matching[0];
};

const writeOutput = (name, value) => {
  appendFileSync(requiredEnvironment("GITHUB_OUTPUT"), `${name}=${value}\n`);
};

const pullRequestNumber = resolvePullRequestNumber();
if (!Number.isInteger(pullRequestNumber)) {
  throw new Error("pull request number is missing");
}
const pullRequest = await githubRequest(
  `/repos/${owner}/${repo}/pulls/${pullRequestNumber}`,
);
const candidateRun = await findCandidateRun({
  pullRequestNumber,
  headSha: pullRequest.head.sha,
});
if (
  candidateRun.head_repository?.full_name !== pullRequest.head.repo.full_name
) {
  throw new Error(
    "candidate run repository does not match the PR head repository",
  );
}
const artifacts = await githubRequest(
  `/repos/${owner}/${repo}/actions/runs/${candidateRun.id}/artifacts?per_page=100`,
);
const candidates = artifacts.artifacts.filter(
  (artifact) => artifact.name === "visual-candidate" && !artifact.expired,
);
if (candidates.length !== 1) {
  throw new Error(
    "candidate run must contain exactly one visual-candidate artifact",
  );
}

const context = {
  candidateArtifactId: candidates[0].id,
  candidateRunId: candidateRun.id,
  headSha: pullRequest.head.sha,
  prAuthor: pullRequest.user.login,
  pullRequestNumber,
  repository,
};
writeFileSync("visual-context.json", `${JSON.stringify(context, null, 2)}\n`);
writeOutput("candidate-run-id", candidateRun.id);
writeOutput("head-sha", pullRequest.head.sha);
writeOutput("pull-request-number", pullRequestNumber);
