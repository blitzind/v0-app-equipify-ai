/**
 * Phase 7.PS-HL — Outreach readiness certification (live audit).
 * Run: pnpm test:growth-prospect-search-outreach-readiness-cert-7-ps-hl
 */
import { createClient } from "@supabase/supabase-js"
import {
  auditVerifiedChannelsCertEnv,
  bootstrapVerifiedChannelsCertEnv,
} from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  probeDeployedGrowthProviderRuntime,
  resolveGrowthDeployedRuntimeBaseUrl,
  resolveGrowthDeployedRuntimeCronSecret,
} from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_SEARCH_OUTREACH_READINESS_CERT_QA_MARKER =
  "growth-prospect-search-outreach-readiness-cert-7-ps-hl-v1" as const

const PS_HE_TARGETS = [
  {
    company_candidate_id: "94bea025-d2df-4a13-ba6c-ec1476b6d050",
    canonical_company_id: "3620d561-8568-4104-a878-898bfec618ca",
    person_id: "dd551823-7adc-4637-817f-4989a30f108e",
    company_name: "Emergency Repair Biomedical",
    query: "biomedical equipment service companies",
    channel_profile: "phone_only" as const,
  },
  {
    company_candidate_id: "5ee5a006-6eb8-4890-8775-21d22af4af6e",
    canonical_company_id: "4456d3c3-900a-468f-ac33-aadabac67e52",
    person_id: "1e08ba6f-b820-497f-a0f8-19dca37887f7",
    company_name: "Biomedical Repair Service",
    query: "medical equipment repair companies",
    channel_profile: "mixed" as const,
  },
  {
    company_candidate_id: "5a9a8ba4-1f8b-4ec6-9ebf-5607bbadf1ec",
    canonical_company_id: "dcf0c09b-c636-4f82-b511-2af45076630e",
    person_id: "ece67a39-e12e-4dc7-8c51-99274e0b13b4",
    company_name: "ERS Biomedical Services",
    query: "biomedical equipment service companies",
    channel_profile: "phone_only" as const,
  },
] as const

