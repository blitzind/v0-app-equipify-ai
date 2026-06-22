/** GE-v1-1 — Medical equipment ICP saved search definitions (client-safe). */

import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"

export const GE_V1_1_MEDICAL_ICP_KIT_QA_MARKER = "ge-v1-1-medical-icp-kit-v1" as const

/** Naming convention: ICP · Medical · {segment} */
export const GE_V1_1_MEDICAL_ICP_NAMING_PREFIX = "ICP · Medical ·" as const

export type GeV11MedicalSavedSearchDefinition = {
  id: string
  name: string
  queryText: string
  filters: GrowthProspectSearchFilters
  documentation: string
}

export const GE_V1_1_MEDICAL_SAVED_SEARCHES: GeV11MedicalSavedSearchDefinition[] = [
  {
    id: "biomedical_service",
    name: `${GE_V1_1_MEDICAL_ICP_NAMING_PREFIX} Biomedical equipment service`,
    queryText: "biomedical equipment service companies",
    filters: {
      industry: "Medical Equipment",
      keywords: ["biomedical", "equipment service", "clinical engineering"],
      engine_verified_email: true,
    },
    documentation:
      "Biomedical / clinical engineering service organizations maintaining hospital devices.",
  },
  {
    id: "medical_distributors",
    name: `${GE_V1_1_MEDICAL_ICP_NAMING_PREFIX} Medical equipment distributors`,
    queryText: "medical equipment distributors",
    filters: {
      industry: "Medical Equipment",
      keywords: ["medical equipment distributor", "capital equipment", "imaging equipment"],
      engine_verified_email: true,
    },
    documentation: "Capital and diagnostic equipment distributors selling into hospitals and clinics.",
  },
  {
    id: "isos",
    name: `${GE_V1_1_MEDICAL_ICP_NAMING_PREFIX} Independent service organizations (ISOs)`,
    queryText: "medical equipment independent service organization",
    filters: {
      industry: "Medical Equipment",
      keywords: ["ISO", "independent service organization", "third party maintenance"],
      engine_verified_email: true,
    },
    documentation: "Third-party maintenance and ISO providers for imaging and biomedical fleets.",
  },
  {
    id: "imaging_service",
    name: `${GE_V1_1_MEDICAL_ICP_NAMING_PREFIX} Imaging service providers`,
    queryText: "medical imaging service provider",
    filters: {
      industry: "Medical Equipment",
      keywords: ["imaging service", "MRI service", "CT service", "ultrasound service"],
      engine_verified_email: true,
    },
    documentation: "Field service teams supporting MRI, CT, ultrasound, and modality fleets.",
  },
]

export const GE_V1_1_MEDICAL_AUDIENCE_NAME = "Medical Equipment ICP" as const

export const GE_V1_1_EQUIPIFY_DEMO_PAGE_TITLE = "Equipify Demo" as const
