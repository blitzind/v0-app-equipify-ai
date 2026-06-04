import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { analyzeBuyingCommitteeCoverage } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-coverage"
import type {
  GrowthBuyingCommitteeIntelligenceCoverage,
  GrowthBuyingCommitteeIntelligenceDraftAssignment,
  GrowthBuyingCommitteeIntelligenceEvidenceDraft,
  GrowthBuyingCommitteeIntelligenceRunDetail,
  GrowthBuyingCommitteeIntelligenceRunStatus,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

export async function createBuyingCommitteeIntelligenceRun(
  admin: SupabaseClient,
  input: { company_id: string; created_by?: string | null },
): Promise<string> {
  const started = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("buying_committee_runs")
    .insert({
      company_id: input.company_id,
      created_by: input.created_by ?? null,
      status: "running",
      started_at: started,
      provider_summary:
        "canonical_role,staging_contact,confirmed_decision_maker,prior_intelligence",
    })
    .select("id")
    .single()
  if (error) throw new Error(`createBuyingCommitteeIntelligenceRun: ${error.message}`)
  return data.id as string
}

export async function finalizeBuyingCommitteeIntelligenceRun(
  admin: SupabaseClient,
  input: {
    run_id: string
    status: GrowthBuyingCommitteeIntelligenceRunStatus
    member_count: number
    verified_count: number
    promoted_count: number
    coverage: GrowthBuyingCommitteeIntelligenceCoverage
    error_message?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from("buying_committee_runs")
    .update({
      status: input.status,
      completed_at: new Date().toISOString(),
      member_count: input.member_count,
      verified_count: input.verified_count,
      promoted_count: input.promoted_count,
      coverage_score: input.coverage.coverage_score,
      error_message: input.error_message ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        coverage: input.coverage,
      },
    })
    .eq("id", input.run_id)
  if (error) throw new Error(`finalizeBuyingCommitteeIntelligenceRun: ${error.message}`)
}

export async function insertBuyingCommitteeIntelligenceEvidence(
  admin: SupabaseClient,
  input: {
    run_id: string
    company_id: string
    draft: GrowthBuyingCommitteeIntelligenceDraftAssignment
    evidence: GrowthBuyingCommitteeIntelligenceEvidenceDraft[]
  },
): Promise<string[]> {
  const ids: string[] = []
  for (const row of input.evidence) {
    const { data, error } = await admin
      .schema("growth")
      .from("buying_committee_evidence")
      .insert({
        run_id: input.run_id,
        company_id: input.company_id,
        person_id: input.draft.person_id,
        assignment_ref: input.draft.assignment_ref,
        committee_role: input.draft.committee_role,
        evidence_type: row.evidence_type,
        source_url: row.source_url ?? null,
        source_record_id: row.source_record_id ?? null,
        extraction_method: row.extraction_method ?? row.evidence_type,
        evidence_text: row.evidence_text,
        proposed_person_name: input.draft.full_name,
        proposed_job_title: input.draft.job_title,
        confidence: row.confidence ?? input.draft.confidence,
        metadata: row.metadata ?? {},
      })
      .select("id")
      .single()
    if (error) throw new Error(`insertBuyingCommitteeIntelligenceEvidence: ${error.message}`)
    ids.push(data.id as string)
  }
  return ids
}

export async function fetchBuyingCommitteeIntelligenceMemberByKey(
  admin: SupabaseClient,
  input: {
    company_id: string
    person_id: string
    committee_role: string
  },
) {
  const { data } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .select("id, company_id, person_id, committee_role, verification_status, confidence")
    .eq("company_id", input.company_id)
    .eq("person_id", input.person_id)
    .eq("committee_role", input.committee_role)
    .neq("verification_status", "superseded")
    .maybeSingle()
  return data ?? null
}

export async function loadBuyingCommitteeIntelligenceRunDetail(
  admin: SupabaseClient,
  runId: string,
): Promise<GrowthBuyingCommitteeIntelligenceRunDetail | null> {
  const { data: run, error: rErr } = await admin
    .schema("growth")
    .from("buying_committee_runs")
    .select(
      "id, company_id, status, member_count, verified_count, promoted_count, coverage_score, metadata, started_at, completed_at",
    )
    .eq("id", runId)
    .maybeSingle()
  if (rErr || !run) return null

  const meta = (run.metadata && typeof run.metadata === "object" ? run.metadata : {}) as {
    coverage?: GrowthBuyingCommitteeIntelligenceCoverage
    assignments?: GrowthBuyingCommitteeIntelligenceRunDetail["assignments"]
  }

  const { data: evidenceRows } = await admin
    .schema("growth")
    .from("buying_committee_evidence")
    .select(
      "id, assignment_ref, person_id, committee_role, evidence_type, evidence_text, confidence",
    )
    .eq("run_id", runId)
    .order("created_at", { ascending: true })

  return {
    run_id: run.id as string,
    company_id: run.company_id as string,
    status: run.status as GrowthBuyingCommitteeIntelligenceRunDetail["status"],
    member_count: Number(run.member_count ?? 0),
    verified_count: Number(run.verified_count ?? 0),
    promoted_count: Number(run.promoted_count ?? 0),
    coverage_score: Number(run.coverage_score ?? 0),
    coverage:
      meta.coverage ??
      analyzeBuyingCommitteeCoverage({ verified_roles: [], verified_person_ids: [] }),
    assignments: meta.assignments ?? [],
    evidence: (evidenceRows ?? []).map((e) => ({
      id: e.id as string,
      assignment_ref: e.assignment_ref as string,
      person_id: e.person_id as string,
      committee_role: e.committee_role as string,
      evidence_type: e.evidence_type as string,
      evidence_text: e.evidence_text as string,
      confidence: Number(e.confidence ?? 0),
    })),
  }
}

export async function countBuyingCommitteeIntelligenceMembers(
  admin: SupabaseClient,
  company_id: string,
): Promise<{ total: number; verified: number; roles: string[]; verified_person_ids: string[] }> {
  const { data } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .select("person_id, committee_role, verification_status")
    .eq("company_id", company_id)
    .neq("verification_status", "superseded")
    .limit(200)

  const rows = data ?? []
  const verified = rows.filter((r) => r.verification_status === "verified")
  return {
    total: rows.length,
    verified: verified.length,
    roles: [...new Set(verified.map((r) => String(r.committee_role)).filter(Boolean))],
    verified_person_ids: [
      ...new Set(verified.map((r) => String(r.person_id)).filter(Boolean)),
    ],
  }
}
