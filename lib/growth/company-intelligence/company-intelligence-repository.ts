import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthCompanyIntelligenceDraftFinding,
  GrowthCompanyIntelligenceEvidenceDraft,
  GrowthCompanyIntelligenceRunDetail,
  GrowthCompanyIntelligenceRunStatus,
} from "@/lib/growth/company-intelligence/company-intelligence-types"

export async function createCompanyIntelligenceRun(
  admin: SupabaseClient,
  input: { company_id: string; created_by?: string | null },
): Promise<string> {
  const started = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("company_intelligence_runs")
    .insert({
      company_id: input.company_id,
      created_by: input.created_by ?? null,
      status: "running",
      started_at: started,
      provider_summary: "website,staging_company,canonical_company,canonical_social,canonical_snapshot",
    })
    .select("id")
    .single()
  if (error) throw new Error(`createCompanyIntelligenceRun: ${error.message}`)
  return data.id as string
}

export async function finalizeCompanyIntelligenceRun(
  admin: SupabaseClient,
  input: {
    run_id: string
    status: GrowthCompanyIntelligenceRunStatus
    finding_count: number
    verified_count: number
    promoted_count: number
    error_message?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from("company_intelligence_runs")
    .update({
      status: input.status,
      completed_at: new Date().toISOString(),
      finding_count: input.finding_count,
      verified_count: input.verified_count,
      promoted_count: input.promoted_count,
      error_message: input.error_message ?? null,
      metadata: input.metadata ?? {},
    })
    .eq("id", input.run_id)
  if (error) throw new Error(`finalizeCompanyIntelligenceRun: ${error.message}`)
}

export async function insertCompanyIntelligenceEvidence(
  admin: SupabaseClient,
  input: {
    run_id: string
    company_id: string
    draft: GrowthCompanyIntelligenceDraftFinding
    evidence: GrowthCompanyIntelligenceEvidenceDraft[]
  },
): Promise<string[]> {
  const ids: string[] = []
  for (const row of input.evidence) {
    const { data, error } = await admin
      .schema("growth")
      .from("company_intelligence_evidence")
      .insert({
        run_id: input.run_id,
        company_id: input.company_id,
        finding_ref: input.draft.finding_ref,
        intelligence_category: input.draft.intelligence_category,
        intelligence_key: input.draft.intelligence_key,
        evidence_type: row.evidence_type,
        source_url: row.source_url ?? null,
        source_record_id: row.source_record_id ?? null,
        extraction_method: row.extraction_method ?? row.evidence_type,
        evidence_text: row.evidence_text,
        proposed_value_text: input.draft.value_text,
        proposed_value_json: input.draft.value_json,
        confidence: row.confidence ?? input.draft.confidence,
        metadata: row.metadata ?? {},
      })
      .select("id")
      .single()
    if (error) throw new Error(`insertCompanyIntelligenceEvidence: ${error.message}`)
    ids.push(data.id as string)
  }
  return ids
}

export async function loadCompanyIntelligenceRunDetail(
  admin: SupabaseClient,
  runId: string,
): Promise<GrowthCompanyIntelligenceRunDetail | null> {
  const { data: run, error: rErr } = await admin
    .schema("growth")
    .from("company_intelligence_runs")
    .select(
      "id, company_id, status, finding_count, verified_count, promoted_count, provider_summary, started_at, completed_at, error_message, metadata",
    )
    .eq("id", runId)
    .maybeSingle()
  if (rErr || !run) return null

  const meta = (run.metadata && typeof run.metadata === "object" ? run.metadata : {}) as {
    findings?: GrowthCompanyIntelligenceRunDetail["findings"]
  }

  const { data: evidenceRows } = await admin
    .schema("growth")
    .from("company_intelligence_evidence")
    .select(
      "id, finding_ref, intelligence_category, intelligence_key, evidence_type, source_url, evidence_text, proposed_value_text, confidence",
    )
    .eq("run_id", runId)
    .order("created_at", { ascending: true })

  return {
    run_id: run.id as string,
    company_id: run.company_id as string,
    status: run.status as GrowthCompanyIntelligenceRunDetail["status"],
    finding_count: Number(run.finding_count) || 0,
    verified_count: Number(run.verified_count) || 0,
    promoted_count: Number(run.promoted_count) || 0,
    provider_summary: typeof run.provider_summary === "string" ? run.provider_summary : "",
    started_at: typeof run.started_at === "string" ? run.started_at : null,
    completed_at: typeof run.completed_at === "string" ? run.completed_at : null,
    error_message: typeof run.error_message === "string" ? run.error_message : null,
    findings: Array.isArray(meta.findings) ? meta.findings : [],
    evidence: (evidenceRows ?? []).map((row) => ({
      id: row.id as string,
      finding_ref: row.finding_ref as string,
      intelligence_category: row.intelligence_category as string,
      intelligence_key: row.intelligence_key as string,
      evidence_type: row.evidence_type as string,
      source_url: typeof row.source_url === "string" ? row.source_url : null,
      evidence_text: typeof row.evidence_text === "string" ? row.evidence_text : "",
      proposed_value_text:
        typeof row.proposed_value_text === "string" ? row.proposed_value_text : null,
      confidence: Number(row.confidence) || 0,
    })),
  }
}

export async function fetchCompanyIntelligenceSnapshotByKey(
  admin: SupabaseClient,
  input: { company_id: string; normalized_intelligence_key: string },
): Promise<{
  id: string
  company_id: string
  confidence: number
  verification_status: string
} | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("company_intelligence_snapshots")
    .select("id, company_id, confidence, verification_status")
    .eq("company_id", input.company_id)
    .eq("normalized_intelligence_key", input.normalized_intelligence_key)
    .neq("verification_status", "superseded")
    .maybeSingle()
  if (error) throw new Error(`fetchCompanyIntelligenceSnapshotByKey: ${error.message}`)
  if (!data) return null
  return {
    id: data.id as string,
    company_id: data.company_id as string,
    confidence: Number(data.confidence) || 0,
    verification_status: typeof data.verification_status === "string" ? data.verification_status : "",
  }
}
