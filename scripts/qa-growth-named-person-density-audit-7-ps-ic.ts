/**
 * Phase 7.PS-IC — Named person density optimization audit (read-only).
 * Run: pnpm exec tsx scripts/qa-growth-named-person-density-audit-7-ps-ic.ts
 */
import { createClient } from "@supabase/supabase-js"
import { classifyContactIdentity } from "../lib/growth/human-identity-evidence/contact-identity-classification"
import { isGenericIdentityName } from "../lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_NAMED_PERSON_DENSITY_AUDIT_7_PS_IC_QA_MARKER =
  "growth-named-person-density-audit-7-ps-ic-v1" as const

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

type CompanyAudit = {
  company_id: string
  company_name: string
  promoted_at: string | null
  named_persons: number
  titled_persons: number
  verified_emails: number
  verified_phones: number
  committee_members: number
  outreach_ready: boolean
  contact_total: number
  company_channel_contacts: number
  generic_contacts: number
  has_team_page: boolean
  has_about_page: boolean
  has_leadership_page: boolean
  has_schema_org: boolean
  has_external_evidence: boolean
  has_professional_corroboration: boolean
  has_named_no_channels: boolean
  has_channels_unverified: boolean
  has_title_committee_failed: boolean
  failure_tags: string[]
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1
}

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const { data: promotedRows, error: promotedErr } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("id, company_name, canonical_company_id, updated_at, created_at, metadata")
    .not("canonical_company_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(100)

  if (promotedErr) {
    console.log(JSON.stringify({ error: promotedErr.message }))
    process.exit(1)
  }

  const companies = (promotedRows ?? []).filter((r) => asString(r.canonical_company_id))
  const companyIds = companies.map((r) => asString(r.canonical_company_id))

  const { data: allContacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "company_id, canonical_person_id, full_name, title, email, phone, linkedin_url, source_type, source_evidence, metadata, contact_status",
    )
    .in("company_id", companyIds)
    .neq("contact_status", "archived")

  const contactsByCompany = new Map<string, Array<Record<string, unknown>>>()
  for (const row of allContacts ?? []) {
    const cid = asString((row as Record<string, unknown>).company_id)
    if (!contactsByCompany.has(cid)) contactsByCompany.set(cid, [])
    contactsByCompany.get(cid)!.push(row as Record<string, unknown>)
  }

  const personIds = [
    ...new Set(
      (allContacts ?? [])
        .map((r) => asString((r as Record<string, unknown>).canonical_person_id))
        .filter(Boolean),
    ),
  ]

  const verifiedEmailByPerson = new Map<string, number>()
  const verifiedPhoneByPerson = new Map<string, number>()
  if (personIds.length > 0) {
    const [{ data: emails }, { data: phones }] = await Promise.all([
      admin
        .schema("growth")
        .from("person_emails")
        .select("person_id")
        .in("person_id", personIds)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_phones")
        .select("person_id")
        .in("person_id", personIds)
        .eq("verification_status", "verified"),
    ])
    for (const row of emails ?? []) {
      const pid = asString(row.person_id)
      verifiedEmailByPerson.set(pid, (verifiedEmailByPerson.get(pid) ?? 0) + 1)
    }
    for (const row of phones ?? []) {
      const pid = asString(row.person_id)
      verifiedPhoneByPerson.set(pid, (verifiedPhoneByPerson.get(pid) ?? 0) + 1)
    }
  }

  const committeeByCompany = new Map<string, number>()
  if (companyIds.length > 0) {
    const { data: committeeRows } = await admin
      .schema("growth")
      .from("buying_committee_intelligence_members")
      .select("company_id")
      .in("company_id", companyIds)
      .eq("verification_status", "verified")
    for (const row of committeeRows ?? []) {
      const cid = asString(row.company_id)
      committeeByCompany.set(cid, (committeeByCompany.get(cid) ?? 0) + 1)
    }
  }

  const corroborationByCompany = new Map<string, number>()
  if (personIds.length > 0) {
    const { data: persons } = await admin
      .schema("growth")
      .from("persons")
      .select("id, metadata")
      .in("id", personIds)
    for (const row of persons ?? []) {
      const meta =
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {}
      const corro = Array.isArray(meta.professional_identity_corroboration)
        ? meta.professional_identity_corroboration.length
        : 0
      if (corro > 0) {
        const contacts = (allContacts ?? []).filter(
          (c) => asString((c as Record<string, unknown>).canonical_person_id) === asString(row.id),
        )
        for (const c of contacts) {
          const cid = asString((c as Record<string, unknown>).company_id)
          corroborationByCompany.set(cid, (corroborationByCompany.get(cid) ?? 0) + 1)
        }
      }
    }
  }

  const sourceAttribution: Record<string, number> = {}
  const failureCategories: Record<string, number> = {}
  const companyAudits: CompanyAudit[] = []

  let funnelCompanies = 0
  let funnelNamed = 0
  let funnelTitled = 0
  let funnelVerifiedChannels = 0
  let funnelCommittee = 0
  let funnelOutreachReady = 0

  for (const row of companies) {
    const company_id = asString(row.canonical_company_id)
    const company_name = asString(row.company_name)
    const contacts = contactsByCompany.get(company_id) ?? []

    const namedPersonIds = new Set<string>()
    let titledPersons = 0
    let companyChannelContacts = 0
    let genericContacts = 0
    let hasTeamPage = false
    let hasAboutPage = false
    let hasLeadershipPage = false
    let hasSchemaOrg = false
    let hasExternalEvidence = false
    let hasUnverifiedChannelCandidate = false

    for (const contact of contacts) {
      const full_name = asString(contact.full_name)
      const title = asString(contact.title)
      const email = asString(contact.email)
      const phone = asString(contact.phone)
      const linkedin = asString(contact.linkedin_url)
      const metadata =
        contact.metadata && typeof contact.metadata === "object"
          ? (contact.metadata as Record<string, unknown>)
          : {}

      const identity = classifyContactIdentity({
        full_name,
        title,
        email,
        phone,
        linkedin_url: linkedin,
        source_type: asString(contact.source_type),
      })

      if (identity.classification === "company_channel") companyChannelContacts += 1
      if (identity.classification === "generic_placeholder") genericContacts += 1

      const pageType = asString(metadata.source_page_type).toLowerCase()
      if (pageType === "team" || pageType === "staff") hasTeamPage = true
      if (pageType === "about") hasAboutPage = true
      if (pageType === "leadership") hasLeadershipPage = true

      const sourceType = asString(contact.source_type).toLowerCase()
      if (sourceType.includes("public_record") || metadata.qa_marker?.toString().includes("external-evidence")) {
        hasExternalEvidence = true
        bump(sourceAttribution, "external_directory")
      }
      if (sourceType.includes("website") || pageType) bump(sourceAttribution, "website")
      if (pageType === "team" || pageType === "staff") bump(sourceAttribution, "team_page")
      if (pageType === "about") bump(sourceAttribution, "about_page")
      if (pageType === "leadership") bump(sourceAttribution, "leadership_page")

      const evidence = Array.isArray(contact.source_evidence)
        ? (contact.source_evidence as Array<{ source?: string; claim?: string }>)
        : []
      for (const ev of evidence) {
        const src = asString(ev.source).toLowerCase()
        const claim = asString(ev.claim).toLowerCase()
        if (src.includes("schema") || claim.includes("schema")) {
          hasSchemaOrg = true
          bump(sourceAttribution, "schema_org")
        }
        if (
          src.includes("association") ||
          src.includes("conference") ||
          src.includes("bbb") ||
          src.includes("public_business") ||
          src.includes("external_")
        ) {
          hasExternalEvidence = true
          bump(sourceAttribution, "external_directory")
        }
      }

      if (identity.classification === "named_person" && !isGenericIdentityName(full_name)) {
        const pid = asString(contact.canonical_person_id)
        if (pid) namedPersonIds.add(pid)
        else funnelNamed += 1
      }
      if (title && (identity.classification === "named_person" || identity.classification === "role_contact")) {
        titledPersons += 1
      }
      if ((email || phone || linkedin) && identity.classification === "named_person") {
        const pid = asString(contact.canonical_person_id)
        const hasVerified =
          (pid && (verifiedEmailByPerson.get(pid) ?? 0) > 0) ||
          (pid && (verifiedPhoneByPerson.get(pid) ?? 0) > 0)
        if (!hasVerified) hasUnverifiedChannelCandidate = true
      }
    }

    const namedPersons = namedPersonIds.size
    let verifiedEmails = 0
    let verifiedPhones = 0
    for (const pid of namedPersonIds) {
      verifiedEmails += verifiedEmailByPerson.get(pid) ?? 0
      verifiedPhones += verifiedPhoneByPerson.get(pid) ?? 0
    }
    const committeeMembers = committeeByCompany.get(company_id) ?? 0
    const hasCorroboration = (corroborationByCompany.get(company_id) ?? 0) > 0
    if (hasCorroboration) bump(sourceAttribution, "professional_corroboration")

    const outreachReady =
      namedPersons > 0 && (verifiedEmails > 0 || verifiedPhones > 0)
    const hasNamedNoChannels =
      namedPersons > 0 && verifiedEmails === 0 && verifiedPhones === 0 && !hasUnverifiedChannelCandidate
    const hasChannelsUnverified =
      namedPersons > 0 && verifiedEmails === 0 && verifiedPhones === 0 && hasUnverifiedChannelCandidate
    const hasTitleCommitteeFailed = titledPersons > 0 && committeeMembers === 0

    const failure_tags: string[] = []
    if (contacts.length === 0) failure_tags.push("no_contacts")
    if (companyChannelContacts > 0 && namedPersons === 0) failure_tags.push("website_only_generic_channels")
    if (!hasTeamPage && !hasLeadershipPage) failure_tags.push("no_team_page")
    if (!hasAboutPage) failure_tags.push("no_about_page")
    if (!hasExternalEvidence && namedPersons === 0) failure_tags.push("no_external_evidence")
    if (hasNamedNoChannels) failure_tags.push("named_person_no_channels")
    if (hasChannelsUnverified) failure_tags.push("channels_found_not_verified")
    if (hasTitleCommitteeFailed) failure_tags.push("title_found_committee_failed")

    for (const tag of failure_tags) bump(failureCategories, tag)

    funnelCompanies += 1
    if (namedPersons > 0) funnelNamed += 1
    if (titledPersons > 0) funnelTitled += 1
    if (verifiedEmails > 0 || verifiedPhones > 0) funnelVerifiedChannels += 1
    if (committeeMembers > 0) funnelCommittee += 1
    if (outreachReady) funnelOutreachReady += 1

    companyAudits.push({
      company_id,
      company_name,
      promoted_at: asString(row.updated_at) || asString(row.created_at) || null,
      named_persons: namedPersons,
      titled_persons: titledPersons,
      verified_emails: verifiedEmails,
      verified_phones: verifiedPhones,
      committee_members: committeeMembers,
      outreach_ready: outreachReady,
      contact_total: contacts.length,
      company_channel_contacts: companyChannelContacts,
      generic_contacts: genericContacts,
      has_team_page: hasTeamPage,
      has_about_page: hasAboutPage,
      has_leadership_page: hasLeadershipPage,
      has_schema_org: hasSchemaOrg,
      has_external_evidence: hasExternalEvidence,
      has_professional_corroboration: hasCorroboration,
      has_named_no_channels: hasNamedNoChannels,
      has_channels_unverified: hasChannelsUnverified,
      has_title_committee_failed: hasTitleCommitteeFailed,
      failure_tags,
    })
  }

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)

  const withNamed = companyAudits.filter((c) => c.named_persons > 0)
  const withOutreach = companyAudits.filter((c) => c.outreach_ready)

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_NAMED_PERSON_DENSITY_AUDIT_7_PS_IC_QA_MARKER,
        companies_analyzed: companyAudits.length,
        density_funnel: {
          companies: funnelCompanies,
          named_person_companies: funnelNamed,
          titled_person_companies: funnelTitled,
          verified_channel_companies: funnelVerifiedChannels,
          committee_companies: funnelCommittee,
          outreach_ready_companies: funnelOutreachReady,
          conversion_rates: {
            companies_to_named_pct: pct(funnelNamed, funnelCompanies),
            named_to_titled_pct: pct(funnelTitled, funnelNamed),
            titled_to_verified_channel_pct: pct(funnelVerifiedChannels, funnelTitled),
            verified_channel_to_committee_pct: pct(funnelCommittee, funnelVerifiedChannels),
            committee_to_outreach_ready_pct: pct(funnelOutreachReady, funnelCommittee),
            companies_to_outreach_ready_pct: pct(funnelOutreachReady, funnelCompanies),
          },
        },
        aggregate_counts: {
          total_named_persons: companyAudits.reduce((s, c) => s + c.named_persons, 0),
          total_titled_persons: companyAudits.reduce((s, c) => s + c.titled_persons, 0),
          total_verified_emails: companyAudits.reduce((s, c) => s + c.verified_emails, 0),
          total_verified_phones: companyAudits.reduce((s, c) => s + c.verified_phones, 0),
          total_committee_members: companyAudits.reduce((s, c) => s + c.committee_members, 0),
        },
        failure_categories: failureCategories,
        source_attribution_contact_signals: sourceAttribution,
        companies_with_named_persons: withNamed.length,
        companies_outreach_ready: withOutreach.length,
        sample_outreach_ready: withOutreach.slice(0, 5).map((c) => ({
          company_name: c.company_name,
          named_persons: c.named_persons,
          verified_emails: c.verified_emails,
          verified_phones: c.verified_phones,
        })),
        sample_zero_named: companyAudits
          .filter((c) => c.named_persons === 0)
          .slice(0, 8)
          .map((c) => ({
            company_name: c.company_name,
            contact_total: c.contact_total,
            company_channel_contacts: c.company_channel_contacts,
            failure_tags: c.failure_tags,
          })),
        optimization_opportunities: [
          {
            rank: 1,
            opportunity: "Deployed-runtime batch channel completion for all named persons (PS-IB)",
            target_failure: "channels_found_not_verified + named_person_no_channels",
            companies_affected_estimate: failureCategories.channels_found_not_verified ?? 0,
            estimated_outreach_ready_lift: "3–8 companies per 100 (based on PS-HZ-RUNTIME 1/15 proof)",
          },
          {
            rank: 2,
            opportunity: "Cohort-targeted external directory mining (BBB + manufacturer locators)",
            target_failure: "no_external_evidence + website_only_generic_channels",
            companies_affected_estimate:
              (failureCategories.no_external_evidence ?? 0) +
              (failureCategories.website_only_generic_channels ?? 0),
            estimated_outreach_ready_lift: "5–12 named-person companies per 100 (PS-HX 1/15 + corroboration)",
          },
          {
            rank: 3,
            opportunity: "Latent title recovery + committee evidence from corroboration excerpts",
            target_failure: "title_found_committee_failed",
            companies_affected_estimate: failureCategories.title_found_committee_failed ?? 0,
            estimated_outreach_ready_lift: "0–2 outreach-ready; committee lift 2–5 members per 100",
          },
          {
            rank: 4,
            opportunity: "Team/leadership page discovery expansion (sitemap + common paths)",
            target_failure: "no_team_page + no_about_page",
            companies_affected_estimate:
              (failureCategories.no_team_page ?? 0) + (failureCategories.no_about_page ?? 0),
            estimated_outreach_ready_lift: "1–4 named persons per 100 if pages exist but uncrawled",
          },
        ],
        biggest_loss_point: "named_person_companies → verified_channel_companies",
        recommended_next_phase: "7.PS-IB — Batch Graph Expansion + Deployed Channel Completion",
        company_audits: companyAudits,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
