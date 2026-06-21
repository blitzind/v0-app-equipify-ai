/** GS-AI-PLAYBOOK-3A — Deterministic company summary generator (client-safe). */

import type {
  GrowthAccountIntelligenceModel,
  GrowthAccountIntelligenceNormalizedSignal,
} from "@/lib/growth/account-intelligence/growth-account-intelligence-types"

function bulletize(values: string[], max: number): string[] {
  return values.slice(0, max).map((entry) => entry.replace(/^[-•]\s*/, "").trim())
}

function formatSummaryBullet(text: string): string {
  const cleaned = text.replace(/\.$/, "").trim()
  if (/^(provides|supports|offers|delivers|operates|performs|maintains|specializes)\b/i.test(cleaned)) {
    return cleaned.charAt(0).toLowerCase() + cleaned.slice(1)
  }
  return cleaned
}

export function buildAccountIntelligenceVerifiedSummaryBullets(input: {
  companyName?: string | null
  verifiedSignals: GrowthAccountIntelligenceNormalizedSignal[]
  model: GrowthAccountIntelligenceModel
}): string[] {
  const bullets: string[] = []
  const seen = new Set<string>()

  function addBullet(text: string): void {
    const normalized = formatSummaryBullet(text)
    const key = normalized.toLowerCase()
    if (!normalized || seen.has(key)) return
    seen.add(key)
    bullets.push(normalized)
  }

  for (const signal of input.verifiedSignals) {
    if (signal.category === "summary" || signal.category === "services") {
      addBullet(signal.claim)
    }
  }

  for (const service of input.model.services.slice(0, 2)) addBullet(service)
  for (const industry of input.model.industriesServed.slice(0, 2)) addBullet(`supports ${industry}`)
  for (const operational of input.model.operationalSignals.slice(0, 2)) addBullet(operational)
  for (const compliance of input.model.complianceIndicators.slice(0, 1)) addBullet(compliance)
  for (const location of input.model.locations.slice(0, 1)) {
    addBullet(location.startsWith("operates") ? location : `operates ${location}`)
  }

  if (bullets.length === 0 && input.companyName) {
    addBullet(`limited verified company intelligence available for ${input.companyName}`)
  }

  return bulletize(bullets, 6)
}

export function buildAccountIntelligencePromptSectionBody(
  title: string,
  signals: string[],
  emptyMessage: string,
): string {
  if (signals.length === 0) return emptyMessage
  return [`${title}:`, ...signals.map((entry) => `- ${entry}`)].join("\n")
}

export function buildAccountIntelligencePromptSectionsFromModel(model: GrowthAccountIntelligenceModel): {
  verifiedCompanySummary: string
  verifiedOperationalSignals: string
  verifiedGrowthSignals: string
  verifiedTechnologySignals: string
  verifiedCustomerSignals: string
  verifiedDifferentiators: string
} {
  const summaryBullets = model.companySummary.length
    ? model.companySummary
    : ["No verified company summary assembled — do not invent company-specific claims."]

  return {
    verifiedCompanySummary: summaryBullets.map((entry) => `- ${entry}`).join("\n"),
    verifiedOperationalSignals: buildAccountIntelligencePromptSectionBody(
      "Operational signals (verified/likely only)",
      model.operationalSignals,
      "- No verified operational signals.",
    ),
    verifiedGrowthSignals: buildAccountIntelligencePromptSectionBody(
      "Growth signals (verified/likely only)",
      [...model.growthIndicators, ...model.hiringIndicators],
      "- No verified growth or hiring signals.",
    ),
    verifiedTechnologySignals: buildAccountIntelligencePromptSectionBody(
      "Technology signals (verified/likely only)",
      model.technologyStack,
      "- No verified technology stack signals.",
    ),
    verifiedCustomerSignals: buildAccountIntelligencePromptSectionBody(
      "Customer signals (verified/likely only)",
      model.customerSignals,
      "- No verified customer or vertical signals.",
    ),
    verifiedDifferentiators: buildAccountIntelligencePromptSectionBody(
      "Differentiators (verified/likely only)",
      [...model.differentiationSignals, ...model.competitiveSignals],
      "- No verified differentiators.",
    ),
  }
}

export function buildAccountIntelligencePromptSectionsForChannel(
  sections: ReturnType<typeof buildAccountIntelligencePromptSectionsFromModel>,
  channel: "SMS" | "VOICE" | "EMAIL" | "SHARE_PAGE" | "COPILOT" | "REFINEMENT" | "DEFAULT",
): ReturnType<typeof buildAccountIntelligencePromptSectionsFromModel> {
  if (channel === "SMS") {
    return {
      ...sections,
      verifiedOperationalSignals: sections.verifiedOperationalSignals.split("\n").slice(0, 2).join("\n"),
      verifiedGrowthSignals: sections.verifiedGrowthSignals.split("\n").slice(0, 2).join("\n"),
      verifiedTechnologySignals: "- Omitted for SMS channel budget.",
      verifiedCustomerSignals: "- Omitted for SMS channel budget.",
      verifiedDifferentiators: "- Omitted for SMS channel budget.",
    }
  }
  if (channel === "VOICE") {
    return {
      ...sections,
      verifiedCompanySummary: sections.verifiedCompanySummary.split("\n").slice(0, 3).join("\n"),
      verifiedTechnologySignals: sections.verifiedTechnologySignals.split("\n").slice(0, 3).join("\n"),
      verifiedCustomerSignals: sections.verifiedCustomerSignals.split("\n").slice(0, 2).join("\n"),
      verifiedDifferentiators: sections.verifiedDifferentiators.split("\n").slice(0, 2).join("\n"),
    }
  }
  return sections
}
