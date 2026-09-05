export type VisualTuple = Readonly<{
  leafId: string;
  storyId: string;
  theme: string;
  viewport: string;
}>;
export type Candidate = VisualTuple &
  Readonly<{ imageHash: string; headSha: string }>;
export type Approval = Candidate &
  Readonly<{
    actor: string;
    eventId: string;
    ready: boolean;
    round: number;
    validatorBaseSha: string;
  }>;
export function approvalBodyFromEvidence(
  approval: Approval,
): Omit<Approval, "actor" | "eventId" | "validatorBaseSha">;
export function joinVisualRecords(
  required: readonly VisualTuple[],
  candidates: readonly Candidate[],
  evidence: readonly Approval[],
): readonly Readonly<{
  requirement: VisualTuple;
  candidate: Candidate;
  approval: Approval;
}>[];
export function validateVisualApproval(
  input: Readonly<{
    approval: Approval;
    candidate: Candidate;
    prAuthor: string;
    actorPermission: string;
    body: string;
  }>,
): Approval;
