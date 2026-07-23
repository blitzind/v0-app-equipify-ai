/** AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1D — Neutral industry capability framing (client-safe). */

import type { GrowthOutreachPersonalizationOrganizationKnowledgeBlock } from "@/lib/growth/outreach/personalization/growth-outreach-personalization-organization-knowledge"

export function normalizeIndustryPlaybookModuleLabel(moduleLabel: string): string {
  return moduleLabel
    .replace(/^Equipify\s+/i, "")
    .replace(/\bEquipify\b/gi, "")
    .trim()
}

export function buildNeutralIndustryCapabilityFraming(input: {
  displayName: string
  capability: string
  painSignal: string
  moduleLabel: string
  organizationKnowledge?: GrowthOutreachPersonalizationOrganizationKnowledgeBlock | null
}): string {
  const neutralModule = normalizeIndustryPlaybookModuleLabel(input.moduleLabel)
  const orgName = input.organizationKnowledge?.companyName?.trim()
  const offerings = input.organizationKnowledge?.productsServices ?? []

  if (orgName && offerings.length > 0) {
    const offeringHint = offerings.slice(0, 2).join(" and ")
    return `Companies like yours in ${input.displayName} often address ${input.painSignal.toLowerCase()} through ${input.capability.toLowerCase()} — ${orgName} supports this with ${offeringHint}.`
  }
  if (orgName) {
    return `Companies like yours in ${input.displayName} often address ${input.painSignal.toLowerCase()} through ${input.capability.toLowerCase()} — ${orgName} can help with ${neutralModule.toLowerCase()}.`
  }
  return `Companies like yours in ${input.displayName} often address ${input.painSignal.toLowerCase()} through ${input.capability.toLowerCase()} and ${neutralModule.toLowerCase()}.`
}

export function buildNeutralCapabilityParagraph(input: {
  capability: string
  moduleLabel: string
  organizationKnowledge?: GrowthOutreachPersonalizationOrganizationKnowledgeBlock | null
}): string {
  const neutralModule = normalizeIndustryPlaybookModuleLabel(input.moduleLabel)
  const orgName = input.organizationKnowledge?.companyName?.trim()
  const offerings = input.organizationKnowledge?.productsServices ?? []

  if (orgName && offerings.length > 0) {
    return `${orgName} helps teams centralize ${input.capability.toLowerCase()} through ${offerings[0]}.`
  }
  if (orgName) {
    return `${orgName} helps teams centralize ${input.capability.toLowerCase()} through ${neutralModule.toLowerCase()}.`
  }
  return `Many teams centralize ${input.capability.toLowerCase()} through ${neutralModule.toLowerCase()}.`
}

export function buildNeutralCapabilitySmsLine(input: {
  capability: string
  moduleLabel: string
  organizationKnowledge?: GrowthOutreachPersonalizationOrganizationKnowledgeBlock | null
}): string {
  const neutralModule = normalizeIndustryPlaybookModuleLabel(input.moduleLabel)
  const orgName = input.organizationKnowledge?.companyName?.trim()

  if (orgName) {
    return `${orgName} centralizes ${input.capability.toLowerCase()} and ${neutralModule.toLowerCase()}.`
  }
  return `Teams often centralize ${input.capability.toLowerCase()} and ${neutralModule.toLowerCase()}.`
}

export function buildNeutralCapabilityVoiceLine(input: {
  capability: string
  organizationKnowledge?: GrowthOutreachPersonalizationOrganizationKnowledgeBlock | null
}): string {
  const orgName = input.organizationKnowledge?.companyName?.trim()
  if (orgName) {
    return `${orgName} helps with ${input.capability.toLowerCase()}.`
  }
  return `Teams often improve ${input.capability.toLowerCase()} with clearer workflows.`
}
