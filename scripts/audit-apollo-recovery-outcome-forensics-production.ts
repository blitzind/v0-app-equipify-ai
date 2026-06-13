/**
 * Phase 14.3H — Read-only Apollo recovery outcome forensics (no Apollo calls, no writes).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/audit-apollo-recovery-outcome-forensics-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import {
  apolloCandidateHasVerifiedStatusWithoutEmail,
} from "../lib/growth/apollo/apollo-email-channel-evidence"
import {
  isApolloVerifiedEmailStatus,
  readApolloEmailStatusFromCandidate,
  resolveApolloCandidatePromotedEmail,
} from "../lib/growth/apollo/apollo-verified-email-promotion-evidence"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const RECOVERY_COMPANY_IDS = [
  "0719a17c-49c7-42f1-a758-f120313c7b11",
  "0d501daf-4082-4a84-98e5-048305e9ee2f",
  "1f88fd7a-99d3-46ea-b2ba-a1f1ef5768aa",
  "226004c7-ed36-47e2-bf99-31d4ef8094e8",
  "25f9b243-b293-45a4-bb31-4c6973e6e908",
  "26d8e885-dc7d-49b3-8fc0-8ade9ed35714",
  "29eb63ce-c3de-45a2-a9a1-5e7e96f13fb1",
  "3d354ede-1871-4396-8637-ca2cb1016f56",
  "41568a8a-8ccd-4042-baac-250a574d6261",
  "429b81e9-1f04-429c-8fda-f100d6b74be9",
  "46054389-4ca0-4154-ac6c-c49430ae26c1",
  "464f3a12-ab57-40fd-b047-9113552443ee",
  "557269ac-ed64-4f9a-a19c-fee606147c12",
  "57b3fdbe-d27e-4d5b-9db2-70025c44acac",
  "66092b20-513d-4ca0-af4d-bd4c5029e8d8",
  "67d0d1cb-dd38-48aa-86b9-8ea4f61ce64e",
  "747df8a8-4e69-4be7-9cfb-3aa4360ed579",
  "79da0ebf-8bf0-4209-baf7-1353e6a15bda",
  "88147b8a-5f31-41c4-b622-143571d6d9ec",
  "96c1b623-68ea-4dbe-b23e-dda52d82c6cf",
  "a58d0a94-6b01-476e-b998-658978d0d0f4",
  "b0ff4677-769a-49d8-9b06-0f5c9f7a2ff7",
  "b1f71947-34b2-4c71-9389-1019de64895e",
  "c8d4f05d-3ba2-4944-9318-bd85a3efc836",
  "d1ddeb0b-d2d2-4f04-9c6a-96862bac0189",
  "d696048a-f2b8-43ff-8575-892224f79917",
  "df2ff4e9-28ab-47dc-9ed2-c6a48e9db967",
  "eaa3add4-0498-4622-88c8-7868b7855960",
  "f32b9add-ea86-47f4-871d-bfadf2ca8e78",
  "f60b179d-517e-4a6c-b6a0-759e4228a133",
  "f65b2f1e-1b63-4269-b21b-e99224cdc104",
] as const

const RECOVERY_WINDOW_START = "2026-06-12T20:15:00.000Z"
const RECOVERY_WINDOW_END = "2026-06-12T20:35:00.000Z"

const PRODUCTION_VALIDATION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readMetadata(candidate: GrowthContactCandidate): Record<string, unknown> {
  return candidate.metadata && typeof candidate.metadata === "object"
    ? (candidate.metadata as Record<string, unknown>)
    : {}
}

function classifyApolloEmailStatus(status: string | null): string {
  const normalized = asString(status).toLowerCase()
  if (!normalized) return "email_missing"
  if (normalized === "verified") return "verified"
  if (normalized === "unavailable") return "email_unavailable"
  if (normalized === "extrapolated") return "email_extrapolated"
  if (normalized === "guessed") return "non_promotable_email"
  if (normalized === "invalid") return "non_promotable_email"
  return "non_promotable_email"
}

function inferContactChangeFlags(candidate: GrowthContactCandidate): {
  apollo_enriched_at_set: boolean
  email_present: boolean
  email_status: string | null
  phone_present: boolean
  linkedin_present: boolean
  job_title_present: boolean
  company_name_in_metadata: string | null
  promotable_email: boolean
  verified_status_without_email: boolean
} {
  const metadata = readMetadata(candidate)
  const email = asString(candidate.email)
  const status = readApolloEmailStatusFromCandidate(candidate)
  return {
    apollo_enriched_at_set: Boolean(asString(metadata.apollo_enriched_at)),
    email_present: Boolean(email),
    email_status: status || null,
    phone_present: Boolean(asString(candidate.phone)),
    linkedin_present: Boolean(asString(candidate.linkedin_url)),
    job_title_present: Boolean(asString(candidate.job_title)),
    company_name_in_metadata: asString(metadata.company_name) || null,
    promotable_email: Boolean(resolveApolloCandidatePromotedEmail(candidate)),
    verified_status_without_email: apolloCandidateHasVerifiedStatusWithoutEmail(candidate),
  }
}

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_VALIDATION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })

  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "production_supabase_unavailable" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const { data: companies } = await admin
    .schema("growth")
    .from("company_candidates")
    .select("id, company_name")
    .in("id", [...RECOVERY_COMPANY_IDS])

  const companyNameById = new Map(
    (companies ?? []).map((row) => [asString(row.id), asString(row.company_name)]),
  )

  const { data: contacts, error } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select(
      "id, company_candidate_id, email, phone, linkedin_url, job_title, full_name, metadata, provider_type, updated_at",
    )
    .in("company_candidate_id", [...RECOVERY_COMPANY_IDS])
    .eq("provider_type", "future_apollo")

  if (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }))
    process.exit(1)
  }

  const allContacts = (contacts ?? []) as GrowthContactCandidate[]

  const recoveryTouches = allContacts.filter((candidate) => {
    const enrichedAt = asString(readMetadata(candidate).apollo_enriched_at)
    const updatedAt = asString((candidate as { updated_at?: string }).updated_at)
    const inEnrichedWindow =
      enrichedAt >= RECOVERY_WINDOW_START && enrichedAt <= RECOVERY_WINDOW_END
    const inUpdatedWindow = updatedAt >= RECOVERY_WINDOW_START && updatedAt <= RECOVERY_WINDOW_END
    return inEnrichedWindow || (inUpdatedWindow && Boolean(enrichedAt))
  })

  const changeSummary = {
    email_added: 0,
    email_status_changed: 0,
    phone_added: 0,
    linkedin_added: 0,
    title_changed: 0,
    company_changed: 0,
    apollo_enriched_at_set: 0,
    no_useful_change: 0,
  }

  const apolloClassification = {
    no_email_returned: 0,
    email_unavailable: 0,
    email_missing: 0,
    email_extrapolated: 0,
    verified_status_without_email: 0,
    non_promotable_email: 0,
    promotable_verified_email: 0,
  }

  const enrichedContactDetails: Array<Record<string, unknown>> = []

  for (const candidate of recoveryTouches) {
    const flags = inferContactChangeFlags(candidate)
    const metadata = readMetadata(candidate)
    const enrichedEmail = asString(metadata.apollo_enriched_email)
    const enrichmentSource = asString(metadata.apollo_email_enrichment_source)

    if (flags.apollo_enriched_at_set) changeSummary.apollo_enriched_at_set += 1
    if (enrichedEmail && enrichmentSource === "bulk_match") changeSummary.email_added += 1
    if (flags.email_status) changeSummary.email_status_changed += 1
    if (flags.phone_present) changeSummary.phone_added += 1
    if (flags.linkedin_present) changeSummary.linkedin_added += 1
    if (flags.job_title_present) changeSummary.title_changed += 1
    if (flags.company_name_in_metadata) changeSummary.company_changed += 1

    const statusClass = classifyApolloEmailStatus(flags.email_status)
    if (!flags.email_present) {
      apolloClassification.no_email_returned += 1
      if (flags.verified_status_without_email) apolloClassification.verified_status_without_email += 1
      else apolloClassification.email_missing += 1
    } else if (statusClass === "email_unavailable") {
      apolloClassification.email_unavailable += 1
    } else if (statusClass === "email_extrapolated") {
      apolloClassification.email_extrapolated += 1
    } else if (statusClass === "verified" && flags.promotable_email) {
      apolloClassification.promotable_verified_email += 1
    } else if (flags.verified_status_without_email) {
      apolloClassification.verified_status_without_email += 1
    } else {
      apolloClassification.non_promotable_email += 1
    }

    if (
      !flags.promotable_email &&
      !flags.phone_present &&
      !flags.linkedin_present &&
      enrichmentSource !== "bulk_match"
    ) {
      changeSummary.no_useful_change += 1
    }

    enrichedContactDetails.push({
      contact_candidate_id: asString(candidate.id),
      company_candidate_id: asString(candidate.company_candidate_id),
      company_name: companyNameById.get(asString(candidate.company_candidate_id)) ?? null,
      apollo_enriched_at: asString(metadata.apollo_enriched_at) || null,
      apollo_email_status: flags.email_status,
      email_present: flags.email_present,
      promotable_verified_email: flags.promotable_email,
      phone_present: flags.phone_present,
      linkedin_present: flags.linkedin_present,
      job_title: asString(candidate.job_title) || null,
      identity_status: asString(metadata.identity_status) || null,
      partial_identity_source: asString(metadata.apollo_partial_identity_resolution_source) || null,
    })
  }

  const companyReports = RECOVERY_COMPANY_IDS.map((company_candidate_id) => {
    const companyContacts = allContacts.filter(
      (c) => asString(c.company_candidate_id) === company_candidate_id,
    )
    const touched = recoveryTouches.filter(
      (c) => asString(c.company_candidate_id) === company_candidate_id,
    )
    const verifiedReady = companyContacts.filter((c) =>
      Boolean(resolveApolloCandidatePromotedEmail(c)),
    ).length

    const blockers: string[] = []
    if (touched.length === 0) {
      blockers.push("apollo_enrichment:enrichment_returned_no_email", "no_enriched_candidates_with_contact_channel")
    } else if (verifiedReady === 0) {
      blockers.push("apollo_search_skipped:existing_contactable_company_contacts")
    }

    return {
      company: companyNameById.get(company_candidate_id) ?? company_candidate_id,
      company_candidate_id,
      strategy: "enrichment_only" as const,
      contacts_enriched: touched.length,
      emails_recovered: verifiedReady,
      verified_email_ready_before: false,
      verified_email_ready_after: verifiedReady > 0,
      blockers,
      apollo_contacts_total: companyContacts.length,
      contacts_with_promotable_email: verifiedReady,
      contacts_with_phone_only: companyContacts.filter(
        (c) => !asString(c.email) && asString(c.phone),
      ).length,
      contacts_with_linkedin_only: companyContacts.filter(
        (c) => !asString(c.email) && !asString(c.phone) && asString(c.linkedin_url),
      ).length,
    }
  })

  const statusDistribution: Record<string, number> = {}
  for (const candidate of allContacts) {
    const status = asString(readApolloEmailStatusFromCandidate(candidate)) || "(none)"
    statusDistribution[status] = (statusDistribution[status] ?? 0) + 1
  }

  const emailStatusOnRecoveryTouches: Record<string, number> = {}
  for (const candidate of recoveryTouches) {
    const status = asString(readApolloEmailStatusFromCandidate(candidate)) || "(none)"
    emailStatusOnRecoveryTouches[status] = (emailStatusOnRecoveryTouches[status] ?? 0) + 1
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: "apollo-recovery-outcome-forensics-v14-3h",
        read_only: true,
        recovery_window: { start: RECOVERY_WINDOW_START, end: RECOVERY_WINDOW_END },
        companies_processed: RECOVERY_COMPANY_IDS.length,
        recovery_touches_found: recoveryTouches.length,
        expected_contacts_enriched: 61,
        company_reports: companyReports,
        contact_change_summary: changeSummary,
        apollo_response_classification: apolloClassification,
        email_status_on_recovery_touches: emailStatusOnRecoveryTouches,
        email_status_all_pool_contacts: statusDistribution,
        enriched_contact_sample: enrichedContactDetails.slice(0, 15),
        enriched_contact_details: enrichedContactDetails,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
