import {
  GROWTH_LEAD_ENGINE_EXECUTION_CHANNELS,
  GROWTH_LEAD_ENGINE_EXECUTION_HANDOFFS,
  GROWTH_LEAD_ENGINE_EXECUTION_OWNER_TYPES,
  GROWTH_LEAD_ENGINE_EXECUTION_PATHS,
  GROWTH_LEAD_ENGINE_EXECUTION_PRIORITIES,
  GROWTH_LEAD_ENGINE_EXECUTION_STATUSES,
  GROWTH_LEAD_ENGINE_EXECUTION_TOUCH_FREQUENCIES,
  GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_OUTPUT_JSON_KEYS,
  type GrowthLeadEngineExecutionChannel,
  type GrowthLeadEngineExecutionEvidenceItem,
  type GrowthLeadEngineExecutionHandoff,
  type GrowthLeadEngineExecutionOwnerType,
  type GrowthLeadEngineExecutionPath,
  type GrowthLeadEngineExecutionPriority,
  type GrowthLeadEngineExecutionSequenceStep,
  type GrowthLeadEngineExecutionStatus,
  type GrowthLeadEngineExecutionTouchFrequency,
  type GrowthLeadEngineRevenueExecutionOutput,
  type GrowthLeadEngineRevenueExecutionSourceAttribution,
} from "@/lib/growth/lead-engine/revenue-execution-types"
import type { GrowthLeadEngineHumanApprovalOutput } from "@/lib/growth/lead-engine/human-approval-types"
import type { GrowthLeadEngineLeadScoreOutput } from "@/lib/growth/lead-engine/lead-score-types"
import type { GrowthLeadEngineOutreachPersonalizationOutput } from "@/lib/growth/lead-engine/outreach-personalization-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"

const ALLOWED_STATUSES = new Set<string>(GROWTH_LEAD_ENGINE_EXECUTION_STATUSES)
const ALLOWED_PRIORITIES = new Set<string>(GROWTH_LEAD_ENGINE_EXECUTION_PRIORITIES)
const ALLOWED_PATHS = new Set<string>(GROWTH_LEAD_ENGINE_EXECUTION_PATHS)
const ALLOWED_CHANNELS = new Set<string>(GROWTH_LEAD_ENGINE_EXECUTION_CHANNELS)
const ALLOWED_OWNERS = new Set<string>(GROWTH_LEAD_ENGINE_EXECUTION_OWNER_TYPES)
const ALLOWED_HANDOFFS = new Set<string>(GROWTH_LEAD_ENGINE_EXECUTION_HANDOFFS)
const ALLOWED_FREQUENCIES = new Set<string>(GROWTH_LEAD_ENGINE_EXECUTION_TOUCH_FREQUENCIES)

const MESSAGE_COPY =
  /\b(dear |hi |hello |hey |subject:|unsubscribe|click here|book a demo|best regards|call script:)\b/i

const UNSUPPORTED_EVIDENCE = /\b(assumed|invented|guess|speculated|fabricated)\b/i

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

function asConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  const normalized = value > 1 ? value / 100 : value
  return Math.max(0, Math.min(1, Number(normalized.toFixed(3))))
}

function asReadiness(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function asEvidenceItems(value: unknown): GrowthLeadEngineExecutionEvidenceItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      const code = asString(row.code)
      const evidence = asString(row.evidence)
      const source = asString(row.source)
      const confidence = asConfidence(row.confidence)
      if (!code || !evidence || !source) return null
      if (confidence <= 0) return null
      if (UNSUPPORTED_EVIDENCE.test(evidence)) return null
      return { code, evidence, source, confidence }
    })
    .filter((row): row is GrowthLeadEngineExecutionEvidenceItem => row !== null)
}

function asChannels(value: unknown): GrowthLeadEngineExecutionChannel[] {
  const raw = asStringArray(value)
  const normalized = raw
    .map((entry) => entry.toUpperCase().replace(/\s+/g, "_"))
    .filter((entry): entry is GrowthLeadEngineExecutionChannel => ALLOWED_CHANNELS.has(entry))
  return [...new Set(normalized)]
}

