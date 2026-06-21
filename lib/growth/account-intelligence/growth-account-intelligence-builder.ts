/** GS-AI-PLAYBOOK-3A — Account intelligence builder (client-safe). */

import {
  dedupeAccountIntelligenceSignals,
  filterAccountIntelligenceSignalsByCertainty,
  normalizeAccountIntelligenceSignals,
} from "@/lib/growth/account-intelligence/growth-account-intelligence-normalizer"
import { GROWTH_ACCOUNT_INTELLIGENCE_MISSING_SIGNAL_HINTS } from "@/lib/growth/account-intelligence/growth-account-intelligence-signals"
import {
  buildAccountIntelligencePromptSectionsForChannel,
  buildAccountIntelligencePromptSectionsFromModel,
  buildAccountIntelligenceVerifiedSummaryBullets,
} from "@/lib/growth/account-intelligence/growth-account-intelligence-summary"
import {
  GROWTH_ACCOUNT_INTELLIGENCE_QA_MARKER,
  type GrowthAccountIntelligenceContext,
  type GrowthAccountIntelligenceInput,
  type GrowthAccountIntelligenceModel,
  type GrowthAccountIntelligenceNormalizedSignal,
  type GrowthAccountIntelligenceSourceType,
} from "@/lib/growth/account-intelligence/growth-account-intelligence-types"
import type { GrowthPlaybookOptimizationChannel } from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-prompt-optimization-types"

export { GROWTH_ACCOUNT_INTELLIGENCE_QA_MARKER }

function averageConfidence(signals: GrowthAccountIntelligenceNormalizedSignal[]): number {
  if (signals.length === 0) return 0
  return Math.round(signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length)
}

function latestFreshness(signals: GrowthAccountIntelligenceNormalizedSignal[]): string | null {
  const dated = signals.map((signal) => signal.freshness).filter(Boolean) as string[]
  if (dated.length === 0) return null
  return dated.sort((left, right) => right.localeCompare(left))[0] ?? null
}

function collectClaims(
  signals: GrowthAccountIntelligenceNormalizedSignal[],
  categories: GrowthAccountIntelligenceNormalizedSignal["category"][],
  max: number,
): string[] {
  return signals
    .filter((signal) => categories.includes(signal.category))
    .filter((signal) => signal.certainty !== "unknown")
    .map((signal) => signal.claim)
    .slice(0, max)
}

function buildModelFromSignals(
  input: GrowthAccountIntelligenceInput,
  signals: GrowthAccountIntelligenceNormalizedSignal[],
): GrowthAccountIntelligenceModel {
  const usable = filterAccountIntelligenceSignalsByCertainty(signals, "likely")
  const verifiedOnly = filterAccountIntelligenceSignalsByCertainty(signals, "verified")

  const employeeEstimate =
    usable.find((signal) => /employee|company size|headcount/i.test(signal.claim))?.claim ?? null

  const companySummary = buildAccountIntelligenceVerifiedSummaryBullets({
    companyName: input.companyName,
    verifiedSignals: verifiedOnly,
    model: {
      companySummary: [],
      services: collectClaims(usable, ["services"], 4),
      products: collectClaims(usable, ["products"], 3),
      industriesServed: collectClaims(usable, ["customer", "summary"], 4),
      locations: collectClaims(usable, ["location"], 3),
      employeeEstimate,
      growthIndicators: collectClaims(usable, ["growth"], 4),
      hiringIndicators: collectClaims(usable, ["growth"], 4).filter((entry) => /hiring|recruit/i.test(entry)),
      technologyStack: collectClaims(usable, ["technology"], 4),
      equipmentIndicators: collectClaims(usable, ["equipment"], 4),
      complianceIndicators: collectClaims(usable, ["compliance"], 4),
      operationalSignals: collectClaims(usable, ["operational"], 5),
      financialSignals: collectClaims(usable, ["financial"], 3),
      customerSignals: collectClaims(usable, ["customer"], 4),
      differentiationSignals: collectClaims(usable, ["differentiation"], 4),
      competitiveSignals: [],
      websiteHighlights: collectClaims(usable, ["website"], 3),
      recentChanges: [],
      confidence: averageConfidence(usable),
      freshness: latestFreshness(usable),
    },
  })

  return {
    companySummary,
    services: collectClaims(usable, ["services"], 4),
    products: collectClaims(usable, ["products"], 3),
    industriesServed: collectClaims(usable, ["customer", "summary"], 4),
    locations: collectClaims(usable, ["location"], 3),
    employeeEstimate,
    growthIndicators: collectClaims(usable, ["growth"], 4),
    hiringIndicators: collectClaims(usable, ["growth"], 4).filter((entry) => /hiring|recruit/i.test(entry)),
    technologyStack: collectClaims(usable, ["technology"], 4),
    equipmentIndicators: collectClaims(usable, ["equipment"], 4),
    complianceIndicators: collectClaims(usable, ["compliance"], 4),
    operationalSignals: collectClaims(usable, ["operational"], 5),
    financialSignals: collectClaims(usable, ["financial"], 3),
    customerSignals: collectClaims(usable, ["customer"], 4),
    differentiationSignals: collectClaims(usable, ["differentiation"], 4),
    competitiveSignals: [],
    websiteHighlights: collectClaims(usable, ["website"], 3),
    recentChanges: [],
    confidence: averageConfidence(usable),
    freshness: latestFreshness(usable),
  }
}

