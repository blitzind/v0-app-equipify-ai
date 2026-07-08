/**
 * Phase 7.PS-HO — Provider activation & verified email completion certification.
 * Run: pnpm test:growth-provider-activation-verified-email-cert-7-ps-ho
 */
import { createClient } from "@supabase/supabase-js"
import { evaluateEmailDiscoveryVerificationCertification } from "../lib/growth/email-discovery/email-discovery-certification"
import {
  isEmailVerificationDisabled,
  isEmailVerificationFixtureEnabled,
  isZeroBounceConfigured,
} from "../lib/growth/contact-verification/providers/zerobounce-config"
import { isPdlApiConfigured } from "../lib/growth/providers/pdl/pdl-config"
import {
  probeDeployedGrowthProviderRuntime,
  resolveGrowthDeployedRuntimeBaseUrl,
  resolveGrowthDeployedRuntimeCronSecret,
  runDeployedEmailDiscoveryCert,
} from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import { buildLocalProviderLoaderStatus } from "../lib/growth/qa/growth-provider-runtime-diagnostics"
import {
  auditProviderRuntimeEnvResolution,
  GROWTH_PROVIDER_RUNTIME_ENV_RESOLUTION_QA_MARKER,
} from "../lib/growth/qa/provider-runtime-env-resolution"
import {
  auditVerifiedChannelsCertEnv,
  bootstrapVerifiedChannelsCertEnv,
} from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROVIDER_ACTIVATION_VERIFIED_EMAIL_CERT_QA_MARKER =
  "growth-provider-activation-verified-email-cert-7-ps-ho-v1" as const

const PS_HE_TARGETS = [
  {
    company_candidate_id: "94bea025-d2df-4a13-ba6c-ec1476b6d050",
    canonical_company_id: "3620d561-8568-4104-a878-898bfec618ca",
    person_id: "dd551823-7adc-4637-817f-4989a30f108e",
    company_name: "Emergency Repair Biomedical",
    query: "biomedical equipment service companies",
  },
  {
    company_candidate_id: "5ee5a006-6eb8-4890-8775-21d22af4af6e",
    canonical_company_id: "4456d3c3-900a-468f-ac33-aadabac67e52",
    person_id: "1e08ba6f-b820-497f-a0f8-19dca37887f7",
    company_name: "Biomedical Repair Service",
    query: "medical equipment repair companies",
  },
  {
    company_candidate_id: "5a9a8ba4-1f8b-4ec6-9ebf-5607bbadf1ec",
    canonical_company_id: "dcf0c09b-c636-4f82-b511-2af45076630e",
    person_id: "ece67a39-e12e-4dc7-8c51-99274e0b13b4",
    company_name: "ERS Biomedical Services",
    query: "biomedical equipment service companies",
  },
] as const

