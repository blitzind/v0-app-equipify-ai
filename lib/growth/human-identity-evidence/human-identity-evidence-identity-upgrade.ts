import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canonicalNormalizedPersonName } from "@/lib/growth/canonical-persons/canonical-person-normalize"
import {
  assertValueSupportedByEvidence,
  isGenericIdentityName,
} from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import {
  buildIdentityEvidenceCorpus,
  extractEvidenceBackedIdentity,
} from "@/lib/growth/human-identity-evidence/human-identity-evidence-naming-extract"

export const GROWTH_HUMAN_IDENTITY_NAMING_UPGRADE_QA_MARKER =
  "growth-human-identity-naming-upgrade-7-ps-hn-v1" as const

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function splitName(full_name: string): { first_name: string | null; last_name: string | null } {
  const parts = full_name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: null, last_name: null }
  if (parts.length === 1) return { first_name: parts[0]!, last_name: null }
  return { first_name: parts[0]!, last_name: parts.slice(1).join(" ") }
}

export type HumanIdentityNamingUpgradeResult = {
  company_contact_id: string
  upgraded: boolean
  skipped: boolean
  reason: string | null
  previous_full_name: string
  new_full_name: string | null
  method: string | null
  review_id: string | null
}

async function findNamedPersonReconciliationTarget(
  admin: SupabaseClient,
  input: {
    company_id: string
    phone: string | null
    email: string | null
    exclude_person_id: string | null
  },
): Promise<{ person_id: string; full_name: string } | null> {
  if (!input.company_id) return null

  let query = admin
    .schema("growth")
    .from("person_company_roles")
    .select("person_id, persons!inner(id, full_name, normalized_name)")
    .eq("company_id", input.company_id)

  if (input.exclude_person_id) {
    query = query.neq("person_id", input.exclude_person_id)
  }

  const { data } = await query.limit(20)
  for (const row of data ?? []) {
    const person = row.persons as { id?: string; full_name?: string; normalized_name?: string } | null
    const full_name = asString(person?.full_name)
    const person_id = asString(person?.id)
    if (!person_id || isGenericIdentityName(full_name)) continue

    const { data: phones } = await admin
      .schema("growth")
      .from("person_phones")
      .select("phone")
      .eq("person_id", person_id)
      .limit(5)
    const { data: emails } = await admin
      .schema("growth")
      .from("person_emails")
      .select("email")
      .eq("person_id", person_id)
      .limit(5)

    const phoneMatch =
      input.phone &&
      (phones ?? []).some((p) => asString(p.phone) === input.phone || input.phone!.includes(asString(p.phone)))
    const emailMatch =
      input.email &&
      (emails ?? []).some((e) => asString(e.email).toLowerCase() === input.email!.toLowerCase())

    if (phoneMatch || emailMatch) {
      return { person_id, full_name }
    }
  }
  return null
}

