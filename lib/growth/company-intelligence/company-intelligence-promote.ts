import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canPromoteCompanyIntelligenceFinding } from "@/lib/growth/company-intelligence/company-intelligence-confidence"
import { evaluateCompanyIntelligenceSnapshotPromotion } from "@/lib/growth/company-intelligence/company-intelligence-integrity-rules"
import { fetchCompanyIntelligenceSnapshotByKey } from "@/lib/growth/company-intelligence/company-intelligence-repository"
import type {
  GrowthCompanyIntelligenceDraftFinding,
  GrowthCompanyIntelligenceVerificationStatus,
} from "@/lib/growth/company-intelligence/company-intelligence-types"

export async function promoteVerifiedCompanyIntelligenceFinding(
  admin: SupabaseClient,
  input: {
    company_id: string
    run_id: string
    draft: GrowthCompanyIntelligenceDraftFinding
    verification_status: GrowthCompanyIntelligenceVerificationStatus
    confidence: number
    source_evidence_ids: string[]
  },
): Promise<{ promoted: boolean; promotion_status: string; reason: string; snapshot_id?: string }> {
  if (
    !canPromoteCompanyIntelligenceFinding({
      verification_status: input.verification_status,
      confidence: input.confidence,
    })
  ) {
    return {
      promoted: false,
      promotion_status: "skipped",
      reason: `Not promotable: verification=${input.verification_status}, confidence=${input.confidence}.`,
    }
  }

  const existing = await fetchCompanyIntelligenceSnapshotByKey(admin, {
    company_id: input.company_id,
    normalized_intelligence_key: input.draft.normalized_intelligence_key,
  })
  const gate = evaluateCompanyIntelligenceSnapshotPromotion({
    existing,
    target_company_id: input.company_id,
    incoming_confidence: input.confidence,
    incoming_verification_status: input.verification_status,
  })
  if (!gate.allowed) {
    return { promoted: false, promotion_status: "rejected", reason: gate.reason }
  }

  const observed_at = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("company_intelligence_snapshots")
    .upsert(
      {
        company_id: input.company_id,
        intelligence_category: input.draft.intelligence_category,
        intelligence_key: input.draft.intelligence_key,
        normalized_intelligence_key: input.draft.normalized_intelligence_key,
        value_text: input.draft.value_text,
        value_json: input.draft.value_json,
        confidence: input.confidence,
        verification_status: "verified",
        source_table: "company_intelligence_runs",
        source_run_id: input.run_id,
        source_evidence_ids: input.source_evidence_ids,
        provider_name: input.draft.provider_name,
        discovery_source: input.draft.discovery_source,
        observed_at,
        metadata: {
          qa_marker: "growth-company-intelligence-7.6a-v1",
          source: input.draft.source,
        },
      },
      { onConflict: "company_id,normalized_intelligence_key", ignoreDuplicates: false },
    )
    .select("id")
    .single()

  if (error) {
    return { promoted: false, promotion_status: "failed", reason: error.message }
  }

  await syncCanonicalCompanyFieldsFromIntelligence(admin, {
    company_id: input.company_id,
    draft: input.draft,
    confidence: input.confidence,
  })

  return {
    promoted: true,
    promotion_status: "promoted",
    reason: gate.reason,
    snapshot_id: data?.id as string | undefined,
  }
}

async function syncCanonicalCompanyFieldsFromIntelligence(
  admin: SupabaseClient,
  input: {
    company_id: string
    draft: GrowthCompanyIntelligenceDraftFinding
    confidence: number
  },
): Promise<void> {
  if (input.confidence < 0.85) return

  const patch: Record<string, unknown> = {}
  if (input.draft.intelligence_category === "industry" && input.draft.intelligence_key === "industry") {
    patch.industry = input.draft.value_text
  }
  if (input.draft.intelligence_category === "sub_industry" && input.draft.intelligence_key === "subindustry") {
    patch.subindustry = input.draft.value_text
  }
  if (input.draft.intelligence_category === "company_size" && input.draft.intelligence_key === "employee_range") {
    patch.employee_range = input.draft.value_text
  }
  if (input.draft.intelligence_category === "location") {
    if (input.draft.intelligence_key === "city") patch.city = input.draft.value_text
    if (input.draft.intelligence_key === "state") patch.state = input.draft.value_text
    if (input.draft.intelligence_key === "country") patch.country = input.draft.value_text
  }
  if (input.draft.intelligence_category === "technology" && input.draft.value_text) {
    const { data: company } = await admin
      .schema("growth")
      .from("companies")
      .select("technologies")
      .eq("id", input.company_id)
      .maybeSingle()
    const existing = Array.isArray(company?.technologies)
      ? (company!.technologies as string[])
      : []
    if (!existing.includes(input.draft.value_text)) {
      patch.technologies = [...existing, input.draft.value_text].slice(0, 50)
    }
  }

  if (Object.keys(patch).length === 0) return
  patch.last_observed_at = new Date().toISOString()

  const { error } = await admin.schema("growth").from("companies").update(patch).eq("id", input.company_id)
  if (error) {
    // Non-fatal: snapshots remain canonical intelligence store
    console.warn(`syncCanonicalCompanyFieldsFromIntelligence: ${error.message}`)
  }
}
