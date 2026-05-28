/** Relationship memory layer for Prospect Search — evidence-backed, client-safe. */

export const GROWTH_RELATIONSHIP_MEMORY_QA_MARKER = "growth-relationship-memory-v1" as const

export const PROSPECT_SEARCH_RELATIONSHIP_STATUSES = [
  "new",
  "warming",
  "engaged",
  "active",
  "stalled",
  "disengaged",
  "blocked",
] as const

export type ProspectSearchRelationshipStatus = (typeof PROSPECT_SEARCH_RELATIONSHIP_STATUSES)[number]

export const PROSPECT_SEARCH_RELATIONSHIP_MOMENTUM = [
  "strengthening",
  "stable",
  "weakening",
  "blocked",
] as const

export type ProspectSearchRelationshipMomentum =
  (typeof PROSPECT_SEARCH_RELATIONSHIP_MOMENTUM)[number]

export type ProspectSearchRelationshipMemoryEvidence = {
  source: string
  label: string
  occurred_at: string | null
  detail: string
}

export type ProspectSearchRelationshipMemorySnapshot = {
  qa_marker: typeof GROWTH_RELATIONSHIP_MEMORY_QA_MARKER
  growth_lead_id: string | null
  relationship_strength_score: number
  relationship_status: ProspectSearchRelationshipStatus
  momentum_direction: ProspectSearchRelationshipMomentum
  trust_indicators: string[]
  conflict_indicators: string[]
  strength_reasons: string[]
  risks: string[]
  recommended_next_action: string
  last_interaction_at: string | null
  interaction_frequency: number
  prior_call_count: number
  prior_email_count: number
  prior_reply_count: number
  prior_meeting_count: number
  suppression_event_count: number
  queue_action_count: number
  relationship_owner: string | null
  evidence: ProspectSearchRelationshipMemoryEvidence[]
  evidence_backed: boolean
}

export type ProspectSearchRelationshipMemoryInput = {
  company_name: string
  growth_lead_id?: string | null
  in_lead_inbox?: boolean
  existing_customer?: boolean
  existing_prospect?: boolean
  is_suppressed?: boolean
  signals?: string[]
  lead_touch?: {
    last_human_touch_at?: string | null
    last_call_at?: string | null
    connected_call_count?: number
    call_attempt_count?: number
    engagement_score?: number | null
    status?: string | null
  } | null
  relationship_context?: {
    progression_score?: number | null
    engagement_trend?: string | null
    relationship_stage?: string | null
  } | null
  timeline_events?: Array<{
    kind: string
    label: string
    detail: string
    occurred_at: string | null
    source?: string
  }>
}

const POSITIVE_EVENT_KINDS = new Set([
  "call_attempt",
  "call_connected",
  "email_reply",
  "meeting",
  "pipeline_transition",
  "operator_action",
  "lead_timeline",
  "relationship_status_change",
])

const NEGATIVE_EVENT_KINDS = new Set([
  "suppression",
  "email_bounce",
  "no_response",
])

function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return null
  return Math.floor((now - ts) / (24 * 60 * 60 * 1000))
}

function countTimelineKinds(
  events: ProspectSearchRelationshipMemoryInput["timeline_events"],
  kinds: Set<string>,
): number {
  return (events ?? []).filter((event) => kinds.has(event.kind)).length
}

