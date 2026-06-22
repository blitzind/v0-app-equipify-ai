/** GE-v1-2 — Operator warnings for sequence approval jobs (client-safe heuristics). */

const CERT_TEST_PATTERN = /\b(cert|sr-?3|fixture|pilot|test|qa|benchmark|dry[- ]run)\b/i

export type SequenceExecutionOperatorWarningFlags = {
  jobAgeDays: number
  isStaleApproval: boolean
  isCertOrTestJob: boolean
  operatorWarnings: string[]
}

export function evaluateSequenceExecutionOperatorWarnings(input: {
  status: string
  createdAt: string
  sequenceLabel: string
  qaDeliverabilityBypassUsed?: boolean
  nowMs?: number
}): SequenceExecutionOperatorWarningFlags {
  const nowMs = input.nowMs ?? Date.now()
  const createdMs = new Date(input.createdAt).getTime()
  const jobAgeDays = Number.isFinite(createdMs)
    ? Math.max(0, Math.floor((nowMs - createdMs) / (24 * 60 * 60 * 1000)))
    : 0

  const isPending = input.status === "draft" || input.status === "pending_approval"
  const isStaleApproval = isPending && jobAgeDays >= 7
  const isCertOrTestJob =
    CERT_TEST_PATTERN.test(input.sequenceLabel) || input.qaDeliverabilityBypassUsed === true

  const operatorWarnings: string[] = []
  if (isStaleApproval) {
    operatorWarnings.push(`Stale approval — pending ${jobAgeDays} day(s). Review before sending.`)
  }
  if (isCertOrTestJob) {
    operatorWarnings.push("Cert/test sequence — do not approve for production outreach.")
  }
  if (input.qaDeliverabilityBypassUsed) {
    operatorWarnings.push("QA deliverability bypass active on this job.")
  }

  return {
    jobAgeDays,
    isStaleApproval,
    isCertOrTestJob,
    operatorWarnings,
  }
}
