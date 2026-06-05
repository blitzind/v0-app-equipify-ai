/** Phase 7.PS-IN — Benchmark false-positive identity containment. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canonicalNormalizedPersonName } from "@/lib/growth/canonical-persons/canonical-person-normalize"
import { auditBenchmarkSuspiciousIdentities } from "@/lib/growth/benchmark/apollo-replacement-benchmark-identity-quality-audit"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER,
  type BenchmarkIdentityContainmentResult,
  type BenchmarkIdentityQualityMetrics,
  type BenchmarkSuspiciousIdentityRow,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-identity-quality-types"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { preserveCompanyChannelsFromContactRow } from "@/lib/growth/human-identity-evidence/generic-contact-containment"
import { isFalsePositiveEmailLocalPartIdentity } from "@/lib/growth/human-identity-evidence/email-local-part-identity-guards"
import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import type { CompanyChannelRecord } from "@/lib/growth/human-identity-evidence/generic-contact-containment-types"
import { GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER } from "@/lib/growth/human-identity-evidence/generic-contact-containment-types"

const GENERIC_CONTACT_LABEL = "Company contact"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function containmentMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> | null {
  const containment = metadata.benchmark_identity_quality_containment
  return containment && typeof containment === "object"
    ? (containment as Record<string, unknown>)
    : null
}

async function restoreIncorrectBenchmarkIdentityContainments(
  admin: SupabaseClient,
  company_ids: string[],
): Promise<{ restored: number; messages: string[] }> {
  const messages: string[] = []
  if (company_ids.length === 0) return { restored: 0, messages }

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id, metadata, canonical_person_id, full_name, email")
    .in("company_id", company_ids)
    .neq("contact_status", "archived")

  let restored = 0

  for (const row of contacts ?? []) {
    const record = row as Record<string, unknown>
    const email = asString(record.email).toLowerCase() || null
    const metadata =
      record.metadata && typeof record.metadata === "object"
        ? ({ ...(record.metadata as Record<string, unknown>) } as Record<string, unknown>)
        : {}
    const containment = containmentMetadata(metadata)
    if (!containment) continue
    const containment_reason = asString(containment.containment_reason)
    const previous_full_name = asString(containment.previous_full_name)
    const false_positive_named_identity =
      previous_full_name &&
      isFalsePositiveEmailLocalPartIdentity(previous_full_name, email)
    const incorrectly_contained =
      containment_reason === "ps_ik_false_upgrade" ||
      ((containment_reason === "role_local_part_identity" ||
        containment_reason === "company_name_local_part_identity") &&
        !false_positive_named_identity)
    if (!incorrectly_contained) continue

    const previous_person_id = asString(containment.previous_person_id) || null
    if (!previous_full_name) continue

    const {
      benchmark_identity_quality_containment: _removed,
      identity_classification: _classification,
      ...restMetadata
    } = metadata

    await admin
      .schema("growth")
      .from("company_contacts")
      .update({
        full_name: previous_full_name,
        canonical_person_id: previous_person_id,
        metadata: {
          ...restMetadata,
          benchmark_identity_quality_restore: {
            qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER,
            restored_at: new Date().toISOString(),
            previous_containment: containment,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", asString(record.id))

    if (previous_person_id) {
      const { data: person } = await admin
        .schema("growth")
        .from("persons")
        .select("metadata, full_name")
        .eq("id", previous_person_id)
        .maybeSingle()

      const personRecord = person as Record<string, unknown> | null
      const personMetadata =
        personRecord?.metadata && typeof personRecord.metadata === "object"
          ? ({ ...(personRecord.metadata as Record<string, unknown>) } as Record<string, unknown>)
          : {}

      if (
        asString(personMetadata.containment_status) ===
        "false_positive_email_local_part_contained"
      ) {
        const {
          containment_status: _status,
          containment_qa_marker: _marker,
          contained_at: _at,
          contained_from_contact_id: _contact,
          previous_full_name: _prev,
          containment_reason: _reason,
          ...restPersonMetadata
        } = personMetadata

        await admin
          .schema("growth")
          .from("persons")
          .update({
            full_name: previous_full_name,
            first_name: previous_full_name.split(/\s+/)[0] ?? previous_full_name,
            last_name:
              previous_full_name.split(/\s+/).length > 1
                ? previous_full_name.split(/\s+/).slice(1).join(" ")
                : null,
            normalized_name: canonicalNormalizedPersonName(previous_full_name),
            metadata: {
              ...restPersonMetadata,
              benchmark_identity_quality_restore: {
                qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER,
                restored_at: new Date().toISOString(),
                previous_containment: personMetadata,
              },
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", previous_person_id)
      }
    }

    restored += 1
    messages.push(`restored ${previous_full_name}`)
  }

  return { restored, messages }
}

async function countLinkedContactsForPerson(
  admin: SupabaseClient,
  person_id: string,
  exclude_contact_id: string,
): Promise<number> {
  const { count } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id", { count: "exact", head: true })
    .eq("canonical_person_id", person_id)
    .neq("id", exclude_contact_id)
    .neq("contact_status", "archived")
  return count ?? 0
}

async function containFalsePositiveContact(
  admin: SupabaseClient,
  row: BenchmarkSuspiciousIdentityRow,
  contactRecord: Record<string, unknown>,
): Promise<BenchmarkIdentityContainmentResult> {
  const messages: string[] = []
  const source_evidence = Array.isArray(contactRecord.source_evidence)
    ? (contactRecord.source_evidence as CompanyChannelRecord["source_evidence"])
    : []

  const metadata =
    contactRecord.metadata && typeof contactRecord.metadata === "object"
      ? ({ ...(contactRecord.metadata as Record<string, unknown>) } as Record<string, unknown>)
      : {}

  const existingContainment = containmentMetadata(metadata)
  if (
    existingContainment &&
    asString(existingContainment.qa_marker) ===
      GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER
  ) {
    return {
      company_contact_id: row.company_contact_id,
      person_id: row.person_id,
      full_name: row.full_name,
      email: row.email,
      contained: true,
      channels_preserved: 0,
      contact_reverted_to_generic: true,
      person_contained: false,
      reason: asString(existingContainment.containment_reason) || row.containment_reason || "already_contained",
      messages: ["already_contained"],
    }
  }

  const channels_preserved = await preserveCompanyChannelsFromContactRow(admin, {
    company_id: row.company_id,
    company_contact_id: row.company_contact_id,
    full_name: GENERIC_CONTACT_LABEL,
    title: asString(contactRecord.title) || null,
    email: row.email,
    phone: asString(contactRecord.phone) || null,
    linkedin_url: asString(contactRecord.linkedin_url) || null,
    source_type: asString(contactRecord.source_type) || null,
    source_evidence,
    metadata,
  })
  messages.push(`channels_preserved=${channels_preserved}`)

  const previous_person_id = row.person_id
  await admin
    .schema("growth")
    .from("company_contacts")
    .update({
      canonical_person_id: null,
      full_name: GENERIC_CONTACT_LABEL,
      metadata: {
        ...metadata,
        identity_classification: "company_channel",
        benchmark_identity_quality_containment: {
          qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER,
          contained_at: new Date().toISOString(),
          containment_reason: row.containment_reason,
          previous_full_name: row.full_name,
          previous_person_id,
          evidence_ref: row.evidence_ref,
          upgrade_method: row.upgrade_method,
        },
        generic_contact_containment_qa_marker: GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER,
        contained_at: new Date().toISOString(),
        contained_person_id: previous_person_id,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.company_contact_id)

  messages.push("contact_unlinked_and_reverted_to_generic")

  let person_contained = false
  if (previous_person_id) {
    const remaining = await countLinkedContactsForPerson(
      admin,
      previous_person_id,
      row.company_contact_id,
    )
    if (remaining === 0) {
      const { data: person } = await admin
        .schema("growth")
        .from("persons")
        .select("metadata")
        .eq("id", previous_person_id)
        .maybeSingle()

      const personMetadata =
        person?.metadata && typeof person.metadata === "object"
          ? ({ ...(person.metadata as Record<string, unknown>) } as Record<string, unknown>)
          : {}

      await admin
        .schema("growth")
        .from("persons")
        .update({
          full_name: GENERIC_CONTACT_LABEL,
          first_name: null,
          last_name: null,
          normalized_name: canonicalNormalizedPersonName(GENERIC_CONTACT_LABEL),
          metadata: {
            ...personMetadata,
            containment_status: "false_positive_email_local_part_contained",
            containment_qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER,
            contained_at: new Date().toISOString(),
            contained_from_contact_id: row.company_contact_id,
            previous_full_name: row.full_name,
            containment_reason: row.containment_reason,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", previous_person_id)

      person_contained = true
      messages.push("person_contained_and_reverted_to_generic")
    } else {
      messages.push(`person_retained_linked_contacts=${remaining}`)
    }
  }

  await admin.schema("growth").from("company_contact_identity_reviews").insert({
    company_contact_id: row.company_contact_id,
    company_id: row.company_id,
    canonical_person_id: previous_person_id,
    reviewer_email: "system-7-ps-in@equipify.internal",
    source_url: row.source_page_url,
    evidence_snapshot: source_evidence,
    fields_changed: ["full_name", "canonical_person_id", "identity_classification"],
    previous_values: {
      full_name: row.full_name,
      canonical_person_id: previous_person_id,
    },
    new_values: {
      full_name: GENERIC_CONTACT_LABEL,
      canonical_person_id: null,
    },
    actions: ["contain_false_positive_identity"],
    review_note: `7.PS-IN — benchmark identity quality containment (${row.containment_reason})`,
    metadata: {
      qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER,
      containment_reason: row.containment_reason,
      evidence_ref: row.evidence_ref,
    },
  })

  return {
    company_contact_id: row.company_contact_id,
    person_id: previous_person_id,
    full_name: row.full_name,
    email: row.email,
    contained: true,
    channels_preserved,
    contact_reverted_to_generic: true,
    person_contained,
    reason: row.containment_reason ?? "false_positive",
    messages,
  }
}

export async function runApolloReplacementBenchmarkIdentityQualityCleanup(
  admin: SupabaseClient,
): Promise<{
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER
  ok: boolean
  inspected: BenchmarkSuspiciousIdentityRow[]
  contained: BenchmarkIdentityContainmentResult[]
  preserved_legitimate: BenchmarkSuspiciousIdentityRow[]
  metrics: BenchmarkIdentityQualityMetrics
  messages: string[]
}> {
  const messages: string[] = []
  const cohort = await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)
  if (!cohort || cohort.company_ids.length === 0) {
    return {
      qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER,
      ok: false,
      inspected: [],
      contained: [],
      preserved_legitimate: [],
      metrics: {
        suspicious_inspected: 0,
        false_positives_contained: 0,
        false_positives_addressed: 0,
        evidence_channels_preserved: 0,
        persons_contained: 0,
        contacts_unlinked: 0,
        legitimate_preserved: 0,
        incorrect_containments_restored: 0,
      },
      messages: ["benchmark_cohort_missing"],
    }
  }

  const restore = await restoreIncorrectBenchmarkIdentityContainments(admin, cohort.company_ids)
  if (restore.restored > 0) {
    messages.push(...restore.messages)
    messages.push(`incorrect_containments_restored=${restore.restored}`)
  }

  const { inspected } = await auditBenchmarkSuspiciousIdentities(admin, cohort.company_ids)
  const to_contain = inspected.filter((row) => row.should_contain)
  const preserved_legitimate = inspected.filter((row) => !row.should_contain)

  const metrics: BenchmarkIdentityQualityMetrics = {
    suspicious_inspected: inspected.length,
    false_positives_contained: 0,
    false_positives_addressed: to_contain.length,
    evidence_channels_preserved: 0,
    persons_contained: 0,
    contacts_unlinked: 0,
    legitimate_preserved: preserved_legitimate.length,
    incorrect_containments_restored: restore.restored,
  }

  const contained: BenchmarkIdentityContainmentResult[] = []

  for (const row of to_contain) {
    const { data: contact } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("*")
      .eq("id", row.company_contact_id)
      .maybeSingle()

    if (!contact) {
      contained.push({
        company_contact_id: row.company_contact_id,
        person_id: row.person_id,
        full_name: row.full_name,
        email: row.email,
        contained: false,
        channels_preserved: 0,
        contact_reverted_to_generic: false,
        person_contained: false,
        reason: row.containment_reason ?? "missing_contact",
        messages: ["contact_not_found"],
      })
      continue
    }

    const result = await containFalsePositiveContact(
      admin,
      row,
      contact as Record<string, unknown>,
    )
    contained.push(result)

    if (result.contained && !result.messages.includes("already_contained")) {
      metrics.false_positives_contained += 1
      metrics.evidence_channels_preserved += result.channels_preserved
      metrics.contacts_unlinked += 1
      if (result.person_contained) metrics.persons_contained += 1
      messages.push(`contained ${row.full_name}@${row.email ?? "no-email"}: ${result.reason}`)
    } else if (result.messages.includes("already_contained")) {
      messages.push(`skipped_already_contained ${row.full_name}@${row.email ?? "no-email"}`)
    }
  }

  messages.push(
    `inspected=${inspected.length} contained=${metrics.false_positives_contained} legitimate_preserved=${metrics.legitimate_preserved}`,
  )

  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER,
    ok: metrics.false_positives_contained > 0 || to_contain.length === 0,
    inspected,
    contained,
    preserved_legitimate,
    metrics,
    messages,
  }
}
