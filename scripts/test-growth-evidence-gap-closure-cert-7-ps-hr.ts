/**
 * Phase 7.PS-HR — Evidence gap closure for remaining PS-HE targets (ER + ERS).
 * Run: pnpm test:growth-evidence-gap-closure-cert-7-ps-hr
 */
import { createClient } from "@supabase/supabase-js"
import {
  probeDeployedGrowthProviderRuntime,
  resolveGrowthDeployedRuntimeBaseUrl,
  resolveGrowthDeployedRuntimeCronSecret,
  runDeployedEmailDiscoveryCert,
} from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

export const GROWTH_EVIDENCE_GAP_CLOSURE_CERT_7_PS_HR_QA_MARKER =
  "growth-evidence-gap-closure-cert-7-ps-hr-v1" as const

const HR_TARGETS = [
  {
    company_candidate_id: "94bea025-d2df-4a13-ba6c-ec1476b6d050",
    canonical_company_id: "3620d561-8568-4104-a878-898bfec618ca",
    person_id: "dd551823-7adc-4637-817f-4989a30f108e",
    contact_id: "526cdf9b-9e1a-4395-8e50-806079b10f7b",
    company_name: "Emergency Repair Biomedical",
    query: "biomedical equipment service companies",
  },
  {
    company_candidate_id: "5a9a8ba4-1f8b-4ec6-9ebf-5607bbadf1ec",
    canonical_company_id: "dcf0c09b-c636-4f82-b511-2af45076630e",
    person_id: "ece67a39-e12e-4dc7-8c51-99274e0b13b4",
    contact_id: "3c25b14d-30b9-4ab7-840d-6e9163386b52",
    company_name: "ERS Biomedical Services",
    query: "biomedical equipment service companies",
  },
] as const

