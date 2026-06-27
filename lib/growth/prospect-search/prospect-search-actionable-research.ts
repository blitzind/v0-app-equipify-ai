/** Prospect Search — map research actions to Growth Engine job lanes (7.PS-C). Client-safe. */

import {
  GROWTH_PROSPECT_SEARCH_ACTIONABLE_RESEARCH_QA_MARKER,
  type GrowthProspectSearchActionableResearchPlan,
  type GrowthProspectSearchEngineDiscoveryRollup,
  type GrowthProspectSearchEngineDiscoveryRollupLane,
  type GrowthProspectSearchGrowthEngineJobLane,
} from "@/lib/growth/prospect-search/prospect-search-actionable-research-types"
import type { GrowthProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import { formatProspectSearchEngineDiscoveryStatus } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-ux"
import type { ProspectSearchResearchActionKind } from "@/lib/growth/prospect-search/prospect-search-research-gaps"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export type GrowthProspectSearchCanonicalResearchContext = {
  canonical_company_id: string | null
  canonical_person_id: string | null
  schema_ready: boolean
  schema_warning: string | null
  engine: GrowthProspectSearchEngineIntelligence | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function resolveProspectSearchCanonicalResearchContext(
  company: Pick<GrowthProspectSearchCompanyResult, "contact_intelligence" | "canonical_company_id">,
): GrowthProspectSearchCanonicalResearchContext {
  const intel = company.contact_intelligence
  const engine = intel?.engine_intelligence ?? null
  const canonical_company_id =
    asString(engine?.canonical_company_id) ||
    asString(company.canonical_company_id) ||
    null

  const primaryContactId = asString(intel?.account_contact_strategy?.primary_contact?.contact_id)
  let canonical_person_id: string | null = null
  if (primaryContactId) {
    const primary = intel?.contacts?.find((c) => c.id === primaryContactId)
    canonical_person_id = asString(primary?.canonical_person_id) || null
  }
  if (!canonical_person_id) {
    for (const contact of intel?.contacts ?? []) {
      const pid = asString(contact.canonical_person_id)
      if (pid) {
        canonical_person_id = pid
        break
      }
    }
  }
  if (!canonical_person_id) {
    canonical_person_id = asString(engine?.buying_committee?.members?.[0]?.person_id) || null
  }

  const schema_ready = engine?.schema_ready !== false
  const schema_warning =
    !schema_ready && engine?.schema_health?.warning_message
      ? engine.schema_health.warning_message
      : !schema_ready
        ? "AI OS intelligence schema is not ready — apply migrations before queuing jobs."
        : null

  return {
    canonical_company_id,
    canonical_person_id,
    schema_ready,
    schema_warning,
    engine,
  }
}

export function mapProspectSearchResearchActionToJobLane(
  actionKind: string,
): GrowthProspectSearchGrowthEngineJobLane {
  const kind = actionKind.trim()
  switch (kind as ProspectSearchResearchActionKind | string) {
    case "verify_email":
      return "email_discovery"
    case "verify_phone_numbers":
    case "improve_call_readiness":
      return "phone_discovery"
    case "rerun_website_extraction":
      return "company_intelligence"
    case "find_operations_manager":
    case "find_owner":
    case "improve_persona_coverage":
    case "expand_relationship_coverage":
    case "research_branch_leadership":
      return "buying_committee_intelligence"
    case "refresh_stale_contacts":
      return "legacy_contact_discovery"
    case "queue_social_profile_discovery":
      return "social_profile_discovery"
    default:
      if (
        kind.startsWith("research_") ||
        kind.startsWith("find_") ||
        kind === "additional_contact_research" ||
        kind === "review_blocked_contacts"
      ) {
        return "buying_committee_intelligence"
      }
      return "legacy_contact_discovery"
  }
}

function laneLabel(lane: GrowthProspectSearchGrowthEngineJobLane): string {
  switch (lane) {
    case "email_discovery":
      return "Queue email discovery"
    case "phone_discovery":
      return "Queue phone discovery"
    case "social_profile_discovery":
      return "Queue social profile discovery"
    case "company_intelligence":
      return "Queue company intelligence"
    case "buying_committee_intelligence":
      return "Queue buying committee intelligence"
    default:
      return "Run website contact discovery"
  }
}

function laneDescription(lane: GrowthProspectSearchGrowthEngineJobLane): string {
  switch (lane) {
    case "email_discovery":
      return "Enqueues existing Growth Engine email discovery job (7.3B) for the canonical person."
    case "phone_discovery":
      return "Enqueues existing Growth Engine phone discovery job (7.4B) for the canonical person."
    case "social_profile_discovery":
      return "Enqueues existing Growth Engine social profile discovery job (7.5B)."
    case "company_intelligence":
      return "Enqueues existing Growth Engine company intelligence job (7.6B) for the canonical company."
    case "buying_committee_intelligence":
      return "Enqueues existing Growth Engine buying committee intelligence job (7.7B)."
    default:
      return "Falls back to legacy website contact discovery when canonical company linkage is unavailable."
  }
}

export function buildProspectSearchActionableResearchPlan(input: {
  company: GrowthProspectSearchCompanyResult
  actionKind: string
  personId?: string | null
}): GrowthProspectSearchActionableResearchPlan {
  const ctx = resolveProspectSearchCanonicalResearchContext(input.company)
  const lane = mapProspectSearchResearchActionToJobLane(input.actionKind)
  const requires_canonical_company = lane !== "legacy_contact_discovery"
  const requires_canonical_person =
    lane === "email_discovery" || lane === "phone_discovery" || lane === "social_profile_discovery"

  const company_id = ctx.canonical_company_id
  const person_id = asString(input.personId) || ctx.canonical_person_id

  let blocked_reason: string | null = null
  if (!ctx.schema_ready) {
    blocked_reason = ctx.schema_warning
  } else if (requires_canonical_company && !company_id) {
    blocked_reason =
      "No canonical company linked yet — run canonical company backfill or push to Growth Engine before queuing intelligence jobs."
  } else if (requires_canonical_person && !person_id) {
    blocked_reason =
      "No canonical person linked for this contact — resolve person lineage before queuing person-scoped discovery."
  }

  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_ACTIONABLE_RESEARCH_QA_MARKER,
    lane,
    label: laneLabel(lane),
    description: laneDescription(lane),
    requires_canonical_company,
    requires_canonical_person,
    can_execute: !blocked_reason,
    blocked_reason,
    company_id,
    person_id: requires_canonical_person ? person_id : person_id || null,
    discovery_scope: lane === "social_profile_discovery" && !person_id ? "company" : "person",
  }
}

export function buildProspectSearchSuggestedGrowthEngineActions(
  company: Pick<GrowthProspectSearchCompanyResult, "contact_intelligence" | "canonical_company_id">,
): GrowthProspectSearchActionableResearchPlan[] {
  const ctx = resolveProspectSearchCanonicalResearchContext(company)
  if (!ctx.canonical_company_id) return []

  const engine = ctx.engine
  const channels = engine?.verified_channels
  const suggestions: Array<{ kind: string; lane: GrowthProspectSearchGrowthEngineJobLane }> = []

  if (!engine?.company_intelligence?.has_verified_intelligence) {
    suggestions.push({ kind: "rerun_website_extraction", lane: "company_intelligence" })
  }
  if ((engine?.buying_committee?.verified_member_count ?? 0) === 0) {
    suggestions.push({ kind: "expand_relationship_coverage", lane: "buying_committee_intelligence" })
  }
  if ((channels?.persons_with_verified_email ?? 0) === 0 && ctx.canonical_person_id) {
    suggestions.push({ kind: "verify_email", lane: "email_discovery" })
  }
  if ((channels?.persons_with_verified_phone ?? 0) === 0 && ctx.canonical_person_id) {
    suggestions.push({ kind: "verify_phone_numbers", lane: "phone_discovery" })
  }
  if ((channels?.persons_with_verified_profile ?? 0) === 0 && ctx.canonical_person_id) {
    suggestions.push({ kind: "queue_social_profile_discovery", lane: "social_profile_discovery" })
  }

  const seen = new Set<string>()
  return suggestions
    .filter((row) => {
      if (seen.has(row.lane)) return false
      seen.add(row.lane)
      return true
    })
    .map((row) =>
      buildProspectSearchActionableResearchPlan({
        company: company as GrowthProspectSearchCompanyResult,
        actionKind: row.kind,
      }),
    )
    .filter((plan) => plan.can_execute || plan.blocked_reason)
    .slice(0, 5)
}

function rollupTone(
  verified: boolean,
  discoveryStatus: string | null | undefined,
): GrowthProspectSearchEngineDiscoveryRollupLane["status_tone"] {
  if (verified) return "verified"
  const raw = (discoveryStatus ?? "").toLowerCase()
  if (raw === "pending" || raw === "running") return "pending"
  if (raw === "failed") return "blocked"
  return "gap"
}

export function buildProspectSearchEngineDiscoveryRollup(
  company: Pick<GrowthProspectSearchCompanyResult, "contact_intelligence" | "canonical_company_id">,
): GrowthProspectSearchEngineDiscoveryRollup | null {
  const ctx = resolveProspectSearchCanonicalResearchContext(company)
  if (!ctx.canonical_company_id || !ctx.engine) return null

  const engine = ctx.engine
  const channels = engine.verified_channels
  const companyIntel = engine.company_intelligence
  const committee = engine.buying_committee

  const lanes: GrowthProspectSearchEngineDiscoveryRollupLane[] = [
    {
      key: "company_intelligence",
      label: "Company intel",
      status: companyIntel?.has_verified_intelligence
        ? "Verified"
        : formatProspectSearchEngineDiscoveryStatus(companyIntel?.discovery_status),
      status_tone: rollupTone(Boolean(companyIntel?.has_verified_intelligence), companyIntel?.discovery_status),
      hint: companyIntel?.has_verified_intelligence
        ? `${companyIntel.categories_present.length} categories`
        : "Queue company intelligence from Research actions",
    },
    {
      key: "buying_committee",
      label: "Committee",
      status:
        (committee?.verified_member_count ?? 0) > 0
          ? `${committee!.verified_member_count} verified`
          : "No verified members",
      status_tone: (committee?.verified_member_count ?? 0) > 0 ? "verified" : "gap",
      hint:
        (committee?.roles_missing?.length ?? 0) > 0
          ? `Missing: ${committee!.roles_missing.slice(0, 2).join(", ").replace(/_/g, " ")}`
          : null,
    },
    {
      key: "email",
      label: "Email",
      status:
        (channels?.persons_with_verified_email ?? 0) > 0
          ? `${channels!.persons_with_verified_email} verified`
          : "No verified email",
      status_tone: (channels?.persons_with_verified_email ?? 0) > 0 ? "verified" : "gap",
      hint: null,
    },
    {
      key: "phone",
      label: "Phone",
      status:
        (channels?.persons_with_verified_phone ?? 0) > 0
          ? `${channels!.persons_with_verified_phone} verified`
          : "No verified phone",
      status_tone: (channels?.persons_with_verified_phone ?? 0) > 0 ? "verified" : "gap",
      hint: null,
    },
    {
      key: "social",
      label: "Social",
      status:
        (channels?.persons_with_verified_profile ?? 0) > 0
          ? `${channels!.persons_with_verified_profile} verified`
          : "No verified profile",
      status_tone: (channels?.persons_with_verified_profile ?? 0) > 0 ? "verified" : "gap",
      hint: null,
    },
  ]

  const gaps = lanes.filter((l) => l.status_tone === "gap" || l.status_tone === "pending").length
  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_ACTIONABLE_RESEARCH_QA_MARKER,
    lanes,
    summary:
      gaps === 0
        ? "All Growth Engine discovery lanes show verified coverage."
        : `${gaps} lane(s) need operator-triggered discovery — use Research actions below.`,
  }
}

