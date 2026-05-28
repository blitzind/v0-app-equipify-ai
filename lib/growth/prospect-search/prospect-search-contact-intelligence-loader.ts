import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadContactDiscoverySnapshot } from "@/lib/growth/contact-discovery/contact-repository"
import { listCompanyContacts } from "@/lib/growth/contact-discovery/company-contact-repository"
import { computeCompanyContactCoverage } from "@/lib/growth/contact-discovery/company-contact-coverage"
import { isGrowthCompanyContactsSchemaReady } from "@/lib/growth/contact-discovery/company-contact-schema-health"
import { companyContactToContactInput } from "@/lib/growth/contact-discovery/integrations/company-contacts-bridge"
import { probeProspectSearchContactIntelligenceSchema } from "@/lib/growth/prospect-search/prospect-search-intelligence-schema-health"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import type { GrowthLeadEnginePipelineRun } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import { extractLeadEngineOutputsFromRun } from "@/lib/growth/lead-operator-workspace/lead-engine-run-extract"
import { GROWTH_LEAD_ENGINE_RUN_METADATA_KEY } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import {
  buildProspectSearchContactIntelligence,
  contactDiscoveryCandidateToInput,
  decisionMakerToContactInput,
  emptyProspectSearchContactIntelligence,
  leadEngineContactResearchToInputs,
  type ProspectSearchContactIntelligenceInputContact,
} from "@/lib/growth/prospect-search/prospect-search-contact-intelligence"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchSourceType,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  loadPhoneDncLookup,
} from "@/lib/growth/prospect-search/prospect-search-contact-eligibility-server"
import { loadProspectSearchSuppressionLookup } from "@/lib/growth/prospect-search/prospect-search-suppression-overlays"
import { loadProspectSearchLeadRelationshipHydrationBatch } from "@/lib/growth/prospect-search/prospect-search-relationship-memory-loader"
import { parseWebsiteExtractionDiagnosticsFromMetadata } from "@/lib/growth/contact-discovery/website-acquisition-metadata-bridge"
import { resolveProspectSearchContactEligibilityHints } from "@/lib/growth/prospect-search/prospect-search-contact-eligibility-server"
import { finalizeProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-result-finalize"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"

function isPipelineRun(value: unknown): value is GrowthLeadEnginePipelineRun {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return Array.isArray(row.stage_results) && typeof row.run_id === "string"
}

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

async function loadLeadMetadataByIds(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>()
  if (leadIds.length === 0) return map

  const { data } = await admin
    .schema("growth")
    .from("leads")
    .select("id, metadata")
    .in("id", leadIds)

  for (const row of data ?? []) {
    const record = row as Record<string, unknown>
    const id = typeof record.id === "string" ? record.id : ""
    if (!id) continue
    map.set(id, metaRecord(record.metadata))
  }
  return map
}

async function buildContactIntelligenceForCompany(
  admin: SupabaseClient,
  input: {
    id: string
    source_type: GrowthProspectSearchSourceType
    growth_lead_id: string | null
    company_name: string
    is_suppressed?: boolean
  },
  context: {
    schema_ready: boolean
    schema_health: import("@/lib/growth/schema-health/growth-schema-health-types").GrowthSchemaHealthSummary
    decisionMakersByLead: Map<string, Awaited<ReturnType<typeof listGrowthLeadDecisionMakers>>>
    leadMetadataById: Map<string, Record<string, unknown>>
  },
): Promise<GrowthProspectSearchContactIntelligence> {
  const source_labels: string[] = []
  const contacts: ProspectSearchContactIntelligenceInputContact[] = []
  let committee_completeness: number | null = null
  let decision_maker_hypothesis: GrowthLeadEngineDecisionMakerHypothesisOutput | null = null
  let contact_coverage_score: number | null = null
  let contact_coverage_label: string | null = null
  let contact_confidence_score: number | null = null
  let primary_contact_id: string | null = null
  let recommended_contact_id: string | null = null

  if (input.growth_lead_id) {
    const decisionMakers = context.decisionMakersByLead.get(input.growth_lead_id) ?? []
    if (decisionMakers.length > 0) source_labels.push("growth.lead_decision_makers")

    for (const dm of decisionMakers) {
      const mapped = decisionMakerToContactInput(dm)
      if (mapped) contacts.push(mapped)
    }

    const metadata = context.leadMetadataById.get(input.growth_lead_id) ?? {}
    const runRaw = metadata[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
    if (isPipelineRun(runRaw)) {
      const outputs = extractLeadEngineOutputsFromRun(runRaw)
      decision_maker_hypothesis = outputs.decisionMakerHypothesis ?? null
      if (outputs.contactResearch) {
        source_labels.push("lead_engine.contact_research")
        contacts.push(...leadEngineContactResearchToInputs(outputs.contactResearch))
        committee_completeness = outputs.contactResearch.coverage.committee_completion
      }
      if (outputs.decisionMakerHypothesis) {
        source_labels.push("lead_engine.decision_maker_hypothesis")
      }
    }
  }

  if (input.source_type === "external_discovered" && context.schema_ready) {
    try {
      const snapshot = await loadContactDiscoverySnapshot(admin, input.id)
      if (snapshot.contacts.length > 0) source_labels.push("contact_discovery")
      const roleByContact = new Map<string, string>()
      for (const member of snapshot.buying_committee?.members ?? []) {
        roleByContact.set(member.contact_candidate_id, member.committee_role)
      }
      for (const candidate of snapshot.contacts) {
        const mapped = contactDiscoveryCandidateToInput(
          {
            ...candidate,
            provider_type: candidate.provider_type,
            provider_name: candidate.provider_name,
            verification_state: candidate.verification_state,
            updated_at: candidate.updated_at,
            metadata: candidate.metadata,
          },
          (roleByContact.get(candidate.id) as Parameters<typeof contactDiscoveryCandidateToInput>[1]) ??
            null,
        )
        if (mapped) contacts.push(mapped)
      }
      if (snapshot.contacts.some((c) => c.provider_type === "website_public_extract")) {
        source_labels.push("website_public_extract")
      }
      if (snapshot.buying_committee?.committee_completeness != null) {
        committee_completeness = snapshot.buying_committee.committee_completeness
      }
    } catch {
      // Safe fallback — external discovery path unchanged when snapshot unavailable.
    }
  }

  let website_extraction_diagnostics: ReturnType<
    typeof parseWebsiteExtractionDiagnosticsFromMetadata
  > = null

  if (await isGrowthCompanyContactsSchemaReady(admin)) {
    try {
      const companyContacts = await listCompanyContacts(admin, input.id)
      if (companyContacts.length > 0) source_labels.push("growth.company_contacts")
      if (companyContacts.some((c) => c.source_type !== "manual" && c.source_type !== "crm")) {
        source_labels.push("website_public_extract")
      }
      for (const contact of companyContacts) {
        const mapped = companyContactToContactInput(contact)
        if (mapped) contacts.push(mapped)
        if (!website_extraction_diagnostics) {
          website_extraction_diagnostics = parseWebsiteExtractionDiagnosticsFromMetadata(
            contact.metadata,
          )
        }
      }
      if (companyContacts.length > 0) {
        const coverage = computeCompanyContactCoverage(companyContacts)
        contact_coverage_score = coverage.coverage_score
        contact_coverage_label = coverage.coverage_label
        contact_confidence_score = coverage.contact_confidence_score
        primary_contact_id = coverage.primary_contact_id
        recommended_contact_id = coverage.recommended_contact_id
      }
    } catch {
      // Safe fallback when company contacts unavailable.
    }
  }

  if (contacts.length === 0 && !decision_maker_hypothesis) {
    return emptyProspectSearchContactIntelligence(
      input.growth_lead_id
        ? "No evidence-backed contacts on this Growth lead yet."
        : "No evidence-backed contacts available for this company.",
      { schema_ready: context.schema_ready, source_labels, schema_health: context.schema_health },
    )
  }

  return buildProspectSearchContactIntelligence({
    contacts,
    decision_maker_hypothesis,
    committee_completeness,
    schema_ready: context.schema_ready,
    schema_health: context.schema_health,
    source_labels,
    contact_coverage_score,
    contact_coverage_label,
    contact_confidence_score,
    primary_contact_id,
    recommended_contact_id,
    company_suppressed: input.is_suppressed === true,
    website_extraction_diagnostics,
  })
}

export async function loadProspectSearchContactIntelligenceBatch(
  admin: SupabaseClient,
  companies: Array<{
    id: string
    source_type: GrowthProspectSearchSourceType
    growth_lead_id: string | null
    company_name: string
  }>,
): Promise<Map<string, GrowthProspectSearchContactIntelligence>> {
  const map = new Map<string, GrowthProspectSearchContactIntelligence>()
  if (companies.length === 0) return map

  let schema_health: Awaited<ReturnType<typeof probeProspectSearchContactIntelligenceSchema>>
  try {
    schema_health = await probeProspectSearchContactIntelligenceSchema(admin)
  } catch {
    schema_health = {
      ready: false,
      verified: false,
      uncertain: true,
      missing_objects: [],
      warning_message: "Contact intelligence schema probe unavailable.",
      env_hint: null,
    }
  }
  const schema_ready = schema_health.ready
  const leadIds = [...new Set(companies.map((c) => c.growth_lead_id).filter(Boolean))] as string[]
  const leadMetadataById = await loadLeadMetadataByIds(admin, leadIds)
  const leadRelationshipHydrationById = await loadProspectSearchLeadRelationshipHydrationBatch(
    admin,
    leadIds,
  )

  const decisionMakersByLead = new Map<
    string,
    Awaited<ReturnType<typeof listGrowthLeadDecisionMakers>>
  >()
  await Promise.allSettled(
    leadIds.map(async (leadId) => {
      try {
        decisionMakersByLead.set(leadId, await listGrowthLeadDecisionMakers(admin, leadId))
      } catch {
        decisionMakersByLead.set(leadId, [])
      }
    }),
  )

  await Promise.allSettled(
    companies.map(async (company) => {
      try {
        let intelligence = await buildContactIntelligenceForCompany(admin, company, {
          schema_ready,
          schema_health,
          decisionMakersByLead,
          leadMetadataById,
        })
        if (company.growth_lead_id) {
          const hydration = leadRelationshipHydrationById.get(company.growth_lead_id)
          if (hydration) {
            intelligence = { ...intelligence, lead_relationship_hydration: hydration }
          }
        }
        map.set(`${company.source_type}:${company.id}`, intelligence)
      } catch {
        map.set(
          `${company.source_type}:${company.id}`,
          emptyProspectSearchContactIntelligence(
            "Contact intelligence partially unavailable for this company.",
            { schema_ready, schema_health, source_labels: [] },
          ),
        )
      }
    }),
  )

  return map
}

export { GROWTH_RUNTIME_REGRESSION_FIX_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-safe-fetch-json"

export function applyContactIntelligenceToCompanyResult(
  company: GrowthProspectSearchCompanyResult,
  intelligence: GrowthProspectSearchContactIntelligence | null | undefined,
  context?: Parameters<typeof finalizeProspectSearchCompanyResult>[1],
): GrowthProspectSearchCompanyResult {
  if (!intelligence) return company

  const decision_maker_coverage =
    intelligence.contact_coverage_score != null
      ? Number((intelligence.contact_coverage_score / 100).toFixed(3))
      : intelligence.committee_completeness_pct != null
        ? Number((intelligence.committee_completeness_pct / 100).toFixed(3))
        : intelligence.contacts.length > 0
          ? Math.min(1, Number((intelligence.contacts.length / 5).toFixed(3)))
          : company.decision_maker_coverage

  return finalizeProspectSearchCompanyResult(
    {
      ...company,
      contact_intelligence: intelligence,
      decision_maker_coverage,
    },
    context,
  )
}

function applyEligibilityHintsToIntelligence(
  intelligence: GrowthProspectSearchContactIntelligence,
  company: {
    company_name: string
    website?: string | null
    growth_lead_id?: string | null
    is_suppressed?: boolean
  },
  context: {
    suppressionLookup: Awaited<ReturnType<typeof loadProspectSearchSuppressionLookup>>
    phoneDncLookup: Map<string, boolean>
  },
): GrowthProspectSearchContactIntelligence {
  if (!intelligence.has_contacts) return intelligence

  const contacts = intelligence.contacts.map((contact) => {
    const hints = resolveProspectSearchContactEligibilityHintsSync(
      {
        email: contact.email,
        phone: contact.phone,
        company_name: company.company_name,
        website: company.website ?? null,
        growth_lead_id: company.growth_lead_id ?? null,
        company_suppressed: company.is_suppressed,
      },
      context,
    )
    return {
      ...contact,
      phone_on_dnc: hints.phone_on_dnc,
      email_suppressed: hints.email_suppressed,
    }
  })

  return { ...intelligence, contacts }
}

function resolveProspectSearchContactEligibilityHintsSync(
  input: Parameters<typeof resolveProspectSearchContactEligibilityHints>[1],
  context: {
    suppressionLookup: Awaited<ReturnType<typeof loadProspectSearchSuppressionLookup>>
    phoneDncLookup: Map<string, boolean>
  },
): Awaited<ReturnType<typeof resolveProspectSearchContactEligibilityHints>> {
  const overlay = context.suppressionLookup.matchForIdentifiers({
    email: input.email,
    phone: input.phone,
    company_name: input.company_name,
    website: input.website,
    growth_lead_id: input.growth_lead_id,
  })

  const email = input.email?.trim().toLowerCase() || null
  const emailOverlay = email ? context.suppressionLookup.matchForIdentifiers({ email }) : null

  const normalizedPhone = input.phone
    ? normalizePhoneNumber(input.phone) || input.phone.replace(/\D/g, "")
    : null
  let phone_on_dnc: boolean | null = null
  if (normalizedPhone) {
    if (!getGrowthEngineAiOrgId()) phone_on_dnc = null
    else phone_on_dnc = context.phoneDncLookup.has(normalizedPhone)
  }

  return {
    phone_on_dnc,
    email_suppressed: Boolean(emailOverlay?.is_suppressed),
    contact_suppressed: Boolean(input.company_suppressed || overlay?.is_suppressed),
  }
}

export async function applyProspectSearchContactIntelligenceOverlay(
  admin: SupabaseClient,
  companies: GrowthProspectSearchCompanyResult[],
  context?: Parameters<typeof finalizeProspectSearchCompanyResult>[1],
): Promise<GrowthProspectSearchCompanyResult[]> {
  if (companies.length === 0) return companies

  const intelligenceByKey = await loadProspectSearchContactIntelligenceBatch(
    admin,
    companies.map((company) => ({
      id: company.id,
      source_type: company.source_type,
      growth_lead_id: company.growth_lead_id,
      company_name: company.company_name,
      is_suppressed: company.is_suppressed,
    })),
  )

  const allPhones = [
    ...new Set(
      [...intelligenceByKey.values()]
        .flatMap((intel) => intel.contacts.map((contact) => contact.phone?.trim()))
        .filter((phone): phone is string => Boolean(phone)),
    ),
  ]
  const [phoneDncResult, suppressionResult] = await Promise.allSettled([
    loadPhoneDncLookup(admin, allPhones),
    loadProspectSearchSuppressionLookup(admin),
  ])
  const phoneDncLookup =
    phoneDncResult.status === "fulfilled" ? phoneDncResult.value : new Map<string, boolean>()
  const suppressionLookup =
    suppressionResult.status === "fulfilled"
      ? suppressionResult.value
      : {
          matchForIdentifiers: () => null,
        }
  const eligibilityContext = { phoneDncLookup, suppressionLookup }

  return companies.map((company) => {
    const intelligence = intelligenceByKey.get(`${company.source_type}:${company.id}`)
    const enriched = intelligence
      ? applyEligibilityHintsToIntelligence(intelligence, company, eligibilityContext)
      : intelligence
    return applyContactIntelligenceToCompanyResult(company, enriched, context)
  })
}
