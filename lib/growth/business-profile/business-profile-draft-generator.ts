/** GE-AIOS-BUSINESS-PROFILE-1A — Deterministic Business Profile draft generator (client-safe). */

import {
  BUSINESS_PROFILE_DRAFT_LABEL,
  type BusinessProfileDraft,
  type BusinessProfileDraftContent,
  type BusinessProfileInput,
} from "@/lib/growth/business-profile/business-profile-types"

export type BusinessProfileDraftGeneratorMode = "deterministic" | "ai"

export type BusinessProfileDraftGeneratorOptions = {
  mode?: BusinessProfileDraftGeneratorMode
  /** Optional AI hook — when unavailable, deterministic fallback is used. */
  generateWithAi?: (input: BusinessProfileInput) => Promise<BusinessProfileDraftContent | null>
}

function trim(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeWebsite(value: string): string {
  const trimmed = trim(value)
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function hostnameFromWebsite(website: string): string {
  try {
    return new URL(normalizeWebsite(website)).hostname.replace(/^www\./i, "")
  } catch {
    return website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0] ?? website
  }
}

function buildDeterministicProfileContent(input: BusinessProfileInput): BusinessProfileDraftContent {
  const companyName = trim(input.companyName)
  const website = normalizeWebsite(input.website)
  const host = hostnameFromWebsite(website)
  const whatTheySell = trim(input.whatTheySell)
  const whoTheySellTo = trim(input.whoTheySellTo)
  const geography = trim(input.geography) || "United States"
  const averageDealSize = trim(input.averageDealSize) || null

  const productsServices = whatTheySell
    ? [whatTheySell]
    : [`Products and services offered by ${companyName}`]

  const targetIndustries = whoTheySellTo
    ? [whoTheySellTo, "Related service industries"]
    : ["Small and mid-sized service businesses", "Operations-driven companies"]

  const buyerPersonas = whoTheySellTo
    ? ["Owner", "Founder", "CEO", "Operations Manager", "General Manager"]
    : ["Owner", "Operations leader", "Service manager"]

  const assumptions: string[] = [
    `Drafted from company name, website (${host || "website"}), and operator inputs.`,
    "Review industries, personas, and messaging before approval.",
  ]
  const missingInformation: string[] = []

  if (!whatTheySell) missingInformation.push("What you sell (products/services detail)")
  if (!whoTheySellTo) missingInformation.push("Who you sell to (ideal customer description)")
  if (!trim(input.geography)) missingInformation.push("Primary geography confirmation")
  if (!averageDealSize) missingInformation.push("Typical deal size or contract value")

  let confidence = 0.62
  if (whatTheySell) confidence += 0.1
  if (whoTheySellTo) confidence += 0.1
  if (averageDealSize) confidence += 0.08
  if (host) confidence += 0.05
  confidence = Math.min(confidence, 0.92)

  return {
    company: {
      companyName,
      website,
      shortDescription: whatTheySell
        ? `${companyName} provides ${whatTheySell.toLowerCase()} for ${whoTheySellTo || "target customers"}.`
        : `${companyName} is a growth-stage company serving business customers (${host || "website"}).`,
      productsServices,
      businessModel: whoTheySellTo
        ? `B2B sales to ${whoTheySellTo.toLowerCase()}`
        : "B2B product or service sales",
      primaryValueProposition: whatTheySell
        ? `Help ${whoTheySellTo || "customers"} achieve better outcomes through ${whatTheySell.toLowerCase()}.`
        : `Help customers improve operations and revenue outcomes.`,
    },
    idealCustomers: {
      targetIndustries,
      companySizeRanges: ["1–10", "11–50", "51–200"],
      geography: [geography],
      buyerPersonas,
      disqualifiers: ["Companies with no operational buying need", "Enterprise-only procurement with long cycles"],
    },
    problemsAndTriggers: {
      painPoints: [
        "Manual or fragmented workflows",
        "Difficulty scaling service delivery",
        "Limited visibility into pipeline or customer operations",
      ],
      buyingTriggers: [
        "Growth or hiring push",
        "Replacing legacy tools",
        "Customer SLA or retention pressure",
      ],
      competitorsAlternatives: ["Spreadsheets", "Legacy software", "Manual processes"],
      keywords: whatTheySell
        ? [whatTheySell, companyName, host].filter(Boolean)
        : [companyName, host, "operations software", "service management"].filter(Boolean),
      negativeKeywords: ["consumer", "hobby", "free-only"],
    },
    salesAndMarketing: {
      averageDealSize,
      salesCycleEstimate: averageDealSize ? "30–90 days (estimated)" : "Unknown — confirm with operator",
      messagingAngles: [
        whatTheySell ? `Outcome-focused ${whatTheySell.toLowerCase()}` : "Operational efficiency and growth",
        "Reduce manual work and improve customer outcomes",
      ],
      qualificationCriteria: [
        "Matches target industry and company size",
        "Identifiable buyer persona with operational pain",
        "Geography fit",
      ],
    },
    confidence: {
      score: confidence,
      assumptions,
      missingInformation,
    },
  }
}

export async function draftBusinessProfileFromCompanyInput(
  input: BusinessProfileInput,
  options: BusinessProfileDraftGeneratorOptions = {},
): Promise<BusinessProfileDraft> {
  const normalizedInput: BusinessProfileInput = {
    companyName: trim(input.companyName),
    website: normalizeWebsite(input.website),
    whatTheySell: trim(input.whatTheySell) || null,
    whoTheySellTo: trim(input.whoTheySellTo) || null,
    geography: trim(input.geography) || null,
    averageDealSize: trim(input.averageDealSize) || null,
  }

  let profile: BusinessProfileDraftContent
  const mode = options.mode ?? "deterministic"

  if (mode === "ai" && options.generateWithAi) {
    profile = (await options.generateWithAi(normalizedInput)) ?? buildDeterministicProfileContent(normalizedInput)
  } else {
    profile = buildDeterministicProfileContent(normalizedInput)
  }

  return {
    status: "draft",
    isActive: false,
    input: normalizedInput,
    profile,
    label: BUSINESS_PROFILE_DRAFT_LABEL,
  }
}
