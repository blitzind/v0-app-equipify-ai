/** Phase 7.PS-IN — Audit suspicious benchmark identities. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER,
  type BenchmarkSuspiciousIdentityRow,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-identity-quality-types"
import {
  isCompanyNameLocalPartIdentity,
  isFalsePositiveEmailLocalPartIdentity,
  isLegitimateEmailLocalPartPersonIdentity,
  isRoleLocalPartIdentityName,
} from "@/lib/growth/human-identity-evidence/email-local-part-identity-guards"
import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isRealPersonName(full_name: string, email: string | null): boolean {
  if (isGenericIdentityName(full_name)) return false
  return isLegitimateEmailLocalPartPersonIdentity(full_name, email)
}

function containmentReason(full_name: string, email: string | null): string | null {
  if (isGenericIdentityName(full_name)) return null
  if (isRoleLocalPartIdentityName(full_name, email)) return "role_local_part_identity"
  if (isCompanyNameLocalPartIdentity(full_name, email)) return "company_name_local_part_identity"
  if (isFalsePositiveEmailLocalPartIdentity(full_name, email)) {
    return isRoleLocalPartIdentityName(full_name, email)
      ? "role_local_part_identity"
      : "company_name_local_part_identity"
  }
  return null
}

export async function auditBenchmarkSuspiciousIdentities(
  admin: SupabaseClient,
  company_ids: string[],
): Promise<{
  inspected: BenchmarkSuspiciousIdentityRow[]
  company_name_by_id: Map<string, string>
}> {
  if (company_ids.length === 0) {
    return { inspected: [], company_name_by_id: new Map() }
  }

  const { data: companies } = await admin
    .schema("growth")
    .from("companies")
    .select("id, display_name")
    .in("id", company_ids)

  const company_name_by_id = new Map(
    (companies ?? []).map((row) => [
      asString((row as Record<string, unknown>).id),
      asString((row as Record<string, unknown>).display_name),
    ]),
  )

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "id, company_id, canonical_person_id, full_name, email, source_type, metadata, source_evidence",
    )
    .in("company_id", company_ids)
    .neq("contact_status", "archived")

  const inspected: BenchmarkSuspiciousIdentityRow[] = []

  for (const row of contacts ?? []) {
    const record = row as Record<string, unknown>
    const metadata =
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : {}

    const full_name = asString(record.full_name)
    const email = asString(record.email).toLowerCase() || null
    const upgrade_method = asString(metadata.identity_naming_upgrade_method) || null
    const ps_ik_upgrade = upgrade_method === "email_local_part"
    const prior_containment =
      metadata.benchmark_identity_quality_containment &&
      typeof metadata.benchmark_identity_quality_containment === "object"
        ? (metadata.benchmark_identity_quality_containment as Record<string, unknown>)
        : null
    const already_contained =
      asString(prior_containment?.qa_marker) ===
      GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER
    const effective_full_name =
      asString(prior_containment?.previous_full_name) || full_name

    const reason =
      containmentReason(effective_full_name, email) ||
      (already_contained ? asString(prior_containment?.containment_reason) || null : null)

    const suspicious =
      ps_ik_upgrade ||
      already_contained ||
      Boolean(reason) ||
      (email !== null && asString(record.canonical_person_id) && !isRealPersonName(full_name, email))

    if (!suspicious) continue

    const is_real_person_name = isRealPersonName(effective_full_name, email)
    // Contain only false-positive named identities (PS-IK upgrades or named role/company local parts).
    const should_contain =
      already_contained ||
      Boolean(reason) ||
      (ps_ik_upgrade && isFalsePositiveEmailLocalPartIdentity(effective_full_name, email))

    inspected.push({
      company_contact_id: asString(record.id),
      company_id: asString(record.company_id),
      company_name: company_name_by_id.get(asString(record.company_id)) || asString(record.company_id),
      person_id: asString(record.canonical_person_id) || null,
      full_name: effective_full_name,
      email,
      upgrade_method,
      evidence_ref:
        asString(prior_containment?.evidence_ref) ||
        asString(metadata.identity_naming_evidence_ref) ||
        email,
      source_page_url: asString(metadata.source_page_url) || null,
      is_real_person_name,
      should_contain,
      containment_reason: should_contain ? reason ?? "ps_ik_false_upgrade" : null,
    })
  }

  return { inspected, company_name_by_id }
}
