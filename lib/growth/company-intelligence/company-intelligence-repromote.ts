/** Re-promote verified company intelligence findings that failed snapshot writes. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { confidenceTierForCompanyIntelligence } from "@/lib/growth/company-intelligence/company-intelligence-confidence"
import { buildNormalizedIntelligenceKey } from "@/lib/growth/company-intelligence/company-intelligence-normalize"
import { promoteVerifiedCompanyIntelligenceFinding } from "@/lib/growth/company-intelligence/company-intelligence-promote"
import { loadCompanyIntelligenceRunDetail } from "@/lib/growth/company-intelligence/company-intelligence-repository"
import type {
  GrowthCompanyIntelligenceCategory,
  GrowthCompanyIntelligenceDraftFinding,
  GrowthCompanyIntelligenceSource,
} from "@/lib/growth/company-intelligence/company-intelligence-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function repromoteVerifiedCompanyIntelligenceRunFindings(
  admin: SupabaseClient,
  input: { run_id: string },
): Promise<{
  run_id: string
  company_id: string
  attempted: number
  promoted: number
  results: Array<{
    intelligence_key: string
    promotion_status: string
    reason: string
  }>
}> {
  const detail = await loadCompanyIntelligenceRunDetail(admin, input.run_id)
  if (!detail) throw new Error("company_intelligence_run_not_found")

  const evidenceByFindingRef = new Map<string, string[]>()
  for (const row of detail.evidence) {
    const findingRef = asString(row.finding_ref)
    if (!findingRef) continue
    const ids = evidenceByFindingRef.get(findingRef) ?? []
    ids.push(row.id)
    evidenceByFindingRef.set(findingRef, ids)
  }

  const results: Array<{ intelligence_key: string; promotion_status: string; reason: string }> = []
  let attempted = 0
  let promoted = 0

  for (const finding of detail.findings) {
    if (finding.verification_status !== "verified") continue
    if (finding.promotion_status === "promoted") continue

    const evidenceRows = detail.evidence.filter((row) => row.finding_ref === finding.finding_ref)
    const primaryEvidence = evidenceRows[0]
    if (!primaryEvidence) continue

    attempted += 1
    const draft: GrowthCompanyIntelligenceDraftFinding = {
      finding_ref: finding.finding_ref,
      intelligence_category: finding.intelligence_category as GrowthCompanyIntelligenceCategory,
      intelligence_key: finding.intelligence_key,
      normalized_intelligence_key: buildNormalizedIntelligenceKey({
        intelligence_category: finding.intelligence_category as GrowthCompanyIntelligenceCategory,
        intelligence_key: finding.intelligence_key,
      }),
      value_text: finding.value_text ?? primaryEvidence.proposed_value_text,
      value_json: null,
      source: finding.source as GrowthCompanyIntelligenceSource,
      confidence: finding.confidence,
      confidence_tier: confidenceTierForCompanyIntelligence({
        source: finding.source as GrowthCompanyIntelligenceSource,
        verification_status: "verified",
        base_confidence: finding.confidence,
      }),
      provider_name: "",
      discovery_source: "",
      evidence: [],
    }

    const promo = await promoteVerifiedCompanyIntelligenceFinding(admin, {
      company_id: detail.company_id,
      run_id: detail.run_id,
      draft,
      verification_status: "verified",
      confidence: finding.confidence,
      source_evidence_ids: evidenceByFindingRef.get(finding.finding_ref) ?? [],
    })

    results.push({
      intelligence_key: finding.intelligence_key,
      promotion_status: promo.promotion_status,
      reason: promo.reason,
    })
    if (promo.promoted) promoted += 1
  }

  return {
    run_id: detail.run_id,
    company_id: detail.company_id,
    attempted,
    promoted,
    results,
  }
}

export async function repromoteBestVerifiedCompanyIntelligenceRunForCompany(
  admin: SupabaseClient,
  input: { company_id: string },
): Promise<ReturnType<typeof repromoteVerifiedCompanyIntelligenceRunFindings> | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("company_intelligence_runs")
    .select("id, verified_count, promoted_count, completed_at")
    .eq("company_id", input.company_id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(20)

  if (error) throw new Error(error.message)
  const bestRun =
    (data ?? []).find((row) => Number(row.verified_count) > 0 && Number(row.promoted_count) === 0) ??
    (data ?? []).find((row) => Number(row.verified_count) > 0)

  const runId = asString(bestRun?.id)
  if (!runId) return null

  return repromoteVerifiedCompanyIntelligenceRunFindings(admin, { run_id: runId })
}
