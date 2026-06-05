/**
 * Phase 7.PS-HP — Buying committee intelligence foundation for Prospect Search.
 * Evidence-backed discovery only; no invented contacts or roles.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buyingCommitteeHasVerifiedIntelligenceMembers } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-committee-integrity"
import { analyzeBuyingCommitteeCoverage } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-coverage"
import { runBuyingCommitteeIntelligenceForCanonicalCompany } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-orchestrator"
import type { GrowthBuyingCommitteeIntelligenceRole } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import type {
  GrowthProspectSearchBuyingCommitteeMember,
  GrowthProspectSearchBuyingCommitteeRead,
} from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import { PROSPECT_SEARCH_BUYING_COMMITTEE_ROLE_LABELS } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-ux"

export const GROWTH_PROSPECT_SEARCH_BUYING_COMMITTEE_FOUNDATION_QA_MARKER =
  "growth-prospect-search-buying-committee-foundation-7-ps-hp-v1" as const

export const PS_HP_CRITICAL_COMMITTEE_ROLES: GrowthBuyingCommitteeIntelligenceRole[] = [
  "executive_sponsor",
  "economic_buyer",
  "champion",
]

export type BuyingCommitteeFoundationReadiness =
  | "ready"
  | "partial"
  | "gap"
  | "blocked"

export type BuyingCommitteeFoundationMetrics = {
  committee_completeness: number
  missing_critical_roles: string[]
  detected_role_labels: string[]
  committee_readiness: BuyingCommitteeFoundationReadiness
  outreach_prioritization_boost: number
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function buildBuyingCommitteeFoundationMetrics(input: {
  members: GrowthProspectSearchBuyingCommitteeMember[]
  roles_present: string[]
  roles_missing: string[]
  coverage_score: number
  verified_member_count: number
}): BuyingCommitteeFoundationMetrics {
  const rolesPresent = new Set(input.roles_present.map((r) => asString(r)).filter(Boolean))
  const missing_critical_roles = PS_HP_CRITICAL_COMMITTEE_ROLES.filter((r) => !rolesPresent.has(r)).map(
    (r) => PROSPECT_SEARCH_BUYING_COMMITTEE_ROLE_LABELS[r] ?? r.replace(/_/g, " "),
  )

  const detected_role_labels = [
    ...new Set(
      input.members
        .map((m) => {
          const role = asString(m.committee_role)
          return (
            PROSPECT_SEARCH_BUYING_COMMITTEE_ROLE_LABELS[
              role as GrowthBuyingCommitteeIntelligenceRole
            ] ?? role.replace(/_/g, " ")
          )
        })
        .filter(Boolean),
    ),
  ]

  const criticalPresent = PS_HP_CRITICAL_COMMITTEE_ROLES.filter((r) => rolesPresent.has(r)).length
  const committee_completeness = Number(
    (
      input.coverage_score * 0.6 +
      (criticalPresent / PS_HP_CRITICAL_COMMITTEE_ROLES.length) * 0.4
    ).toFixed(3),
  )

  let committee_readiness: BuyingCommitteeFoundationReadiness = "blocked"
  if (input.verified_member_count >= 2 && criticalPresent >= 2) {
    committee_readiness = "ready"
  } else if (input.verified_member_count >= 1 && criticalPresent >= 1) {
    committee_readiness = "partial"
  } else if (input.verified_member_count >= 1) {
    committee_readiness = "gap"
  }

  const outreach_prioritization_boost =
    committee_readiness === "ready"
      ? 12
      : committee_readiness === "partial"
        ? 8
        : committee_readiness === "gap"
          ? 4
          : 0

  return {
    committee_completeness,
    missing_critical_roles,
    detected_role_labels,
    committee_readiness,
    outreach_prioritization_boost,
  }
}

export function enrichBuyingCommitteeReadForProspectSearch(
  read: GrowthProspectSearchBuyingCommitteeRead,
): GrowthProspectSearchBuyingCommitteeRead {
  const foundation = buildBuyingCommitteeFoundationMetrics({
    members: read.members,
    roles_present: read.roles_present,
    roles_missing: read.roles_missing,
    coverage_score: read.coverage_score,
    verified_member_count: read.verified_member_count,
  })

  return {
    ...read,
    committee_completeness: foundation.committee_completeness,
    missing_critical_roles: foundation.missing_critical_roles,
    detected_role_labels: foundation.detected_role_labels,
    committee_readiness: foundation.committee_readiness,
    outreach_prioritization_boost: foundation.outreach_prioritization_boost,
  }
}

export async function ensureBuyingCommitteeIntelligenceFoundation(
  admin: SupabaseClient,
  input: { company_id: string; force?: boolean },
): Promise<{
  ran: boolean
  skipped_reason: string | null
  verified_member_count: number
  promoted_count: number
  coverage_score: number
}> {
  const company_id = asString(input.company_id)
  if (!company_id) {
    return {
      ran: false,
      skipped_reason: "missing_company_id",
      verified_member_count: 0,
      promoted_count: 0,
      coverage_score: 0,
    }
  }

  if (!input.force) {
    const hasVerified = await buyingCommitteeHasVerifiedIntelligenceMembers(admin, company_id)
    if (hasVerified) {
      const { count } = await admin
        .schema("growth")
        .from("buying_committee_intelligence_members")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company_id)
        .eq("verification_status", "verified")
      return {
        ran: false,
        skipped_reason: "verified_members_already_present",
        verified_member_count: count ?? 0,
        promoted_count: 0,
        coverage_score: 0,
      }
    }
  }

  const result = await runBuyingCommitteeIntelligenceForCanonicalCompany(admin, {
    company_id,
    promote: true,
  })

  return {
    ran: true,
    skipped_reason: null,
    verified_member_count: result.coverage.verified_member_count,
    promoted_count: result.promoted_count,
    coverage_score: result.coverage.coverage_score,
  }
}

export async function loadBuyingCommitteeFoundationSnapshot(
  admin: SupabaseClient,
  company_id: string,
): Promise<{
  members: GrowthProspectSearchBuyingCommitteeMember[]
  coverage: ReturnType<typeof analyzeBuyingCommitteeCoverage>
  synthetic_risk_count: number
}> {
  const { data: rows } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .select(
      "person_id, full_name, job_title, committee_role, confidence, verification_status, provider_name, discovery_source, metadata",
    )
    .eq("company_id", company_id)
    .eq("verification_status", "verified")
    .order("confidence", { ascending: false })
    .limit(50)

  const members: GrowthProspectSearchBuyingCommitteeMember[] = (rows ?? []).map((row) => ({
    person_id: asString(row.person_id),
    full_name: asString(row.full_name) || "Unknown",
    job_title: asString(row.job_title) || null,
    committee_role: asString(row.committee_role),
    confidence: Number(row.confidence ?? 0),
  }))

  const verified_roles = members.map((m) => m.committee_role) as GrowthBuyingCommitteeIntelligenceRole[]
  const verified_person_ids = members.map((m) => m.person_id)
  const coverage = analyzeBuyingCommitteeCoverage({ verified_roles, verified_person_ids })

  const synthetic_risk_count = (rows ?? []).filter((row) => {
    const corpus = [row.provider_name, row.discovery_source, JSON.stringify(row.metadata ?? {})]
      .map((v) => String(v ?? "").toLowerCase())
      .join(" ")
    return (
      corpus.includes("synthetic") ||
      corpus.includes("manual_invent") ||
      corpus.includes("ai_generated")
    )
  }).length

  return { members, coverage, synthetic_risk_count }
}
