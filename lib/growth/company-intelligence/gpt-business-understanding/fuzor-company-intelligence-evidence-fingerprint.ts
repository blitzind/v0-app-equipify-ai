/**
 * FUZOR-COMPANY-INTELLIGENCE-2A — Evidence fingerprint for regeneration gating.
 * Fingerprint changes only when trustworthy evidence materially changes.
 */

import { createHash } from "node:crypto"
import type { FuzorCompanyIntelligenceEvidencePacket } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"
import type { FuzorCompanyIntelligenceEvidenceRefs } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-2a-types"
import { FUZOR_COMPANY_INTELLIGENCE_PLATFORM_VERSION } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-2a-types"
import { FUZOR_COMPANY_INTELLIGENCE_PROMPT_VERSION } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"

export function buildFuzorCompanyIntelligenceEvidenceRefs(
  packet: FuzorCompanyIntelligenceEvidencePacket,
): FuzorCompanyIntelligenceEvidenceRefs {
  return {
    leadId: packet.leadId,
    website: packet.website,
    linkedinCompanyUrl: packet.linkedinCompanyUrl,
    hasVerifiedDescription: Boolean(packet.verifiedDescription?.trim()),
    verifiedOfferingCount: packet.verifiedOfferings.length,
    verifiedIndustryCount: packet.verifiedIndustries.length,
    websiteExcerptCount: packet.websiteExcerpts.length,
    pagesObserved: packet.pagesObserved.slice(0, 40),
    datamoonFindingCount: packet.datamoonFindings.length,
    missingFromCollection: packet.missingFromCollection.slice(0, 24),
    priorResearchNotesPresent: Boolean(packet.priorResearchNotes?.trim()),
  }
}

/**
 * Stable content hash over material evidence fields.
 * Excludes volatile timestamps. Includes platform version so schema bumps force regen.
 */
export function computeFuzorCompanyIntelligenceEvidenceFingerprint(
  packet: FuzorCompanyIntelligenceEvidencePacket,
): { evidenceFingerprint: string; evidenceVersion: string } {
  const material = {
    platformVersion: FUZOR_COMPANY_INTELLIGENCE_PLATFORM_VERSION,
    promptVersion: FUZOR_COMPANY_INTELLIGENCE_PROMPT_VERSION,
    companyName: packet.companyName.trim().toLowerCase(),
    website: packet.website?.trim().toLowerCase() ?? null,
    linkedinCompanyUrl: packet.linkedinCompanyUrl?.trim().toLowerCase() ?? null,
    verifiedDescription: packet.verifiedDescription?.trim() ?? null,
    verifiedOfferings: [...packet.verifiedOfferings].map((s) => s.trim()).sort(),
    verifiedIndustries: [...packet.verifiedIndustries].map((s) => s.trim()).sort(),
    verifiedCustomers: [...packet.verifiedCustomers].map((s) => s.trim()).sort(),
    verifiedMarkets: [...packet.verifiedMarkets].map((s) => s.trim()).sort(),
    verifiedDifferentiators: [...packet.verifiedDifferentiators].map((s) => s.trim()).sort(),
    verifiedTechnologySignals: [...packet.verifiedTechnologySignals].map((s) => s.trim()).sort(),
    verifiedHiringSignals: [...packet.verifiedHiringSignals].map((s) => s.trim()).sort(),
    websiteExcerpts: [...packet.websiteExcerpts].map((s) => s.trim()).sort(),
    pagesObserved: packet.pagesObserved
      .map((p) => `${p.pageType}|${p.status}|${p.url}`)
      .sort(),
    datamoonFindings: [...packet.datamoonFindings].map((s) => s.trim()).sort(),
    priorResearchNotes: packet.priorResearchNotes?.trim() ?? null,
  }

  const evidenceFingerprint = createHash("sha256")
    .update(JSON.stringify(material))
    .digest("hex")
    .slice(0, 32)

  return {
    evidenceFingerprint,
    evidenceVersion: `ev-${evidenceFingerprint.slice(0, 12)}`,
  }
}
