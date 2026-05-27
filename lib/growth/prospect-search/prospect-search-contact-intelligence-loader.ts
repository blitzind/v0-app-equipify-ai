import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadContactDiscoverySnapshot } from "@/lib/growth/contact-discovery/contact-repository"
import { listCompanyContacts } from "@/lib/growth/contact-discovery/company-contact-repository"
import { computeCompanyContactCoverage } from "@/lib/growth/contact-discovery/company-contact-coverage"
import { isGrowthCompanyContactsSchemaReady } from "@/lib/growth/contact-discovery/company-contact-schema-health"
import { companyContactToContactInput } from "@/lib/growth/contact-discovery/integrations/company-contacts-bridge"
import { isGrowthContactDiscoverySchemaReady } from "@/lib/growth/contact-discovery/contact-schema-health"
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
import { finalizeProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-result-finalize"

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
  },
  context: {
    schema_ready: boolean
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
          candidate,
          (roleByContact.get(candidate.id) as Parameters<typeof contactDiscoveryCandidateToInput>[1]) ??
            null,
        )
        if (mapped) contacts.push(mapped)
      }
      if (snapshot.buying_committee?.committee_completeness != null) {
        committee_completeness = snapshot.buying_committee.committee_completeness
      }
    } catch {
      // Safe fallback — external discovery path unchanged when snapshot unavailable.
    }
  }

  if (await isGrowthCompanyContactsSchemaReady(admin)) {
    try {
      const companyContacts = await listCompanyContacts(admin, input.id)
      if (companyContacts.length > 0) source_labels.push("growth.company_contacts")
      for (const contact of companyContacts) {
        const mapped = companyContactToContactInput(contact)
        if (mapped) contacts.push(mapped)
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
      { schema_ready: context.schema_ready, source_labels },
    )
  }

  return buildProspectSearchContactIntelligence({
    contacts,
    decision_maker_hypothesis,
    committee_completeness,
    schema_ready: context.schema_ready,
    source_labels,
    contact_coverage_score,
    contact_coverage_label,
    contact_confidence_score,
    primary_contact_id,
    recommended_contact_id,
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

  const schema_ready = await isGrowthContactDiscoverySchemaReady(admin)
  const leadIds = [...new Set(companies.map((c) => c.growth_lead_id).filter(Boolean))] as string[]
  const leadMetadataById = await loadLeadMetadataByIds(admin, leadIds)

  const decisionMakersByLead = new Map<
    string,
    Awaited<ReturnType<typeof listGrowthLeadDecisionMakers>>
  >()
  await Promise.all(
    leadIds.map(async (leadId) => {
      decisionMakersByLead.set(leadId, await listGrowthLeadDecisionMakers(admin, leadId))
    }),
  )

  await Promise.all(
    companies.map(async (company) => {
      const intelligence = await buildContactIntelligenceForCompany(admin, company, {
        schema_ready,
        decisionMakersByLead,
        leadMetadataById,
      })
      map.set(`${company.source_type}:${company.id}`, intelligence)
    }),
  )

  return map
}

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
    })),
  )

  return companies.map((company) =>
    applyContactIntelligenceToCompanyResult(
      company,
      intelligenceByKey.get(`${company.source_type}:${company.id}`),
      context,
    ),
  )
}