function asSequenceSteps(value: unknown): GrowthLeadEngineExecutionSequenceStep[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      const step_order = typeof row.step_order === "number" ? Math.round(row.step_order) : 0
      const channelRaw = asString(row.channel).toUpperCase().replace(/\s+/g, "_")
      const channel = ALLOWED_CHANNELS.has(channelRaw)
        ? (channelRaw as GrowthLeadEngineExecutionChannel)
        : null
      const action_category = asString(row.action_category)
      const evidence = asString(row.evidence)
      if (!channel || !action_category || !evidence || step_order <= 0) return null
      if (MESSAGE_COPY.test(action_category) || MESSAGE_COPY.test(evidence)) return null
      return { step_order, channel, action_category, evidence }
    })
    .filter((row): row is GrowthLeadEngineExecutionSequenceStep => row !== null)
    .sort((a, b) => a.step_order - b.step_order)
}

function asSourceAttribution(value: unknown): GrowthLeadEngineRevenueExecutionSourceAttribution[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      const source = asString(row.source)
      const section = asString(row.section)
      const signal = asString(row.signal)
      const evidence = asString(row.evidence)
      const confidence = asConfidence(row.confidence)
      if (!source || !section || !signal || !evidence) return null
      if (confidence <= 0) return null
      return { source, section, signal, evidence, confidence }
    })
    .filter((row): row is GrowthLeadEngineRevenueExecutionSourceAttribution => row !== null)
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(body) as unknown
}

function looksLikeMessageCopy(value: string): boolean {
  return MESSAGE_COPY.test(value) || value.length > 320
}

function sanitizeGuidance(value: string): string {
  if (!value || looksLikeMessageCopy(value)) return ""
  return value
}

export type GrowthLeadEngineRevenueExecutionUpstreamContext = {
  approvalStatus?: string | null
  approvalPriority?: string | null
  approvalBlockersCount?: number
  leadScore?: number | null
  leadPriority?: string | null
  verificationDisposition?: string | null
  personalizationChannels?: string[]
  recommendedNextAction?: string | null
}

export function buildRevenueExecutionUpstreamContext(upstream?: {
  humanApproval?: GrowthLeadEngineHumanApprovalOutput | string
  leadScore?: GrowthLeadEngineLeadScoreOutput | string
  verificationTriage?: GrowthLeadEngineVerificationTriageOutput | string
  outreachPersonalization?: GrowthLeadEngineOutreachPersonalizationOutput | string
}): GrowthLeadEngineRevenueExecutionUpstreamContext {
  const context: GrowthLeadEngineRevenueExecutionUpstreamContext = {}

  if (upstream?.humanApproval && typeof upstream.humanApproval === "object") {
    const approval = upstream.humanApproval
    context.approvalStatus = approval.approval_status
    context.approvalPriority = approval.approval_priority
    context.approvalBlockersCount = approval.approval_blockers.length
  }

  if (upstream?.leadScore && typeof upstream.leadScore === "object") {
    const score = upstream.leadScore
    context.leadScore = score.lead_score
    context.leadPriority = score.priority_level
    context.recommendedNextAction = score.recommended_next_action
  }

  if (upstream?.verificationTriage && typeof upstream.verificationTriage === "object") {
    context.verificationDisposition = upstream.verificationTriage.disposition
  }

  if (upstream?.outreachPersonalization && typeof upstream.outreachPersonalization === "object") {
    context.personalizationChannels = upstream.outreachPersonalization.recommended_channel_priority
  }

  return context
}

function buildDeterministicBlockers(
  context: GrowthLeadEngineRevenueExecutionUpstreamContext,
  attributionCount: number,
): GrowthLeadEngineExecutionEvidenceItem[] {
  const blockers: GrowthLeadEngineExecutionEvidenceItem[] = []

  if ((context.approvalStatus ?? "") === "blocked") {
    blockers.push({
      code: "APPROVAL_BLOCKED",
      evidence: "Human approval status is blocked.",
      source: "human_approval",
      confidence: 0.95,
    })
  }

  if (attributionCount < 2) {
    blockers.push({
      code: "ATTRIBUTION_INSUFFICIENT",
      evidence: "Revenue execution requires at least two source_attribution entries.",
      source: "revenue_execution",
      confidence: 0.9,
    })
  }

  if ((context.verificationDisposition ?? "") === "reject") {
    blockers.push({
      code: "VERIFICATION_REJECT",
      evidence: "Verification triage disposition is reject.",
      source: "verification_triage",
      confidence: 0.92,
    })
  }

  if (context.leadPriority === "disqualified") {
    blockers.push({
      code: "LEAD_DISQUALIFIED",
      evidence: "Lead score priority is disqualified.",
      source: "lead_score",
      confidence: 0.9,
    })
  }

  return blockers
}

