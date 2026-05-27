/** Nightly continuous discovery segment definitions. Client-safe. */

import type { GrowthDiscoverySegment } from "@/lib/growth/discovery-engine/discovery-engine-types"

export const GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS: GrowthDiscoverySegment[] = [
  { key: "hvac", label: "HVAC", query: "HVAC service companies", industry: "HVAC", discovery_source_type: "industry_expansion" },
  { key: "biomedical", label: "Biomedical service", query: "biomedical equipment service companies", industry: "biomedical equipment service", discovery_source_type: "industry_expansion" },
  { key: "electrical", label: "Electrical contractors", query: "electrical contractor companies", industry: "electrical", discovery_source_type: "industry_expansion" },
  { key: "plumbing", label: "Plumbing", query: "commercial plumbing companies", industry: "plumbing", discovery_source_type: "industry_expansion" },
  { key: "commercial_equipment", label: "Commercial equipment service", query: "commercial equipment service companies", industry: "commercial equipment service", discovery_source_type: "industry_expansion" },
  { key: "mep", label: "MEP", query: "MEP contractor companies", industry: "MEP", discovery_source_type: "industry_expansion" },
  { key: "specialty_contractors", label: "Specialty contractors", query: "specialty contractor service companies", industry: "specialty contractors", discovery_source_type: "industry_expansion" },
]
