/** Phase 7.PS-HS — Prospect source registry (evidence-backed sources only). Client-safe. */

import {
  GROWTH_PROSPECT_SOURCE_REGISTRY_QA_MARKER,
  GROWTH_PROSPECT_SOURCE_TYPES,
  type GrowthProspectSourceRegistryEntry,
  type GrowthProspectSourceType,
} from "@/lib/growth/graph-expansion/prospect-graph-expansion-types"

export { GROWTH_PROSPECT_SOURCE_REGISTRY_QA_MARKER, GROWTH_PROSPECT_SOURCE_TYPES }

export const GROWTH_PROSPECT_SOURCE_REGISTRY: GrowthProspectSourceRegistryEntry[] = [
  {
    source_type: "website",
    label: "Website",
    description: "Homepage and general site pages with public contact evidence.",
    refresh_cadence_days: 30,
    acquisition_priority: 50,
    company_contact_source_type: "website",
    evidence_depth: "page",
    requires_public_url: true,
    live: true,
  },
  {
    source_type: "team_page",
    label: "Team page",
    description: "Dedicated team/staff pages with named person evidence.",
    refresh_cadence_days: 45,
    acquisition_priority: 90,
    company_contact_source_type: "team_page",
    evidence_depth: "page",
    requires_public_url: true,
    live: true,
  },
  {
    source_type: "leadership_page",
    label: "Leadership page",
    description: "Executive and leadership roster pages.",
    refresh_cadence_days: 45,
    acquisition_priority: 95,
    company_contact_source_type: "team_page",
    evidence_depth: "page",
    requires_public_url: true,
    live: true,
  },
  {
    source_type: "schema_org",
    label: "Schema.org",
    description: "Structured Person/Organization markup on crawled pages.",
    refresh_cadence_days: 60,
    acquisition_priority: 85,
    company_contact_source_type: "website",
    evidence_depth: "structured",
    requires_public_url: true,
    live: true,
  },
  {
    source_type: "contact_page",
    label: "Contact page",
    description: "Contact and location pages with direct channel evidence.",
    refresh_cadence_days: 30,
    acquisition_priority: 70,
    company_contact_source_type: "contact_page",
    evidence_depth: "page",
    requires_public_url: true,
    live: true,
  },
  {
    source_type: "directory",
    label: "Directory",
    description: "Indexed business directory listings with company evidence.",
    refresh_cadence_days: 90,
    acquisition_priority: 40,
    company_contact_source_type: "public_record",
    evidence_depth: "directory_listing",
    requires_public_url: false,
    live: true,
  },
  {
    source_type: "association",
    label: "Association",
    description: "Trade association member directories and listings.",
    refresh_cadence_days: 120,
    acquisition_priority: 35,
    company_contact_source_type: "public_record",
    evidence_depth: "directory_listing",
    requires_public_url: false,
    live: true,
  },
  {
    source_type: "conference_exhibitor",
    label: "Conference / exhibitor",
    description: "Conference exhibitor lists with company and booth contact evidence.",
    refresh_cadence_days: 180,
    acquisition_priority: 30,
    company_contact_source_type: "public_record",
    evidence_depth: "event_listing",
    requires_public_url: false,
    live: true,
  },
]

export function listLiveProspectSources(): GrowthProspectSourceRegistryEntry[] {
  return GROWTH_PROSPECT_SOURCE_REGISTRY.filter((entry) => entry.live)
}

export function getProspectSourceRegistryEntry(
  source_type: GrowthProspectSourceType,
): GrowthProspectSourceRegistryEntry | undefined {
  return GROWTH_PROSPECT_SOURCE_REGISTRY.find((entry) => entry.source_type === source_type)
}

export function resolveProspectSourceRefreshCadenceMs(
  source_type: GrowthProspectSourceType,
): number {
  const entry = getProspectSourceRegistryEntry(source_type)
  const days = entry?.refresh_cadence_days ?? 60
  return days * 24 * 60 * 60 * 1000
}

export function sortProspectSourcesByPriority(
  source_types: GrowthProspectSourceType[],
): GrowthProspectSourceType[] {
  return [...source_types].sort((a, b) => {
    const pa = getProspectSourceRegistryEntry(a)?.acquisition_priority ?? 0
    const pb = getProspectSourceRegistryEntry(b)?.acquisition_priority ?? 0
    return pb - pa
  })
}
