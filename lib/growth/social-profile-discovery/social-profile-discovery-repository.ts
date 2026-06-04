import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthSocialProfileDiscoveryDraftCandidate,
  GrowthSocialProfileDiscoveryRunDetail,
  GrowthSocialProfileDiscoveryRunStatus,
  GrowthSocialProfileDiscoveryScope,
  GrowthSocialProfileDiscoverySource,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

export async function loadSocialProfileDiscoveryPersonContext(
  admin: SupabaseClient,
  input: { company_id: string; person_id: string },
): Promise<{
  person_id: string
  company_id: string
  discovery_scope: "person"
  normalized_name: string
  full_name: string
  company_name: string
  primary_domain: string | null
  website_url: string | null
} | null> {
  const { data: person, error: pErr } = await admin
    .schema("growth")
    .from("persons")
    .select("id, normalized_name, first_name, last_name, full_name")
    .eq("id", input.person_id)
    .maybeSingle()
  if (pErr || !person) return null

  const { data: company, error: cErr } = await admin
    .schema("growth")
    .from("companies")
    .select("id, display_name, primary_domain, website")
    .eq("id", input.company_id)
    .maybeSingle()
  if (cErr || !company) return null

  const full_name =
    (typeof person.full_name === "string" && person.full_name.trim()) ||
    [person.first_name, person.last_name].filter((p) => typeof p === "string" && p.trim()).join(" ") ||
    "Unknown"

  return {
    person_id: person.id as string,
    company_id: company.id as string,
    discovery_scope: "person",
    normalized_name: (typeof person.normalized_name === "string" && person.normalized_name) || "",
    full_name,
    company_name: (typeof company.display_name === "string" && company.display_name) || "",
    primary_domain: typeof company.primary_domain === "string" ? company.primary_domain : null,
    website_url: typeof company.website === "string" ? company.website : null,
  }
}

export async function loadSocialProfileDiscoveryCompanyContext(
  admin: SupabaseClient,
  input: { company_id: string },
): Promise<{
  company_id: string
  person_id: null
  discovery_scope: "company"
  normalized_name: string
  full_name: string
  company_name: string
  primary_domain: string | null
  website_url: string | null
} | null> {
  const { data: company, error: cErr } = await admin
    .schema("growth")
    .from("companies")
    .select("id, display_name, primary_domain, website")
    .eq("id", input.company_id)
    .maybeSingle()
  if (cErr || !company) return null

  const company_name = (typeof company.display_name === "string" && company.display_name) || ""
  return {
    company_id: company.id as string,
    person_id: null,
    discovery_scope: "company",
    normalized_name: "",
    full_name: company_name,
    company_name,
    primary_domain: typeof company.primary_domain === "string" ? company.primary_domain : null,
    website_url: typeof company.website === "string" ? company.website : null,
  }
}

export async function createSocialProfileDiscoveryRun(
  admin: SupabaseClient,
  input: {
    company_id: string
    person_id: string | null
    discovery_scope: GrowthSocialProfileDiscoveryScope
    created_by?: string | null
  },
): Promise<string> {
  const started = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("social_profile_discovery_runs")
    .insert({
      company_id: input.company_id,
      person_id: input.person_id,
      discovery_scope: input.discovery_scope,
      created_by: input.created_by ?? null,
      status: "running",
      started_at: started,
      provider_summary: "website,staging_contact,canonical_channel",
    })
    .select("id")
    .single()
  if (error) throw new Error(`createSocialProfileDiscoveryRun: ${error.message}`)
  return data.id as string
}

export async function finalizeSocialProfileDiscoveryRun(
  admin: SupabaseClient,
  input: {
    run_id: string
    status: GrowthSocialProfileDiscoveryRunStatus
    candidate_count: number
    verified_count: number
    promoted_count: number
    error_message?: string | null
  },
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from("social_profile_discovery_runs")
    .update({
      status: input.status,
      completed_at: new Date().toISOString(),
      candidate_count: input.candidate_count,
      verified_count: input.verified_count,
      promoted_count: input.promoted_count,
      error_message: input.error_message ?? null,
    })
    .eq("id", input.run_id)
  if (error) throw new Error(`finalizeSocialProfileDiscoveryRun: ${error.message}`)
}

export async function insertSocialProfileDiscoveryCandidate(
  admin: SupabaseClient,
  input: {
    run_id: string
    company_id: string
    person_id: string | null
    draft: GrowthSocialProfileDiscoveryDraftCandidate
    verification_status: string
    verified_at: string | null
    verification_provider: string
    verification_reasons: string[]
    promotion_status: string
  },
): Promise<string> {
  const { data, error } = await admin
    .schema("growth")
    .from("social_profile_discovery_candidates")
    .insert({
      run_id: input.run_id,
      company_id: input.company_id,
      person_id: input.person_id,
      profile_type: input.draft.profile_type,
      profile_url: input.draft.profile_url,
      normalized_profile_key: input.draft.normalized_profile_key,
      source: input.draft.source,
      confidence: input.draft.confidence,
      confidence_tier: input.draft.confidence_tier,
      verification_status: input.verification_status,
      verified_at: input.verified_at,
      verification_provider: input.verification_provider,
      verification_reasons: input.verification_reasons,
      promotion_status: input.promotion_status,
      provider_name: input.draft.provider_name,
      discovery_source: input.draft.discovery_source,
    })
    .select("id")
    .single()
  if (error) throw new Error(`insertSocialProfileDiscoveryCandidate: ${error.message}`)
  return data.id as string
}

