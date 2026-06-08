/** Phase 7.PS-IU — Verified contact source registry (observed PDL + candidate estimates). Client-safe. */

import type {
  ContactSourceBenchmarkEntry,
  ContactSourceDensityMetrics,
} from "@/lib/growth/benchmark/apollo-replacement-contact-source-benchmark-types"

/** PS-IR observed incremental lift on 54-company benchmark cohort (live PDL, force_live). */
export const OBSERVED_PS_IR_PDL_INCREMENTAL: ContactSourceDensityMetrics = {
  named_persons_per_100: 11.1,
  titled_persons_per_100: 11.1,
  verified_emails_per_100: 0,
  verified_phones_per_100: 0,
  outreach_ready_companies_per_100: 0,
}

function rankContactSource(input: {
  marginal: ContactSourceDensityMetrics
  cost_per_verified_email: number | null
  complexity: number
  maintenance: number
  dependency_risk: number
  confidence: number
  wired: boolean
  evidence_observed: boolean
}): number {
  const costPenalty =
    input.cost_per_verified_email == null
      ? 0
      : input.cost_per_verified_email <= 0.15
        ? 0
        : input.cost_per_verified_email <= 0.35
          ? 6
          : 12
  return (
    input.marginal.outreach_ready_companies_per_100 * 6 +
    input.marginal.verified_emails_per_100 * 4 +
    input.marginal.named_persons_per_100 * 1.5 +
    input.confidence * 3 +
    (input.wired ? 10 : 0) +
    (input.evidence_observed ? 12 : 0) -
    input.complexity * 2 -
    input.maintenance * 1.5 -
    input.dependency_risk * 1.5 -
    costPenalty
  )
}

function entry(input: Omit<ContactSourceBenchmarkEntry, "rank_score">): ContactSourceBenchmarkEntry {
  return {
    ...input,
    rank_score: rankContactSource({
      marginal: input.marginal_density,
      cost_per_verified_email: input.cost.cost_per_verified_email_usd,
      complexity: input.operational.integration_complexity,
      maintenance: input.operational.maintenance_burden,
      dependency_risk: input.operational.provider_dependency_risk,
      confidence: input.confidence,
      wired: input.operational.wired_in_codebase,
      evidence_observed: input.evidence_tier === "observed",
    }),
  }
}

