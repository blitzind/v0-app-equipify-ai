/** GE-AIOS-19C-2E — Business Strategy content (client-safe, stored in profile_json). */

export const GROWTH_BUSINESS_STRATEGY_QA_MARKER = "ge-aios-19c-business-strategy-v1" as const

export type BusinessStrategyConfidenceSection = {
  score: number
  assumptions: string[]
  missingInformation: string[]
}

export type BusinessStrategyMessagingSection = {
  elevatorPitch: string
  tone: string
  formality: string
  emailLengthPreference: string
  ctaPreferences: string[]
  wordsToAvoid: string[]
  neverSay: string[]
}

export type BusinessStrategyPositioningSection = {
  competitiveAdvantages: string[]
  pricingPhilosophy: string
  neverCompeteOnPrice: boolean | null
  competitorNotes: string[]
}

export type BusinessStrategyObjectionItem = {
  objection: string
  preferredResponse: string
}

export type BusinessStrategyObjectionsSection = {
  items: BusinessStrategyObjectionItem[]
}

export type BusinessStrategySalesPhilosophySection = {
  qualificationStandards: string[]
  disqualifiers: string[]
  discoveryQuestions: string[]
  buyingSignals: string[]
}

export type BusinessStrategyDomainPrinciplesSection = {
  principles: string[]
  notes: string
}

export type BusinessStrategyCompanyWideSection = {
  mission: string
  coreValues: string[]
  brandPersonality: string
}

export type BusinessStrategyContent = {
  companyWide: BusinessStrategyCompanyWideSection
  messaging: BusinessStrategyMessagingSection
  positioning: BusinessStrategyPositioningSection
  objections: BusinessStrategyObjectionsSection
  salesPhilosophy: BusinessStrategySalesPhilosophySection
  salesAndRelationships: BusinessStrategyDomainPrinciplesSection
  marketingAndBrand: BusinessStrategyDomainPrinciplesSection
  customerExperience: BusinessStrategyDomainPrinciplesSection
  serviceStandards: BusinessStrategyDomainPrinciplesSection
  financialGuidelines: BusinessStrategyDomainPrinciplesSection
  confidence: BusinessStrategyConfidenceSection
}

export function createEmptyBusinessStrategyContent(): BusinessStrategyContent {
  return {
    companyWide: {
      mission: "",
      coreValues: [],
      brandPersonality: "",
    },
    messaging: {
      elevatorPitch: "",
      tone: "",
      formality: "",
      emailLengthPreference: "",
      ctaPreferences: [],
      wordsToAvoid: [],
      neverSay: [],
    },
    positioning: {
      competitiveAdvantages: [],
      pricingPhilosophy: "",
      neverCompeteOnPrice: null,
      competitorNotes: [],
    },
    objections: {
      items: [],
    },
    salesPhilosophy: {
      qualificationStandards: [],
      disqualifiers: [],
      discoveryQuestions: [],
      buyingSignals: [],
    },
    salesAndRelationships: { principles: [], notes: "" },
    marketingAndBrand: { principles: [], notes: "" },
    customerExperience: { principles: [], notes: "" },
    serviceStandards: { principles: [], notes: "" },
    financialGuidelines: { principles: [], notes: "" },
    confidence: {
      score: 0,
      assumptions: [],
      missingInformation: [],
    },
  }
}

export function resolveBusinessStrategyContent(
  content: BusinessStrategyContent | null | undefined,
): BusinessStrategyContent {
  if (!content) return createEmptyBusinessStrategyContent()
  return {
    ...createEmptyBusinessStrategyContent(),
    ...content,
    companyWide: { ...createEmptyBusinessStrategyContent().companyWide, ...content.companyWide },
    messaging: { ...createEmptyBusinessStrategyContent().messaging, ...content.messaging },
    positioning: { ...createEmptyBusinessStrategyContent().positioning, ...content.positioning },
    objections: { ...createEmptyBusinessStrategyContent().objections, ...content.objections },
    salesPhilosophy: {
      ...createEmptyBusinessStrategyContent().salesPhilosophy,
      ...content.salesPhilosophy,
    },
    salesAndRelationships: {
      ...createEmptyBusinessStrategyContent().salesAndRelationships,
      ...content.salesAndRelationships,
    },
    marketingAndBrand: {
      ...createEmptyBusinessStrategyContent().marketingAndBrand,
      ...content.marketingAndBrand,
    },
    customerExperience: {
      ...createEmptyBusinessStrategyContent().customerExperience,
      ...content.customerExperience,
    },
    serviceStandards: {
      ...createEmptyBusinessStrategyContent().serviceStandards,
      ...content.serviceStandards,
    },
    financialGuidelines: {
      ...createEmptyBusinessStrategyContent().financialGuidelines,
      ...content.financialGuidelines,
    },
    confidence: { ...createEmptyBusinessStrategyContent().confidence, ...content.confidence },
  }
}