export function computeRelationshipStrength(
  input: ProspectSearchRelationshipMemoryInput,
): ProspectSearchRelationshipMemorySnapshot {
  const evidence: ProspectSearchRelationshipMemoryEvidence[] = []
  const strength_reasons: string[] = []
  const risks: string[] = []
  const trust_indicators: string[] = []
  const conflict_indicators: string[] = []

  let score = 10
  let prior_call_count = input.lead_touch?.connected_call_count ?? 0
  let prior_email_count = 0
  let prior_reply_count = 0
  let prior_meeting_count = 0
  let suppression_event_count = 0
  let queue_action_count = 0

  for (const event of input.timeline_events ?? []) {
    evidence.push({
      source: event.source ?? "timeline",
      label: event.label,
      occurred_at: event.occurred_at,
      detail: event.detail,
    })
    if (event.kind === "call_attempt" || event.detail.toLowerCase().includes("call")) {
      prior_call_count += 1
    }
    if (event.kind === "email_attempt" || event.detail.toLowerCase().includes("email")) {
      prior_email_count += 1
    }
    if (event.kind === "email_reply" || /reply|respond/i.test(event.detail)) {
      prior_reply_count += 1
      trust_indicators.push(event.label)
    }
    if (event.kind === "meeting") prior_meeting_count += 1
    if (event.kind === "suppression") suppression_event_count += 1
    if (event.kind === "queue_push") queue_action_count += 1
  }

  if (input.lead_touch?.call_attempt_count) {
    prior_call_count = Math.max(prior_call_count, input.lead_touch.call_attempt_count)
  }

  const last_interaction_at =
    [input.lead_touch?.last_human_touch_at, input.lead_touch?.last_call_at]
      .filter(Boolean)
      .sort()
      .reverse()[0] ??
    (input.timeline_events ?? [])
      .map((e) => e.occurred_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] ??
    null

  const interaction_frequency =
    (input.timeline_events ?? []).filter((e) => e.occurred_at).length +
    (input.lead_touch?.connected_call_count ?? 0)

  if (input.is_suppressed) {
    score = 0
    conflict_indicators.push("Account or contact suppressed")
    risks.push("Outreach blocked by compliance — resolve suppression before contact")
  }

  if (input.in_lead_inbox) {
    score += 8
    strength_reasons.push("Account present in Lead Inbox — prior operator engagement")
    evidence.push({
      source: "lead_inbox",
      label: "Lead Inbox record",
      occurred_at: null,
      detail: "Known inbox relationship — not fabricated history",
    })
  }
  if (input.existing_prospect) {
    score += 6
    strength_reasons.push("Known CRM prospect")
  }
  if (input.existing_customer) {
    score += 12
    strength_reasons.push("Existing customer relationship")
    trust_indicators.push("Customer account")
  }

  if (prior_reply_count > 0) {
    score += Math.min(20, prior_reply_count * 8)
    strength_reasons.push(
      prior_reply_count === 1 ? "Prior reply recorded" : `${prior_reply_count} prior replies recorded`,
    )
  }
  if (prior_meeting_count > 0) {
    score += Math.min(18, prior_meeting_count * 10)
    strength_reasons.push("Meeting history on record")
  }
  if ((input.lead_touch?.connected_call_count ?? 0) > 0) {
    score += Math.min(15, (input.lead_touch?.connected_call_count ?? 0) * 5)
    strength_reasons.push("Previously connected on call")
    trust_indicators.push("Connected call history")
  }

  const positiveEvents = countTimelineKinds(input.timeline_events, POSITIVE_EVENT_KINDS)
  if (positiveEvents > 0) {
    score += Math.min(12, positiveEvents * 3)
  }

  const negativeEvents = countTimelineKinds(input.timeline_events, NEGATIVE_EVENT_KINDS)
  if (negativeEvents >= 3) {
    score -= 15
    risks.push("Repeated negative outreach signals — review before next touch")
    conflict_indicators.push("Multiple failed or negative touchpoints")
  }
  if (suppression_event_count > 0) {
    score -= 20
    conflict_indicators.push("Suppression event on timeline")
  }

  const staleDays = daysSince(last_interaction_at)
  if (staleDays != null && staleDays >= 90 && interaction_frequency > 0) {
    score -= 12
    risks.push(`Relationship stalled ${staleDays}+ days since last interaction`)
  } else if (staleDays != null && staleDays >= 30 && prior_reply_count === 0 && prior_call_count >= 3) {
    score -= 8
    risks.push("No engagement after multiple outreach attempts")
  }

  if (input.relationship_context?.progression_score != null) {
    score += Math.min(15, input.relationship_context.progression_score * 0.12)
    strength_reasons.push(
      `Lead memory progression score ${Math.round(input.relationship_context.progression_score)}`,
    )
  }

  const trend = input.relationship_context?.engagement_trend
  let momentum_direction: ProspectSearchRelationshipMomentum = "stable"
  if (input.is_suppressed || suppression_event_count > 0) {
    momentum_direction = "blocked"
  } else if (trend === "improving" || prior_reply_count > 0) {
    momentum_direction = "strengthening"
  } else if (trend === "declining" || trend === "cooling" || (staleDays != null && staleDays >= 60)) {
    momentum_direction = "weakening"
  }

  let relationship_status: ProspectSearchRelationshipStatus = "new"
  if (input.is_suppressed || suppression_event_count > 0) {
    relationship_status = "blocked"
  } else if (input.existing_customer || prior_meeting_count > 0) {
    relationship_status = "active"
  } else if (prior_reply_count > 0 || (input.lead_touch?.connected_call_count ?? 0) > 0) {
    relationship_status = "engaged"
  } else if (
    input.in_lead_inbox ||
    input.existing_prospect ||
    positiveEvents > 0 ||
    trend === "improving"
  ) {
    relationship_status = "warming"
  } else if (staleDays != null && staleDays >= 90 && interaction_frequency > 0) {
    relationship_status = "stalled"
  } else if (trend === "declining" || negativeEvents >= 2) {
    relationship_status = "disengaged"
  } else if (queue_action_count > 0 || input.in_lead_inbox) {
    relationship_status = "warming"
  }

  score = Math.round(Math.min(100, Math.max(0, score)))

  let recommended_next_action = "Establish baseline contact research before outreach"
  if (relationship_status === "blocked") {
    recommended_next_action = "Resolve suppression or compliance block before any outreach"
  } else if (relationship_status === "stalled") {
    recommended_next_action = "Refresh stale contacts and review relationship before re-engaging"
  } else if (relationship_status === "engaged" || relationship_status === "active") {
    recommended_next_action = "Follow up on prior engagement — use relationship context in outreach"
  } else if (relationship_status === "warming") {
    recommended_next_action = "Continue warming sequence with highest-influence reachable contact"
  } else if (prior_call_count >= 3 && prior_reply_count === 0) {
    recommended_next_action = "Avoid repeated identical outreach — try alternate persona or channel"
  }

  const evidence_backed = evidence.length > 0 || Boolean(input.growth_lead_id)

  return {
    qa_marker: GROWTH_RELATIONSHIP_MEMORY_QA_MARKER,
    growth_lead_id: input.growth_lead_id ?? null,
    relationship_strength_score: score,
    relationship_status,
    momentum_direction,
    trust_indicators: trust_indicators.slice(0, 4),
    conflict_indicators: conflict_indicators.slice(0, 4),
    strength_reasons: strength_reasons.slice(0, 5),
    risks: risks.slice(0, 4),
    recommended_next_action,
    last_interaction_at,
    interaction_frequency,
    prior_call_count,
    prior_email_count,
    prior_reply_count,
    prior_meeting_count,
    suppression_event_count,
    queue_action_count,
    relationship_owner: null,
    evidence: evidence.slice(0, 12),
    evidence_backed,
  }
}

