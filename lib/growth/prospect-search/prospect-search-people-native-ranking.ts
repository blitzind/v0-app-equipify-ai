/** People-native contactability ranking — primary people-first sort dimension. Client-safe. */

import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import type { GrowthProspectSearchPersonResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { GROWTH_CONTACTABILITY_RANKING_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contactability-ranking"
import type { ProspectSearchContactNativeIndexRecord } from "@/lib/growth/prospect-search/prospect-search-contact-native-index"

export const GROWTH_PEOPLE_FIRST_GRID_QA_MARKER = "growth-people-first-grid-v1" as const

export type ProspectSearchPeopleNativeRankedRow = {
  qa_marker: typeof GROWTH_PEOPLE_FIRST_GRID_QA_MARKER
  contactability_rank_score: number
  ranking_reasons: string[]
}

function textMatchScore(query: string, blob: string): number {
  const q = query.trim().toLowerCase()
  const b = blob.toLowerCase()
  if (!q || !b) return 0
  if (b.includes(q)) return 0.85
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  return tokens.filter((t) => b.includes(t)).length / tokens.length
}

export function computeProspectSearchPeopleNativeRankScore(input: {
  query: string
  full_name?: string | null
  title?: string | null
  email?: string | null
  phone?: string | null
  company_name?: string | null
  confidence?: number | null
  outreach_ready?: boolean
  outreach_rank_score?: number | null
  reachable_human_score?: number | null
  verification_status?: string | null
  persona_icp_fit?: string | null
  freshness_status?: string | null
  email_verification_depth?: string | null
  phone_verification_depth?: string | null
  decision_maker_fit?: boolean
}): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  const blob = [input.full_name, input.title, input.email, input.phone, input.company_name]
    .filter(Boolean)
    .join(" ")
  score += textMatchScore(input.query, blob) * 0.15

  const verification = (input.verification_status ?? "").toLowerCase()
  const emailDepth = (input.email_verification_depth ?? "").toLowerCase()
  const phoneDepth = (input.phone_verification_depth ?? "").toLowerCase()

  if (input.email && (verification.includes("email") || emailDepth.includes("published"))) {
    score += 0.28
    reasons.push("Verified email channel")
  } else if (input.email) {
    score += 0.08
  }

  if (input.phone && (verification.includes("phone") || phoneDepth.includes("published"))) {
    score += 0.22
    reasons.push("Verified phone channel")
  } else if (input.phone) {
    score += 0.06
  }

  if (input.full_name?.trim()) {
    score += 0.12
    reasons.push("Named person")
  }

  if ((input.confidence ?? 0) >= 0.75) {
    score += 0.1
    reasons.push("Strong role confidence")
  }

  if (input.decision_maker_fit || input.persona_icp_fit === "strong_fit") {
    score += 0.12
    reasons.push("Decision maker fit")
  }

  if (input.freshness_status === "fresh") {
    score += 0.05
  } else if (input.freshness_status === "expired" || input.freshness_status === "stale") {
    score -= 0.08
  }

  if ((input.reachable_human_score ?? 0) >= 75) {
    score += 0.1
    reasons.push("Outreach-ready reachable human score")
  }

  if (input.outreach_ready) {
    score += 0.08
    reasons.push("Outreach ready")
  }

  if ((input.outreach_rank_score ?? 0) > 0) {
    score += Math.min(0.15, input.outreach_rank_score * 0.15)
  }

  return { score: Number(Math.min(1, Math.max(0, score)).toFixed(4)), reasons }
}

export function rankProspectSearchPeopleNativeRows(
  rows: GrowthProspectSearchPeopleResultRow[],
  query: string,
): GrowthProspectSearchPeopleResultRow[] {
  return [...rows]
    .map((row) => {
      const { score, reasons } = computeProspectSearchPeopleNativeRankScore({
        query,
        full_name: row.full_name,
        title: row.title,
        email: row.email,
        phone: row.phone,
        company_name: row.company_name,
        confidence: row.confidence,
        outreach_ready: row.outreach_ready,
        outreach_rank_score: row.outreach_rank_score,
        reachable_human_score: row.company.reachable_human?.score ?? null,
        verification_status: row.verification_status,
        persona_icp_fit: row.persona_icp_relevance >= 0.7 ? "strong_fit" : null,
        freshness_status: row.freshness_status,
        email_verification_depth: row.email_verification_depth,
        phone_verification_depth: row.phone_verification_depth,
        decision_maker_fit: row.persona_type === "owner" || row.persona_type === "operations_manager",
      })
      return {
        ...row,
        contact_native_rank_score: score,
        contact_native_rank_reasons: reasons,
        rank_score: score,
      }
    })
    .sort((a, b) => (b.contact_native_rank_score ?? 0) - (a.contact_native_rank_score ?? 0))
}

export function rankProspectSearchPersonResultsNative(
  people: GrowthProspectSearchPersonResult[],
  query: string,
  nativeRecords?: ProspectSearchContactNativeIndexRecord[],
): GrowthProspectSearchPersonResult[] {
  const recordByKey = new Map(
    (nativeRecords ?? []).map((record) => [`${record.source_type}:${record.company_id}:${record.contact_id}`, record]),
  )

  return [...people]
    .map((person) => {
      const key = `${person.source_type}:${person.company_id}:${person.id}`
      const native = recordByKey.get(key)
      const { score } = computeProspectSearchPeopleNativeRankScore({
        query,
        full_name: person.full_name,
        title: person.title,
        email: person.email,
        phone: person.phone,
        company_name: person.company_name,
        confidence: native?.confidence ?? person.rank_score,
        reachable_human_score: native?.reachable_human_score ?? null,
        verification_status: person.verification_status,
      })
      return { ...person, rank_score: score }
    })
    .sort((a, b) => b.rank_score - a.rank_score)
}

export function filterProspectSearchQueueReadyPeopleRows(
  rows: GrowthProspectSearchPeopleResultRow[],
): GrowthProspectSearchPeopleResultRow[] {
  return rows.filter(
    (row) =>
      row.outreach_ready &&
      row.email_eligibility === "eligible" &&
      row.compliance_status === "ready" &&
      !row.company.is_suppressed,
  )
}

export { GROWTH_CONTACTABILITY_RANKING_QA_MARKER }
