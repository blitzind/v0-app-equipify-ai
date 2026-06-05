/** Phase 7.PS-IM — Find generic contacts with personal email local parts. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import {
  isRoleOrGenericInboxEmail,
  emailLocalPartSupportsPersonName,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-selection"
import type {
  DensityScaleUpRejectedRow,
  DensityScaleUpUpgradeCandidateRow,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-types"

const COMPANY_FRAGMENT_LOCAL =
  /\b(medical|biomedical|technologies|technology|technicians|services|service|equipment|supply|solutions|vanguard|repair|biomed)\b/i

const PERSONAL_LOCAL_PART = /^[a-z][a-z0-9]{2,14}$/
const PERSONAL_DOTTED_LOCAL_PART = /^[a-z][a-z0-9]{1,12}\.[a-z][a-z0-9]{1,14}$/

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function hasContactEvidence(record: Record<string, unknown>, metadata: Record<string, unknown>): boolean {
  const source_evidence = record.source_evidence
  if (Array.isArray(source_evidence) && source_evidence.length > 0) return true
  if (asString(metadata.source_page_url)) return true
  const source_type = asString(record.source_type).toLowerCase()
  return /contact|about|team|page|website/.test(source_type)
}

function localPartLooksPersonal(email: string): boolean {
  const local = email.split("@")[0]?.trim().toLowerCase() ?? ""
  if (!local || isRoleOrGenericInboxEmail(email)) return false
  if (!PERSONAL_LOCAL_PART.test(local) && !PERSONAL_DOTTED_LOCAL_PART.test(local)) return false
  if (COMPANY_FRAGMENT_LOCAL.test(local) && local.length >= 8) return false
  return true
}

function inferredNameFromLocalPart(email: string): string {
  const local = email.split("@")[0]?.trim().toLowerCase() ?? ""
  if (!local) return ""
  if (local.includes(".")) {
    const first = local.split(".")[0] ?? ""
    return first ? first.charAt(0).toUpperCase() + first.slice(1) : ""
  }
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export async function findGenericPersonalEmailUpgradeCandidates(
  admin: SupabaseClient,
  input: {
    company_ids: string[]
    benchmark_company_ids: string[]
    contact_limit?: number
  },
): Promise<{
  candidates: DensityScaleUpUpgradeCandidateRow[]
  rejected: DensityScaleUpRejectedRow[]
}> {
  const benchmarkSet = new Set(input.benchmark_company_ids)
  const rejected: DensityScaleUpRejectedRow[] = []
  const candidates: DensityScaleUpUpgradeCandidateRow[] = []
  const seenEmail = new Set<string>()

  if (input.company_ids.length === 0) {
    return { candidates, rejected }
  }

  const contact_limit = input.contact_limit ?? 800
  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "id, company_id, full_name, email, source_type, metadata, source_evidence",
    )
    .in("company_id", input.company_ids)
    .neq("contact_status", "archived")
    .not("email", "is", null)
    .limit(contact_limit)

  const companyIds = [...new Set((contacts ?? []).map((row) => asString((row as Record<string, unknown>).company_id)).filter(Boolean))]
  const companyNameById = new Map<string, string>()
  if (companyIds.length > 0) {
    const { data: companies } = await admin
      .schema("growth")
      .from("companies")
      .select("id, display_name")
      .in("id", companyIds)
    for (const row of companies ?? []) {
      companyNameById.set(
        asString((row as Record<string, unknown>).id),
        asString((row as Record<string, unknown>).display_name),
      )
    }
  }

  for (const row of contacts ?? []) {
    const record = row as Record<string, unknown>
    const company_contact_id = asString(record.id)
    const company_id = asString(record.company_id)
    const full_name = asString(record.full_name)
    const email = asString(record.email).toLowerCase()
    const metadata =
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : {}

    const reject = (reason: string) => {
      rejected.push({ company_contact_id, company_id, full_name, email: email || null, rejection_reason: reason })
    }

    if (!email) {
      reject("missing_email")
      continue
    }

    if (!isGenericIdentityName(full_name)) {
      reject("not_generic_identity")
      continue
    }

    if (!hasContactEvidence(record, metadata)) {
      reject("missing_evidence")
      continue
    }

    if (!localPartLooksPersonal(email)) {
      reject("ineligible_personal_local_part")
      continue
    }

    const inferred_name = inferredNameFromLocalPart(email)
    const normalizedNameToken = inferred_name.replace(/\s+/g, "").toLowerCase()
    const local = email.split("@")[0]?.trim().toLowerCase() ?? ""
    if (
      normalizedNameToken === local &&
      (COMPANY_FRAGMENT_LOCAL.test(inferred_name) || local.length >= 10)
    ) {
      reject("company_local_part_identity")
      continue
    }

    if (!emailLocalPartSupportsPersonName(email, inferred_name)) {
      reject("email_local_part_does_not_support_name")
      continue
    }

    if (seenEmail.has(email)) {
      reject("duplicate_email")
      continue
    }
    seenEmail.add(email)

    candidates.push({
      company_contact_id,
      company_id,
      company_name: companyNameById.get(company_id) || company_id,
      full_name,
      email,
      source_type: asString(record.source_type),
      evidence_ref: asString(metadata.identity_naming_evidence_ref) || email,
      source_page_url: asString(metadata.source_page_url) || null,
      in_benchmark: benchmarkSet.has(company_id),
    })
  }

  return { candidates, rejected }
}
