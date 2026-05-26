import { randomUUID } from "node:crypto"
import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-types"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"
import {
  buildSandboxCompanyDiscoveryStub,
  buildSandboxContactResearchStub,
  buildSandboxDecisionMakerStub,
  buildSandboxIcpTargetingStub,
  buildSandboxVerificationTriageStub,
} from "@/lib/growth/lead-engine/sandbox-stubs"
import {
  createProviderResponse,
  type GrowthLeadEngineCompanyResearchProvider,
  type GrowthLeadEngineContactResearchProvider,
  type GrowthLeadEngineDecisionMakerResearchProvider,
  type GrowthLeadEngineIntentSignalProvider,
  type GrowthLeadEngineProviderBundle,
  type GrowthLeadEngineProviderContext,
  type GrowthLeadEngineProviderEvidence,
  type GrowthLeadEngineProviderResponse,
  type GrowthLeadEngineProviderSourceAttribution,
  type GrowthLeadEngineVerificationProvider,
  type GrowthLeadEngineWebsiteResearchProvider,
} from "@/lib/growth/lead-engine/providers/provider-types"
import { createFixtureCompanyIdentificationProvider } from "@/lib/growth/company-identification/company-identification-provider"
import { providerSkippedResponse } from "@/lib/growth/lead-engine/providers/provider-errors"

const FIXTURE_PROVIDER_NAME = "lead_engine_fixture_provider"

