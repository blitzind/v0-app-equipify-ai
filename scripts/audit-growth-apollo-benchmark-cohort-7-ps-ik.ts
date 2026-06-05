/**
 * Phase 7.PS-IK — Benchmark cohort segmentation audit (read-only).
 * Run: NODE_OPTIONS='--require ./scripts/shim-server-only.cjs' tsx scripts/audit-growth-apollo-benchmark-cohort-7-ps-ik.ts
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { ensureApolloReplacementBenchmarkCohort },
    { loadApolloReplacementBenchmarkCohort },
    { classifyContactIdentity },
    { personHasVerifiedReachableChannel },
    { loadPersonCommitteeDensityCompanySnapshot },
    { APOLLO_REPLACEMENT_BENCHMARK_ID },
  ] = await Promise.all([
    import("../lib/growth/benchmark/apollo-replacement-benchmark-cohort"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-storage"),
    import("../lib/growth/human-identity-evidence/contact-identity-classification"),
    import("../lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-metrics"),
    import("../lib/growth/graph-expansion/person-committee-density-expansion"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-types"),
  ])

  let cohort = await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)
  if (!cohort) {
    const ensured = await ensureApolloReplacementBenchmarkCohort(admin)
    cohort = ensured.cohort
  }

  const { data: companies } = await admin
    .schema("growth")
    .from("companies")
    .select("id, name, website, primary_domain, industry")
    .in("id", cohort.company_ids)

  const companyById = new Map(
    (companies ?? []).map((row) => [asString(row.id), row as Record<string, unknown>]),
  )

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "id, company_id, canonical_person_id, full_name, title, email, phone, linkedin_url, source_type, metadata, contact_status",
    )
    .in("company_id", cohort.company_ids)
    .neq("contact_status", "archived")

  const contactsByCompany = new Map<string, Array<Record<string, unknown>>>()
  for (const row of contacts ?? []) {
    const record = row as Record<string, unknown>
    const company_id = asString(record.company_id)
    if (!contactsByCompany.has(company_id)) contactsByCompany.set(company_id, [])
    contactsByCompany.get(company_id)!.push(record)
  }

  const segments = {
    no_contacts: [] as Record<string, unknown>[],
    generic_channels_only: [] as Record<string, unknown>[],
    named_without_verified_channel: [] as Record<string, unknown>[],
    titled_without_committee: [] as Record<string, unknown>[],
    verified_channel_not_outreach_ready: [] as Record<string, unknown>[],
    outreach_ready: [] as Record<string, unknown>[],
  }

  let total_named_persons = 0
  let named_without_verified = 0
  let generic_only_companies = 0

  for (const company_id of cohort.company_ids) {
    const company = companyById.get(company_id)
    const rows = contactsByCompany.get(company_id) ?? []
    const company_name = asString(company?.name) || company_id

    if (rows.length === 0) {
      segments.no_contacts.push({
        company_id,
        company_name,
        industry: asString(company?.industry),
        website: asString(company?.website) || asString(company?.primary_domain),
      })
      continue
    }

    const namedPersons: Array<{
      person_id: string
      full_name: string
      title: string
      has_verified: boolean
      has_corroboration: boolean
      source_type: string
    }> = []

    let hasGenericOnly = true
    let hasNamed = false
    let hasTitled = false

    for (const row of rows) {
      const identity = classifyContactIdentity({
        full_name: asString(row.full_name),
        title: asString(row.title),
        email: asString(row.email),
        phone: asString(row.phone),
        linkedin_url: asString(row.linkedin_url),
        source_type: asString(row.source_type),
      })

      if (identity.classification !== "company_channel" && identity.classification !== "generic_placeholder") {
        hasGenericOnly = false
      }
      if (identity.classification === "named_person") {
        hasNamed = true
        const person_id = asString(row.canonical_person_id)
        if (person_id) {
          const metadata =
            row.metadata && typeof row.metadata === "object"
              ? (row.metadata as Record<string, unknown>)
              : {}
          const has_corroboration = Boolean(
            Array.isArray(metadata.professional_identity_corroboration) &&
              metadata.professional_identity_corroboration.length > 0,
          )
          const has_verified = await personHasVerifiedReachableChannel(admin, person_id)
          namedPersons.push({
            person_id,
            full_name: asString(row.full_name),
            title: asString(row.title),
            has_verified,
            has_corroboration,
            source_type: asString(row.source_type),
          })
          total_named_persons += 1
          if (!has_verified) named_without_verified += 1
        }
      }
      if (asString(row.title)) hasTitled = true
    }

    if (hasGenericOnly) {
      generic_only_companies += 1
      segments.generic_channels_only.push({
        company_id,
        company_name,
        contact_count: rows.length,
        sample_names: rows.slice(0, 3).map((r) => asString(r.full_name)),
      })
    }

    const snapshot = await loadPersonCommitteeDensityCompanySnapshot(admin, {
      canonical_company_id: company_id,
      company_name,
      cohort_kind: "ps_ht_new",
    })

    if (snapshot.outreach_ready) {
      segments.outreach_ready.push({
        company_id,
        company_name,
        named_persons: snapshot.named_persons,
        verified_emails: snapshot.verified_emails,
        verified_phones: snapshot.verified_phones,
        namedPersons,
      })
    }

    for (const person of namedPersons) {
      if (!person.has_verified) {
        segments.named_without_verified_channel.push({
          company_id,
          company_name,
          ...person,
        })
      } else if (!snapshot.outreach_ready) {
        segments.verified_channel_not_outreach_ready.push({
          company_id,
          company_name,
          ...person,
          snapshot,
        })
      }
    }

    if (hasTitled && snapshot.committee_members_verified === 0) {
      const titledContacts = rows.filter((r) => asString(r.title))
      segments.titled_without_committee.push({
        company_id,
        company_name,
        titled_count: titledContacts.length,
        sample: titledContacts.slice(0, 2).map((r) => ({
          full_name: asString(r.full_name),
          title: asString(r.title),
          person_id: asString(r.canonical_person_id),
        })),
      })
    }
  }

  console.log(
    JSON.stringify(
      {
        qa_marker: "growth-apollo-benchmark-cohort-audit-7-ps-ik-v1",
        cohort_count: cohort.company_ids.length,
        segment_counts: {
          no_contacts: segments.no_contacts.length,
          generic_channels_only: segments.generic_channels_only.length,
          named_without_verified_channel: segments.named_without_verified_channel.length,
          titled_without_committee: segments.titled_without_committee.length,
          verified_channel_not_outreach_ready: segments.verified_channel_not_outreach_ready.length,
          outreach_ready: segments.outreach_ready.length,
        },
        blocker_analysis: {
          total_named_persons,
          named_without_verified,
          generic_only_companies,
          companies_without_named: cohort.company_ids.length - segments.outreach_ready.length - segments.named_without_verified_channel.length,
        },
        segments,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
