const tupleKey = ({ storyId, theme, viewport }) =>
  `${storyId}|${theme}|${viewport}`;

const approvalBodyFields = [
  "leafId",
  "storyId",
  "theme",
  "viewport",
  "imageHash",
  "headSha",
  "ready",
  "round",
];

/** Returns the exact user-authored portion of trusted approval evidence. */
export function approvalBodyFromEvidence(approval) {
  return Object.fromEntries(
    approvalBodyFields.map((field) => [field, approval[field]]),
  );
}

const indexUnique = (records, label) => {
  const index = new Map();
  for (const record of records) {
    const key = tupleKey(record);
    if (index.has(key)) {
      throw new Error(`${label} contains duplicate tuple ${key}`);
    }
    index.set(key, record);
  }
  return index;
};

/** Joins required visual tuples with exactly one candidate and approval. */
export function joinVisualRecords(required, candidates, evidence) {
  const requiredIndex = indexUnique(required, "required cases");
  const candidateIndex = indexUnique(candidates, "candidate records");
  const evidenceIndex = indexUnique(evidence, "evidence records");
  for (const key of candidateIndex.keys()) {
    if (!requiredIndex.has(key)) {
      throw new Error(`candidate contains undeclared tuple ${key}`);
    }
  }
  return [...requiredIndex].map(([key, requirement]) => {
    const candidate = candidateIndex.get(key);
    const approval = evidenceIndex.get(key);
    if (!candidate) throw new Error(`candidate missing for ${key}`);
    if (!approval) throw new Error(`evidence missing for ${key}`);
    if (
      candidate.leafId !== requirement.leafId ||
      approval.leafId !== requirement.leafId
    ) {
      throw new Error(`leaf identity mismatch for ${key}`);
    }
    if (
      approval.imageHash !== candidate.imageHash ||
      approval.headSha !== candidate.headSha
    ) {
      throw new Error(`evidence hash/head mismatch for ${key}`);
    }
    return { requirement, candidate, approval };
  });
}

/** Validates one GitHub-authenticated visual approval against a candidate. */
export function validateVisualApproval(input) {
  const { approval, candidate, prAuthor, actorPermission, body } = input;
  if (approval.actor === prAuthor)
    throw new Error("self approval is forbidden");
  if (!new Set(["admin", "maintain", "write"]).has(actorPermission)) {
    throw new Error("actor lacks write permission");
  }
  if (approval.round > 2) throw new Error("approval round exceeds two");
  if (approval.ready !== true) throw new Error("approval is not ready");
  if (approval.headSha !== candidate.headSha)
    throw new Error("head SHA is stale");
  if (approval.imageHash !== candidate.imageHash)
    throw new Error("image hash mismatch");
  if (tupleKey(approval) !== tupleKey(candidate))
    throw new Error("tuple mismatch");
  if (body !== JSON.stringify(approvalBodyFromEvidence(approval)))
    throw new Error("approval body mismatch");
  if (!approval.eventId || !approval.validatorBaseSha) {
    throw new Error("trusted approval provenance is incomplete");
  }
  return approval;
}