export function growthEngineJobEndpoint(lane: GrowthProspectSearchGrowthEngineJobLane): string | null {
  switch (lane) {
    case "email_discovery":
      return "/api/platform/growth/email-discovery/jobs"
    case "phone_discovery":
      return "/api/platform/growth/phone-discovery/jobs"
    case "social_profile_discovery":
      return "/api/platform/growth/social-profile-discovery/jobs"
    case "company_intelligence":
      return "/api/platform/growth/company-intelligence/jobs"
    case "buying_committee_intelligence":
      return "/api/platform/growth/buying-committee-intelligence/jobs"
    default:
      return null
  }
}

export function buildGrowthEngineJobRequestBody(
  plan: GrowthProspectSearchActionableResearchPlan,
): Record<string, unknown> | null {
  if (!plan.company_id) return null
  const base = {
    company_id: plan.company_id,
    promote_on_complete: true,
    trigger_source: "manual" as const,
  }
  switch (plan.lane) {
    case "email_discovery":
    case "phone_discovery":
      if (!plan.person_id) return null
      return { ...base, person_id: plan.person_id }
    case "social_profile_discovery":
      if (plan.discovery_scope === "company" || !plan.person_id) {
        return { ...base, discovery_scope: "company" as const }
      }
      return { ...base, person_id: plan.person_id, discovery_scope: "person" as const }
    case "company_intelligence":
    case "buying_committee_intelligence":
      return base
    default:
      return null
  }
}

export function formatGrowthEngineEnqueueMessage(input: {
  lane: GrowthProspectSearchGrowthEngineJobLane
  enqueued: boolean
  reason?: string | null
  message?: string | null
}): string {
  if (input.message && !input.enqueued) return input.message
  if (input.enqueued) {
    return `${input.lane.replace(/_/g, " ")} queued — results update when the worker completes.`
  }
  switch (input.reason) {
    case "verified_email_exists":
      return "Verified email already on file."
    case "verified_phone_exists":
      return "Verified phone already on file."
    case "verified_profile_exists":
      return "Verified social profile already on file."
    case "active_job_exists":
      return "Discovery already queued or running for this target."
    case "schema_not_ready":
      return "AI OS runtime schema is not ready — apply migrations first."
    case "has_verified_intelligence":
    case "skip_verified_intelligence":
      return "Verified company intelligence already present."
    default:
      return input.reason ?? "Job was not queued."
  }
}