export function buildContactSourceBenchmarkRegistry(input: {
  pdl_configured: boolean
  zerobounce_configured: boolean
}): ContactSourceBenchmarkEntry[] {
  const sources: ContactSourceBenchmarkEntry[] = [
    entry({
      key: "people_data_labs",
      label: "People Data Labs",
      evidence_tier: "observed",
      observed_phase: "7.PS-IR",
      density: OBSERVED_PS_IR_PDL_INCREMENTAL,
      marginal_density: OBSERVED_PS_IR_PDL_INCREMENTAL,
      cost: {
        cost_per_discovered_person_usd: 0.9,
        cost_per_verified_email_usd: null,
        cost_per_outreach_ready_company_usd: null,
      },
      operational: {
        api_available: true,
        integration_complexity: 2,
        maintenance_burden: 2,
        provider_dependency_risk: 2,
        rate_limit_risk: 2,
        verification_compatible: true,
        wired_in_codebase: true,
        configured_at_runtime: input.pdl_configured,
      },
      confidence: 5,
      notes:
        "Measured on 54-company cohort: +6 named, +6 titled, 0 verified emails, 0 outreach-ready. 3/54 companies returned records.",
    }),
    entry({
      key: "apollo_api",
      label: "Apollo.io",
      evidence_tier: "estimate",
      observed_phase: null,
      density: {
        named_persons_per_100: 45,
        titled_persons_per_100: 35,
        verified_emails_per_100: 18,
        verified_phones_per_100: 8,
        outreach_ready_companies_per_100: 14,
      },
      marginal_density: {
        named_persons_per_100: 28,
        titled_persons_per_100: 22,
        verified_emails_per_100: 14,
        verified_phones_per_100: 6,
        outreach_ready_companies_per_100: 11,
      },
      cost: {
        cost_per_discovered_person_usd: 0.25,
        cost_per_verified_email_usd: 0.2,
        cost_per_outreach_ready_company_usd: 8.5,
      },
      operational: {
        api_available: true,
        integration_complexity: 3,
        maintenance_burden: 3,
        provider_dependency_risk: 4,
        rate_limit_risk: 3,
        verification_compatible: true,
        wired_in_codebase: false,
        configured_at_runtime: false,
      },
      confidence: 3,
      notes:
        "API available (people/match, bulk_match, mixed_people search). Credit-based pricing ~$0.20/email reveal. Marginal estimate discounted 40% for ICP overlap with exhausted website graph.",
    }),
    entry({
      key: "seamless_api",
      label: "Seamless.AI",
      evidence_tier: "estimate",
      observed_phase: null,
      density: {
        named_persons_per_100: 40,
        titled_persons_per_100: 30,
        verified_emails_per_100: 16,
        verified_phones_per_100: 10,
        outreach_ready_companies_per_100: 13,
      },
      marginal_density: {
        named_persons_per_100: 24,
        titled_persons_per_100: 18,
        verified_emails_per_100: 12,
        verified_phones_per_100: 7,
        outreach_ready_companies_per_100: 10,
      },
      cost: {
        cost_per_discovered_person_usd: 0.35,
        cost_per_verified_email_usd: 0.35,
        cost_per_outreach_ready_company_usd: 12,
      },
      operational: {
        api_available: true,
        integration_complexity: 3,
        maintenance_burden: 3,
        provider_dependency_risk: 4,
        rate_limit_risk: 3,
        verification_compatible: true,
        wired_in_codebase: false,
        configured_at_runtime: false,
      },
      confidence: 3,
      notes:
        "REST API for contact search/enrichment. Higher phone yield than PDL for SMB owners; credit pricing similar to Apollo.",
    }),
    entry({
      key: "rocketreach",
      label: "RocketReach",
      evidence_tier: "estimate",
      observed_phase: null,
      density: {
        named_persons_per_100: 38,
        titled_persons_per_100: 28,
        verified_emails_per_100: 14,
        verified_phones_per_100: 7,
        outreach_ready_companies_per_100: 11,
      },
      marginal_density: {
        named_persons_per_100: 22,
        titled_persons_per_100: 16,
        verified_emails_per_100: 10,
        verified_phones_per_100: 5,
        outreach_ready_companies_per_100: 8,
      },
      cost: {
        cost_per_discovered_person_usd: 0.28,
        cost_per_verified_email_usd: 0.3,
        cost_per_outreach_ready_company_usd: 10,
      },
      operational: {
        api_available: true,
        integration_complexity: 3,
        maintenance_burden: 3,
        provider_dependency_risk: 3,
        rate_limit_risk: 3,
        verification_compatible: true,
        wired_in_codebase: false,
        configured_at_runtime: false,
      },
      confidence: 3,
      notes: "People lookup API with lookup credits. Strong email coverage; moderate title depth for service-shop SMBs.",
    }),
    entry({
      key: "prospeo",
      label: "Prospeo",
      evidence_tier: "estimate",
      observed_phase: null,
      density: {
        named_persons_per_100: 22,
        titled_persons_per_100: 12,
        verified_emails_per_100: 16,
        verified_phones_per_100: 2,
        outreach_ready_companies_per_100: 9,
      },
      marginal_density: {
        named_persons_per_100: 12,
        titled_persons_per_100: 6,
        verified_emails_per_100: 10,
        verified_phones_per_100: 1,
        outreach_ready_companies_per_100: 6,
      },
      cost: {
        cost_per_discovered_person_usd: 0.08,
        cost_per_verified_email_usd: 0.12,
        cost_per_outreach_ready_company_usd: 4.5,
      },
      operational: {
        api_available: true,
        integration_complexity: 2,
        maintenance_burden: 2,
        provider_dependency_risk: 2,
        rate_limit_risk: 2,
        verification_compatible: true,
        wired_in_codebase: false,
        configured_at_runtime: false,
      },
      confidence: 3,
      notes:
        "Email-finder API (domain + name). Lower person/title discovery; better verified-email economics. Still needs ZeroBounce gate.",
    }),
    entry({
      key: "hunter",
      label: "Hunter.io",
      evidence_tier: "estimate",
      observed_phase: null,
      density: {
        named_persons_per_100: 16,
        titled_persons_per_100: 8,
        verified_emails_per_100: 10,
        verified_phones_per_100: 1,
        outreach_ready_companies_per_100: 6,
      },
      marginal_density: {
        named_persons_per_100: 8,
        titled_persons_per_100: 4,
        verified_emails_per_100: 6,
        verified_phones_per_100: 0,
        outreach_ready_companies_per_100: 4,
      },
      cost: {
        cost_per_discovered_person_usd: 0.06,
        cost_per_verified_email_usd: 0.1,
        cost_per_outreach_ready_company_usd: 5,
      },
      operational: {
        api_available: true,
        integration_complexity: 2,
        maintenance_burden: 2,
        provider_dependency_risk: 2,
        rate_limit_risk: 2,
        verification_compatible: true,
        wired_in_codebase: false,
        configured_at_runtime: false,
      },
      confidence: 2,
      notes:
        "Domain Search + Email Finder APIs. Email supplement only; weak owner/title coverage for biomedical service-shop ICP.",
    }),
  ]

  return sources.sort((a, b) => b.rank_score - a.rank_score)
}