export type ProspectSearchLeadRelationshipHydration = {
  growth_lead_id: string
  lead_touch: {
    last_human_touch_at: string | null
    last_call_at: string | null
    connected_call_count: number
    call_attempt_count: number
    engagement_score: number | null
    status: string | null
  }
  relationship_context: {
    progression_score: number | null
    engagement_trend: string | null
    relationship_stage: string | null
  } | null
  lead_timeline_events: Array<{
    id: string
    event_type: string
    title: string
    summary: string | null
    occurred_at: string
  }>
}

export function resolveRelationshipRankBoost(
  memory: ProspectSearchRelationshipMemorySnapshot | null | undefined,
): { scoreDelta: number; reasons: string[]; risks: string[] } {
  if (!memory || !memory.evidence_backed) {
    return { scoreDelta: 0, reasons: [], risks: [] }
  }
  let scoreDelta = 0
  if (memory.relationship_status === "engaged" || memory.relationship_status === "active") {
    scoreDelta += 0.06
  } else if (memory.relationship_status === "warming") {
    scoreDelta += 0.03
  } else if (memory.relationship_status === "stalled" || memory.relationship_status === "disengaged") {
    scoreDelta -= 0.08
  } else if (memory.relationship_status === "blocked") {
    return { scoreDelta: 0, reasons: [], risks: memory.risks }
  }
  if (memory.prior_reply_count > 0) scoreDelta += 0.04
  if (memory.momentum_direction === "strengthening") scoreDelta += 0.03
  if (memory.momentum_direction === "weakening") scoreDelta -= 0.05
  return {
    scoreDelta,
    reasons: memory.strength_reasons.slice(0, 2),
    risks: memory.risks.slice(0, 2),
  }
}

export function resolveRelationshipQueueBoost(
  memory: ProspectSearchRelationshipMemorySnapshot | null | undefined,
): number {
  if (!memory || memory.relationship_status === "blocked") return 0
  let boost = 0
  if (memory.relationship_status === "engaged" || memory.relationship_status === "active") {
    boost += 6
  } else if (memory.relationship_status === "warming") boost += 3
  if (memory.momentum_direction === "strengthening") boost += 4
  if (memory.momentum_direction === "weakening") boost -= 5
  if (memory.prior_reply_count > 0) boost += 3
  if (memory.relationship_status === "stalled") boost -= 4
  return boost
}