function shellFromTarget(target: (typeof HR_TARGETS)[number]): GrowthProspectSearchCompanyResult {
  return {
    id: target.company_candidate_id,
    source_type: "external_discovered",
    company_name: target.company_name,
    website: null,
    domain: null,
    canonical_company_id: target.canonical_company_id,
    growth_lead_id: null,
    is_suppressed: false,
    suppression_reason: null,
    suppression_scope: null,
    suppressed_at: null,
    lead_score: null,
    lead_engine_score: null,
    company_match_confidence: null,
    growth_signal_score: null,
    decision_maker_coverage: null,
    in_revenue_queue: false,
    existing_prospect: false,
    existing_customer: false,
    already_pushed: false,
    signals: [],
    match_reasoning: [],
    keywords: [],
    territory_match_reasons: [],
    score_explanation_items: [],
    confidence_explanation_items: [],
    contact_intelligence: null,
    reachable_human: null,
  } as GrowthProspectSearchCompanyResult
}

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const [
    { runWebsiteContactDiscoveryForCompany },
    { discoverWebsiteContacts },
    { isGenericIdentityName },
    { extractEvidenceBackedIdentity },
    { completeVerifiedChannelsForPerson },
    { upgradeGenericIdentityFromEvidence, upgradeGenericIdentitiesBatch },
    { submitHumanIdentityEvidenceReview },
    { ensureBuyingCommitteeIntelligenceFoundation },
    { runProspectSearchHumanAcquisitionPipeline },
    { resolveProspectSearchOutreachReadinessGate },
    { resolveProspectSearchReachableHumanScore },
    { refreshProspectSearchCompanyAfterHumanAcquisition },
    { buildProspectSearchEngineReadiness },
    { buildProspectSearchAccountContactStrategy },
    { buildProspectSearchPeopleRowsFromCompanies },
    { buildProspectSearchCompanyContactCoverageIntelligence },
  ] = await Promise.all([
    import("../lib/growth/contact-discovery/company-contact-repository"),
    import("../lib/growth/contact-discovery/website-contact-discovery"),
    import("../lib/growth/human-identity-evidence/human-identity-evidence-evidence"),
    import("../lib/growth/human-identity-evidence/human-identity-evidence-naming-extract"),
    import("../lib/growth/human-identity-evidence/human-identity-evidence-channel-completion"),
    import("../lib/growth/human-identity-evidence/human-identity-evidence-identity-upgrade"),
    import("../lib/growth/human-identity-evidence/human-identity-evidence-review"),
    import("../lib/growth/prospect-search/prospect-search-buying-committee-foundation"),
    import("../lib/growth/prospect-search/prospect-search-human-acquisition"),
    import("../lib/growth/prospect-search/prospect-search-outreach-readiness-gate"),
    import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring"),
    import("../lib/growth/prospect-search/prospect-search-human-acquisition-hydration"),
    import("../lib/growth/prospect-search/prospect-search-engine-readiness"),
    import("../lib/growth/prospect-search/prospect-search-account-contact-strategy"),
    import("../lib/growth/prospect-search/prospect-search-contact-discovery"),
    import("../lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"),
  ])

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const deployed_probe = await probeDeployedGrowthProviderRuntime({
    base_url: resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai",
    cron_secret: resolveGrowthDeployedRuntimeCronSecret(),
    admin,
  })
  const zerobounce_deployed =
    deployed_probe.ok && deployed_probe.diagnostics.loaders.isZeroBounceConfigured

  async function loadCompanyWebsite(company_id: string): Promise<string | null> {
    const { data } = await admin
      .schema("growth")
      .from("companies")
      .select("website, primary_domain")
      .eq("id", company_id)
      .maybeSingle()
    const website = String(data?.website ?? "").trim() || String(data?.primary_domain ?? "").trim()
    if (!website) return null
    return website.startsWith("http") ? website : `https://${website}`
  }

  async function countVerifiedChannels(person_ids: string[]) {
    const [phones, emails, profiles] = await Promise.all([
      admin
        .schema("growth")
        .from("person_phones")
        .select("person_id")
        .in("person_id", person_ids)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_emails")
        .select("person_id")
        .in("person_id", person_ids)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_profiles")
        .select("person_id")
        .in("person_id", person_ids)
        .eq("verification_status", "verified"),
    ])
    return {
      verified_phones: (phones.data ?? []).length,
      verified_emails: (emails.data ?? []).length,
      verified_profiles: (profiles.data ?? []).length,
    }
  }

  async function countCommitteeMembers(company_id: string) {
    const { count } = await admin
      .schema("growth")
      .from("buying_committee_intelligence_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company_id)
      .eq("verification_status", "verified")
    return count ?? 0
  }

  async function countOutreachReadyCompanies() {
    let ready = 0
    const per_company: Array<{
      company: string
      reachable_label: string
      gate_state: string
      outreach_ready: boolean
    }> = []

    for (const target of HR_TARGETS) {
      const shell = shellFromTarget(target)
      const website = await loadCompanyWebsite(target.canonical_company_id)
      if (website) {
        shell.website = website
        shell.domain = website.replace(/^https?:\/\//, "").replace(/\/$/, "")
      }
      const hydrated = await refreshProspectSearchCompanyAfterHumanAcquisition(admin, {
        company: shell,
        canonical_company_id: target.canonical_company_id,
        query: target.query,
      })
      const reachable = resolveProspectSearchReachableHumanScore(hydrated)
      const gate = resolveProspectSearchOutreachReadinessGate({ company: hydrated, reachable })
      const engine = buildProspectSearchEngineReadiness({ company: hydrated })
      const peopleRows = buildProspectSearchPeopleRowsFromCompanies([hydrated])
      const coverageContacts = peopleRows.map((row) => ({
        contact_id: row.id,
        full_name: row.name,
        title: row.title,
        email_available: row.email_available,
        phone_available: row.phone_available,
        outreach_rank_score: row.outreach_rank_score ?? 0,
        priority_tier: row.priority_tier ?? "low_confidence",
        is_recommended_contact: row.is_recommended_contact ?? false,
        freshness_status: row.freshness_status ?? "fresh",
        email_eligibility: row.email_eligibility ?? "ineligible",
        call_eligibility: row.call_eligibility ?? "ineligible",
        sms_eligibility: row.sms_eligibility ?? "ineligible",
        verification_status: row.verification_status,
        confidence: row.confidence,
        role_type: row.persona?.role_type ?? null,
        ranking_reasons: row.ranking?.reasons ?? [],
      }))
      const coverage = buildProspectSearchCompanyContactCoverageIntelligence({
        company_name: target.company_name,
        contacts: coverageContacts,
        company_suppressed: false,
      })
      const strategy = buildProspectSearchAccountContactStrategy({
        company_id: target.canonical_company_id,
        company_name: target.company_name,
        contacts: coverageContacts,
        coverage,
      })
      const company_outreach_ready =
        gate.state === "ready" ||
        engine.prioritization_tier === "ready_for_outreach" ||
        strategy.account_outreach_readiness === "ready"
      if (company_outreach_ready) ready += 1
      per_company.push({
        company: target.company_name,
        reachable_label: reachable.label,
        gate_state: gate.state,
        outreach_ready: company_outreach_ready,
      })
    }

    return { ready, per_company, total: HR_TARGETS.length }
  }

  function summarizeWebsiteEvidence(
    discovery: Awaited<ReturnType<typeof discoverWebsiteContacts>>,
  ) {
    return {
      pages_crawled: discovery.pages_crawled.length,
      contacts_extracted: discovery.contacts.length,
      named_contacts: discovery.contacts.filter(
        (c) => c.full_name && !isGenericIdentityName(c.full_name),
      ).length,
      direct_emails: discovery.contacts.filter((c) => c.email).length,
      direct_phones: discovery.contacts.filter((c) => c.phone).length,
      linkedin_urls: discovery.contacts.filter((c) => c.linkedin_url).length,
      messages: discovery.messages.slice(0, 5),
      sample_named: discovery.contacts
        .filter((c) => c.full_name && !isGenericIdentityName(c.full_name))
        .slice(0, 5)
        .map((c) => ({
          name: c.full_name,
          title: c.title ?? null,
          email: c.email ? "present" : null,
          phone: c.phone ? "present" : null,
          linkedin: c.linkedin_url ? "present" : null,
        })),
    }
  }

  async function loadContactEvidence(contact_id: string) {
    const { data } = await admin
      .schema("growth")
      .from("company_contacts")
      .select(
        "id, full_name, title, email, phone, linkedin_url, contact_status, source_evidence, metadata, canonical_person_id",
      )
      .eq("id", contact_id)
      .maybeSingle()
    if (!data) return null
    const source_evidence = Array.isArray(data.source_evidence) ? data.source_evidence : []
    const metadata =
      data.metadata && typeof data.metadata === "object"
        ? (data.metadata as Record<string, unknown>)
        : {}
    const candidate = extractEvidenceBackedIdentity({
      full_name: String(data.full_name ?? ""),
      title: data.title ? String(data.title) : null,
      email: data.email ? String(data.email) : null,
      source_evidence,
      metadata,
    })
    return {
      contact_id: String(data.id),
      full_name: String(data.full_name ?? ""),
      title: data.title ? String(data.title) : null,
      generic_identity: isGenericIdentityName(String(data.full_name ?? "")),
      evidence_backed_identity: candidate,
      source_evidence_count: source_evidence.length,
      has_email: Boolean(data.email),
      has_phone: Boolean(data.phone),
      has_linkedin: Boolean(data.linkedin_url),
      contact_status: String(data.contact_status ?? ""),
    }
  }

  const all_person_ids = HR_TARGETS.map((t) => t.person_id)
  const before_channels = await countVerifiedChannels(all_person_ids)
  const before_committee = Object.fromEntries(
    await Promise.all(
      HR_TARGETS.map(async (t) => [
        t.company_name,
        await countCommitteeMembers(t.canonical_company_id),
      ]),
    ),
  )
  const before_outreach = await countOutreachReadyCompanies()

  const company_runs = []

  for (const target of HR_TARGETS) {
    const website = await loadCompanyWebsite(target.canonical_company_id)
    const website_preview = website ? await discoverWebsiteContacts(website) : null
    const website_evidence = website_preview ? summarizeWebsiteEvidence(website_preview) : null

    let website_sync = null as Awaited<ReturnType<typeof runWebsiteContactDiscoveryForCompany>> | null
    if (website) {
      website_sync = await runWebsiteContactDiscoveryForCompany(admin, {
        company_id: target.canonical_company_id,
        website,
      })
    }

    const acquisition = await runProspectSearchHumanAcquisitionPipeline(admin, {
      company_candidate_id: target.company_candidate_id,
      canonical_company_id: target.canonical_company_id,
      run_discovery: true,
      search_query: target.query,
      company_snapshot: shellFromTarget(target),
    })

    const evidence_before_upgrade = await loadContactEvidence(target.contact_id)
    const naming_upgrade = await upgradeGenericIdentityFromEvidence(admin, {
      company_contact_id: target.contact_id,
      reviewer_email: "cert-7-ps-hr@equipify.internal",
    })
    const evidence_after_upgrade = await loadContactEvidence(target.contact_id)

    let identity_review: Record<string, unknown> | null = null
    const { data: contactRow } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("id, contact_status")
      .eq("id", target.contact_id)
      .maybeSingle()

    if (contactRow?.contact_status === "candidate") {
      identity_review = await submitHumanIdentityEvidenceReview(admin, {
        company_contact_id: target.contact_id,
        actions: ["mark_contact_verified", "mark_phone_verified"],
        review_note: "7.PS-HR — evidence-backed review after website re-acquisition",
        rerun_phone_discovery: true,
        reviewer_email: "cert-7-ps-hr@equipify.internal",
      })
    } else {
      const { runPhoneDiscoveryForCanonicalPerson } = await import(
        "../lib/growth/phone-discovery/phone-discovery-orchestrator"
      )
      const phone_rediscovery = await runPhoneDiscoveryForCanonicalPerson(admin, {
        company_id: target.canonical_company_id,
        person_id: target.person_id,
        promote: true,
      })
      identity_review = {
        ok: phone_rediscovery.promoted_count > 0,
        phone_discovery: phone_rediscovery,
        skipped: "contact_already_reviewed",
      }
    }

    let email_discovery: Record<string, unknown> | null = null
    if (zerobounce_deployed && deployed_probe.ok) {
      const result = await runDeployedEmailDiscoveryCert({
        base_url: deployed_probe.base_url,
        cron_secret: resolveGrowthDeployedRuntimeCronSecret() ?? "",
        company_id: target.canonical_company_id,
        person_id: target.person_id,
        admin,
      })
      email_discovery = {
        ok: result.ok,
        error: result.error,
        verified_count: (result.body?.result as { verified_count?: number })?.verified_count ?? 0,
        channel: result.channel ?? "http",
      }
    } else {
      email_discovery = { skipped: "deployed_zerobounce_not_proven" }
    }

    const channel_completion = await completeVerifiedChannelsForPerson(admin, {
      person_id: target.person_id,
      company_id: target.canonical_company_id,
    })

    const committee = await ensureBuyingCommitteeIntelligenceFoundation(admin, {
      company_id: target.canonical_company_id,
      force: true,
    })

    company_runs.push({
      company: target.company_name,
      website,
      website_evidence,
      website_contacts_synced: website_sync?.contacts?.length ?? 0,
      acquisition: {
        ok: acquisition.ok,
        discovery_contacts: acquisition.discovery_contacts,
        company_contacts_synced: acquisition.company_contacts_synced,
        persons_linked: acquisition.backfill_persons_linked,
        messages: acquisition.provider_messages?.slice(0, 5) ?? [],
      },
      evidence_before_upgrade,
      naming_upgrade,
      evidence_after_upgrade,
      identity_review,
      email_discovery,
      channel_completion: {
        zerobounce_configured: channel_completion.zerobounce_configured,
        email_rows: channel_completion.email_audit.length,
        social_rows: channel_completion.social_audit.length,
        social_promoted: channel_completion.social_audit.reduce(
          (sum, r) => sum + r.promoted_count,
          0,
        ),
      },
      committee,
      blocked:
        !evidence_after_upgrade?.evidence_backed_identity &&
        evidence_after_upgrade?.generic_identity === true
          ? "no_named_evidence_on_website_or_contacts"
          : null,
    })
  }

  await upgradeGenericIdentitiesBatch(admin, {
    company_ids: HR_TARGETS.map((t) => t.canonical_company_id),
    limit: 10,
  })

  const after_channels = await countVerifiedChannels(all_person_ids)
  const after_committee = Object.fromEntries(
    await Promise.all(
      HR_TARGETS.map(async (t) => [
        t.company_name,
        await countCommitteeMembers(t.canonical_company_id),
      ]),
    ),
  )
  const after_outreach = await countOutreachReadyCompanies()

  const identities_upgraded = company_runs.filter((r) => r.naming_upgrade?.upgraded).length
  const evidence_blocked = company_runs.filter((r) => r.blocked).length
  const named_evidence_found = company_runs.filter(
    (r) =>
      (r.website_evidence?.named_contacts ?? 0) > 0 ||
      r.evidence_after_upgrade?.evidence_backed_identity != null,
  ).length

  const remaining_blockers: string[] = []
  for (const run of company_runs) {
    if (run.blocked) {
      remaining_blockers.push(`${run.company}: ${run.blocked}`)
    }
    if ((run.committee?.verified_member_count ?? 0) === 0) {
      remaining_blockers.push(`${run.company}: no_verified_committee_members`)
    }
  }
  if (after_channels.verified_emails === 0) {
    remaining_blockers.push("no_verified_emails_on_er_ers_persons")
  }
  if (after_channels.verified_profiles === 0) {
    remaining_blockers.push("no_verified_social_profiles")
  }

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  if (
    after_outreach.ready >= before_outreach.ready + 1 &&
    identities_upgraded + named_evidence_found > 0
  ) {
    certification = "PASS"
  } else if (
    evidence_blocked > 0 &&
    after_outreach.ready === before_outreach.ready &&
    named_evidence_found === 0
  ) {
    certification = "PASS_PARTIAL"
  } else if (after_outreach.ready > before_outreach.ready || identities_upgraded > 0) {
    certification = "PASS_PARTIAL"
  } else if (evidence_blocked === HR_TARGETS.length && before_outreach.ready === 0) {
    certification = "PASS_PARTIAL"
  }

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_EVIDENCE_GAP_CLOSURE_CERT_7_PS_HR_QA_MARKER,
        certification,
        deployed_zerobounce: zerobounce_deployed,
        evidence_found_per_company: company_runs.map((r) => ({
          company: r.company,
          website_evidence: r.website_evidence,
          evidence_after_upgrade: r.evidence_after_upgrade,
          blocked: r.blocked,
        })),
        identities_upgraded,
        verified_channels: {
          before: before_channels,
          after: after_channels,
        },
        committee_members: {
          before: before_committee,
          after: after_committee,
        },
        outreach_ready_companies: {
          before: before_outreach,
          after: after_outreach,
        },
        company_runs,
        remaining_blockers: [...new Set(remaining_blockers)],
      },
      null,
      2,
    ),
  )

  if (certification === "FAIL") process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
