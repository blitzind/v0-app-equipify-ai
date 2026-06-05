/** Phase 7.PS-IL — Benchmark cohort verified-email candidate selection. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isPlausiblePersonName } from "@/lib/growth/contact-discovery/extract/extract-shared"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"
import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import type {
  BenchmarkVerifiedEmailCandidateRow,
  BenchmarkVerifiedEmailRejectedRow,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-types"

const ROLE_LOCAL_PARTS = new Set([
  "info",
  "contact",
  "sales",
  "support",
  "hello",
  "admin",
  "office",
  "service",
  "dispatch",
  "billing",
  "hr",
  "careers",
  "help",
  "team",
  "noreply",
  "no-reply",
  "orders",
  "custserv",
  "cs",
  "customerservice",
  "asap",
])

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function isRoleOrGenericInboxEmail(email: string): boolean {
  const local = email.split("@")[0]?.trim().toLowerCase() ?? ""
  if (!local) return true
  if (ROLE_LOCAL_PARTS.has(local)) return true
  if (/^(info|contact|sales|support|service|admin|office|help|team|orders|custserv)/i.test(local)) {
    return true
  }
  return false
}

export function emailLocalPartSupportsPersonName(email: string, full_name: string): boolean {
  const local = email.split("@")[0]?.trim().toLowerCase() ?? ""
  const name = full_name.trim().toLowerCase()
  if (!local || !name) return false

  const nameParts = name.split(/\s+/).filter(Boolean)
  if (local.includes(".")) {
    const localParts = local.split(".").filter((part) => part.length >= 2)
    if (nameParts.length >= 2 && localParts.length >= 2) {
      return (
        localParts[0] === nameParts[0] &&
        localParts[localParts.length - 1] === nameParts[nameParts.length - 1]
      )
    }
  }

  if (nameParts.length === 1) {
    return local === nameParts[0] || local.startsWith(nameParts[0]!)
  }

  if (nameParts.length >= 2) {
    const first = nameParts[0]!
    const last = nameParts[nameParts.length - 1]!
    return local === first || local === `${first}.${last}` || local === `${first}${last}`
  }

  return false
}

const COMPANY_FRAGMENT_NAME_TOKENS =
  /\b(medical|biomedical|technologies|technology|technicians|services|service|equipment|supply|solutions|vanguard)\b/i

export function isBenchmarkEligiblePersonalName(full_name: string, email: string): boolean {
  const name = full_name.trim()
  const local = email.split("@")[0]?.trim().toLowerCase() ?? ""
  if (!name || !local) return false
  if (ROLE_LOCAL_PARTS.has(local)) return false
  if (ROLE_LOCAL_PARTS.has(name.toLowerCase())) return false
  if (COMPANY_FRAGMENT_NAME_TOKENS.test(name) && !isPlausiblePersonName(name)) return false
  if (isPlausiblePersonName(name)) return true
  if (emailLocalPartSupportsPersonName(email, name) && /^[A-Z][a-z]{2,}$/.test(name)) return true
  return false
}

function isPsIkNamingUpgrade(metadata: Record<string, unknown>): boolean {
  return (
    asString(metadata.identity_naming_upgrade_method) === "email_local_part" &&
    Boolean(asString(metadata.identity_naming_evidence_ref))
  )
}

export async function selectBenchmarkVerifiedEmailCandidates(
  admin: SupabaseClient,
): Promise<{
  cohort_company_count: number
  selected: BenchmarkVerifiedEmailCandidateRow[]
  rejected: BenchmarkVerifiedEmailRejectedRow[]
}> {
  const cohort = await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)
  if (!cohort || cohort.company_ids.length === 0) {
    return { cohort_company_count: 0, selected: [], rejected: [] }
  }

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "id, company_id, canonical_person_id, full_name, title, email, phone, linkedin_url, source_type, metadata, source_evidence",
    )
    .in("company_id", cohort.company_ids)
    .neq("contact_status", "archived")

  const { data: companies } = await admin
    .schema("growth")
    .from("companies")
    .select("id, display_name")
    .in("id", cohort.company_ids)

  const companyNameById = new Map(
    (companies ?? []).map((row) => [
      asString((row as Record<string, unknown>).id),
      asString((row as Record<string, unknown>).display_name),
    ]),
  )

  const personIds = [
    ...new Set(
      (contacts ?? [])
        .map((row) => asString((row as Record<string, unknown>).canonical_person_id))
        .filter(Boolean),
    ),
  ]

  const verifiedEmailByPerson = new Map<string, Set<string>>()
  if (personIds.length > 0) {
    const { data: verifiedRows } = await admin
      .schema("growth")
      .from("person_emails")
      .select("person_id, email")
      .in("person_id", personIds)
      .eq("verification_status", "verified")

    for (const row of verifiedRows ?? []) {
      const person_id = asString((row as Record<string, unknown>).person_id)
      const email = asString((row as Record<string, unknown>).email).toLowerCase()
      if (!person_id || !email) continue
      if (!verifiedEmailByPerson.has(person_id)) verifiedEmailByPerson.set(person_id, new Set())
      verifiedEmailByPerson.get(person_id)!.add(email)
    }
  }

  const selectedByPersonEmail = new Map<string, BenchmarkVerifiedEmailCandidateRow>()
  const rejected: BenchmarkVerifiedEmailRejectedRow[] = []
  const seenPersonEmail = new Set<string>()

  for (const row of contacts ?? []) {
    const record = row as Record<string, unknown>
    const company_contact_id = asString(record.id)
    const company_id = asString(record.company_id)
    const person_id = asString(record.canonical_person_id)
    const full_name = asString(record.full_name)
    const email = asString(record.email).toLowerCase()
    const metadata =
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : {}

    const identity = classifyContactIdentity({
      full_name,
      title: asString(record.title),
      email,
      phone: asString(record.phone),
      linkedin_url: asString(record.linkedin_url),
      source_type: asString(record.source_type),
    })

    const reject = (reason: string) => {
      rejected.push({
        company_contact_id,
        company_id,
        full_name,
        email: email || null,
        rejection_reason: reason,
      })
    }

    if (!email) {
      reject("missing_email")
      continue
    }

    if (isGenericIdentityName(full_name) && identity.classification !== "named_person") {
      reject("not_named_person")
      continue
    }

    if (!person_id) {
      reject("missing_canonical_person_id")
      continue
    }

    const ps_ik_upgrade = isPsIkNamingUpgrade(metadata)
    const local_supported = emailLocalPartSupportsPersonName(email, full_name)

    if (isRoleOrGenericInboxEmail(email) && !(ps_ik_upgrade && local_supported)) {
      reject("role_or_generic_inbox")
      continue
    }

    if (
      asString(metadata.email_classification) === "role_email" &&
      !(ps_ik_upgrade && local_supported)
    ) {
      reject("role_email_classification")
      continue
    }

    if (!local_supported && !ps_ik_upgrade) {
      reject("email_local_part_does_not_support_name")
      continue
    }

    const normalizedNameToken = full_name.replace(/\s+/g, "").toLowerCase()
    const local = email.split("@")[0]?.trim().toLowerCase() ?? ""
    if (
      normalizedNameToken === local &&
      (COMPANY_FRAGMENT_NAME_TOKENS.test(full_name) || local.length >= 10)
    ) {
      reject("company_local_part_identity")
      continue
    }

    if (!isBenchmarkEligiblePersonalName(full_name, email)) {
      reject("ineligible_personal_name_shape")
      continue
    }

    const personVerified = verifiedEmailByPerson.get(person_id) ?? new Set<string>()
    if (personVerified.has(email)) {
      reject("already_verified")
      continue
    }

    const dedupeKey = `${person_id || company_contact_id}:${email}`
    if (seenPersonEmail.has(`${email}:${full_name}`)) {
      reject("duplicate_person_email")
      continue
    }
    seenPersonEmail.add(`${email}:${full_name}`)

    const candidate: BenchmarkVerifiedEmailCandidateRow = {
      company_contact_id,
      company_id,
      company_name: companyNameById.get(company_id) || company_id,
      person_id,
      full_name,
      email,
      source_type: asString(record.source_type),
      ps_ik_upgrade,
      upgrade_method: asString(metadata.identity_naming_upgrade_method) || null,
      evidence_ref: asString(metadata.identity_naming_evidence_ref) || email,
      source_page_url: asString(metadata.source_page_url) || null,
    }

    const mapKey = `${email}:${person_id || "unlinked"}`
    const existing = selectedByPersonEmail.get(email)
    if (!existing) {
      selectedByPersonEmail.set(email, candidate)
      continue
    }
    const existingScore =
      (existing.person_id ? 2 : 0) + (existing.ps_ik_upgrade ? 1 : 0)
    const candidateScore = (person_id ? 2 : 0) + (ps_ik_upgrade ? 1 : 0)
    if (candidateScore > existingScore) {
      rejected.push({
        company_contact_id: existing.company_contact_id,
        company_id: existing.company_id,
        full_name: existing.full_name,
        email: existing.email,
        rejection_reason: "duplicate_superseded",
      })
      selectedByPersonEmail.set(email, candidate)
    } else {
      reject("duplicate_superseded")
    }
  }

  const selected = [...selectedByPersonEmail.values()].filter((row) => {
    if (!row.person_id) {
      rejected.push({
        company_contact_id: row.company_contact_id,
        company_id: row.company_id,
        full_name: row.full_name,
        email: row.email,
        rejection_reason: "missing_canonical_person_id",
      })
      return false
    }
    return true
  })

  return {
    cohort_company_count: cohort.company_ids.length,
    selected,
    rejected,
  }
}
