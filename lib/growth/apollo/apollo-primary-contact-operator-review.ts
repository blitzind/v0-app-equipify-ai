/** Apollo-Primary-2 operator review orchestration — server-only, no enrollment/outreach. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildApolloOperatorReviewMetadataPatch,
  buildApolloPrimaryContactOperatorReviewSnapshot,
  isApolloBackedCompanyContactRow,
  mergeApolloOperatorReviewRows,
} from "@/lib/growth/apollo/apollo-primary-contact-operator-review-evidence"
import {
  APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER,
  type ApolloPrimaryContactOperatorReviewActionResult,
  type ApolloPrimaryContactOperatorReviewEvidence,
  type ApolloPrimaryContactOperatorReviewSnapshot,
} from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"
import { resolveApolloEnrichmentCanonicalCompanyId } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution"
import { loadStagingCompanyCandidateRow } from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export {
  APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER,
  type ApolloPrimaryContactOperatorReviewSnapshot,
  type ApolloPrimaryContactOperatorReviewActionResult,
  type ApolloPrimaryContactOperatorReviewEvidence,
} from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"

export {
  buildApolloPrimaryContactOperatorReviewSnapshot,
  mergeApolloOperatorReviewRows,
} from "@/lib/growth/apollo/apollo-primary-contact-operator-review-evidence"

const REVIEWS_TABLE = "apollo_primary_contact_operator_reviews"

async function loadCompanyContext(
  admin: SupabaseClient,
  companyCandidateId: string,
): Promise<{
  company_candidate_id: string
  company_name: string
  domain: string | null
  canonical_company_id: string | null
} | null> {
  const staging = await loadStagingCompanyCandidateRow(admin, companyCandidateId)
  if (!staging) return null

  const row = staging.row
  const domain = canonicalNormalizedDomain(asString(row.domain), asString(row.website))
  const resolution = await resolveApolloEnrichmentCanonicalCompanyId(admin, {
    company_candidate_id: companyCandidateId,
    domain,
  })

  return {
    company_candidate_id: asString(row.company_id) || companyCandidateId,
    company_name: asString(row.company_name) || companyCandidateId,
    domain,
    canonical_company_id: resolution.canonical_company_id,
  }
}

async function loadApolloReviewSourceRows(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    canonical_company_id: string | null
  },
): Promise<{
  company_contacts: Record<string, unknown>[]
  contact_candidates: Record<string, unknown>[]
}> {
  const { data: candidates } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("*")
    .eq("company_candidate_id", input.company_candidate_id)
    .eq("provider_type", "future_apollo")
    .limit(100)

  const contact_candidates = (candidates ?? []) as Record<string, unknown>[]
  const apolloCandidateIds = new Set(
    contact_candidates.map((row) => asString(row.id)).filter(Boolean),
  )

  const companyContactById = new Map<string, Record<string, unknown>>()
  const addCompanyContacts = (rows: Record<string, unknown>[] | null | undefined) => {
    for (const row of rows ?? []) {
      const id = asString(row.id)
      if (!id || companyContactById.has(id)) continue
      if (!isApolloBackedCompanyContactRow(row, apolloCandidateIds)) continue
      companyContactById.set(id, row)
    }
  }

  if (input.canonical_company_id) {
    const { data } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("*")
      .eq("company_id", input.canonical_company_id)
      .neq("contact_status", "archived")
      .limit(100)
    addCompanyContacts((data ?? []) as Record<string, unknown>[])
  }

  if (apolloCandidateIds.size > 0) {
    const { data } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("*")
      .in("contact_candidate_id", [...apolloCandidateIds])
      .neq("contact_status", "archived")
      .limit(100)
    addCompanyContacts((data ?? []) as Record<string, unknown>[])
  }

  return {
    company_contacts: [...companyContactById.values()],
    contact_candidates,
  }
}

async function resolvePromotedCompanyContactId(
  admin: SupabaseClient,
  input: {
    company_contact_id?: string | null
    contact_candidate_id?: string | null
  },
): Promise<string | null> {
  const companyContactId = asString(input.company_contact_id)
  if (companyContactId) return companyContactId

  const candidateId = asString(input.contact_candidate_id)
  if (!candidateId) return null

  const { data } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id")
    .eq("contact_candidate_id", candidateId)
    .neq("contact_status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return asString(data?.id) || null
}

export async function loadApolloPrimaryContactOperatorReviewSnapshot(
  admin: SupabaseClient,
  companyCandidateId: string,
): Promise<ApolloPrimaryContactOperatorReviewSnapshot | null> {
  const context = await loadCompanyContext(admin, companyCandidateId)
  if (!context) return null

  const sources = await loadApolloReviewSourceRows(admin, {
    company_candidate_id: context.company_candidate_id,
    canonical_company_id: context.canonical_company_id,
  })

  return buildApolloPrimaryContactOperatorReviewSnapshot({
    company_candidate_id: context.company_candidate_id,
    company_name: context.company_name,
    canonical_company_id: context.canonical_company_id,
    company_contacts: sources.company_contacts,
    contact_candidates: sources.contact_candidates,
  })
}

async function loadCompanyContactById(
  admin: SupabaseClient,
  contactId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("*")
    .eq("id", contactId)
    .maybeSingle()
  return (data as Record<string, unknown> | null) ?? null
}

async function loadContactCandidateById(
  admin: SupabaseClient,
  candidateId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle()
  return (data as Record<string, unknown> | null) ?? null
}

function mergeMetadata(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const reviewPatch =
    patch.apollo_operator_review && typeof patch.apollo_operator_review === "object"
      ? (patch.apollo_operator_review as Record<string, unknown>)
      : {}
  const existingReview =
    existing.apollo_operator_review && typeof existing.apollo_operator_review === "object"
      ? (existing.apollo_operator_review as Record<string, unknown>)
      : {}

  return {
    ...existing,
    ...patch,
    apollo_operator_review: {
      ...existingReview,
      ...reviewPatch,
    },
  }
}

async function insertReviewEvidence(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    company_contact_id: string | null
    contact_candidate_id: string | null
    action: "approve" | "reject" | "bulk_approve"
    operator_review_status: "approved" | "rejected"
    reviewer_user_id: string | null
    reviewer_email: string | null
    contact_snapshot: Record<string, unknown>
    sequence_ready_at_action: boolean
    blockers_at_action: string[]
    note?: string | null
  },
): Promise<ApolloPrimaryContactOperatorReviewEvidence> {
  const { data, error } = await admin
    .schema("growth")
    .from(REVIEWS_TABLE)
    .insert({
      company_candidate_id: input.company_candidate_id,
      company_contact_id: input.company_contact_id,
      contact_candidate_id: input.contact_candidate_id,
      action: input.action,
      operator_review_status: input.operator_review_status,
      reviewer_user_id: input.reviewer_user_id,
      reviewer_email: input.reviewer_email,
      contact_snapshot: input.contact_snapshot,
      sequence_ready_at_action: input.sequence_ready_at_action,
      blockers_at_action: input.blockers_at_action,
      note: input.note?.trim() || null,
      auto_enrollment_attempted: false,
      outreach_sent: false,
      metadata: { qa_marker: APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER },
    })
    .select("id, created_at")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Could not record operator review evidence.")
  }

  return {
    qa_marker: APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER,
    review_id: asString(data.id),
    action: input.action,
    company_candidate_id: input.company_candidate_id,
    company_contact_id: input.company_contact_id,
    contact_candidate_id: input.contact_candidate_id,
    operator_review_status: input.operator_review_status,
    reviewer_user_id: input.reviewer_user_id,
    reviewer_email: input.reviewer_email,
    sequence_ready_at_action: input.sequence_ready_at_action,
    blockers_at_action: input.blockers_at_action,
    note: input.note?.trim() || null,
    auto_enrollment: false,
    outreach_sent: false,
    recorded_at: asString(data.created_at) || new Date().toISOString(),
  }
}

async function applyOperatorReviewToContact(
  admin: SupabaseClient,
  input: {
    company_contact_id: string
    status: "approved" | "rejected"
    reviewed_at: string
    reviewed_by: string | null
    note?: string | null
    outreach_ready?: boolean
  },
): Promise<Record<string, unknown> | null> {
  const row = await loadCompanyContactById(admin, input.company_contact_id)
  if (!row) return null

  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
  const patch = buildApolloOperatorReviewMetadataPatch({
    status: input.status,
    reviewed_at: input.reviewed_at,
    reviewed_by: input.reviewed_by,
    note: input.note,
    outreach_ready: input.outreach_ready,
  })

  const update: Record<string, unknown> = {
    metadata: mergeMetadata(metadata, patch),
    updated_at: input.reviewed_at,
  }
  if (input.status === "rejected") {
    update.contact_status = "suppressed"
  }

  const { data, error } = await admin
    .schema("growth")
    .from("company_contacts")
    .update(update)
    .eq("id", input.company_contact_id)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return (data as Record<string, unknown> | null) ?? null
}

async function applyOperatorReviewToCandidate(
  admin: SupabaseClient,
  input: {
    contact_candidate_id: string
    status: "approved" | "rejected"
    reviewed_at: string
    reviewed_by: string | null
    note?: string | null
    outreach_ready?: boolean
  },
): Promise<Record<string, unknown> | null> {
  const row = await loadContactCandidateById(admin, input.contact_candidate_id)
  if (!row) return null

  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
  const patch = buildApolloOperatorReviewMetadataPatch({
    status: input.status,
    reviewed_at: input.reviewed_at,
    reviewed_by: input.reviewed_by,
    note: input.note,
    outreach_ready: input.outreach_ready,
  })

  const update: Record<string, unknown> = {
    metadata: mergeMetadata(metadata, patch),
    updated_at: input.reviewed_at,
  }
  if (input.status === "rejected") {
    update.verification_state = "rejected"
  }

  const { data, error } = await admin
    .schema("growth")
    .from("contact_candidates")
    .update(update)
    .eq("id", input.contact_candidate_id)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return (data as Record<string, unknown> | null) ?? null
}

function resolveReviewTarget(input: {
  company_contact_id?: string | null
  contact_candidate_id?: string | null
}): { company_contact_id: string | null; contact_candidate_id: string | null } {
  return {
    company_contact_id: asString(input.company_contact_id) || null,
    contact_candidate_id: asString(input.contact_candidate_id) || null,
  }
}

export async function approveApolloPrimaryContactForOutreach(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    company_contact_id?: string | null
    contact_candidate_id?: string | null
    note?: string | null
    reviewer_user_id?: string | null
    reviewer_email?: string | null
  },
): Promise<ApolloPrimaryContactOperatorReviewActionResult & { evidence: ApolloPrimaryContactOperatorReviewEvidence | null }> {
  const context = await loadCompanyContext(admin, input.company_candidate_id)
  if (!context) {
    return {
      ok: false,
      action: "approve",
      review_id: null,
      contact_id: null,
      contact_ids: [],
      operator_review_status: null,
      error: "company_candidate_not_found",
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
      evidence: null,
    }
  }

  const target = resolveReviewTarget(input)
  target.company_contact_id = await resolvePromotedCompanyContactId(admin, target)
  const reviewed_at = new Date().toISOString()
  const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, input.company_candidate_id)
  const reviewRow = snapshot?.contacts.find((row) => {
    if (target.company_contact_id && row.company_contact_id === target.company_contact_id) return true
    if (target.contact_candidate_id && row.contact_candidate_id === target.contact_candidate_id) return true
    return false
  })

  if (!reviewRow) {
    return {
      ok: false,
      action: "approve",
      review_id: null,
      contact_id: target.company_contact_id ?? target.contact_candidate_id,
      contact_ids: [],
      operator_review_status: null,
      error: "contact_not_found",
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
      evidence: null,
    }
  }

  if (!target.company_contact_id) {
    return {
      ok: false,
      action: "approve",
      review_id: null,
      contact_id: target.contact_candidate_id,
      contact_ids: [],
      operator_review_status: null,
      error: "promoted_company_contact_required",
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
      evidence: null,
    }
  }

  await applyOperatorReviewToContact(admin, {
    company_contact_id: target.company_contact_id,
    status: "approved",
    reviewed_at,
    reviewed_by: input.reviewer_user_id ?? null,
    note: input.note,
    outreach_ready: true,
  })

  const evidence = await insertReviewEvidence(admin, {
    company_candidate_id: context.company_candidate_id,
    company_contact_id: target.company_contact_id,
    contact_candidate_id: reviewRow.contact_candidate_id ?? target.contact_candidate_id,
    action: "approve",
    operator_review_status: "approved",
    reviewer_user_id: input.reviewer_user_id ?? null,
    reviewer_email: input.reviewer_email ?? null,
    contact_snapshot: reviewRow as unknown as Record<string, unknown>,
    sequence_ready_at_action: reviewRow.sequence_ready,
    blockers_at_action: reviewRow.blockers,
    note: input.note,
  })

  return {
    ok: true,
    action: "approve",
    review_id: evidence.review_id,
    contact_id: target.company_contact_id ?? target.contact_candidate_id,
    contact_ids: [target.company_contact_id ?? target.contact_candidate_id].filter(Boolean) as string[],
    operator_review_status: "approved",
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
    evidence,
  }
}

export async function rejectApolloPrimaryContact(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    company_contact_id?: string | null
    contact_candidate_id?: string | null
    note?: string | null
    reviewer_user_id?: string | null
    reviewer_email?: string | null
  },
): Promise<ApolloPrimaryContactOperatorReviewActionResult & { evidence: ApolloPrimaryContactOperatorReviewEvidence | null }> {
  const context = await loadCompanyContext(admin, input.company_candidate_id)
  if (!context) {
    return {
      ok: false,
      action: "reject",
      review_id: null,
      contact_id: null,
      contact_ids: [],
      operator_review_status: null,
      error: "company_candidate_not_found",
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
      evidence: null,
    }
  }

  const target = resolveReviewTarget(input)
  const reviewed_at = new Date().toISOString()
  const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, input.company_candidate_id)
  const reviewRow = snapshot?.contacts.find((row) => {
    if (target.company_contact_id && row.company_contact_id === target.company_contact_id) return true
    if (target.contact_candidate_id && row.contact_candidate_id === target.contact_candidate_id) return true
    return false
  })

  if (!reviewRow) {
    return {
      ok: false,
      action: "reject",
      review_id: null,
      contact_id: target.company_contact_id ?? target.contact_candidate_id,
      contact_ids: [],
      operator_review_status: null,
      error: "contact_not_found",
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
      evidence: null,
    }
  }

  if (target.company_contact_id) {
    await applyOperatorReviewToContact(admin, {
      company_contact_id: target.company_contact_id,
      status: "rejected",
      reviewed_at,
      reviewed_by: input.reviewer_user_id ?? null,
      note: input.note,
      outreach_ready: false,
    })
  } else if (target.contact_candidate_id) {
    await applyOperatorReviewToCandidate(admin, {
      contact_candidate_id: target.contact_candidate_id,
      status: "rejected",
      reviewed_at,
      reviewed_by: input.reviewer_user_id ?? null,
      note: input.note,
      outreach_ready: false,
    })
  }

  const evidence = await insertReviewEvidence(admin, {
    company_candidate_id: context.company_candidate_id,
    company_contact_id: target.company_contact_id,
    contact_candidate_id: target.contact_candidate_id,
    action: "reject",
    operator_review_status: "rejected",
    reviewer_user_id: input.reviewer_user_id ?? null,
    reviewer_email: input.reviewer_email ?? null,
    contact_snapshot: reviewRow as unknown as Record<string, unknown>,
    sequence_ready_at_action: reviewRow.sequence_ready,
    blockers_at_action: reviewRow.blockers,
    note: input.note,
  })

  return {
    ok: true,
    action: "reject",
    review_id: evidence.review_id,
    contact_id: target.company_contact_id ?? target.contact_candidate_id,
    contact_ids: [target.company_contact_id ?? target.contact_candidate_id].filter(Boolean) as string[],
    operator_review_status: "rejected",
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
    evidence,
  }
}

export async function bulkApproveSequenceReadyApolloContacts(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    note?: string | null
    reviewer_user_id?: string | null
    reviewer_email?: string | null
  },
): Promise<ApolloPrimaryContactOperatorReviewActionResult & { evidence_ids: string[] }> {
  const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, input.company_candidate_id)
  if (!snapshot) {
    return {
      ok: false,
      action: "bulk_approve",
      review_id: null,
      contact_id: null,
      contact_ids: [],
      operator_review_status: null,
      error: "company_candidate_not_found",
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
      evidence_ids: [],
    }
  }

  const targets = snapshot.contacts.filter(
    (row) => row.sequence_ready && row.operator_review_status === "pending",
  )

  const evidence_ids: string[] = []
  const contact_ids: string[] = []

  for (const row of targets) {
    const result = await approveApolloPrimaryContactForOutreach(admin, {
      company_candidate_id: input.company_candidate_id,
      company_contact_id: row.company_contact_id,
      contact_candidate_id: row.contact_candidate_id,
      note: input.note,
      reviewer_user_id: input.reviewer_user_id,
      reviewer_email: input.reviewer_email,
    })
    if (result.ok && result.review_id) {
      evidence_ids.push(result.review_id)
      if (result.contact_id) contact_ids.push(result.contact_id)
    }
  }

  return {
    ok: true,
    action: "bulk_approve",
    review_id: evidence_ids[0] ?? null,
    contact_id: contact_ids[0] ?? null,
    contact_ids,
    operator_review_status: "approved",
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
    evidence_ids,
  }
}
