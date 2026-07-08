/** Account-level multi-contact outreach strategy — deterministic, evidence-backed. Client-safe. */

import type { ProspectSearchCompanyContactCoverageIntelligence } from "@/lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"
import type { ProspectSearchContactPriorityTier } from "@/lib/growth/prospect-search/prospect-search-contact-ranking"
import type { ProspectSearchRevenuePersonaType } from "@/lib/growth/prospect-search/prospect-search-revenue-persona-intelligence"
import type { ProspectSearchContactFreshnessStatus } from "@/lib/growth/prospect-search/prospect-search-contact-freshness"

export const GROWTH_ACCOUNT_CONTACT_STRATEGY_QA_MARKER = "growth-account-contact-strategy-v1" as const
export const GROWTH_MULTI_CONTACT_ORCHESTRATION_QA_MARKER =
  "growth-multi-contact-orchestration-v1" as const

export const ACCOUNT_OUTREACH_READINESS_TIERS = [
  "ready",
  "ready_with_review",
  "research_needed",
  "verification_needed",
  "blocked",
  "low_confidence",
] as const

export type ProspectSearchAccountOutreachReadinessTier =
  (typeof ACCOUNT_OUTREACH_READINESS_TIERS)[number]

export const RECOMMENDED_OUTREACH_CHANNELS = [
  "email",
  "call",
  "sms",
  "manual_review",
  "research_first",
  "blocked",
] as const

export type ProspectSearchRecommendedOutreachChannel =
  (typeof RECOMMENDED_OUTREACH_CHANNELS)[number]

export type ProspectSearchAccountStrategyContact = {
  contact_id: string
  full_name: string | null
  title: string | null
  persona_label: string
  persona_type: ProspectSearchRevenuePersonaType
  outreach_rank_score: number
  priority_tier: ProspectSearchContactPriorityTier
  recommended_channel: ProspectSearchRecommendedOutreachChannel
  channel_reason: string
  role_in_strategy: "primary" | "secondary" | "fallback" | "blocked"
  block_reason: string | null
  freshness_status: ProspectSearchContactFreshnessStatus | string
  email_eligibility: string
  call_eligibility: string
  sms_eligibility: string
  ranking_reasons: string[]
}

export type ProspectSearchAccountResearchAction = {
  id: string
  label: string
  description: string
  persona_target?: ProspectSearchRevenuePersonaType
}

export type ProspectSearchAccountContactStrategy = {
  qa_marker: typeof GROWTH_ACCOUNT_CONTACT_STRATEGY_QA_MARKER
  orchestration_marker: typeof GROWTH_MULTI_CONTACT_ORCHESTRATION_QA_MARKER
  company_id: string
  company_name: string
  account_outreach_readiness: ProspectSearchAccountOutreachReadinessTier
  account_outreach_readiness_score: number
  recommended_channel: ProspectSearchRecommendedOutreachChannel
  primary_contact: ProspectSearchAccountStrategyContact | null
  secondary_contacts: ProspectSearchAccountStrategyContact[]
  fallback_contacts: ProspectSearchAccountStrategyContact[]
  blocked_contacts: ProspectSearchAccountStrategyContact[]
  missing_personas: ProspectSearchRevenuePersonaType[]
  safest_next_action: string
  contact_research_next_step: string | null
  strategy_reasons: string[]
  risks: string[]
  strategy_summary: string | null
  queue_priority_score: number
  queue_prioritization_reason: string | null
  research_actions: ProspectSearchAccountResearchAction[]
}

type StrategyContactInput = {
  contact_id: string
  full_name?: string | null
  title?: string | null
  persona_label: string
  persona_type: ProspectSearchRevenuePersonaType
  outreach_rank_score: number
  priority_tier: ProspectSearchContactPriorityTier
  freshness_status: ProspectSearchContactFreshnessStatus | string
  email_available: boolean
  phone_available: boolean
  call_ready: boolean
  sms_ready: boolean
  email_eligibility: string
  call_eligibility: string
  sms_eligibility: string
  call_block_reason?: string | null
  sms_block_reason?: string | null
  phone_on_dnc?: boolean | null
  email_verification_depth?: string | null
  phone_verification_depth?: string | null
  is_recommended_contact?: boolean
  is_secondary_contact?: boolean
  ranking_reasons?: string[]
  ranking_risks?: string[]
}