export function computeDeterministicExecutionStatus(
  context: GrowthLeadEngineRevenueExecutionUpstreamContext,
  attributionCount: number,
  modelBlockers: GrowthLeadEngineExecutionEvidenceItem[],
): GrowthLeadEngineExecutionStatus {
  const deterministicBlockers = buildDeterministicBlockers(context, attributionCount)
  const allBlockers = [...deterministicBlockers, ...modelBlockers]

  if (allBlockers.length > 0) return "blocked"
  if (attributionCount < 2) return "blocked"

  const approval = (context.approvalStatus ?? "").toLowerCase()
  if (approval === "blocked") return "blocked"
  if (approval === "conditional") return "waiting"
  if (approval !== "approved") return "waiting"

  if ((context.verificationDisposition ?? "") === "risky") return "waiting"
  if ((context.recommendedNextAction ?? "") === "verify_contact") return "waiting"
  if ((context.recommendedNextAction ?? "") === "enrich_more") return "waiting"

  return "ready"
}

function computeExecutionReadiness(
  status: GrowthLeadEngineExecutionStatus,
  context: GrowthLeadEngineRevenueExecutionUpstreamContext,
  attributionCount: number,
): number {
  if (status === "blocked") {
    return Math.min(30, Math.max(0, (context.leadScore ?? 0) / 4))
  }
  if (status === "waiting") {
    return Math.min(65, 40 + attributionCount * 5)
  }

  let readiness = 70
  if ((context.leadScore ?? 0) >= 85) readiness += 15
  else if ((context.leadScore ?? 0) >= 70) readiness += 10
  if (attributionCount >= 3) readiness += 5
  if ((context.approvalStatus ?? "") === "approved") readiness += 10
  return Math.max(0, Math.min(100, readiness))
}

function resolveExecutionPriority(
  status: GrowthLeadEngineExecutionStatus,
  context: GrowthLeadEngineRevenueExecutionUpstreamContext,
): GrowthLeadEngineExecutionPriority {
  if (status === "blocked") return "low"
  const approvalPriority = (context.approvalPriority ?? "normal").toLowerCase()
  if (approvalPriority === "urgent") return "urgent"
  if (status === "waiting") return "normal"
  if ((context.leadScore ?? 0) >= 85) return "urgent"
  if ((context.leadScore ?? 0) >= 70) return "normal"
  return "low"
}

function resolveExecutionPath(
  status: GrowthLeadEngineExecutionStatus,
  context: GrowthLeadEngineRevenueExecutionUpstreamContext,
): GrowthLeadEngineExecutionPath {
  if (status === "blocked") return "nurture"
  if (status === "waiting") return "nurture"
  const channels = context.personalizationChannels ?? []
  if (channels.includes("PHONE") || channels.includes("MULTI_TOUCH")) return "call_sequence"
  if (channels.length > 1) return "multi_touch"
  return "outbound_sales"
}

function resolveHandoff(
  status: GrowthLeadEngineExecutionStatus,
  context: GrowthLeadEngineRevenueExecutionUpstreamContext,
): GrowthLeadEngineExecutionHandoff {
  if (status === "blocked" || context.leadPriority === "disqualified") return "disqualify"
  if (status === "waiting") {
    if ((context.recommendedNextAction ?? "") === "enrich_more") return "enrich_first"
    return "review_first"
  }
  if ((context.approvalStatus ?? "") === "approved") return "assign_owner"
  return "review_first"
}

