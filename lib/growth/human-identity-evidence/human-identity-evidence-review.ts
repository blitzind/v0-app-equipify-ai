import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canonicalNormalizedPersonName } from "@/lib/growth/canonical-persons/canonical-person-normalize"
import {
  assertValueSupportedByEvidence,
  contactHasReviewableEvidence,
  evidenceCorpus,
} from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import type {
  HumanIdentityEvidenceReviewInput,
  HumanIdentityEvidenceReviewResult,
} from "@/lib/growth/human-identity-evidence/human-identity-evidence-types"
import { ensureStagingCanonicalCompanyLinkage } from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import { runPhoneDiscoveryForCanonicalPerson } from "@/lib/growth/phone-discovery/phone-discovery-orchestrator"

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function splitName(full_name: string): { first_name: string | null; last_name: string | null } {
  const parts = full_name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: null, last_name: null }
  if (parts.length === 1) return { first_name: parts[0]!, last_name: null }
  return { first_name: parts[0]!, last_name: parts.slice(1).join(" ") }
}

export async function submitHumanIdentityEvidenceReview(
  admin: SupabaseClient,
  input: HumanIdentityEvidenceReviewInput & {
    reviewer_user_id?: string | null
    reviewer_email?: string | null
  },
): Promise<HumanIdentityEvidenceReviewResult> {
  const company_contact_id = asString(input.company_contact_id)
  if (!company_contact_id) {
    return { ok: false, review_id: null, company_contact_id: "", fields_changed: [], previous_values: {}, new_values: {}, phone_discovery: null, error: "company_contact_id required" }
  }

  const { data: row, error: loadErr } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("*")
    .eq("id", company_contact_id)
    .maybeSingle()

  if (loadErr || !row) {
    return {
      ok: false,
      review_id: null,
      company_contact_id,
      fields_changed: [],
      previous_values: {},
      new_values: {},
      phone_discovery: null,
      error: loadErr?.message ?? "Contact not found.",
    }
  }

  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
  const source_evidence = Array.isArray(row.source_evidence) ? row.source_evidence : []
  const corpus = evidenceCorpus({ source_evidence, metadata })

  const previous_values: Record<string, unknown> = {
    full_name: row.full_name,
    title: row.title,
    contact_status: row.contact_status,
    phone_status: row.phone_status,
    phone: row.phone,
    email: row.email,
    linkedin_url: row.linkedin_url,
  }

  const patch: Record<string, unknown> = {}
  const fields_changed: string[] = []
  const actions = input.actions ?? []

  const wantsVerify =
    actions.includes("mark_contact_verified") || actions.includes("mark_phone_verified")
  if (wantsVerify) {
    const evidenceCheck = contactHasReviewableEvidence({
      source_evidence,
      metadata,
      phone: asString(row.phone) || null,
      email: asString(row.email) || null,
    })
    if (!evidenceCheck.ok) {
      return {
        ok: false,
        review_id: null,
        company_contact_id,
        fields_changed: [],
        previous_values,
        new_values: {},
        phone_discovery: null,
        error: evidenceCheck.message,
      }
    }
  }

  if (input.full_name?.trim() || actions.includes("update_name_from_evidence")) {
    const nextName = asString(input.full_name ?? row.full_name)
    const nameCheck = assertValueSupportedByEvidence({
      value: nextName,
      evidence_corpus: corpus,
      field_label: "full_name",
    })
    if (!nameCheck.ok) {
      return {
        ok: false,
        review_id: null,
        company_contact_id,
        fields_changed: [],
        previous_values,
        new_values: {},
        phone_discovery: null,
        error: nameCheck.message,
      }
    }
    if (nextName !== row.full_name) {
      patch.full_name = nextName
      const { first_name, last_name } = splitName(nextName)
      patch.first_name = first_name
      patch.last_name = last_name
      fields_changed.push("full_name", "first_name", "last_name")
    }
  }

  if (input.title?.trim() || actions.includes("update_title_from_evidence")) {
    const nextTitle = asString(input.title ?? row.title)
    if (nextTitle) {
      const titleCheck = assertValueSupportedByEvidence({
        value: nextTitle,
        evidence_corpus: corpus,
        field_label: "title",
      })
      if (!titleCheck.ok) {
        return {
          ok: false,
          review_id: null,
          company_contact_id,
          fields_changed: [],
          previous_values,
          new_values: {},
          phone_discovery: null,
          error: titleCheck.message,
        }
      }
      if (nextTitle !== row.title) {
        patch.title = nextTitle
        fields_changed.push("title")
      }
    }
  }

  if (actions.includes("mark_contact_verified") && row.contact_status !== "verified") {
    patch.contact_status = "verified"
    patch.last_verified_at = new Date().toISOString()
    fields_changed.push("contact_status", "last_verified_at")
  }

  if (actions.includes("mark_phone_verified") && row.phone?.trim() && row.phone_status !== "verified") {
    patch.phone_status = "verified"
    fields_changed.push("phone_status")
  }

  for (const channel of ["phone", "email", "linkedin_url"] as const) {
    if (!(channel in patch)) continue
    if (asString(patch[channel]) !== asString(row[channel])) {
      return {
        ok: false,
        review_id: null,
        company_contact_id,
        fields_changed: [],
        previous_values,
        new_values: {},
        phone_discovery: null,
        error: "Manual phone, email, or LinkedIn creation is not allowed.",
      }
    }
  }

  if (fields_changed.length === 0) {
    return {
      ok: false,
      review_id: null,
      company_contact_id,
      fields_changed: [],
      previous_values,
      new_values: {},
      phone_discovery: null,
      error: "No review changes to apply.",
    }
  }

  patch.updated_at = new Date().toISOString()
  patch.metadata = {
    ...metadata,
    human_identity_review_at: new Date().toISOString(),
    human_identity_review_by: input.reviewer_email ?? input.reviewer_user_id ?? null,
  }

  const { error: updateErr } = await admin
    .schema("growth")
    .from("company_contacts")
    .update(patch)
    .eq("id", company_contact_id)

  if (updateErr) {
    return {
      ok: false,
      review_id: null,
      company_contact_id,
      fields_changed: [],
      previous_values,
      new_values: {},
      phone_discovery: null,
      error: updateErr.message,
    }
  }

  const new_values: Record<string, unknown> = {
    full_name: patch.full_name ?? row.full_name,
    title: patch.title ?? row.title,
    contact_status: patch.contact_status ?? row.contact_status,
    phone_status: patch.phone_status ?? row.phone_status,
    phone: row.phone,
    email: row.email,
    linkedin_url: row.linkedin_url,
  }

  const person_id = asString(row.canonical_person_id)
  if (person_id && typeof patch.full_name === "string") {
    const normalized_name = canonicalNormalizedPersonName(patch.full_name)
    await admin
      .schema("growth")
      .from("persons")
      .update({
        full_name: patch.full_name,
        first_name: patch.first_name ?? null,
        last_name: patch.last_name ?? null,
        normalized_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person_id)
  }

  const evidenceCheck = contactHasReviewableEvidence({
    source_evidence,
    metadata,
    phone: asString(row.phone) || null,
    email: asString(row.email) || null,
  })

  let phone_discovery: HumanIdentityEvidenceReviewResult["phone_discovery"] = null
  let phone_discovery_run_id: string | null = null
  let phone_promoted_count = 0
  let triggered_phone_discovery = false

  const company_id = asString(row.canonical_company_id) || asString(row.company_id)
  if (input.rerun_phone_discovery !== false && person_id && company_id) {
    triggered_phone_discovery = true
    const result = await runPhoneDiscoveryForCanonicalPerson(admin, {
      company_id,
      person_id,
      promote: true,
      created_by: input.reviewer_user_id ?? null,
    })
    phone_discovery_run_id = result.run_id
    phone_promoted_count = result.promoted_count
    phone_discovery = {
      run_id: result.run_id,
      verified_count: result.verified_count,
      promoted_count: result.promoted_count,
    }
  }

  const { data: auditRow, error: auditErr } = await admin
    .schema("growth")
    .from("company_contact_identity_reviews")
    .insert({
      company_contact_id,
      company_id: asString(row.company_id),
      canonical_person_id: person_id || null,
      reviewer_user_id: input.reviewer_user_id ?? null,
      reviewer_email: input.reviewer_email ?? null,
      source_url: evidenceCheck.ok ? evidenceCheck.source_url : null,
      evidence_snapshot: source_evidence,
      fields_changed: [...new Set(fields_changed)],
      previous_values,
      new_values,
      actions,
      review_note: input.review_note?.trim() || null,
      triggered_phone_discovery,
      phone_discovery_run_id,
      phone_promoted_count,
      metadata: { qa_marker: "growth-human-identity-evidence-7-ps-hk-v1" },
    })
    .select("id")
    .single()

  if (auditErr) {
    return {
      ok: false,
      review_id: null,
      company_contact_id,
      fields_changed,
      previous_values,
      new_values,
      phone_discovery,
      error: `Review applied but audit insert failed: ${auditErr.message}`,
    }
  }

  const contactCandidateId =
    asString(row.contact_candidate_id) ||
    asString(metadata.contact_candidate_id) ||
    asString(
      metadata.metadata && typeof metadata.metadata === "object"
        ? (metadata.metadata as Record<string, unknown>).contact_candidate_id
        : null,
    )
  if (contactCandidateId) {
    const { data: candidateRow } = await admin
      .schema("growth")
      .from("contact_candidates")
      .select("company_candidate_id")
      .eq("id", contactCandidateId)
      .maybeSingle()
    const companyCandidateId = asString(candidateRow?.company_candidate_id)
    if (companyCandidateId) {
      await ensureStagingCanonicalCompanyLinkage(admin, companyCandidateId, {
        explicit_canonical_company_id: company_id || null,
      })
    }
  }

  return {
    ok: true,
    review_id: asString(auditRow?.id) || null,
    company_contact_id,
    fields_changed: [...new Set(fields_changed)],
    previous_values,
    new_values,
    phone_discovery,
  }
}