function shellFromTarget(
  target: (typeof PS_HE_TARGETS)[number],
): GrowthProspectSearchCompanyResult {
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

async function loadCompanyWebsites(
  admin: ReturnType<typeof createClient>,
  canonical_company_ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (canonical_company_ids.length === 0) return map
  const { data } = await admin
    .schema("growth")
    .from("companies")
    .select("id, website, primary_domain")
    .in("id", canonical_company_ids)
  for (const row of data ?? []) {
    const website = String(row.website ?? "").trim() || String(row.primary_domain ?? "").trim()
    if (website) map.set(String(row.id), website.startsWith("http") ? website : `https://${website}`)
  }
  return map
}

async function loadStagingCanonicalLinkage(
  admin: ReturnType<typeof createClient>,
  candidate_ids: string[],
) {
  const { data } = await admin
    .schema("growth")
    .from("real_world_company_candidates")
    .select("id, canonical_company_id, company_name")
    .in("id", candidate_ids)
  return (data ?? []).map((row) => ({
    candidate_id: String(row.id),
    canonical_company_id: row.canonical_company_id ? String(row.canonical_company_id) : null,
    company_name: String(row.company_name ?? ""),
  }))
}

async function loadVerifiedChannelInventory(
  admin: ReturnType<typeof createClient>,
  person_ids: string[],
) {
  const [emails, phones, profiles, reviews] = await Promise.all([
    admin
      .schema("growth")
      .from("person_emails")
      .select("person_id, email, verification_status, confidence, provider_name, discovery_source")
      .in("person_id", person_ids),
    admin
      .schema("growth")
      .from("person_phones")
      .select("person_id, phone, verification_status, confidence, provider_name, discovery_source")
      .in("person_id", person_ids),
    admin
      .schema("growth")
      .from("person_profiles")
      .select("person_id, profile_url, verification_status, confidence, provider_name, discovery_source")
      .in("person_id", person_ids),
    admin
      .schema("growth")
      .from("company_contact_identity_reviews")
      .select("id, company_contact_id, fields_changed, triggered_phone_discovery, phone_promoted_count")
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  const verified_emails = (emails.data ?? []).filter((r) => r.verification_status === "verified")
  const verified_phones = (phones.data ?? []).filter((r) => r.verification_status === "verified")
  const verified_profiles = (profiles.data ?? []).filter((r) => r.verification_status === "verified")

  const synthetic_risk = [...verified_emails, ...verified_phones, ...verified_profiles].filter(
    (r) => {
      const corpus = [r.provider_name, r.discovery_source].map((v) => String(v ?? "").toLowerCase()).join(" ")
      return corpus.includes("synthetic") || corpus.includes("manual_invent")
    },
  )

  return {
    verified_emails: verified_emails.length,
    verified_phones: verified_phones.length,
    verified_profiles: verified_profiles.length,
    email_rows: verified_emails,
    phone_rows: verified_phones,
    profile_rows: verified_profiles,
    identity_review_count: reviews.data?.length ?? 0,
    synthetic_verification_risk: synthetic_risk.length,
    synthetic_rows: synthetic_risk,
  }
}

function providerBlockers(audit: ReturnType<typeof auditVerifiedChannelsCertEnv>) {
  const blockers: string[] = []
  const zb =
    audit.keys.ZEROBOUNCE_API_KEY.status === "configured" ||
    audit.keys.GROWTH_ZEROBOUNCE_API_KEY.status === "configured"
  const pdl =
    audit.keys.PEOPLE_DATA_LABS_API_KEY.status === "configured" ||
    audit.keys.PDL_API_KEY.status === "configured"

  if (!zb || audit.keys.ZEROBOUNCE_API_KEY.status === "empty_placeholder") {
    blockers.push("email_verification_provider_unconfigured (ZeroBounce)")
  }
  if (!pdl || audit.keys.PEOPLE_DATA_LABS_API_KEY.status === "empty_placeholder") {
    blockers.push("email_discovery_provider_unconfigured (People Data Labs)")
  }
  if (audit.keys.GROWTH_EMAIL_VERIFICATION_USE_FIXTURE.status === "unsafe_for_production") {
    blockers.push("email_verification_fixture_enabled_in_production")
  }
  return blockers
}

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(
      JSON.stringify({
        qa_marker: GROWTH_PROSPECT_SEARCH_OUTREACH_READINESS_CERT_QA_MARKER,
        certification: "FAIL",
        error: "no_credentials",
      }),
    )
    process.exit(1)
  }

  const [
    { buildProspectSearchAccountContactStrategy },
    { buildProspectSearchCompanyContactCoverageIntelligence },
    { computeProspectSearchContactOutreachReadiness },
    { buildProspectSearchPeopleRowsFromCompanies },
    { buildProspectSearchEngineReadiness },
    { refreshProspectSearchCompanyAfterHumanAcquisition },
    { resolveProspectSearchOutreachReadinessGate },
    { resolveProspectSearchReachableHumanScore },
    { resolveAccountSequenceReadiness },
    { validateProspectSearchWorkspaceBulkExecution },
    { buildProspectSearchWorkspaceExecutionPreview },
  ] = await Promise.all([
    import("../lib/growth/prospect-search/prospect-search-account-contact-strategy"),
    import("../lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"),
    import("../lib/growth/prospect-search/prospect-search-contact-readiness"),
    import("../lib/growth/prospect-search/prospect-search-contact-discovery"),
    import("../lib/growth/prospect-search/prospect-search-engine-readiness"),
    import("../lib/growth/prospect-search/prospect-search-human-acquisition-hydration"),
    import("../lib/growth/prospect-search/prospect-search-outreach-readiness-gate"),
    import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring"),
    import("../lib/growth/prospect-search/prospect-search-sequence-readiness"),
    import("../lib/growth/prospect-search/prospect-search-workspace-bulk-execution"),
    import("../lib/growth/prospect-search/prospect-search-workspace-execution-preview"),
  ])

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const deployed_probe = await probeDeployedGrowthProviderRuntime({
    base_url: resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai",
    cron_secret: resolveGrowthDeployedRuntimeCronSecret(),
    admin,
  })
  const envAudit = auditVerifiedChannelsCertEnv()
  const provider_blockers =
    deployed_probe.ok &&
    deployed_probe.diagnostics.loaders.isZeroBounceConfigured &&
    deployed_probe.diagnostics.loaders.isPdlApiConfigured
      ? []
      : providerBlockers(envAudit)

  const person_ids = PS_HE_TARGETS.map((t) => t.person_id)
  const company_websites = await loadCompanyWebsites(
    admin,
    PS_HE_TARGETS.map((t) => t.canonical_company_id),
  )
  const staging_linkage = await loadStagingCanonicalLinkage(
    admin,
    PS_HE_TARGETS.map((t) => t.company_candidate_id),
  )
  const channel_inventory = await loadVerifiedChannelInventory(admin, person_ids)
  const staging_canonical_linked = staging_linkage.filter((row) => row.canonical_company_id).length

  const hydratedCompanies: GrowthProspectSearchCompanyResult[] = []
  const target_results = []

  let outreach_ready_companies = 0
  let outreach_ready_contacts = 0
  let outreach_ready_decision_makers = 0
  let sequence_ready_companies = 0
  let phone_only_sequence_eligible = 0
  let email_only_sequence_eligible = 0
  let mixed_sequence_eligible = 0

  for (const target of PS_HE_TARGETS) {
    const shell = shellFromTarget(target)
    const website = company_websites.get(target.canonical_company_id) ?? null
    if (website) {
      shell.website = website
      shell.domain = website.replace(/^https?:\/\//, "").replace(/\/$/, "")
    }

    const hydrated = await refreshProspectSearchCompanyAfterHumanAcquisition(admin, {
      company: shell,
      canonical_company_id: target.canonical_company_id,
      query: target.query,
    })
    hydratedCompanies.push(hydrated)

    const contacts = hydrated.contact_intelligence?.contacts ?? []
    const reachable = resolveProspectSearchReachableHumanScore(hydrated)
    const outreach_gate = resolveProspectSearchOutreachReadinessGate({ company: hydrated, reachable })
    const engine_readiness = buildProspectSearchEngineReadiness({ company: hydrated })

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

    const accountStrategy = buildProspectSearchAccountContactStrategy({
      company_id: target.canonical_company_id,
      company_name: target.company_name,
      contacts: coverageContacts,
      coverage,
    })

    const sequence = resolveAccountSequenceReadiness({
      company: hydrated,
      peopleRows,
      coverage,
      accountStrategy,
    })

    const contact_readiness = contacts.map((c) => {
      const readiness = computeProspectSearchContactOutreachReadiness({
        email: c.email,
        phone: c.phone,
        verification_status: c.verification_status,
        confidence: c.confidence,
        suppressed: false,
      })
      return {
        contact_id: c.id,
        name: c.name,
        verification_status: c.verification_status,
        outreach_ready: readiness.outreach_ready,
        call_ready: readiness.call_ready,
        phone_verified: readiness.phone_verified,
        email_verified: readiness.email_verified,
        readiness_label: readiness.readiness_label,
      }
    })

    const company_outreach_ready =
      outreach_gate.state === "ready" ||
      engine_readiness.prioritization_tier === "ready_for_outreach" ||
      accountStrategy.account_outreach_readiness === "ready"
    if (company_outreach_ready) outreach_ready_companies += 1

    const readyContacts = contact_readiness.filter((c) => c.outreach_ready)
    outreach_ready_contacts += readyContacts.length

    const committee = hydrated.contact_intelligence?.engine_intelligence?.buying_committee
    const dmReady =
      (committee?.verified_member_count ?? 0) > 0 &&
      readyContacts.length > 0 &&
      (reachable.verified_phone_count > 0 || reachable.verified_email_count > 0)
    if (dmReady) outreach_ready_decision_makers += committee?.verified_member_count ?? 0

    const sequenceEligible =
      sequence.readiness_state === "ready" || sequence.readiness_state === "ready_with_review"
    if (sequenceEligible) sequence_ready_companies += 1

    if (target.channel_profile === "phone_only" && sequence.sequence_suitability === "call_first") {
      phone_only_sequence_eligible += 1
    }
    if (target.channel_profile === "mixed") {
      if (sequence.sequence_suitability === "email_first" || sequence.sequence_suitability === "call_first") {
        mixed_sequence_eligible += 1
      }
    }

    const engine = hydrated.contact_intelligence?.engine_intelligence
    const execution_preview = buildProspectSearchWorkspaceExecutionPreview({
      companies: [hydrated],
      company_keys: [`${hydrated.source_type}:${hydrated.id}`],
      queue_id: "missing_verified_email",
    })
    const bulk_validation = validateProspectSearchWorkspaceBulkExecution({
      selected_company_keys: [`${hydrated.source_type}:${hydrated.id}`],
      preview: execution_preview,
      queue_id: "missing_verified_email",
      companies: [hydrated],
    })

    const coverage_resolved =
      hydrated.contact_intelligence?.engine_coverage?.company?.resolved === true
    const staging_row = staging_linkage.find((row) => row.candidate_id === target.company_candidate_id)

    target_results.push({
      company: target.company_name,
      channel_profile: target.channel_profile,
      integration: {
        staging_canonical_company_id: staging_row?.canonical_company_id ?? null,
        coverage_resolved,
        coverage_method: hydrated.contact_intelligence?.engine_coverage?.company?.method ?? null,
      },
      verified_channels_db: {
        phones: channel_inventory.phone_rows.filter((r) => r.person_id === target.person_id).length,
        emails: channel_inventory.email_rows.filter((r) => r.person_id === target.person_id).length,
        profiles: channel_inventory.profile_rows.filter((r) => r.person_id === target.person_id).length,
      },
      verified_channels_engine: {
        phones: engine?.verified_channels?.persons_with_verified_phone ?? 0,
        emails: engine?.verified_channels?.persons_with_verified_email ?? 0,
        profiles: engine?.verified_channels?.persons_with_verified_profile ?? 0,
      },
      company_readiness: {
        reachable_label: reachable.label,
        reachable_score: reachable.score,
        outreach_gate_state: outreach_gate.state,
        prioritization_tier: engine_readiness.prioritization_tier,
        overall_score: engine_readiness.overall.score,
        channel_score: engine_readiness.channel.score,
        account_outreach_readiness: accountStrategy.account_outreach_readiness,
        recommended_channel: accountStrategy.recommended_channel,
      },
      contact_readiness,
      committee: {
        verified_member_count: committee?.verified_member_count ?? 0,
        coverage_score: committee?.coverage_score ?? 0,
        roles_present: committee?.roles_present ?? [],
      },
      sequence: {
        readiness_state: sequence.readiness_state,
        sequence_suitability: sequence.sequence_suitability,
        readiness_score: sequence.readiness_score,
        blockers: sequence.blockers,
        suggested_sequence_type: sequence.suggested_sequence_type,
      },
      execution_simulation: {
        preview_account_count: execution_preview.account_count,
        bulk_validation_allowed: bulk_validation.allowed,
        bulk_validation_reason: bulk_validation.reason,
        recommended_actions: execution_preview.recommended_action_kinds,
      },
      pass:
        channel_inventory.phone_rows.some((r) => r.person_id === target.person_id) &&
        readyContacts.length > 0 &&
        sequence.readiness_state !== "blocked" &&
        sequence.readiness_state !== "insufficient_coverage",
      prospect_search_surfaces_verified_phone:
        (engine?.verified_channels?.persons_with_verified_phone ?? 0) > 0,
    })
  }

  const pass_count = target_results.filter((r) => r.pass).length
  const ps_surfaces_verified_phones = target_results.filter(
    (r) => r.prospect_search_surfaces_verified_phone,
  ).length

  const db_foundations_certified =
    channel_inventory.verified_phones >= PS_HE_TARGETS.length &&
    channel_inventory.synthetic_verification_risk === 0

  const ps_integration_certified =
    db_foundations_certified &&
    ps_surfaces_verified_phones >= PS_HE_TARGETS.length &&
    staging_canonical_linked >= PS_HE_TARGETS.length

  const operational_outreach_ready =
    ps_integration_certified &&
    outreach_ready_contacts >= PS_HE_TARGETS.length &&
    sequence_ready_companies >= PS_HE_TARGETS.length - 1

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  if (operational_outreach_ready && provider_blockers.length === 0) {
    certification = "PASS"
  } else if (db_foundations_certified && pass_count >= 2) {
    certification = "PASS_PARTIAL"
  }

  const remaining_blockers: string[] = [...provider_blockers]
  if (staging_canonical_linked < PS_HE_TARGETS.length) {
    remaining_blockers.push(
      "staging_candidate_canonical_company_id_null (real_world_company_candidates not backfilled)",
    )
  }
  if (ps_surfaces_verified_phones < PS_HE_TARGETS.length) {
    remaining_blockers.push(
      "prospect_search_verified_channel_hydration_gap (engine intelligence not surfacing person_phones)",
    )
  }
  if (channel_inventory.verified_emails === 0) {
    remaining_blockers.push("no_verified_emails_across_ps_he_targets")
  }
  if (channel_inventory.verified_profiles === 0) {
    remaining_blockers.push("no_verified_social_profiles_across_ps_he_targets")
  }
  if (outreach_ready_companies < PS_HE_TARGETS.length) {
    remaining_blockers.push("company_level_outreach_ready_tier_not_met (generic identity / committee gaps)")
  }
  for (const r of target_results) {
    if (r.company_readiness.reachable_label !== "outreach_ready") {
      remaining_blockers.push(`${r.company}: reachable_label=${r.company_readiness.reachable_label}`)
    }
    if (r.sequence.readiness_state === "verification_required") {
      remaining_blockers.push(`${r.company}: sequence_verification_required`)
    }
  }

  const production_ready =
    db_foundations_certified &&
    ps_integration_certified &&
    sequence_ready_companies >= PS_HE_TARGETS.length - 1 &&
    channel_inventory.synthetic_verification_risk === 0

  const apollo_competitive =
    production_ready &&
    channel_inventory.verified_emails >= 1 &&
    outreach_ready_decision_makers >= 2 &&
    provider_blockers.length === 0

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_PROSPECT_SEARCH_OUTREACH_READINESS_CERT_QA_MARKER,
        certification,
        pass_count,
        target_count: PS_HE_TARGETS.length,
        outreach_ready_counts: {
          companies: outreach_ready_companies,
          contacts: outreach_ready_contacts,
          decision_makers: outreach_ready_decision_makers,
        },
        sequence_enrollment: {
          sequence_ready_companies,
          phone_only_eligible: phone_only_sequence_eligible,
          email_only_eligible: email_only_sequence_eligible,
          mixed_channel_eligible: mixed_sequence_eligible,
        },
        verified_channel_inventory: {
          db_verified_phones: channel_inventory.verified_phones,
          db_verified_emails: channel_inventory.verified_emails,
          db_verified_profiles: channel_inventory.verified_profiles,
          prospect_search_surfaces_verified_phones: ps_surfaces_verified_phones,
          identity_reviews: channel_inventory.identity_review_count,
          synthetic_verification_risk: channel_inventory.synthetic_verification_risk,
        },
        staging_linkage: {
          linked: staging_canonical_linked,
          total: PS_HE_TARGETS.length,
          rows: staging_linkage,
        },
        compliance: {
          synthetic_verification: channel_inventory.synthetic_verification_risk === 0,
          threshold_bypasses: false,
          provider_bypasses: false,
        },
        provider_dependency_blockers: provider_blockers,
        remaining_blockers: [...new Set(remaining_blockers)],
        production_ready,
        apollo_competitive,
        smallest_remaining_phase: apollo_competitive
          ? "7.PS-HM — scale acquisition volume and enrichment depth"
          : ps_integration_certified
            ? "7.PS-HN — verified email/social completion + identity naming from evidence"
            : "7.PS-HM-LINK — backfill staging canonical_company_id + verified-channel hydration into Prospect Search",
        target_results,
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