const READINESS_TIER_SCORE: Record<ProspectSearchAccountOutreachReadinessTier, number> = {
  ready: 100,
  ready_with_review: 82,
  verification_needed: 55,
  research_needed: 35,
  low_confidence: 25,
  blocked: 0,
}

export function resolveRecommendedChannelForContact(
  contact: StrategyContactInput,
): { channel: ProspectSearchRecommendedOutreachChannel; reason: string } {
  const blocked =
    contact.priority_tier === "blocked" ||
    contact.call_eligibility === "blocked" ||
    contact.call_eligibility === "suppressed" ||
    contact.email_eligibility === "blocked" ||
    contact.email_eligibility === "suppressed" ||
    contact.phone_on_dnc === true

  if (blocked) {
    const reason =
      contact.phone_on_dnc === true
        ? "DNC blocked — do not call"
        : (contact.call_block_reason ??
          (contact.email_eligibility === "suppressed"
            ? "Email suppressed"
            : "Compliance block — outreach not permitted"))
    return { channel: "blocked", reason }
  }

  if (!contact.email_available && !contact.phone_available) {
    return { channel: "research_first", reason: "No reachable channels — contact research needed" }
  }

  const stale =
    contact.freshness_status === "stale" || contact.freshness_status === "expired"

  if (stale) {
    return { channel: "manual_review", reason: "Stale or expired verification — refresh before outreach" }
  }

  if (
    contact.email_eligibility === "eligible" &&
    contact.email_available &&
    (contact.email_verification_depth === "published_on_website" ||
      contact.freshness_status === "fresh")
  ) {
    return {
      channel: "email",
      reason: `Verified email available for ${contact.persona_label}`,
    }
  }

  if (contact.call_eligibility === "eligible" && contact.call_ready && contact.phone_available) {
    return {
      channel: "call",
      reason: `Call-ready ${contact.persona_label} with verified phone`,
    }
  }

  if (
    contact.call_ready &&
    contact.phone_available &&
    contact.phone_verification_depth === "office_line"
  ) {
    return {
      channel: "call",
      reason: "Call office line first — no verified direct email",
    }
  }

  if (contact.sms_eligibility === "eligible" && contact.sms_ready) {
    return { channel: "sms", reason: "SMS eligible — review compliance before sending" }
  }

  if (
    contact.email_eligibility === "needs_review" ||
    contact.call_eligibility === "needs_review" ||
    contact.email_eligibility === "verification_required" ||
    contact.call_eligibility === "verification_required"
  ) {
    return { channel: "manual_review", reason: "Operator review required before outreach" }
  }

  if (contact.email_available && contact.email_eligibility === "eligible") {
    return { channel: "email", reason: "Email eligible — verify freshness before send" }
  }

  if (contact.phone_available) {
    return { channel: "call", reason: "Phone available — call review may be needed" }
  }

  return { channel: "research_first", reason: "Insufficient channel evidence for outreach" }
}

function toStrategyContact(
  contact: StrategyContactInput,
  role: ProspectSearchAccountStrategyContact["role_in_strategy"],
): ProspectSearchAccountStrategyContact {
  const { channel, reason } = resolveRecommendedChannelForContact(contact)
  const blockReason =
    role === "blocked" || channel === "blocked"
      ? (contact.call_block_reason ??
        (contact.phone_on_dnc ? "DNC blocked" : null) ??
        reason)
      : null

  return {
    contact_id: contact.contact_id,
    full_name: contact.full_name ?? null,
    title: contact.title ?? null,
    persona_label: contact.persona_label,
    persona_type: contact.persona_type,
    outreach_rank_score: contact.outreach_rank_score,
    priority_tier: contact.priority_tier,
    recommended_channel: channel,
    channel_reason: reason,
    role_in_strategy: role,
    block_reason: blockReason,
    freshness_status: contact.freshness_status,
    email_eligibility: contact.email_eligibility,
    call_eligibility: contact.call_eligibility,
    sms_eligibility: contact.sms_eligibility,
    ranking_reasons: contact.ranking_reasons ?? [],
  }
}