export async function insertSocialProfileDiscoveryEvidence(
  admin: SupabaseClient,
  candidateId: string,
  evidence: GrowthSocialProfileDiscoveryDraftCandidate["evidence"],
): Promise<void> {
  if (evidence.length === 0) return
  const rows = evidence.map((row) => ({
    candidate_id: candidateId,
    evidence_type: row.evidence_type,
    source_url: row.source_url ?? null,
    source_record_id: row.source_record_id ?? null,
    extraction_method: row.extraction_method ?? "",
    evidence_text: row.evidence_text,
    confidence: row.confidence,
    metadata: row.metadata ?? {},
  }))
  const { error } = await admin.schema("growth").from("social_profile_discovery_evidence").insert(rows)
  if (error) throw new Error(`insertSocialProfileDiscoveryEvidence: ${error.message}`)
}

export async function updateSocialProfileDiscoveryCandidatePromotion(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    promotion_status: "candidate" | "promoted" | "rejected" | "skipped"
    promotion_reason?: string
    promoted_at?: string | null
  },
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from("social_profile_discovery_candidates")
    .update({
      promotion_status: input.promotion_status,
      promoted_at: input.promoted_at ?? null,
      metadata: input.promotion_reason ? { promotion_reason: input.promotion_reason } : undefined,
    })
    .eq("id", input.candidate_id)
  if (error) throw new Error(`updateSocialProfileDiscoveryCandidatePromotion: ${error.message}`)
}

export async function loadSocialProfileDiscoveryRunDetail(
  admin: SupabaseClient,
  run_id: string,
): Promise<GrowthSocialProfileDiscoveryRunDetail | null> {
  const { data: run, error: runErr } = await admin
    .schema("growth")
    .from("social_profile_discovery_runs")
    .select(
      "id, company_id, person_id, discovery_scope, status, candidate_count, verified_count, promoted_count",
    )
    .eq("id", run_id)
    .maybeSingle()
  if (runErr) throw new Error(`loadSocialProfileDiscoveryRunDetail: ${runErr.message}`)
  if (!run) return null

  const { data: candidates, error: cErr } = await admin
    .schema("growth")
    .from("social_profile_discovery_candidates")
    .select(
      "id, profile_type, profile_url, source, confidence, confidence_tier, verification_status, promotion_status, verification_provider, verification_reasons, metadata",
    )
    .eq("run_id", run_id)
    .order("confidence", { ascending: false })
  if (cErr) throw new Error(`loadSocialProfileDiscoveryRunDetail candidates: ${cErr.message}`)

  const candidateIds = (candidates ?? []).map((c) => c.id as string)
  let evidenceRows: Array<Record<string, unknown>> = []
  if (candidateIds.length > 0) {
    const { data: evidence, error: eErr } = await admin
      .schema("growth")
      .from("social_profile_discovery_evidence")
      .select(
        "id, candidate_id, evidence_type, source_url, source_record_id, extraction_method, evidence_text, confidence, created_at",
      )
      .in("candidate_id", candidateIds)
      .order("created_at", { ascending: true })
    if (eErr) throw new Error(`loadSocialProfileDiscoveryRunDetail evidence: ${eErr.message}`)
    evidenceRows = evidence ?? []
  }

  const evidenceByCandidate = new Map<string, typeof evidenceRows>()
  for (const row of evidenceRows) {
    const cid = row.candidate_id as string
    const list = evidenceByCandidate.get(cid) ?? []
    list.push(row)
    evidenceByCandidate.set(cid, list)
  }

  return {
    run_id: run.id as string,
    company_id: run.company_id as string,
    person_id: (run.person_id as string | null) ?? null,
    discovery_scope: run.discovery_scope as string,
    status: run.status as string,
    candidate_count: run.candidate_count as number,
    verified_count: run.verified_count as number,
    promoted_count: run.promoted_count as number,
    candidates: (candidates ?? []).map((c) => {
      const meta =
        c.metadata && typeof c.metadata === "object" && !Array.isArray(c.metadata)
          ? (c.metadata as Record<string, unknown>)
          : {}
      const reasons = Array.isArray(c.verification_reasons) ? c.verification_reasons : []
      return {
        id: c.id as string,
        profile_type: c.profile_type as GrowthSocialProfileDiscoveryDraftCandidate["profile_type"],
        profile_url: c.profile_url as string,
        source: c.source as GrowthSocialProfileDiscoverySource,
        confidence: Number(c.confidence) || 0,
        confidence_tier: c.confidence_tier as GrowthSocialProfileDiscoveryDraftCandidate["confidence_tier"],
        verification_status:
          c.verification_status as GrowthSocialProfileDiscoveryDraftCandidate["verification_status"],
        promotion_status: c.promotion_status as string,
        promotion_reason: typeof meta.promotion_reason === "string" ? meta.promotion_reason : undefined,
        verification_provider: typeof c.verification_provider === "string" ? c.verification_provider : "",
        verification_reasons: reasons.filter((r): r is string => typeof r === "string"),
        evidence_count: (evidenceByCandidate.get(c.id as string) ?? []).length,
        evidence: (evidenceByCandidate.get(c.id as string) ?? []).map((e) => ({
          id: e.id as string,
          candidate_id: e.candidate_id as string,
          evidence_type: e.evidence_type as string,
          source_url: (e.source_url as string | null) ?? null,
          source_record_id: (e.source_record_id as string | null) ?? null,
          extraction_method: (e.extraction_method as string | null) ?? null,
          evidence_text: e.evidence_text as string,
          confidence: Number(e.confidence) || 0,
          created_at: e.created_at as string,
        })),
      }
    }),
  }
}
