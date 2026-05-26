import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildBuyingCommitteeAssessment } from "@/lib/growth/contact-discovery/buying-committee-builder"
import { runContactDiscoveryProviders } from "@/lib/growth/contact-discovery/contact-discovery-registry"
import {
  GROWTH_CONTACT_DISCOVERY_PRIVACY_NOTE,
  GROWTH_CONTACT_DISCOVERY_QA_MARKER,
  type GrowthBuyingCommitteeAssessment,
  type GrowthContactCandidate,
  type GrowthContactDiscoverySnapshot,
  type GrowthContactVerificationState,
} from "@/lib/growth/contact-discovery/contact-discovery-types"
import { filterNewContacts, findExistingContactDedupeHashes } from "@/lib/growth/contact-discovery/contact-dedupe"
import {
  dedupeNormalizedContacts,
  normalizeContactCandidate,
} from "@/lib/growth/contact-discovery/contact-normalizer"
import { isGrowthContactDiscoverySchemaReady } from "@/lib/growth/contact-discovery/contact-schema-health"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function rowToContact(row: Record<string, unknown>): GrowthContactCandidate {
  return {
    id: asString(row.id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    company_candidate_id: asString(row.company_candidate_id),
    provider_name: asString(row.provider_name),
    provider_type: asString(row.provider_type),
    full_name: asString(row.full_name),
    first_name: asString(row.first_name) || null,
    last_name: asString(row.last_name) || null,
    job_title: asString(row.job_title) || null,
    department: asString(row.department) || null,
    seniority: asString(row.seniority) || null,
    linkedin_url: asString(row.linkedin_url) || null,
    email: asString(row.email) || null,
    phone: asString(row.phone) || null,
    verification_state: asString(row.verification_state) as GrowthContactVerificationState,
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    source_attribution: Array.isArray(row.source_attribution)
      ? (row.source_attribution as GrowthContactCandidate["source_attribution"])
      : [],
    evidence: Array.isArray(row.evidence)
      ? (row.evidence as GrowthContactCandidate["evidence"])
      : [],
    dedupe_hash: asString(row.dedupe_hash),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

export type ResolveCompanyContextResult = {
  company_candidate_id: string
  company_name: string
  domain: string | null
  growth_lead_id: string | null
  industry: string | null
}

async function loadCompanyCandidateRow(
  admin: SupabaseClient,
  companyCandidateId: string,
  table: "real_world_company_candidates" | "external_company_candidates",
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .schema("growth")
    .from(table)
    .select("id, company_name, domain, industry, metadata")
    .eq("id", companyCandidateId)
    .maybeSingle()
  return data ? (data as Record<string, unknown>) : null
}

export async function resolveCompanyCandidateContext(
  admin: SupabaseClient,
  companyCandidateId: string,
): Promise<ResolveCompanyContextResult | null> {
  try {
    const data =
      (await loadCompanyCandidateRow(admin, companyCandidateId, "real_world_company_candidates")) ??
      (await loadCompanyCandidateRow(admin, companyCandidateId, "external_company_candidates"))
    if (!data) return null
    const r = data as Record<string, unknown>
    const meta =
      r.metadata && typeof r.metadata === "object"
        ? (r.metadata as Record<string, unknown>)
        : {}
    return {
      company_candidate_id: asString(r.id),
      company_name: asString(r.company_name),
      domain: asString(r.domain) || null,
      growth_lead_id:
        typeof meta.matched_growth_lead_id === "string" ? meta.matched_growth_lead_id : null,
      industry: asString(r.industry) || null,
    }
  } catch {
    return null
  }
}

async function persistBuyingCommittee(
  admin: SupabaseClient,
  assessment: GrowthBuyingCommitteeAssessment,
): Promise<GrowthBuyingCommitteeAssessment> {
  const { data: committeeRow, error: committeeError } = await admin
    .schema("growth")
    .from("buying_committees")
    .insert({
      company_id: assessment.committee.company_id,
      committee_type: assessment.committee.committee_type,
      coverage_score: assessment.committee.coverage_score,
      decision_maker_found: assessment.committee.decision_maker_found,
      economic_buyer_found: assessment.committee.economic_buyer_found,
      technical_buyer_found: assessment.committee.technical_buyer_found,
      champion_found: assessment.committee.champion_found,
      metadata: assessment.committee.metadata,
    })
    .select("*")
    .single()

  if (committeeError || !committeeRow) return assessment

  const committeeId = asString((committeeRow as Record<string, unknown>).id)
  const memberRows = assessment.members
    .filter((m) => m.contact_candidate_id)
    .map((m) => ({
      committee_id: committeeId,
      contact_candidate_id: m.contact_candidate_id,
      committee_role: m.committee_role,
      confidence: m.confidence,
    }))

  if (memberRows.length) {
    await admin.schema("growth").from("buying_committee_members").insert(memberRows)
  }

  return {
    ...assessment,
    committee: {
      ...assessment.committee,
      id: committeeId,
    },
    members: assessment.members.map((m) => ({ ...m, committee_id: committeeId })),
  }
}

export async function runContactDiscoveryForCompany(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    created_by?: string | null
    limit?: number
  },
): Promise<GrowthContactDiscoverySnapshot> {
  const base: GrowthContactDiscoverySnapshot = {
    qa_marker: GROWTH_CONTACT_DISCOVERY_QA_MARKER,
    schema_ready: false,
    company_candidate_id: input.company_candidate_id,
    run: null,
    contacts: [],
    buying_committee: null,
    provider_messages: [],
    privacy_note: GROWTH_CONTACT_DISCOVERY_PRIVACY_NOTE,
  }

  const schema_ready = await isGrowthContactDiscoverySchemaReady(admin)
  if (!schema_ready) return { ...base, schema_ready: false }

  const ctx = await resolveCompanyCandidateContext(admin, input.company_candidate_id)
  if (!ctx) {
    return {
      ...base,
      schema_ready: true,
      provider_messages: ["Company candidate not found."],
    }
  }

  const providerResults = await runContactDiscoveryProviders(admin, {
    company_candidate_id: ctx.company_candidate_id,
    company_name: ctx.company_name,
    domain: ctx.domain,
    growth_lead_id: ctx.growth_lead_id,
    industry: ctx.industry,
    limit: input.limit ?? 20,
  })

  const provider_messages = providerResults.map(
    (r) => `${r.provider_name}: ${r.status} — ${r.message}`,
  )

  const normalized: Array<
    ReturnType<typeof normalizeContactCandidate> & {
      provider_name: string
      provider_type: string
    }
  > = []

  for (const pr of providerResults) {
    if (pr.status !== "success") continue
    for (const raw of pr.contacts) {
      const row = normalizeContactCandidate(
        raw,
        pr.provider_name,
        pr.provider_type,
        ctx.company_candidate_id,
      )
      if (row) {
        normalized.push({
          ...row,
          provider_name: pr.provider_name,
          provider_type: pr.provider_type,
        })
      }
    }
  }

  const deduped = dedupeNormalizedContacts(
    normalized.map(({ provider_name: _pn, provider_type: _pt, ...row }) => row),
  )

  const existingHashes = await findExistingContactDedupeHashes(
    admin,
    ctx.company_candidate_id,
    deduped.map((d) => d.dedupe_hash),
  )
  const toInsert = filterNewContacts(deduped, existingHashes)

  const { data: runRow, error: runError } = await admin
    .schema("growth")
    .from("contact_discovery_runs")
    .insert({
      company_candidate_id: ctx.company_candidate_id,
      created_by: input.created_by ?? null,
      provider_names: providerResults.map((r) => r.provider_name),
      status: providerResults.some((r) => r.status === "failed")
        ? toInsert.length
          ? "partial"
          : "failed"
        : "completed",
      candidate_count: 0,
      error_message: runError ? runError.message : null,
      metadata: { qa_marker: GROWTH_CONTACT_DISCOVERY_QA_MARKER },
    })
    .select("*")
    .single()

  if (runError || !runRow) {
    return { ...base, schema_ready: true, provider_messages }
  }

  const runId = asString((runRow as Record<string, unknown>).id)
  const inserts = toInsert.map((row) => {
    const prov = normalized.find((n) => n.dedupe_hash === row.dedupe_hash)
    return {
      run_id: runId,
      company_candidate_id: ctx.company_candidate_id,
      provider_name: prov?.provider_name ?? "contact_manual_fixture",
      provider_type: prov?.provider_type ?? "manual_fixture",
      full_name: row.full_name,
      first_name: row.first_name,
      last_name: row.last_name,
      job_title: row.job_title,
      department: row.department,
      seniority: row.seniority,
      linkedin_url: row.linkedin_url,
      email: row.email,
      phone: row.phone,
      verification_state: row.verification_state,
      confidence: row.confidence,
      source_attribution: row.source_attribution,
      evidence: row.evidence,
      dedupe_hash: row.dedupe_hash,
      metadata: row.metadata,
    }
  })

  let stored: GrowthContactCandidate[] = []

  if (inserts.length) {
    const { data: inserted, error: insertError } = await admin
      .schema("growth")
      .from("contact_candidates")
      .insert(inserts)
      .select(
        "id, created_at, updated_at, company_candidate_id, provider_name, provider_type, full_name, first_name, last_name, job_title, department, seniority, linkedin_url, email, phone, verification_state, confidence, source_attribution, evidence, dedupe_hash, metadata",
      )
    if (!insertError && inserted?.length) {
      stored = inserted.map((r) => rowToContact(r as Record<string, unknown>))
    }
  }

  const { data: prior } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select(
      "id, created_at, updated_at, company_candidate_id, provider_name, provider_type, full_name, first_name, last_name, job_title, department, seniority, linkedin_url, email, phone, verification_state, confidence, source_attribution, evidence, dedupe_hash, metadata",
    )
    .eq("company_candidate_id", ctx.company_candidate_id)
    .order("confidence", { ascending: false })
    .limit(50)

  const allContacts = [
    ...stored,
    ...(prior ?? [])
      .map((r) => rowToContact(r as Record<string, unknown>))
      .filter((c) => !stored.some((s) => s.id === c.id)),
  ]

  const assessment = buildBuyingCommitteeAssessment({
    company_id: ctx.company_candidate_id,
    contacts: allContacts,
  })

  const buying_committee = await persistBuyingCommittee(admin, assessment)

  await admin
    .schema("growth")
    .from("contact_discovery_runs")
    .update({
      candidate_count: allContacts.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)

  const r = runRow as Record<string, unknown>
  return {
    qa_marker: GROWTH_CONTACT_DISCOVERY_QA_MARKER,
    schema_ready: true,
    company_candidate_id: ctx.company_candidate_id,
    run: {
      id: runId,
      created_at: asString(r.created_at),
      updated_at: asString(r.updated_at),
      company_candidate_id: ctx.company_candidate_id,
      created_by: asString(r.created_by) || null,
      provider_names: Array.isArray(r.provider_names) ? (r.provider_names as string[]) : [],
      status: asString(r.status) as GrowthContactDiscoverySnapshot["run"] extends null
        ? never
        : NonNullable<GrowthContactDiscoverySnapshot["run"]>["status"],
      candidate_count: allContacts.length,
      error_message: asString(r.error_message) || null,
      metadata:
        r.metadata && typeof r.metadata === "object"
          ? (r.metadata as Record<string, unknown>)
          : {},
    },
    contacts: allContacts,
    buying_committee,
    provider_messages,
    privacy_note: GROWTH_CONTACT_DISCOVERY_PRIVACY_NOTE,
  }
}

export async function loadContactDiscoverySnapshot(
  admin: SupabaseClient,
  companyCandidateId: string,
): Promise<GrowthContactDiscoverySnapshot> {
  const schema_ready = await isGrowthContactDiscoverySchemaReady(admin)
  if (!schema_ready) {
    return {
      qa_marker: GROWTH_CONTACT_DISCOVERY_QA_MARKER,
      schema_ready: false,
      company_candidate_id: companyCandidateId,
      run: null,
      contacts: [],
      buying_committee: null,
      provider_messages: [],
      privacy_note: GROWTH_CONTACT_DISCOVERY_PRIVACY_NOTE,
    }
  }

  const { data: contacts } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select(
      "id, created_at, updated_at, company_candidate_id, provider_name, provider_type, full_name, first_name, last_name, job_title, department, seniority, linkedin_url, email, phone, verification_state, confidence, source_attribution, evidence, dedupe_hash, metadata",
    )
    .eq("company_candidate_id", companyCandidateId)
    .order("confidence", { ascending: false })
    .limit(50)

  const mapped = (contacts ?? []).map((r) => rowToContact(r as Record<string, unknown>))
  const buying_committee =
    mapped.length > 0
      ? buildBuyingCommitteeAssessment({
          company_id: companyCandidateId,
          contacts: mapped,
        })
      : null

  return {
    qa_marker: GROWTH_CONTACT_DISCOVERY_QA_MARKER,
    schema_ready: true,
    company_candidate_id: companyCandidateId,
    run: null,
    contacts: mapped,
    buying_committee,
    provider_messages: [],
    privacy_note: GROWTH_CONTACT_DISCOVERY_PRIVACY_NOTE,
  }
}
