/** Phase 7.PS-HX — External evidence registry (public sources only, no paid enrichment). Client-safe. */

import {
  GROWTH_EXTERNAL_EVIDENCE_QA_MARKER,
  type ExternalEvidenceRegistryEntry,
} from "@/lib/growth/external-evidence/external-evidence-types"

export { GROWTH_EXTERNAL_EVIDENCE_QA_MARKER }

/** Curated public evidence endpoints for biomedical / medical equipment repair ICP. */
export const GROWTH_EXTERNAL_EVIDENCE_REGISTRY: ExternalEvidenceRegistryEntry[] = [
  {
    key: "aami_leadership",
    source_type: "association_directory",
    label: "AAMI leadership directory",
    urls: ["https://www.aami.org/about-aami/leadership"],
    industry_scope: "biomedical",
    free_public_only: true,
    live: true,
  },
  {
    key: "aami_about",
    source_type: "association_directory",
    label: "AAMI about / staff",
    urls: ["https://www.aami.org/about-aami"],
    industry_scope: "biomedical",
    free_public_only: true,
    live: true,
  },
  {
    key: "ecri_leadership",
    source_type: "association_directory",
    label: "ECRI leadership",
    urls: ["https://www.ecri.org/about-ecri/leadership"],
    industry_scope: "biomedical",
    free_public_only: true,
    live: true,
  },
  {
    key: "aami_conference_speakers",
    source_type: "conference_speaker_page",
    label: "AAMI conference speaker bios",
    urls: ["https://www.aami.org/conferences"],
    industry_scope: "biomedical",
    free_public_only: true,
    live: true,
  },
  {
    key: "mdm_exhibitors",
    source_type: "conference_exhibitor_directory",
    label: "MD&M / medical device exhibitor listings",
    urls: ["https://www.mdmwest.com/en/exhibitor-list.html"],
    industry_scope: "medical equipment",
    free_public_only: true,
    live: true,
  },
  {
    key: "biomed_cert_cbet",
    source_type: "public_certification_directory",
    label: "AAMI certification public references",
    urls: ["https://www.aami.org/certification"],
    industry_scope: "biomedical",
    free_public_only: true,
    live: true,
  },
  {
    key: "bbb_biomedical",
    source_type: "public_business_directory",
    label: "BBB biomedical equipment repair category",
    urls: ["https://www.bbb.org/search?find_text=biomedical%20equipment%20repair"],
    industry_scope: "biomedical",
    free_public_only: true,
    live: true,
  },
  {
    key: "philips_partner_locator",
    source_type: "manufacturer_partner_directory",
    label: "Philips service partner locator",
    urls: ["https://www.usa.philips.com/healthcare/about/support/service-solutions"],
    industry_scope: "medical equipment",
    free_public_only: true,
    live: true,
  },
  {
    key: "ge_vendor_locator",
    source_type: "vendor_locator_directory",
    label: "GE HealthCare service locator",
    urls: ["https://www.gehealthcare.com/support/service"],
    industry_scope: "medical equipment",
    free_public_only: true,
    live: true,
  },
]

export function listLiveExternalEvidenceSources(): ExternalEvidenceRegistryEntry[] {
  return GROWTH_EXTERNAL_EVIDENCE_REGISTRY.filter((entry) => entry.live)
}