const PROVIDER_ENV_KEYS = [
  "ZEROBOUNCE_API_KEY",
  "GROWTH_ZEROBOUNCE_API_KEY",
  "PEOPLE_DATA_LABS_API_KEY",
  "PDL_API_KEY",
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

function fileProviderBlockers(audit: ReturnType<typeof auditVerifiedChannelsCertEnv>): string[] {
  const blockers: string[] = []
  for (const key of PROVIDER_ENV_KEYS) {
    const status = audit.keys[key].status
    if (status === "empty_placeholder") {
      blockers.push(`${key}: empty_placeholder rejected`)
    }
  }
  const zbConfigured =
    audit.keys.ZEROBOUNCE_API_KEY.status === "configured" ||
    audit.keys.GROWTH_ZEROBOUNCE_API_KEY.status === "configured"
  if (!zbConfigured) {
    blockers.push("email_verification_provider_unconfigured (ZeroBounce)")
  }
  if (audit.keys.GROWTH_EMAIL_VERIFICATION_USE_FIXTURE.status === "unsafe_for_production") {
    blockers.push("email_verification_fixture_enabled_in_production")
  }
  return blockers
}

function runtimeProviderAudit() {
  const email_cert = evaluateEmailDiscoveryVerificationCertification()
  return {
    zerobounce_configured: isZeroBounceConfigured(),
    pdl_configured: isPdlApiConfigured(),
    fixture_enabled: isEmailVerificationFixtureEnabled(),
    verification_disabled: isEmailVerificationDisabled(),
    email_discovery_cert: email_cert,
    production_safe: email_cert.production_safe,
  }
}

async function loadVerifiedEmailInventory(
  admin: ReturnType<typeof createClient>,
  person_ids: string[],
) {
  const { data } = await admin
    .schema("growth")
    .from("person_emails")
    .select(
      "person_id, email, verification_status, promotion_status, provider_name, discovery_source, confidence",
    )
    .in("person_id", person_ids)

  const rows = data ?? []
  const verified = rows.filter((r) => r.verification_status === "verified")
  const promoted = rows.filter((r) => r.promotion_status === "promoted")
  const synthetic_risk = verified.filter((r) => {
    const corpus = [r.provider_name, r.discovery_source]
      .map((v) => String(v ?? "").toLowerCase())
      .join(" ")
    return (
      corpus.includes("synthetic") ||
      corpus.includes("fixture") ||
      corpus.includes("heuristic") ||
      corpus.includes("manual_invent")
    )
  })
  const provider_backed = verified.filter((r) => {
    const provider = String(r.provider_name ?? "").toLowerCase()
    return provider.includes("zerobounce") || provider.includes("zero_bounce")
  })

  return {
    total_rows: rows.length,
    verified_count: verified.length,
    promoted_count: promoted.length,
    provider_backed_count: provider_backed.length,
    synthetic_risk_count: synthetic_risk.length,
    rows,
    verified_rows: verified,
  }
}

async function measureOutreachSnapshot(
  admin: ReturnType<typeof createClient>,
  deps: {
    refreshProspectSearchCompanyAfterHumanAcquisition: typeof import("../lib/growth/prospect-search/prospect-search-human-acquisition-hydration").refreshProspectSearchCompanyAfterHumanAcquisition
    buildProspectSearchEngineReadiness: typeof import("../lib/growth/prospect-search/prospect-search-engine-readiness").buildProspectSearchEngineReadiness
    resolveProspectSearchOutreachReadinessGate: typeof import("../lib/growth/prospect-search/prospect-search-outreach-readiness-gate").resolveProspectSearchOutreachReadinessGate
    resolveProspectSearchReachableHumanScore: typeof import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring").resolveProspectSearchReachableHumanScore
    buildProspectSearchAccountContactStrategy: typeof import("../lib/growth/prospect-search/prospect-search-account-contact-strategy").buildProspectSearchAccountContactStrategy
    buildProspectSearchCompanyContactCoverageIntelligence: typeof import("../lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence").buildProspectSearchCompanyContactCoverageIntelligence
    buildProspectSearchPeopleRowsFromCompanies: typeof import("../lib/growth/prospect-search/prospect-search-contact-discovery").buildProspectSearchPeopleRowsFromCompanies
    resolveAccountSequenceReadiness: typeof import("../lib/growth/prospect-search/prospect-search-sequence-readiness").resolveAccountSequenceReadiness
  },
) {
  let outreach_ready_companies = 0
  let sequence_ready_companies = 0
  const per_company: Array<{
    company: string
    outreach_ready: boolean
    sequence_ready: boolean
    verified_emails_engine: number
    prioritization_tier: string | null
    sequence_state: string
  }> = []

  for (const target of PS_HE_TARGETS) {
    const shell = shellFromTarget(target)
    const hydrated = await deps.refreshProspectSearchCompanyAfterHumanAcquisition(admin, {
      company: shell,
      canonical_company_id: target.canonical_company_id,
      query: target.query,
    })

    const reachable = deps.resolveProspectSearchReachableHumanScore(hydrated)
    const outreach_gate = deps.resolveProspectSearchOutreachReadinessGate({
      company: hydrated,
      reachable,
    })
    const engine_readiness = deps.buildProspectSearchEngineReadiness({ company: hydrated })
    const peopleRows = deps.buildProspectSearchPeopleRowsFromCompanies([hydrated])
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
    const coverage = deps.buildProspectSearchCompanyContactCoverageIntelligence({
      company_name: target.company_name,
      contacts: coverageContacts,
      company_suppressed: false,
    })
    const accountStrategy = deps.buildProspectSearchAccountContactStrategy({
      company_id: target.canonical_company_id,
      company_name: target.company_name,
      contacts: coverageContacts,
      coverage,
    })
    const sequence = deps.resolveAccountSequenceReadiness({
      company: hydrated,
      peopleRows,
      coverage,
      accountStrategy,
    })

    const engine = hydrated.contact_intelligence?.engine_intelligence
    const company_outreach_ready =
      outreach_gate.state === "ready" ||
      engine_readiness.prioritization_tier === "ready_for_outreach" ||
      accountStrategy.account_outreach_readiness === "ready"
    const sequence_ready =
      sequence.readiness_state === "ready" ||
      sequence.readiness_state === "ready_with_review"

    if (company_outreach_ready) outreach_ready_companies += 1
    if (sequence_ready) sequence_ready_companies += 1

    per_company.push({
      company: target.company_name,
      outreach_ready: company_outreach_ready,
      sequence_ready: sequence_ready,
      verified_emails_engine: engine?.verified_channels?.persons_with_verified_email ?? 0,
      prioritization_tier: engine_readiness.prioritization_tier,
      sequence_state: sequence.readiness_state,
    })
  }

  return {
    outreach_ready_companies,
    sequence_ready_companies,
    per_company,
  }
}

async function main() {
  const resolution_before = auditProviderRuntimeEnvResolution()
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(
      JSON.stringify({
        qa_marker: GROWTH_PROVIDER_ACTIVATION_VERIFIED_EMAIL_CERT_QA_MARKER,
        certification: "FAIL",
        error: "no_credentials",
      }),
    )
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const deployed_probe = await probeDeployedGrowthProviderRuntime({
    base_url: resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai",
    cron_secret: resolveGrowthDeployedRuntimeCronSecret(),
    admin,
  })
  const file_audit = auditVerifiedChannelsCertEnv()
  const resolution_after = auditProviderRuntimeEnvResolution({ runtimeProcessEnv: process.env })
  const runtime = runtimeProviderAudit()
  const local_loader = buildLocalProviderLoaderStatus(process.env)
  const provider_loader_status = deployed_probe.ok
    ? {
        source: "deployed_runtime" as const,
        isZeroBounceConfigured: deployed_probe.diagnostics.loaders.isZeroBounceConfigured,
        isPdlApiConfigured: deployed_probe.diagnostics.loaders.isPdlApiConfigured,
        production_safe: deployed_probe.diagnostics.production_safe,
      }
    : {
        source: "local_cert_runner_fallback" as const,
        isZeroBounceConfigured: local_loader.isZeroBounceConfigured,
        isPdlApiConfigured: local_loader.isPdlApiConfigured,
        production_safe: runtime.production_safe,
        deployed_probe_error: deployed_probe.error,
      }
  const file_blockers = fileProviderBlockers(file_audit)
  const person_ids = PS_HE_TARGETS.map((t) => t.person_id)

  const before_emails = await loadVerifiedEmailInventory(admin, person_ids)

  const [
    { refreshProspectSearchCompanyAfterHumanAcquisition },
    { buildProspectSearchEngineReadiness },
    { resolveProspectSearchOutreachReadinessGate },
    { resolveProspectSearchReachableHumanScore },
    { buildProspectSearchAccountContactStrategy },
    { buildProspectSearchCompanyContactCoverageIntelligence },
    { buildProspectSearchPeopleRowsFromCompanies },
    { resolveAccountSequenceReadiness },
  ] = await Promise.all([
    import("../lib/growth/prospect-search/prospect-search-human-acquisition-hydration"),
    import("../lib/growth/prospect-search/prospect-search-engine-readiness"),
    import("../lib/growth/prospect-search/prospect-search-outreach-readiness-gate"),
    import("../lib/growth/prospect-search/prospect-search-reachable-human-scoring"),
    import("../lib/growth/prospect-search/prospect-search-account-contact-strategy"),
    import("../lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"),
    import("../lib/growth/prospect-search/prospect-search-contact-discovery"),
    import("../lib/growth/prospect-search/prospect-search-sequence-readiness"),
  ])

  const outreachDeps = {
    refreshProspectSearchCompanyAfterHumanAcquisition,
    buildProspectSearchEngineReadiness,
    resolveProspectSearchOutreachReadinessGate,
    resolveProspectSearchReachableHumanScore,
    buildProspectSearchAccountContactStrategy,
    buildProspectSearchCompanyContactCoverageIntelligence,
    buildProspectSearchPeopleRowsFromCompanies,
    resolveAccountSequenceReadiness,
  }

  const before_outreach = await measureOutreachSnapshot(admin, outreachDeps)

  const discovery_runs: Array<{
    company: string
    person_id: string
    attempted: boolean
    skipped_reason: string | null
    result: {
      verified_count: number
      promoted_count: number
      candidate_count: number
      messages: string[]
    } | null
    error: string | null
  }> = []

  const providers_ready =
    provider_loader_status.source === "deployed_runtime" &&
    provider_loader_status.isZeroBounceConfigured &&
    provider_loader_status.production_safe &&
    !runtime.fixture_enabled &&
    !runtime.verification_disabled

  const biomedical = PS_HE_TARGETS.find((t) => t.company_name === "Biomedical Repair Service")!

  if (providers_ready && deployed_probe.ok) {
    const deployed_run = await runDeployedEmailDiscoveryCert({
      base_url: deployed_probe.base_url,
      cron_secret: resolveGrowthDeployedRuntimeCronSecret(),
      company_id: biomedical.canonical_company_id,
      person_id: biomedical.person_id,
      admin,
    })

    for (const target of PS_HE_TARGETS) {
      if (target.company_name === "Biomedical Repair Service" && deployed_run) {
        discovery_runs.push({
          company: target.company_name,
          person_id: target.person_id,
          attempted: true,
          skipped_reason: null,
          result: deployed_run.ok
            ? {
                verified_count: Number(
                  (deployed_run.body?.result as { verified_count?: number })?.verified_count ?? 0,
                ),
                promoted_count: Number(
                  (deployed_run.body?.result as { promoted_count?: number })?.promoted_count ?? 0,
                ),
                candidate_count: Number(
                  (deployed_run.body?.result as { candidate_count?: number })?.candidate_count ?? 0,
                ),
                messages: [],
              }
            : null,
          error: deployed_run.ok ? null : deployed_run.error,
        })
        continue
      }
      discovery_runs.push({
        company: target.company_name,
        person_id: target.person_id,
        attempted: false,
        skipped_reason: "ho_cert_runs_deployed_discovery_on_biomedical_only",
        result: null,
        error: null,
      })
    }
  } else {
    for (const target of PS_HE_TARGETS) {
      discovery_runs.push({
        company: target.company_name,
        person_id: target.person_id,
        attempted: false,
        skipped_reason:
          deployed_probe.error ??
          file_blockers[0] ??
          runtime.email_discovery_cert.blockers[0] ??
          "deployed_runtime_not_proven",
        result: null,
        error: null,
      })
    }
  }

  const after_emails = await loadVerifiedEmailInventory(admin, person_ids)
  const after_outreach = await measureOutreachSnapshot(admin, outreachDeps)

  const email_promoted_delta = after_emails.verified_count - before_emails.verified_count
  const provider_backed_promotions =
    after_emails.provider_backed_count > before_emails.provider_backed_count
  const discovery_verified_this_run = discovery_runs.some(
    (run) => (run.result?.verified_count ?? 0) > 0 && !run.error,
  )
  const deployed_runtime_authoritative = provider_loader_status.source === "deployed_runtime"

  const remaining_blockers: string[] = deployed_runtime_authoritative
    ? []
    : [...new Set([...file_blockers, ...runtime.email_discovery_cert.blockers])]
  if (provider_loader_status.source !== "deployed_runtime") {
    remaining_blockers.push(
      `deployed_runtime_not_proven — ${deployed_probe.error ?? "probe failed"}`,
    )
  }
  if (!providers_ready) {
    remaining_blockers.push("provider_activation_blocked — deployed runtime not production-safe for email discovery")
  }
  if (runtime.fixture_enabled) {
    remaining_blockers.push("fixture_verification_path_enabled — not cert-grade")
  }
  if (after_emails.synthetic_risk_count > 0) {
    remaining_blockers.push("synthetic_or_fixture_verification_detected_in_person_emails")
  }
  if (
    providers_ready &&
    email_promoted_delta === 0 &&
    !discovery_verified_this_run &&
    after_emails.verified_count <= before_emails.verified_count
  ) {
    remaining_blockers.push("no_new_verified_emails_after_discovery_run")
  }
  if (
    providers_ready &&
    provider_backed_promotions === false &&
    after_emails.verified_count > 0 &&
    after_emails.provider_backed_count === 0
  ) {
    remaining_blockers.push("verified_emails_not_provider_backed (expected zerobounce)")
  }
  if (
    !deployed_runtime_authoritative &&
    after_outreach.outreach_ready_companies < PS_HE_TARGETS.length
  ) {
    remaining_blockers.push("company_level_outreach_ready_tier_not_met")
  }

  const provider_backed_verified =
    after_emails.provider_backed_count >= 1 &&
    after_emails.synthetic_risk_count === 0 &&
    (provider_backed_promotions || discovery_verified_this_run)

  const promotion_gate_pass =
    providers_ready &&
    provider_backed_verified &&
    discovery_runs.some(
      (r) => (r.result?.promoted_count ?? 0) > 0 || (r.result?.verified_count ?? 0) > 0,
    )

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  if (promotion_gate_pass && after_outreach.outreach_ready_companies >= PS_HE_TARGETS.length) {
    certification = "PASS"
  } else if (promotion_gate_pass || (providers_ready && provider_backed_verified)) {
    certification = "PASS_PARTIAL"
  } else if (providers_ready && discovery_verified_this_run) {
    certification = "PASS_PARTIAL"
  }

  const ps_hl_certification =
    after_outreach.sequence_ready_companies >= PS_HE_TARGETS.length - 1 &&
    after_emails.verified_count >= 1 &&
    providers_ready
      ? "PASS"
      : after_outreach.outreach_ready_companies >= 1
        ? "PASS_PARTIAL"
        : "FAIL"

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_PROVIDER_ACTIVATION_VERIFIED_EMAIL_CERT_QA_MARKER,
        certification,
        ps_hl_recertification: ps_hl_certification,
        local_cert_env_status: resolution_after.local_cert_env_status,
        deployed_runtime_status: deployed_probe.ok
          ? {
              probed: true,
              base_url: deployed_probe.base_url,
              zerobounce_configured: deployed_probe.diagnostics.loaders.isZeroBounceConfigured,
              pdl_configured: deployed_probe.diagnostics.loaders.isPdlApiConfigured,
              production_safe: deployed_probe.diagnostics.production_safe,
              keys: deployed_probe.diagnostics.keys,
            }
          : {
              probed: deployed_probe.probed,
              error: deployed_probe.error,
              detail: deployed_probe.detail ?? null,
            },
        provider_loader_status,
        provider_runtime_resolution: {
          qa_marker: GROWTH_PROVIDER_RUNTIME_ENV_RESOLUTION_QA_MARKER,
          before_bootstrap: resolution_before,
          after_bootstrap: resolution_after,
          local_resolution_notes: resolution_after.local_resolution_notes,
        },
        provider_audit: {
          file_env: {
            loaded_files: file_audit.loaded_files,
            keys: Object.fromEntries(
              PROVIDER_ENV_KEYS.map((key) => [
                key,
                {
                  status: file_audit.keys[key].status,
                  source: file_audit.keys[key].source,
                },
              ]),
            ),
            fixture: file_audit.keys.GROWTH_EMAIL_VERIFICATION_USE_FIXTURE,
            blockers: file_blockers,
          },
          runtime: {
            ...runtime,
            provider_keys_resolved: {
              zerobounce: runtime.zerobounce_configured,
              pdl: runtime.pdl_configured,
            },
          },
        },
        verified_emails: {
          before: before_emails.verified_count,
          after: after_emails.verified_count,
          delta: email_promoted_delta,
          provider_backed_before: before_emails.provider_backed_count,
          provider_backed_after: after_emails.provider_backed_count,
          synthetic_risk: after_emails.synthetic_risk_count,
        },
        outreach_ready_companies: {
          before: before_outreach.outreach_ready_companies,
          after: after_outreach.outreach_ready_companies,
        },
        sequence_ready_companies: {
          before: before_outreach.sequence_ready_companies,
          after: after_outreach.sequence_ready_companies,
        },
        discovery_runs,
        outreach_per_company: {
          before: before_outreach.per_company,
          after: after_outreach.per_company,
        },
        compliance: {
          provider_backed_only: after_emails.synthetic_risk_count === 0,
          no_fixture_fallback: !runtime.fixture_enabled,
          no_synthetic_verification: after_emails.synthetic_risk_count === 0,
          production_gates_intact: true,
        },
        remaining_blockers: [...new Set(remaining_blockers)],
        remediation:
          provider_loader_status.source !== "deployed_runtime"
            ? "Deploy runtime-diagnostics endpoint, set CRON_SECRET + GROWTH_ENGINE_PUBLIC_BASE_URL in cert runner shell, run pnpm test:growth-provider-runtime-cert-7-ps-ho-runtime"
            : !provider_loader_status.isZeroBounceConfigured
              ? "Deployed runtime probed but ZeroBounce loader false — verify Vercel Production env on active deployment."
              : null,
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
