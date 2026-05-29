import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { scanAcquisitionCompanyCandidateBatch } from "@/lib/growth/acquisition/acquisition-repository"
import type { GrowthBulkAcquisitionKeysetCursor } from "@/lib/growth/acquisition/acquisition-types"
import type { GrowthCompanyContact } from "@/lib/growth/contact-discovery/company-contact-types"
import { isEmailReadyForLeadPromotion } from "@/lib/growth/contact-verification/email-verification-types"
import { verifyCompanyContact } from "@/lib/growth/contact-verification/verify-contact"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function rowToCompanyContact(row: Record<string, unknown>): GrowthCompanyContact {
  return {
    id: asString(row.id),
    company_id: asString(row.company_id),
    growth_lead_id: asString(row.growth_lead_id) || null,
    contact_candidate_id: asString(row.contact_candidate_id) || null,
    lead_decision_maker_id: asString(row.lead_decision_maker_id) || null,
    full_name: asString(row.full_name),
    first_name: asString(row.first_name) || null,
    last_name: asString(row.last_name) || null,
    title: asString(row.title) || null,
    department: asString(row.department) || null,
    email: asString(row.email) || null,
    email_status: asString(row.email_status) as GrowthCompanyContact["email_status"],
    phone: asString(row.phone) || null,
    phone_status: asString(row.phone_status) as GrowthCompanyContact["phone_status"],
    linkedin_url: asString(row.linkedin_url) || null,
    confidence_score: typeof row.confidence_score === "number" ? row.confidence_score : Number(row.confidence_score ?? 0),
    decision_maker_score:
      typeof row.decision_maker_score === "number"
        ? row.decision_maker_score
        : Number(row.decision_maker_score ?? 0),
    source_type: asString(row.source_type) as GrowthCompanyContact["source_type"],
    source_evidence: Array.isArray(row.source_evidence)
      ? (row.source_evidence as GrowthCompanyContact["source_evidence"])
      : [],
    contact_status: asString(row.contact_status) as GrowthCompanyContact["contact_status"],
    last_verified_at: asString(row.last_verified_at) || null,
    dedupe_hash: asString(row.dedupe_hash),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    metadata:
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
  }
}

/** Provider-backed verification required before acquisition lead promotion. */
export async function verifyCompanyContactForAcquisition(
  admin: SupabaseClient,
  contactId: string,
): Promise<GrowthCompanyContact | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("*")
    .eq("id", contactId)
    .maybeSingle()
  if (error || !data) return null

  const contact = rowToCompanyContact(data as Record<string, unknown>)
  const verification = await verifyCompanyContact(contact, { admin })

  const { data: updated, error: updateError } = await admin
    .schema("growth")
    .from("company_contacts")
    .update({
      email_status: verification.email_status,
      phone_status: verification.phone_status,
      confidence_score: verification.confidence_score,
      last_verified_at: verification.last_verified_at,
      updated_at: new Date().toISOString(),
      metadata: {
        ...contact.metadata,
        ...verification.email_verification_metadata,
        verification_reasons: verification.verification_reasons,
        acquisition_verified: verification.email_verification
          ? isEmailReadyForLeadPromotion(verification.email_verification)
          : false,
      },
    })
    .eq("id", contactId)
    .select("*")
    .single()

  if (updateError || !updated) return null
  return rowToCompanyContact(updated as Record<string, unknown>)
}