function buildDiagnostics(
  signals: GrowthAccountIntelligenceNormalizedSignal[],
  model: GrowthAccountIntelligenceModel,
): GrowthAccountIntelligenceContext["diagnostics"] {
  const sourceBreakdown: Record<GrowthAccountIntelligenceSourceType, number> = {
    crm_metadata: 0,
    research: 0,
    website_crawl: 0,
    discovery: 0,
    apollo: 0,
    public_indicator: 0,
  }
  for (const signal of signals) {
    sourceBreakdown[signal.source] += 1
  }

  const missingSignals = GROWTH_ACCOUNT_INTELLIGENCE_MISSING_SIGNAL_HINTS.filter((hint) => {
    if (/operational/i.test(hint)) return model.operationalSignals.length === 0
    if (/growth/i.test(hint)) return model.growthIndicators.length === 0 && model.hiringIndicators.length === 0
    if (/technology/i.test(hint)) return model.technologyStack.length === 0
    if (/customer/i.test(hint)) return model.customerSignals.length === 0
    if (/differentiation/i.test(hint)) return model.differentiationSignals.length === 0
    if (/compliance/i.test(hint)) return model.complianceIndicators.length === 0
    return false
  })

  return {
    signalCount: signals.length,
    confidence: model.confidence,
    freshness: model.freshness,
    sourceBreakdown,
    verifiedSummary: model.companySummary.join("; "),
    topSignals: dedupeAccountIntelligenceSignals(signals)
      .slice(0, 6)
      .map((signal) => signal.claim),
    missingSignals: [...missingSignals],
  }
}

export function buildGrowthAccountIntelligence(
  input: GrowthAccountIntelligenceInput,
): GrowthAccountIntelligenceContext {
  const signals = normalizeAccountIntelligenceSignals(input)
  const model = buildModelFromSignals(input, signals)
  const promptSections = buildAccountIntelligencePromptSectionsFromModel(model)

  return {
    model,
    diagnostics: buildDiagnostics(signals, model),
    promptSections,
  }
}

export function buildGrowthAccountIntelligencePromptSectionsForChannel(
  context: GrowthAccountIntelligenceContext | null,
  channel: GrowthPlaybookOptimizationChannel,
): GrowthAccountIntelligenceContext["promptSections"] {
  if (!context) {
    return {
      verifiedCompanySummary: "- No account intelligence assembled.",
      verifiedOperationalSignals: "- No verified operational signals.",
      verifiedGrowthSignals: "- No verified growth signals.",
      verifiedTechnologySignals: "- No verified technology signals.",
      verifiedCustomerSignals: "- No verified customer signals.",
      verifiedDifferentiators: "- No verified differentiators.",
    }
  }
  return buildAccountIntelligencePromptSectionsForChannel(context.promptSections, channel)
}

export function buildAccountIntelligenceInputFromIndustryContextInput(
  input: import("@/lib/growth/playbooks/growth-industry-context-types").GrowthIndustryContextInput,
): GrowthAccountIntelligenceInput {
  return {
    companyName: input.companyName,
    companySummary: input.description,
    websiteSummary: input.researchSummary,
    researchFindings: input.researchSignals,
    websiteText: input.websiteText,
    websiteSignals: input.websiteSignals,
    verifiedFacts: input.verifiedFacts,
    companySize: input.companySize,
    decisionMakerTitle: input.decisionMakerTitle,
    naics: input.naics,
    sic: input.sic,
    hiringSignals: input.hiringSignals,
    leadSignals: input.leadSignals,
    researchSignals: input.researchSignals,
    ...(input.accountIntelligence ?? {}),
  }
}