function resolveAccountReadinessTier(input: {
  company_suppressed: boolean
  contacts: StrategyContactInput[]
  coverage: ProspectSearchCompanyContactCoverageIntelligence | null
  company_match_confidence?: number | null
}): ProspectSearchAccountOutreachReadinessTier {
  if (input.company_suppressed) return "blocked"

  const nonBlocked = input.contacts.filter((c) => c.priority_tier !== "blocked")
  if (input.contacts.length === 0 || nonBlocked.length === 0) {
    if (input.contacts.some((c) => c.priority_tier === "blocked")) return "blocked"
    return "research_needed"
  }

  const primary = nonBlocked.find((c) => c.is_recommended_contact) ?? nonBlocked[0]!
  const primaryChannel = resolveRecommendedChannelForContact(primary)

  if (primaryChannel.channel === "blocked") return "blocked"
  if (primaryChannel.channel === "research_first" && nonBlocked.every((c) => !c.email_available && !c.phone_available)) {
    return "research_needed"
  }

  const stalePrimary =
    primary.freshness_status === "stale" || primary.freshness_status === "expired"
  if (stalePrimary || primaryChannel.channel === "manual_review") {
    return "verification_needed"
  }

  if (primary.priority_tier === "low_confidence" || primary.outreach_rank_score < 0.45) {
    return "low_confidence"
  }

  if (
    primaryChannel.channel === "manual_review" ||
    primary.email_eligibility === "needs_review" ||
    primary.call_eligibility === "needs_review"
  ) {
    return "ready_with_review"
  }

  if (primaryChannel.channel === "email" || primaryChannel.channel === "call") {
    if (primary.priority_tier === "high_priority" || primary.priority_tier === "recommended") {
      return "ready"
    }
    return "ready_with_review"
  }

  return "ready_with_review"
}

function buildResearchActions(input: {
  missing_personas: ProspectSearchRevenuePersonaType[]
  has_stale: boolean
  has_blocked: boolean
  email_coverage: boolean
  call_coverage: boolean
}): ProspectSearchAccountResearchAction[] {
  const actions: ProspectSearchAccountResearchAction[] = []

  if (input.missing_personas.length > 0) {
    actions.push({
      id: "find_missing_personas",
      label: "Find missing personas",
      description: "Run contact discovery to fill persona gaps before outreach",
    })
  }
  if (input.missing_personas.includes("owner")) {
    actions.push({
      id: "research_owner",
      label: "Research owner",
      description: "Review website leadership pages for owner/founder contact",
      persona_target: "owner",
    })
  }
  if (input.missing_personas.includes("operations_manager")) {
    actions.push({
      id: "research_operations",
      label: "Research operations contact",
      description: "Search for operations manager or director role",
      persona_target: "operations_manager",
    })
  }
  if (input.missing_personas.includes("service_manager")) {
    actions.push({
      id: "research_service_manager",
      label: "Research service manager",
      description: "Common buyer persona for field service ICP",
      persona_target: "service_manager",
    })
  }
  if (input.has_stale) {
    actions.push({
      id: "refresh_stale_contacts",
      label: "Refresh stale contacts",
      description: "Re-verify contacts with stale or expired verification",
    })
  }
  if (input.has_blocked) {
    actions.push({
      id: "review_blocked_contacts",
      label: "Review blocked contacts",
      description: "Resolve DNC, suppression, or compliance blocks before outreach",
    })
  }
  if (!input.email_coverage && !input.call_coverage) {
    actions.push({
      id: "additional_contact_research",
      label: "Run additional contact research",
      description: "Only generic or partial contacts found — expand website extraction",
    })
  }

  return actions.slice(0, 6)
}

function buildStrategySummary(input: {
  tier: ProspectSearchAccountOutreachReadinessTier
  primary: ProspectSearchAccountStrategyContact | null
  recommended_channel: ProspectSearchRecommendedOutreachChannel
}): string | null {
  const { tier, primary, recommended_channel } = input
  if (!primary) {
    if (tier === "research_needed") return "Research needed: no decision-maker contacts found"
    if (tier === "blocked") return "Blocked: account suppressed or all contacts blocked"
    return "Contact research needed before outreach"
  }

  const name = primary.full_name ?? "Recommended contact"
  const persona = primary.persona_label

  if (tier === "ready" && recommended_channel === "email") {
    return `Ready: email ${name}, ${persona}`
  }
  if (tier === "ready" && recommended_channel === "call") {
    return `Ready: call ${name}, ${persona}`
  }
  if (tier === "ready_with_review") {
    return `Ready with review: ${recommended_channel} ${name}, ${persona}`
  }
  if (tier === "verification_needed") {
    return `Verification needed: contacts found but stale — refresh ${name} first`
  }
  if (tier === "research_needed") {
    return `Research needed: no operations or owner contact found`
  }
  if (tier === "blocked") {
    return `Blocked: ${primary.block_reason ?? "compliance block on available channels"}`
  }
  if (tier === "low_confidence") {
    return `Low confidence: review evidence for ${name} before outreach`
  }

  return `${tier.replace(/_/g, " ")}: ${recommended_channel} ${name}`
}