function resolveChannels(
  status: GrowthLeadEngineExecutionStatus,
  context: GrowthLeadEngineRevenueExecutionUpstreamContext,
  modelChannels: GrowthLeadEngineExecutionChannel[],
): GrowthLeadEngineExecutionChannel[] {
  if (status === "blocked") return []
  const fromPersonalization = (context.personalizationChannels ?? [])
    .map((c) => c.toUpperCase())
    .filter((c): c is GrowthLeadEngineExecutionChannel => ALLOWED_CHANNELS.has(c))
  const merged = [...new Set([...fromPersonalization, ...modelChannels])]
  if (merged.length > 0) return merged
  return status === "ready" ? ["EMAIL"] : []
}

function resolveOwnerType(
  status: GrowthLeadEngineExecutionStatus,
  context: GrowthLeadEngineRevenueExecutionUpstreamContext,
): GrowthLeadEngineExecutionOwnerType {
  if (status === "blocked") return "marketing"
  if ((context.leadScore ?? 0) >= 85) return "account_executive"
  if ((context.leadScore ?? 0) >= 70) return "sales"
  return "sdr"
}

function resolveTouchFrequency(status: GrowthLeadEngineExecutionStatus): GrowthLeadEngineExecutionTouchFrequency {
  if (status === "ready") return "immediate"
  if (status === "waiting") return "weekly"
  return "monthly"
}

function enforceRevenueExecution(
  output: GrowthLeadEngineRevenueExecutionOutput,
  context: GrowthLeadEngineRevenueExecutionUpstreamContext,
): GrowthLeadEngineRevenueExecutionOutput {
  const execution_status = computeDeterministicExecutionStatus(
    context,
    output.source_attribution.length,
    output.execution_blockers,
  )

  const deterministicBlockers = buildDeterministicBlockers(
    context,
    output.source_attribution.length,
  )
  const execution_blockers =
    execution_status === "blocked"
      ? [...new Map([...deterministicBlockers, ...output.execution_blockers].map((b) => [b.code, b])).values()]
      : []

  const execution_dependencies = execution_status === "ready" ? [] : output.execution_dependencies

  const execution_readiness = computeExecutionReadiness(
    execution_status,
    context,
    output.source_attribution.length,
  )

  let execution_confidence = output.execution_confidence
  if (execution_status === "blocked") {
    execution_confidence = Math.min(execution_confidence, 0.4)
  } else if (execution_status === "waiting") {
    execution_confidence = Math.min(execution_confidence, 0.7)
  }

  const recommended_channels = resolveChannels(
    execution_status,
    context,
    output.recommended_channels,
  )

  let recommended_followup_strategy = sanitizeGuidance(output.recommended_followup_strategy)
  if (!recommended_followup_strategy) {
    recommended_followup_strategy =
      execution_status === "ready"
        ? "Human rep executes evidenced sequence — no autonomous sends."
        : "Resolve blockers or complete approval before execution."
  }

  const recommended_sequence_steps =
    execution_status === "ready" ? output.recommended_sequence_steps : []

  return {
    ...output,
    execution_status,
    execution_readiness,
    execution_priority: resolveExecutionPriority(execution_status, context),
    recommended_execution_path: resolveExecutionPath(execution_status, context),
    recommended_channels,
    recommended_handoff: resolveHandoff(execution_status, context),
    recommended_owner_type: resolveOwnerType(execution_status, context),
    recommended_touch_frequency: resolveTouchFrequency(execution_status),
    execution_blockers,
    execution_dependencies,
    execution_confidence,
    human_execution_required: true,
    recommended_followup_strategy,
    recommended_sequence_steps,
  }
}