async function listCompanyContactsForCompanyIds(
  admin: SupabaseClient,
  input: {
    company_ids: string[]
    mode: "pending_verification" | "ready_for_promotion"
    limit: number
  },
): Promise<GrowthCompanyContact[]> {
  if (input.company_ids.length === 0 || input.limit <= 0) return []

  if (input.mode === "pending_verification") {
    const { data } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("*")
      .in("company_id", input.company_ids)
      .is("growth_lead_id", null)
      .neq("contact_status", "archived")
      .neq("contact_status", "suppressed")
      .not("email", "is", null)
      .in("email_status", ["discovered", "unknown"])
      .order("updated_at", { ascending: true })
      .limit(input.limit)

    return (data ?? []).map((row) => rowToCompanyContact(row as Record<string, unknown>))
  }

  const { data } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("*")
    .in("company_id", input.company_ids)
    .eq("email_status", "verified")
    .is("growth_lead_id", null)
    .neq("contact_status", "archived")
    .neq("contact_status", "suppressed")
    .order("decision_maker_score", { ascending: false })
    .order("confidence_score", { ascending: false })
    .limit(input.limit)

  return (data ?? [])
    .map((row) => rowToCompanyContact(row as Record<string, unknown>))
    .filter((contact) => {
      const meta =
        contact.metadata.email_verification &&
        typeof contact.metadata.email_verification === "object"
          ? (contact.metadata.email_verification as Record<string, unknown>)
          : null
      return meta?.verified_by_provider === true
    })
}

async function scanCompanyContactsForAcquisitionRun(
  admin: SupabaseClient,
  input: {
    child_run_ids: string[]
    mode: "pending_verification" | "ready_for_promotion"
    limit?: number
    company_scan_cursor?: GrowthBulkAcquisitionKeysetCursor | null
  },
): Promise<{
  contacts: GrowthCompanyContact[]
  company_scan_cursor: GrowthBulkAcquisitionKeysetCursor | null
  exhausted: boolean
}> {
  const target = input.limit ?? 25
  const contacts: GrowthCompanyContact[] = []
  let cursor = input.company_scan_cursor ?? null
  let exhausted = false

  while (contacts.length < target) {
    const batch = await scanAcquisitionCompanyCandidateBatch(admin, {
      child_run_ids: input.child_run_ids,
      cursor,
    })
    cursor = batch.cursor
    exhausted = batch.exhausted

    if (batch.company_ids.length === 0) break

    const found = await listCompanyContactsForCompanyIds(admin, {
      company_ids: batch.company_ids,
      mode: input.mode,
      limit: target - contacts.length,
    })
    contacts.push(...found)

    if (batch.exhausted) break
  }

  return { contacts, company_scan_cursor: cursor, exhausted }
}

export async function listCompanyContactsPendingAcquisitionVerification(
  admin: SupabaseClient,
  input: {
    child_run_ids: string[]
    limit?: number
    company_scan_cursor?: GrowthBulkAcquisitionKeysetCursor | null
  },
): Promise<{
  contacts: GrowthCompanyContact[]
  company_scan_cursor: GrowthBulkAcquisitionKeysetCursor | null
  exhausted: boolean
}> {
  if (input.child_run_ids.length === 0) {
    return { contacts: [], company_scan_cursor: input.company_scan_cursor ?? null, exhausted: true }
  }

  return scanCompanyContactsForAcquisitionRun(admin, {
    child_run_ids: input.child_run_ids,
    mode: "pending_verification",
    limit: input.limit,
    company_scan_cursor: input.company_scan_cursor,
  })
}

export async function listVerifiedCompanyContactsReadyForPromotion(
  admin: SupabaseClient,
  input: {
    child_run_ids: string[]
    limit?: number
    company_scan_cursor?: GrowthBulkAcquisitionKeysetCursor | null
  },
): Promise<{
  contacts: GrowthCompanyContact[]
  company_scan_cursor: GrowthBulkAcquisitionKeysetCursor | null
  exhausted: boolean
}> {
  if (input.child_run_ids.length === 0) {
    return { contacts: [], company_scan_cursor: input.company_scan_cursor ?? null, exhausted: true }
  }

  return scanCompanyContactsForAcquisitionRun(admin, {
    child_run_ids: input.child_run_ids,
    mode: "ready_for_promotion",
    limit: input.limit,
    company_scan_cursor: input.company_scan_cursor,
  })
}