function parseJsonSafe(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function upstreamIcp(context: GrowthLeadEngineProviderContext): GrowthLeadEngineIcpTargetingOutput | null {
  const icp = context.upstream?.icp
  return icp && typeof icp === "object" ? (icp as GrowthLeadEngineIcpTargetingOutput) : null
}

function upstreamCompany(context: GrowthLeadEngineProviderContext): GrowthLeadEngineCompanyDiscoveryOutput | null {
  const company = context.upstream?.company
  return company && typeof company === "object" ? (company as GrowthLeadEngineCompanyDiscoveryOutput) : null
}

function upstreamContact(context: GrowthLeadEngineProviderContext): GrowthLeadEngineContactResearchOutput | null {
  const contact = context.upstream?.contact
  return contact && typeof contact === "object" ? (contact as GrowthLeadEngineContactResearchOutput) : null
}

function extractEvidenceFromPayload(payload: Record<string, unknown>): GrowthLeadEngineProviderEvidence[] {
  const items: GrowthLeadEngineProviderEvidence[] = []
  for (const key of ["source_evidence", "pain_points", "growth_signals", "buying_signals"]) {
    const arr = payload[key]
    if (!Array.isArray(arr)) continue
    for (const entry of arr) {
      if (!entry || typeof entry !== "object") continue
      const row = entry as Record<string, unknown>
      const claim = String(row.claim ?? "").trim()
      const evidence = String(row.evidence ?? "").trim()
      const source = String(row.source ?? FIXTURE_PROVIDER_NAME).trim()
      if (claim || evidence) items.push({ claim, evidence, source })
    }
  }
  return items
}

function attributionFromEvidence(
  evidence: GrowthLeadEngineProviderEvidence[],
  section: string,
): GrowthLeadEngineProviderSourceAttribution[] {
  if (evidence.length === 0) {
    return [
      {
        source: FIXTURE_PROVIDER_NAME,
        section,
        signal: "fixture_stub",
        evidence: "Deterministic sandbox fixture — no fabricated enrichment.",
        confidence: 0.5,
      },
    ]
  }
  return evidence.map((item) => ({
    source: item.source || FIXTURE_PROVIDER_NAME,
    section,
    signal: item.claim || section,
    evidence: item.evidence || item.claim,
    confidence: 0.7,
  }))
}

function fixtureResponse(
  providerType: GrowthLeadEngineProviderResponse["provider_type"],
  context: GrowthLeadEngineProviderContext,
  raw: string,
  status: GrowthLeadEngineProviderResponse["status"] = "success",
): GrowthLeadEngineProviderResponse {
  const normalized = parseJsonSafe(raw)
  const evidence = extractEvidenceFromPayload(normalized)
  return createProviderResponse({
    provider_name: FIXTURE_PROVIDER_NAME,
    provider_type: providerType,
    request_id: randomUUID(),
    query: { ...context.query, stage_id: context.stage_id },
    status,
    confidence: status === "success" ? 0.75 : 0,
    evidence,
    source_attribution: attributionFromEvidence(evidence, context.stage_id),
    raw_payload: raw,
    normalized_payload: normalized,
    warnings: ["Fixture provider — sandbox stubs only, no external APIs."],
    errors: [],
  })
}

export function fixtureCompanyResearchSync(context: GrowthLeadEngineProviderContext): GrowthLeadEngineProviderResponse {
  const icp = upstreamIcp(context)
  if (!icp) {
    return providerSkippedResponse(
      FIXTURE_PROVIDER_NAME,
      "company_research",
      context,
      randomUUID(),
      "Fixture company research requires upstream ICP output.",
    )
  }
  const raw = buildSandboxCompanyDiscoveryStub(context.input, icp)
  return fixtureResponse("company_research", context, raw)
}

const companyResearch: GrowthLeadEngineCompanyResearchProvider = {
  provider_type: "company_research",
  research: (context) => Promise.resolve(fixtureCompanyResearchSync(context)),
}

export function fixtureDecisionMakerResearchSync(
  context: GrowthLeadEngineProviderContext,
): GrowthLeadEngineProviderResponse {
  const company = upstreamCompany(context)
  if (!company) {
    return providerSkippedResponse(
      FIXTURE_PROVIDER_NAME,
      "decision_maker_research",
      context,
      randomUUID(),
      "Fixture decision maker research requires upstream company discovery.",
    )
  }
  const raw = buildSandboxDecisionMakerStub(company)
  return fixtureResponse("decision_maker_research", context, raw)
}

const decisionMakerResearch: GrowthLeadEngineDecisionMakerResearchProvider = {
  provider_type: "decision_maker_research",
  research: (context) => Promise.resolve(fixtureDecisionMakerResearchSync(context)),
}

export function fixtureContactResearchSync(context: GrowthLeadEngineProviderContext): GrowthLeadEngineProviderResponse {
  const company = upstreamCompany(context)
  if (!company) {
    return providerSkippedResponse(
      FIXTURE_PROVIDER_NAME,
      "contact_research",
      context,
      randomUUID(),
      "Fixture contact research requires upstream company discovery.",
    )
  }
  const raw = buildSandboxContactResearchStub(context.input, company)
  return fixtureResponse("contact_research", context, raw)
}

const contactResearch: GrowthLeadEngineContactResearchProvider = {
  provider_type: "contact_research",
  research: (context) => Promise.resolve(fixtureContactResearchSync(context)),
}

export function fixtureVerificationSync(context: GrowthLeadEngineProviderContext): GrowthLeadEngineProviderResponse {
  const contact = upstreamContact(context)
  if (!contact) {
    return providerSkippedResponse(
      FIXTURE_PROVIDER_NAME,
      "verification",
      context,
      randomUUID(),
      "Fixture verification requires upstream contact research.",
    )
  }
  const raw = buildSandboxVerificationTriageStub(context.input, contact)
  return fixtureResponse("verification", context, raw)
}

const verification: GrowthLeadEngineVerificationProvider = {
  provider_type: "verification",
  verify: (context) => Promise.resolve(fixtureVerificationSync(context)),
}

export function fixtureWebsiteResearchSync(context: GrowthLeadEngineProviderContext): GrowthLeadEngineProviderResponse {
  const domain = context.query.domain ?? ""
  if (!domain) {
    return providerSkippedResponse(
      FIXTURE_PROVIDER_NAME,
      "website_research",
      context,
      randomUUID(),
      "No domain provided for website research.",
    )
  }
  const normalized = {
    website_url: context.query.website_url ?? `https://${domain}`,
    domain,
    notes: "Fixture website research — operator domain only, no scraping.",
    pages: [],
  }
  return createProviderResponse({
    provider_name: FIXTURE_PROVIDER_NAME,
    provider_type: "website_research",
    request_id: randomUUID(),
    query: { ...context.query, stage_id: context.stage_id },
    status: "partial",
    confidence: 0.4,
    evidence: [],
    source_attribution: [
      {
        source: FIXTURE_PROVIDER_NAME,
        section: "website",
        signal: "domain_only",
        evidence: `Website research limited to supplied domain ${domain}.`,
        confidence: 0.4,
      },
    ],
    raw_payload: normalized,
    normalized_payload: normalized,
    warnings: ["No website scrape in fixture mode."],
    errors: [],
  })
}

const websiteResearch: GrowthLeadEngineWebsiteResearchProvider = {
  provider_type: "website_research",
  research: (context) => Promise.resolve(fixtureWebsiteResearchSync(context)),
}

export function fixtureIntentSignalSync(context: GrowthLeadEngineProviderContext): GrowthLeadEngineProviderResponse {
  const normalized = {
    intent_signals: [],
    notes: context.input.notes.trim() || null,
    source: "fixture",
  }
  return createProviderResponse({
    provider_name: FIXTURE_PROVIDER_NAME,
    provider_type: "intent_signal",
    request_id: randomUUID(),
    query: { ...context.query, stage_id: context.stage_id },
    status: "skipped",
    confidence: 0,
    evidence: [],
    source_attribution: [
      {
        source: FIXTURE_PROVIDER_NAME,
        section: "intent",
        signal: "fixture_empty",
        evidence: "Fixture intent signals empty — intent pixel not wired in fixture mode.",
        confidence: 0,
      },
    ],
    raw_payload: normalized,
    normalized_payload: normalized,
    warnings: ["Intent signals not populated in fixture provider."],
    errors: [],
  })
}

const intentSignal: GrowthLeadEngineIntentSignalProvider = {
  provider_type: "intent_signal",
  collect: (context) => Promise.resolve(fixtureIntentSignalSync(context)),
}

export function invokeFixtureProviderSync(
  providerType: GrowthLeadEngineProviderResponse["provider_type"],
  context: GrowthLeadEngineProviderContext,
): GrowthLeadEngineProviderResponse {
  switch (providerType) {
    case "company_research":
      return fixtureCompanyResearchSync(context)
    case "company_identification":
      return providerSkippedResponse(
        FIXTURE_PROVIDER_NAME,
        "company_identification",
        context,
        randomUUID(),
        "Company identification uses in-process engine — fixture provider hook skipped.",
      )
    case "decision_maker_research":
      return fixtureDecisionMakerResearchSync(context)
    case "contact_research":
      return fixtureContactResearchSync(context)
    case "verification":
      return fixtureVerificationSync(context)
    case "website_research":
      return fixtureWebsiteResearchSync(context)
    case "intent_signal":
      return fixtureIntentSignalSync(context)
    default:
      return providerSkippedResponse(FIXTURE_PROVIDER_NAME, providerType, context, randomUUID(), "Unknown fixture provider.")
  }
}

/** Fixture provider also seeds ICP-shaped context for company discovery via raw stub. */
export function buildFixtureIcpNormalizedPayload(
  input: GrowthLeadEngineProviderContext["input"],
): Record<string, unknown> {
  return parseJsonSafe(buildSandboxIcpTargetingStub(input))
}

const companyIdentification = createFixtureCompanyIdentificationProvider()

export function createFixtureLeadEngineProviderBundle(): GrowthLeadEngineProviderBundle {
  return {
    mode: "fixture",
    company_research: companyResearch,
    company_identification: companyIdentification,
    decision_maker_research: decisionMakerResearch,
    contact_research: contactResearch,
    verification,
    website_research: websiteResearch,
    intent_signal: intentSignal,
  }
}