export function parseGrowthLeadEngineRevenueExecutionOutput(
  raw: string,
  options?: { upstream?: GrowthLeadEngineRevenueExecutionUpstreamContext },
): { ok: true; output: GrowthLeadEngineRevenueExecutionOutput } | { ok: false; message: string } {
  try {
    const parsed = extractJsonObject(raw)
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, message: "Revenue execution response is not a JSON object." }
    }
    const record = parsed as Record<string, unknown>
    const context = options?.upstream ?? {}

    const source_attribution = asSourceAttribution(record.source_attribution)
    if (source_attribution.length === 0) {
      return {
        ok: false,
        message: "Revenue execution response must include source_attribution with evidence.",
      }
    }

    const pathRaw = asString(record.recommended_execution_path).toLowerCase()
    const recommended_execution_path = ALLOWED_PATHS.has(pathRaw)
      ? (pathRaw as GrowthLeadEngineExecutionPath)
      : "nurture"

    const ownerRaw = asString(record.recommended_owner_type).toLowerCase()
    const recommended_owner_type = ALLOWED_OWNERS.has(ownerRaw)
      ? (ownerRaw as GrowthLeadEngineExecutionOwnerType)
      : "sdr"

    const handoffRaw = asString(record.recommended_handoff).toLowerCase()
    const recommended_handoff = ALLOWED_HANDOFFS.has(handoffRaw)
      ? (handoffRaw as GrowthLeadEngineExecutionHandoff)
      : "review_first"

    const frequencyRaw = asString(record.recommended_touch_frequency).toLowerCase()
    const recommended_touch_frequency = ALLOWED_FREQUENCIES.has(frequencyRaw)
      ? (frequencyRaw as GrowthLeadEngineExecutionTouchFrequency)
      : "weekly"

    const output: GrowthLeadEngineRevenueExecutionOutput = {
      execution_status: ALLOWED_STATUSES.has(asString(record.execution_status).toLowerCase())
        ? (asString(record.execution_status).toLowerCase() as GrowthLeadEngineExecutionStatus)
        : "waiting",
      execution_readiness: asReadiness(record.execution_readiness),
      execution_priority: ALLOWED_PRIORITIES.has(asString(record.execution_priority).toLowerCase())
        ? (asString(record.execution_priority).toLowerCase() as GrowthLeadEngineExecutionPriority)
        : "normal",
      recommended_execution_path,
      recommended_channels: asChannels(record.recommended_channels),
      recommended_sequence: asString(record.recommended_sequence) || "STANDARD_SEQUENCE",
      recommended_sequence_steps: asSequenceSteps(record.recommended_sequence_steps),
      recommended_timing: sanitizeGuidance(asString(record.recommended_timing)) || "business_hours",
      recommended_owner_type,
      recommended_handoff,
      recommended_followup_strategy: asString(record.recommended_followup_strategy),
      recommended_touch_frequency,
      execution_blockers: asEvidenceItems(record.execution_blockers),
      execution_dependencies: asEvidenceItems(record.execution_dependencies),
      execution_confidence: asConfidence(record.execution_confidence),
      human_execution_required: record.human_execution_required !== false,
      evidence_summary: asString(record.evidence_summary),
      source_attribution,
    }

    if (!output.evidence_summary) {
      return { ok: false, message: "Revenue execution response missing evidence_summary." }
    }

    const enforced = enforceRevenueExecution(output, context)

    if (enforced.execution_status === "ready") {
      if ((context.approvalStatus ?? "") !== "approved") {
        return {
          ok: false,
          message: "Execution ready requires human approval status approved.",
        }
      }
      if (enforced.execution_blockers.length > 0) {
        return { ok: false, message: "Execution ready requires empty execution_blockers." }
      }
      if (enforced.source_attribution.length < 2) {
        return { ok: false, message: "Execution ready requires sufficient source_attribution." }
      }
    }

    if (
      enforced.execution_status !==
      computeDeterministicExecutionStatus(
        context,
        enforced.source_attribution.length,
        asEvidenceItems(record.execution_blockers),
      )
    ) {
      return { ok: false, message: "Enforced execution_status mismatch after deterministic pass." }
    }

    return { ok: true, output: enforced }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not parse revenue execution JSON.",
    }
  }
}

export function parseGrowthLeadEngineRevenueExecutionFromUpstream(
  raw: string,
  upstream?: {
    humanApproval?: GrowthLeadEngineHumanApprovalOutput | string
    leadScore?: GrowthLeadEngineLeadScoreOutput | string
    verificationTriage?: GrowthLeadEngineVerificationTriageOutput | string
    outreachPersonalization?: GrowthLeadEngineOutreachPersonalizationOutput | string
  },
): ReturnType<typeof parseGrowthLeadEngineRevenueExecutionOutput> {
  return parseGrowthLeadEngineRevenueExecutionOutput(raw, {
    upstream: buildRevenueExecutionUpstreamContext(upstream),
  })
}

export function assertGrowthLeadEngineRevenueExecutionOutputKeys(): readonly string[] {
  return GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_OUTPUT_JSON_KEYS
}
