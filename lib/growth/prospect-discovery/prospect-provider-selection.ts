/** Provider selection for prospect execution plans (client-safe). */

import type { NormalizedProspectSearchIntent, ProspectDiscoveryProvider, ProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import type { ProspectExecutionStage, ProspectExecutionStageId } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"

const STAGE_LABELS: Record<ProspectExecutionStageId, string> = {
  company_discovery: "Company Discovery",
  signal_enrichment: "Signal Enrichment",
  contact_discovery: "Contact Discovery",
  company_intelligence: "Company Intelligence",
  buying_committee_expansion: "Buying Committee Expansion",
  qualification: "Qualification",
}

const STAGE_DESCRIPTIONS: Record<ProspectExecutionStageId, string> = {
  company_discovery: "Discover target companies via real-world and web discovery providers.",
  signal_enrichment: "Enrich companies with growth signals and intent evidence.",
  contact_discovery: "Identify reachable contacts via Apollo, PDL, and website extraction.",
  company_intelligence: "Build company intelligence profile for qualification.",
  buying_committee_expansion: "Expand buying committee coverage beyond primary contacts.",
  qualification: "Apply qualification filters and readiness scoring — no auto-enrollment.",
}

const STAGE_PROVIDER_MAP: Record<ProspectExecutionStageId, ProspectDiscoveryProvider[]> = {
  company_discovery: [
    "real_world_google_places",
    "real_world_serp",
    "real_world_business_directory",
    "website_discovery",
    "apollo_company_search",
  ],
  signal_enrichment: ["signal_enrichment"],
  contact_discovery: ["apollo_people_search", "pdl_search", "website_discovery"],
  company_intelligence: ["company_intelligence"],
  buying_committee_expansion: ["buying_committee_expansion"],
  qualification: [],
}

function intentHasBiomedicalProfile(intent: NormalizedProspectSearchIntent): boolean {
  return intent.industries.some((i) => /biomedical|medical|healthcare/i.test(i))
}

function intentHasTechnologyFocus(intent: NormalizedProspectSearchIntent): boolean {
  return intent.technologies.length > 0
}

function intentHasHiringSignals(intent: NormalizedProspectSearchIntent): boolean {
  return intent.signals.some((s) => s === "hiring" || s === "expansion" || s === "funding")
}

/**
 * Select execution providers from an approved search plan and intent profile.
 */
export function selectProspectExecutionProviders(searchPlan: ProspectSearchPlan): ProspectDiscoveryProvider[] {
  const intent = searchPlan.normalized_intent
  const base = new Set(searchPlan.discovery_providers)
  const selected: ProspectDiscoveryProvider[] = [...base]

  if (intentHasBiomedicalProfile(intent)) {
    for (const provider of [
      "real_world_google_places",
      "real_world_serp",
      "website_discovery",
      "apollo_people_search",
      "pdl_search",
      "company_intelligence",
    ] as ProspectDiscoveryProvider[]) {
      selected.push(provider)
    }
  }

  if (intentHasTechnologyFocus(intent)) {
    for (const provider of [
      "apollo_people_search",
      "pdl_search",
      "company_intelligence",
    ] as ProspectDiscoveryProvider[]) {
      selected.push(provider)
    }
  }

  if (intentHasHiringSignals(intent)) {
    for (const provider of [
      "signal_enrichment",
      "company_intelligence",
      "website_discovery",
    ] as ProspectDiscoveryProvider[]) {
      selected.push(provider)
    }
  }

  if (intent.titles.length > 0 || intent.prospect_search_filters.decision_maker_role) {
    selected.push("buying_committee_expansion")
  }

  return [...new Set(selected)]
}

export function orderProspectExecutionProviders(
  providers: ProspectDiscoveryProvider[],
): ProspectDiscoveryProvider[] {
  const priority: ProspectDiscoveryProvider[] = [
    "real_world_google_places",
    "real_world_serp",
    "real_world_business_directory",
    "apollo_company_search",
    "website_discovery",
    "signal_enrichment",
    "apollo_people_search",
    "pdl_search",
    "company_intelligence",
    "buying_committee_expansion",
  ]
  return priority.filter((provider) => providers.includes(provider))
}

export function buildProspectExecutionStages(
  providers: ProspectDiscoveryProvider[],
): ProspectExecutionStage[] {
  const stages: ProspectExecutionStage[] = []
  let order = 1

  for (const stageId of [
    "company_discovery",
    "signal_enrichment",
    "contact_discovery",
    "company_intelligence",
    "buying_committee_expansion",
    "qualification",
  ] as ProspectExecutionStageId[]) {
    const stageProviders =
      stageId === "qualification"
        ? []
        : STAGE_PROVIDER_MAP[stageId].filter((provider) => providers.includes(provider))

    if (stageId !== "qualification" && stageProviders.length === 0) continue

    stages.push({
      stage_id: stageId,
      label: STAGE_LABELS[stageId],
      order,
      providers: stageProviders,
      description: STAGE_DESCRIPTIONS[stageId],
    })
    order += 1
  }

  return stages
}

export function deriveProviderOrderFromStages(stages: ProspectExecutionStage[]): ProspectDiscoveryProvider[] {
  const ordered: ProspectDiscoveryProvider[] = []
  for (const stage of stages) {
    for (const provider of stage.providers) {
      if (!ordered.includes(provider)) ordered.push(provider)
    }
  }
  return ordered
}
