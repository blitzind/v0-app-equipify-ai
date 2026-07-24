/**
 * GE-AIOS-NEXT-3C — Evidence-backed executive reasoning synthesizer (presentation-only).
 * Combines NEXT-3A/3B evidence with existing Home runtime signals — no new engines.
 */

import type { GrowthOrganizationalEvidenceCompletenessSnapshot } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import {
  GROWTH_AIOS_NEXT_3C_EXECUTIVE_REASONING_PRINCIPLE,
  GROWTH_AIOS_NEXT_3C_EXECUTIVE_REASONING_QA_MARKER,
  type GrowthHomeAvaExecutiveReasoningBlock,
  type GrowthHomeAvaExecutiveReasoningConfidence,
  type GrowthHomeAvaExecutiveReasoningInput,
  type GrowthHomeAvaExecutiveReasoningPayload,
} from "./growth-home-ava-executive-reasoning-next-3c-types"

const DISALLOWED_PHRASES = /\b(I think|I guess|it seems)\b/i

export function polishExecutiveLanguage(text: string): string {
  let output = text.trim()
  output = output.replace(/^I think it's time we/i, "Current evidence suggests it's time we")
  output = output.replace(/^I think /i, "Current evidence suggests ")
  output = output.replace(/^I'd like to recommend/i, "Based on available evidence, I recommend")
  output = output.replace(/^I believe /i, "The strongest explanation is that ")
  output = output.replace(/\bIt seems like\b/gi, "Current evidence suggests")
  output = output.replace(/\bI guess\b/gi, "There is not yet enough evidence to conclude")
  output = output.replace(
    /Autonomous preparation capacity currently exceeds review capacity\s*\((\d+) packages awaiting decision\)\.?/i,
    (_match, count: string) => {
      const n = Number(count)
      return n === 1
        ? "I've prepared one qualified opportunity. Reviewing it now will allow me to continue building the pipeline."
        : `I've prepared ${n} qualified opportunities. Reviewing them now will allow me to continue building the pipeline.`
    },
  )
  output = output.replace(
    /Clear the approval queue before prioritizing additional discovery or research expansion\.?/i,
    "Review what's ready first — then I'll keep building the pipeline.",
  )
  return output
}

export function assertExecutiveLanguageProfessional(text: string): boolean {
  return !DISALLOWED_PHRASES.test(text)
}

function mapCompletenessConfidence(
  classification: string | undefined,
  sharePct: number | null,
): GrowthHomeAvaExecutiveReasoningConfidence {
  if (classification === "unavailable" || classification === "insufficient_evidence") {
    return "insufficient_evidence"
  }
  if (sharePct != null && sharePct >= 40 && classification === "available") return "high"
  if (classification === "available") return "moderate"
  if (classification === "partially_available") return "moderate"
  return "unknown"
}

function buildAdmissionReasoningBlock(
  snapshot: GrowthOrganizationalEvidenceCompletenessSnapshot,
  outboundDisabled: boolean,
): GrowthHomeAvaExecutiveReasoningBlock | null {
  const admission = snapshot.admissionEvidence
  if (admission.completeness === "unavailable") return null

  const intake = admission.discoveryIntake
  const evidence = [
    intake.discoveryRunsInWindow > 0
      ? `Discovery volume is active (${intake.discoveryRunsInWindow} runs, ${intake.providerRecordsInWindow.toLocaleString()} provider records in the observation window).`
      : null,
    admission.primaryCategory
      ? `Policy-gate and admission categories remain the dominant rejection signal (${admission.leadPoolReasonCategories[0]?.label ?? admission.primaryCategory}).`
      : null,
    intake.intakeExistingTotal > 0
      ? `Duplicate prevention is functioning (${intake.intakeExistingTotal} intake survivors matched existing leads).`
      : null,
    intake.leadsAdmittedInWindow === 0 && intake.providerRecordsInWindow > 0
      ? "No new leads were admitted in the observation window despite provider volume."
      : null,
  ].filter((line): line is string => Boolean(line))

  if (evidence.length === 0) return null

  const confidence = mapCompletenessConfidence(admission.completeness, admission.primaryCategorySharePct)
  const alternatives = [
    "If policy criteria changed recently, today's sample may not represent long-term behavior.",
    intake.intakeSelectedTotal === 0
      ? "Intake disposition counters may be incomplete on some discovery runs — yield could look lower until promotion completes."
      : null,
    outboundDisabled ? "Outbound is disabled — downstream conversion evidence is not available to cross-check admission yield." : null,
  ].filter((line): line is string => Boolean(line))

  const recommendation =
    admission.primaryCategory === "policy" || admission.leadPoolReasonCategories[0]?.category === "policy"
      ? "Address policy-gate review before expanding discovery volume."
      : admission.evidenceBackedExplanation
        ? "Review the dominant admission rejection category before increasing provider spend."
        : null

  return {
    topic: "admission_yield",
    observation: polishExecutiveLanguage(
      admission.evidenceBackedExplanation ??
        "Admission yield remains constrained relative to discovery volume.",
    ),
    evidence,
    confidence,
    confidenceReason:
      confidence === "high"
        ? "Multiple independent signals align: discovery volume, categorized rejection reasons, and intake disposition counters."
        : confidence === "insufficient_evidence"
          ? "Admission categorization exists but sample or intake metadata is incomplete."
          : "Evidence is directionally consistent but not yet sufficient for high certainty.",
    alternativeExplanations: alternatives,
    recommendation: recommendation ? polishExecutiveLanguage(recommendation) : null,
    expectedImpact: recommendation
      ? "Higher admission yield without increasing provider spend."
      : null,
    evidenceSources: ["organizational_effectiveness", "evidence_completeness", "admission_analysis"],
  }
}

function buildDecisionMakerReasoningBlock(
  snapshot: GrowthOrganizationalEvidenceCompletenessSnapshot,
): GrowthHomeAvaExecutiveReasoningBlock | null {
  const dm = snapshot.decisionMakerReadiness
  if (dm.completeness === "unavailable") return null
  if (dm.waitingForDecisionMaker < 3 && dm.waitingForContactVerification < 1) return null

  const evidence = [
    `${dm.waitingForDecisionMaker} leads are waiting for decision-maker research.`,
    dm.verificationRatePct != null
      ? `Decision-maker verification rate is ${dm.verificationRatePct}% across active draft-factory work.`
      : null,
    dm.blockingReasons[0]
      ? `Primary blocking stage: ${dm.blockingReasons[0].reason} (${dm.blockingReasons[0].count} affected).`
      : null,
  ].filter((line): line is string => Boolean(line))

  return {
    topic: "decision_maker_readiness",
    observation: polishExecutiveLanguage(
      "Decision-maker research is limiting package throughput more than downstream stages.",
    ),
    evidence,
    confidence: dm.completeness === "available" ? "moderate" : "low",
    confidenceReason:
      dm.blockingReasons.length > 0
        ? "Draft-factory stage counts and blocking reasons provide direct operational evidence."
        : "Queue depth is visible; progression timing is not yet fully normalized.",
    alternativeExplanations: [
      "Some leads may be waiting on provider person-discovery latency rather than qualification failure.",
      "Recent discovery bursts can temporarily inflate decision-maker queue depth.",
    ],
    recommendation: polishExecutiveLanguage(
      "Prioritize decision-maker verification throughput before adding net-new discovery volume.",
    ),
    expectedImpact: "More packages reaching review-ready state without increasing operator review load.",
    evidenceSources: ["draft_factory", "evidence_completeness", "organizational_effectiveness"],
  }
}

function buildOperatorReviewReasoningBlock(input: {
  pendingApprovals: number
  outboundDisabled: boolean
}): GrowthHomeAvaExecutiveReasoningBlock | null {
  if (input.pendingApprovals < 2) return null

  return {
    topic: "operator_review",
    observation: polishExecutiveLanguage(
      `Autonomous preparation capacity currently exceeds review capacity (${input.pendingApprovals} packages awaiting decision).`,
    ),
    evidence: [
      `${input.pendingApprovals} packages are waiting for operator approval.`,
      "Draft-factory states show review-ready work queued behind operator acknowledgment.",
    ],
    confidence: input.pendingApprovals >= 3 ? "high" : "moderate",
    confidenceReason:
      input.pendingApprovals >= 3
        ? "Multiple packages are waiting — a direct queue signal from draft-factory authority."
        : "Review delay is visible but volume is still manageable.",
    alternativeExplanations: [
      "Operator delays may reflect intentional review pacing rather than a capacity defect.",
      input.outboundDisabled
        ? "Outbound remains disabled — approving packages prepares work but does not yet send."
        : null,
    ].filter((line): line is string => Boolean(line)),
    recommendation: polishExecutiveLanguage(
      "Clear the approval queue before prioritizing additional discovery or research expansion.",
    ),
    expectedImpact: "Unlocks downstream progression for packages already prepared.",
    evidenceSources: ["draft_factory", "operator_decision_throughput"],
  }
}

function buildDiscoveryReasoningBlock(
  mission: GrowthHomeMissionDiscoverySnapshot,
): GrowthHomeAvaExecutiveReasoningBlock | null {
  if (!mission.pipelineLow) return null

  return {
    topic: "pipeline_coverage",
    observation: polishExecutiveLanguage(
      "Portfolio coverage is running low on fresh qualified companies.",
    ),
    evidence: [
      "Mission discovery reports pipeline-low status.",
      `Visible lead pool: ${mission.leadPoolVisible} companies.`,
    ],
    confidence: "high",
    confidenceReason: "Pipeline-low signal is part of canonical mission discovery authority.",
    alternativeExplanations: [
      "Temporary depletion may follow a burst of approvals rather than discovery failure.",
    ],
    recommendation: polishExecutiveLanguage(
      "Refocus executive attention on qualified discovery before outreach expansion.",
    ),
    expectedImpact: "Restores sustainable pipeline coverage within approved markets.",
    evidenceSources: ["mission_discovery", "lead_pool"],
  }
}

function buildInsufficientEvidenceBlock(): GrowthHomeAvaExecutiveReasoningBlock {
  return {
    topic: "insufficient_evidence",
    observation:
      "There is not yet enough evidence to conclude which organizational constraint should change first.",
    evidence: ["Evidence completeness baseline is still establishing across comparison windows."],
    confidence: "insufficient_evidence",
    confidenceReason: "Multiple highest-priority measurements are partial or awaiting durable history.",
    alternativeExplanations: [
      "Recent sample size may be too small for period-over-period conclusions.",
      "Competing explanations may apply until admission and operator outcome history mature.",
    ],
    recommendation: null,
    expectedImpact: null,
    evidenceSources: ["organizational_effectiveness", "evidence_completeness"],
  }
}

export function buildGrowthHomeAvaExecutiveReasoningNext3c(
  input: GrowthHomeAvaExecutiveReasoningInput,
): GrowthHomeAvaExecutiveReasoningPayload {
  const outboundDisabled = input.outboundDisabled ?? true
  const pendingApprovals =
    input.pendingApprovals ?? input.missionDiscovery?.counters.pendingApprovals ?? 0

  const blocks: GrowthHomeAvaExecutiveReasoningBlock[] = []

  if (input.evidenceCompleteness) {
    const admission = buildAdmissionReasoningBlock(input.evidenceCompleteness, outboundDisabled)
    if (admission) blocks.push(admission)
    const dm = buildDecisionMakerReasoningBlock(input.evidenceCompleteness)
    if (dm) blocks.push(dm)
  }

  const operator = buildOperatorReviewReasoningBlock({ pendingApprovals, outboundDisabled })
  if (operator) blocks.push(operator)

  if (input.missionDiscovery) {
    const discovery = buildDiscoveryReasoningBlock(input.missionDiscovery)
    if (discovery) blocks.push(discovery)
  }

  const primary =
    blocks.find((block) => block.topic === "admission_yield") ??
    blocks.find((block) => block.topic === "decision_maker_readiness") ??
    blocks.find((block) => block.topic === "operator_review") ??
    blocks.find((block) => block.topic === "pipeline_coverage") ??
    (blocks[0] ?? null)

  const supporting = primary ? blocks.filter((block) => block !== primary) : blocks

  const synthesisSummary = primary
    ? polishExecutiveLanguage(
        `${primary.observation} ${primary.recommendation ? primary.recommendation : ""}`.trim(),
      )
    : null

  return {
    qaMarker: GROWTH_AIOS_NEXT_3C_EXECUTIVE_REASONING_QA_MARKER,
    principle: GROWTH_AIOS_NEXT_3C_EXECUTIVE_REASONING_PRINCIPLE,
    primary: primary ?? (blocks.length === 0 ? buildInsufficientEvidenceBlock() : null),
    supporting,
    synthesisSummary,
  }
}

export function buildExecutiveReasoningLines(
  reasoning: GrowthHomeAvaExecutiveReasoningPayload | null,
): string[] {
  if (!reasoning?.primary) return []
  const { primary } = reasoning
  const lines = [
    primary.observation,
    ...primary.evidence.slice(0, 3),
    `Confidence: ${primary.confidence} — ${primary.confidenceReason}`,
  ]
  if (primary.alternativeExplanations[0]) {
    lines.push(`Alternative explanation: ${primary.alternativeExplanations[0]}`)
  }
  if (primary.recommendation) {
    lines.push(`Recommendation: ${primary.recommendation}`)
  }
  if (primary.expectedImpact) {
    lines.push(`Expected impact: ${primary.expectedImpact}`)
  }
  return lines
}

export function buildExecutiveReasoningFromEvidenceCompleteness(
  snapshot: GrowthOrganizationalEvidenceCompletenessSnapshot,
  input?: Omit<GrowthHomeAvaExecutiveReasoningInput, "evidenceCompleteness">,
): GrowthHomeAvaExecutiveReasoningPayload {
  return buildGrowthHomeAvaExecutiveReasoningNext3c({
    evidenceCompleteness: snapshot,
    ...input,
  })
}