export async function upgradeGenericIdentityFromEvidence(
  admin: SupabaseClient,
  input: {
    company_contact_id: string
    reviewer_email?: string | null
    dry_run?: boolean
  },
): Promise<HumanIdentityNamingUpgradeResult> {
  const company_contact_id = asString(input.company_contact_id)
  const base: HumanIdentityNamingUpgradeResult = {
    company_contact_id,
    upgraded: false,
    skipped: true,
    reason: null,
    previous_full_name: "",
    new_full_name: null,
    method: null,
    review_id: null,
  }

  const { data: row, error } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("*")
    .eq("id", company_contact_id)
    .maybeSingle()

  if (error || !row) {
    return { ...base, reason: error?.message ?? "Contact not found." }
  }

  base.previous_full_name = asString(row.full_name)
  if (!isGenericIdentityName(row.full_name)) {
    return { ...base, reason: "Identity is not generic — no upgrade needed." }
  }

  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
  const source_evidence = Array.isArray(row.source_evidence) ? row.source_evidence : []

  const reconcileTarget = await findNamedPersonReconciliationTarget(admin, {
    company_id: asString(row.company_id),
    phone: asString(row.phone) || null,
    email: asString(row.email) || null,
    exclude_person_id: asString(row.canonical_person_id) || null,
  })

  if (reconcileTarget) {
    if (input.dry_run) {
      return {
        ...base,
        skipped: false,
        new_full_name: reconcileTarget.full_name,
        method: "person_reconciliation",
        reason: "Would reconcile to existing named canonical person.",
      }
    }

    const previous_person_id = asString(row.canonical_person_id)
    await admin
      .schema("growth")
      .from("company_contacts")
      .update({
        canonical_person_id: reconcileTarget.person_id,
        full_name: reconcileTarget.full_name,
        updated_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          identity_reconciled_at: new Date().toISOString(),
          identity_reconciled_from_person_id: previous_person_id || null,
          identity_reconciled_to_person_id: reconcileTarget.person_id,
        },
      })
      .eq("id", company_contact_id)

    const { data: auditRow } = await admin
      .schema("growth")
      .from("company_contact_identity_reviews")
      .insert({
        company_contact_id,
        company_id: asString(row.company_id),
        canonical_person_id: reconcileTarget.person_id,
        reviewer_email: input.reviewer_email ?? "system-7-ps-hn@equipify.internal",
        source_url: asString(metadata.source_page_url) || null,
        evidence_snapshot: source_evidence,
        fields_changed: ["canonical_person_id", "full_name"],
        previous_values: {
          full_name: row.full_name,
          canonical_person_id: previous_person_id,
        },
        new_values: {
          full_name: reconcileTarget.full_name,
          canonical_person_id: reconcileTarget.person_id,
        },
        actions: ["identity_reconciliation"],
        review_note: "7.PS-HN — reconciled generic shell to evidence-backed named person",
        metadata: { qa_marker: GROWTH_HUMAN_IDENTITY_NAMING_UPGRADE_QA_MARKER },
      })
      .select("id")
      .maybeSingle()

    return {
      ...base,
      upgraded: true,
      skipped: false,
      new_full_name: reconcileTarget.full_name,
      method: "person_reconciliation",
      review_id: asString(auditRow?.id) || null,
    }
  }

  const candidate = extractEvidenceBackedIdentity({
    full_name: row.full_name,
    title: row.title,
    email: row.email,
    source_evidence,
    metadata,
  })

  if (!candidate) {
    return { ...base, reason: "No evidence-backed name or title found — upgrade refused." }
  }

  const corpus = buildIdentityEvidenceCorpus({
    source_evidence,
    metadata,
    email: asString(row.email) || null,
    phone: asString(row.phone) || null,
    linkedin_url: asString(row.linkedin_url) || null,
  })

  const nameCheck = assertValueSupportedByEvidence({
    value: candidate.full_name,
    evidence_corpus: corpus,
    field_label: "full_name",
  })
  if (!nameCheck.ok) {
    return { ...base, reason: nameCheck.message }
  }

  if (input.dry_run) {
    return {
      ...base,
      skipped: false,
      new_full_name: candidate.full_name,
      method: candidate.method,
      reason: "Dry run — would upgrade identity from evidence.",
    }
  }

  const { first_name, last_name } = splitName(candidate.full_name)
  const nextTitle = candidate.title ?? row.title
  const patch: Record<string, unknown> = {
    full_name: candidate.full_name,
    first_name,
    last_name,
    updated_at: new Date().toISOString(),
    metadata: {
      ...metadata,
      identity_naming_upgrade_at: new Date().toISOString(),
      identity_naming_upgrade_method: candidate.method,
      identity_naming_evidence_ref: candidate.evidence_ref,
    },
  }
  if (nextTitle && nextTitle !== row.title) {
    patch.title = nextTitle
  }

  await admin.schema("growth").from("company_contacts").update(patch).eq("id", company_contact_id)

  const person_id = asString(row.canonical_person_id)
  if (person_id) {
    await admin
      .schema("growth")
      .from("persons")
      .update({
        full_name: candidate.full_name,
        first_name,
        last_name,
        normalized_name: canonicalNormalizedPersonName(candidate.full_name),
        updated_at: new Date().toISOString(),
      })
      .eq("id", person_id)
  }

  const contactCandidateId = asString(row.contact_candidate_id) || asString(metadata.contact_candidate_id)
  if (contactCandidateId) {
    await admin
      .schema("growth")
      .from("contact_candidates")
      .update({
        full_name: candidate.full_name,
        first_name,
        last_name,
        job_title: nextTitle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactCandidateId)
  }

  const fields_changed = ["full_name", "first_name", "last_name"]
  if (nextTitle && nextTitle !== row.title) fields_changed.push("title")

  const { data: auditRow } = await admin
    .schema("growth")
    .from("company_contact_identity_reviews")
    .insert({
      company_contact_id,
      company_id: asString(row.company_id),
      canonical_person_id: person_id || null,
      reviewer_email: input.reviewer_email ?? "system-7-ps-hn@equipify.internal",
      source_url: asString(metadata.source_page_url) || null,
      evidence_snapshot: source_evidence,
      fields_changed,
      previous_values: {
        full_name: row.full_name,
        title: row.title,
      },
      new_values: {
        full_name: candidate.full_name,
        title: nextTitle,
      },
      actions: ["update_name_from_evidence"],
      review_note: `7.PS-HN — evidence-backed naming (${candidate.method})`,
      metadata: {
        qa_marker: GROWTH_HUMAN_IDENTITY_NAMING_UPGRADE_QA_MARKER,
        evidence_ref: candidate.evidence_ref,
      },
    })
    .select("id")
    .maybeSingle()

  return {
    ...base,
    upgraded: true,
    skipped: false,
    new_full_name: candidate.full_name,
    method: candidate.method,
    review_id: asString(auditRow?.id) || null,
  }
}

export async function upgradeGenericIdentitiesBatch(
  admin: SupabaseClient,
  input?: {
    company_ids?: string[]
    limit?: number
    dry_run?: boolean
  },
): Promise<HumanIdentityNamingUpgradeResult[]> {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200)
  let query = admin
    .schema("growth")
    .from("company_contacts")
    .select("id, full_name, company_id")
    .not("canonical_person_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit * 3)

  if (input?.company_ids?.length) {
    query = query.in("company_id", input.company_ids)
  }

  const { data } = await query
  const targets = (data ?? []).filter((row) => isGenericIdentityName(asString(row.full_name))).slice(0, limit)

  const results: HumanIdentityNamingUpgradeResult[] = []
  for (const row of targets) {
    results.push(
      await upgradeGenericIdentityFromEvidence(admin, {
        company_contact_id: asString(row.id),
        dry_run: input?.dry_run,
      }),
    )
  }
  return results
}