export function buildProspectSearchAccountContactStrategy(input: {
  company_id: string
  company_name: string
  company_suppressed?: boolean
  company_match_confidence?: number | null
  lead_engine_score?: number | null
  in_revenue_queue?: boolean
  existing_customer?: boolean
  contacts: StrategyContactInput[]
  coverage?: ProspectSearchCompanyContactCoverageIntelligence | null
}): ProspectSearchAccountContactStrategy {
  const coverage = input.coverage ?? null
  const sorted = [...input.contacts].sort((a, b) => b.outreach_rank_score - a.outreach_rank_score)

  const blockedContacts = sorted
    .filter(
      (c) =>
        c.priority_tier === "blocked" ||
        resolveRecommendedChannelForContact(c).channel === "blocked",
    )
    .map((c) => toStrategyContact(c, "blocked"))

  const nonBlocked = sorted.filter(
    (c) => !blockedContacts.some((b) => b.contact_id === c.contact_id),
  )

  const primaryRaw =
    nonBlocked.find((c) => c.is_recommended_contact) ??
    nonBlocked.find((c) => c.priority_tier !== "low_confidence") ??
    null

  const primary = primaryRaw ? toStrategyContact(primaryRaw, "primary") : null

  const secondaryRaw = nonBlocked.filter(
    (c) =>
      c.contact_id !== primaryRaw?.contact_id &&
      (c.is_secondary_contact || c.outreach_rank_score >= 0.55) &&
      c.priority_tier !== "low_confidence",
  )
  const secondary_contacts = secondaryRaw
    .slice(0, 3)
    .map((c) => toStrategyContact(c, "secondary"))

  const fallbackRaw = nonBlocked.filter(
    (c) =>
      c.contact_id !== primaryRaw?.contact_id &&
      !secondaryRaw.some((s) => s.contact_id === c.contact_id) &&
      c.priority_tier !== "blocked",
  )
  const fallback_contacts = fallbackRaw.slice(0, 3).map((c) => toStrategyContact(c, "fallback"))

  const missing_personas = coverage?.missing_critical_roles ?? []
  const tier = resolveAccountReadinessTier({
    company_suppressed: input.company_suppressed === true,
    contacts: input.contacts,
    coverage,
    company_match_confidence: input.company_match_confidence,
  })

  const recommended_channel =
    primary?.recommended_channel ??
    (tier === "research_needed"
      ? "research_first"
      : tier === "blocked"
        ? "blocked"
        : "manual_review")

  const strategy_reasons: string[] = []
  const risks: string[] = []

  if (primary) {
    strategy_reasons.push(
      `Primary: ${primary.full_name ?? "Contact"} (${primary.persona_label}) — ${Math.round(primary.outreach_rank_score * 100)}% rank`,
    )
    strategy_reasons.push(...primary.ranking_reasons.slice(0, 2))
  }
  if (secondary_contacts.length > 0) {
    strategy_reasons.push(
      `${secondary_contacts.length} backup contact${secondary_contacts.length === 1 ? "" : "s"} identified`,
    )
  }
  if (coverage?.persona_completeness != null && coverage.persona_completeness < 60) {
    risks.push("Persona coverage incomplete for key outreach roles")
  }
  if (blockedContacts.length > 0) {
    risks.push(`${blockedContacts.length} contact${blockedContacts.length === 1 ? "" : "s"} blocked by compliance`)
  }
  const staleCount = input.contacts.filter(
    (c) => c.freshness_status === "stale" || c.freshness_status === "expired",
  ).length
  if (staleCount > 0) {
    risks.push(`${staleCount} contact${staleCount === 1 ? "" : "s"} with stale verification`)
  }
  if (input.existing_customer) {
    risks.push("Existing customer — coordinate account expansion carefully")
  }

  let safest_next_action = "Review account contact strategy before outreach"
  let contact_research_next_step: string | null = null

  switch (tier) {
    case "ready":
      safest_next_action =
        recommended_channel === "email"
          ? `Email ${primary?.full_name ?? "primary contact"} — ${primary?.persona_label ?? "recommended persona"}`
          : recommended_channel === "call"
            ? `Call ${primary?.full_name ?? "primary contact"} — verify notes before dial`
            : safest_next_action
      break
    case "ready_with_review":
      safest_next_action = "Review contact evidence, then route to Queue or Call Queue"
      break
    case "verification_needed":
      safest_next_action = "Refresh verification before outreach"
      contact_research_next_step = "Refresh stale contacts before selecting outreach channel"
      break
    case "research_needed":
      safest_next_action = "Run contact discovery — missing key personas or channels"
      contact_research_next_step =
        missing_personas.length > 0
          ? `Search for ${missing_personas.map((p) => p.replace(/_/g, " ")).join(", ")}`
          : "Run Find contacts on company website"
      break
    case "blocked":
      safest_next_action = "Do not outreach — resolve compliance blocks first"
      break
    case "low_confidence":
      safest_next_action = "Low confidence — refresh contact research before outreach"
      contact_research_next_step = "Review website leadership and re-run contact discovery"
      break
  }

  const tierScore = READINESS_TIER_SCORE[tier]
  let queue_priority_score = tierScore
  if (primary) queue_priority_score += primary.outreach_rank_score * 20
  if (coverage) queue_priority_score += coverage.outreach_readiness_score * 0.15
  if (input.lead_engine_score != null && input.lead_engine_score >= 70) queue_priority_score += 8
  if (input.in_revenue_queue) queue_priority_score += 4
  if (input.company_match_confidence != null && input.company_match_confidence >= 0.7) {
    queue_priority_score += 5
  }
  queue_priority_score = Math.round(Math.min(100, queue_priority_score))

  const queue_prioritization_reason =
    tier === "ready"
      ? `Account ready — ${primary?.persona_label ?? "primary contact"} via ${recommended_channel}`
      : tier === "blocked"
        ? "Account blocked — deprioritized in queue"
        : `Account ${tier.replace(/_/g, " ")} — ${safest_next_action}`

  const research_actions = buildResearchActions({
    missing_personas,
    has_stale: staleCount > 0,
    has_blocked: blockedContacts.length > 0,
    email_coverage: coverage?.email_coverage ?? false,
    call_coverage: coverage?.call_coverage ?? false,
  })

  return {
    qa_marker: GROWTH_ACCOUNT_CONTACT_STRATEGY_QA_MARKER,
    orchestration_marker: GROWTH_MULTI_CONTACT_ORCHESTRATION_QA_MARKER,
    company_id: input.company_id,
    company_name: input.company_name,
    account_outreach_readiness: tier,
    account_outreach_readiness_score: tierScore,
    recommended_channel,
    primary_contact: primary,
    secondary_contacts,
    fallback_contacts,
    blocked_contacts: blockedContacts,
    missing_personas,
    safest_next_action,
    contact_research_next_step,
    strategy_reasons: strategy_reasons.slice(0, 5),
    risks: risks.slice(0, 4),
    strategy_summary: buildStrategySummary({ tier, primary, recommended_channel }),
    queue_priority_score,
    queue_prioritization_reason,
    research_actions,
  }
}

export function prioritizeProspectSearchAccountsForQueue<
  T extends { id: string; contact_intelligence?: { account_contact_strategy?: ProspectSearchAccountContactStrategy | null } | null },
>(companies: T[]): T[] {
  return [...companies].sort((a, b) => {
    const scoreA =
      a.contact_intelligence?.account_contact_strategy?.queue_priority_score ??
      a.contact_intelligence?.company_contact_coverage?.outreach_readiness_score ??
      0
    const scoreB =
      b.contact_intelligence?.account_contact_strategy?.queue_priority_score ??
      b.contact_intelligence?.company_contact_coverage?.outreach_readiness_score ??
      0
    return scoreB - scoreA
  })
}
