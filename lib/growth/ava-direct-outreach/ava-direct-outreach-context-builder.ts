/**
 * AVA-SIMPLE-OUTREACH-2A — Gather / verify / organize evidence for GPT.
 * Does not score ICP fit, invent operational confidence, or pre-judge outreach.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadOutreachSellerTruthBundle } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { enrichCompanyIntelligenceFromEvidence } from "@/lib/growth/research/company-evidence/company-evidence-intelligence-enrichment"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import type { AvaDirectOutreachContext } from "@/lib/growth/ava-direct-outreach/ava-direct-outreach-types"

const MAX_LIST = 16
const MAX_EXCERPT = 12
const MAX_TEXT = 1200

function trimText(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().replace(/\s+/g, " ")
  if (!trimmed) return null
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

function uniqueStrings(values: Array<string | null | undefined>, max = MAX_LIST): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const trimmed = trimText(value, 500)
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= max) break
  }
  return out
}

function locationFromLead(lead: {
  city: string | null
  state: string | null
  country: string | null
}): string | null {
  return uniqueStrings([lead.city, lead.state, lead.country], 3).join(", ") || null
}

/**
 * Strip synthetic score lines from stored research summaries when a cleaner
 * evidence profile section exists. Prefer original prose over maturity/% scores.
 */
function preferEvidenceRichSummary(summary: string | null): string | null {
  const full = trimText(summary, 4000)
  if (!full) return null

  const evidenceIdx = full.search(/\nEvidence profile\b/i)
  if (evidenceIdx >= 0) {
    const profile = full.slice(evidenceIdx).trim()
    // Keep a short lead sentence if the base summary has non-score prose.
    const lead = full.slice(0, evidenceIdx).trim()
    const leadClean = lead
      .split(/[.\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !/\b\d{1,3}%\s*confidence\b/i.test(s))
      .filter((s) => !/\bwebsite maturity\b/i.test(s))
      .filter((s) => !/\bmaturity\s+\d+\/100\b/i.test(s))
      .slice(0, 2)
      .join(". ")
    if (leadClean) return trimText(`${leadClean}.\n\n${profile}`, 4000)
    return trimText(profile, 4000)
  }

  // Drop synthetic score / operator-action clauses; keep original prose.
  return (
    trimText(
      full
        .replace(/\bWebsite maturity\s+\d+\/100\b[^.]*\.?/gi, "")
        .replace(/\(\d{1,3}%\s*confidence\)/gi, "")
        .replace(/\bTop opportunities:[^.]*\.?/gi, "")
        .replace(/\bSuggested operator action:[^.]*\.?/gi, "")
        .replace(/\bDetected technologies:[^.]*\.?/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
      4000,
    ) ?? full
  )
}

function extractDatamoonFindings(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  if (!metadata || typeof metadata !== "object") return []
  const datamoon = metadata.datamoon
  if (!datamoon || typeof datamoon !== "object") return []
  const dm = datamoon as Record<string, unknown>
  const findings: string[] = []

  const domain = trimText(dm.domain ?? dm.companyDomain ?? dm.website, 200)
  if (domain) findings.push(`DataMoon source domain: ${domain}`)

  const audienceId = trimText(dm.audienceId ?? dm.audience_id, 120)
  if (audienceId) findings.push(`Imported from DataMoon audience ${audienceId}`)

  const industry = trimText(dm.industry, 200)
  if (industry) findings.push(`DataMoon industry: ${industry}`)

  const companyName = trimText(dm.companyName ?? dm.company_name, 200)
  if (companyName) findings.push(`DataMoon company name: ${companyName}`)

  return uniqueStrings(findings, 8)
}

function extractWebsiteExcerpts(
  research: Awaited<ReturnType<typeof fetchLatestCompletedProspectResearchRun>>,
): string[] {
  const bundle = research?.signals?.companyEvidence_v22
  if (!bundle?.profile) return []

  const excerpts: string[] = []
  const profile = bundle.profile
  const listFields = [
    profile.primaryServices,
    profile.primaryProducts,
    profile.industriesServed,
    profile.differentiators,
    profile.targetCustomers,
    profile.geographicMarkets,
    profile.hiringSignals,
    profile.technologySignals,
  ]

  for (const field of listFields) {
    if (!field?.evidence?.length) continue
    for (const excerpt of field.evidence) {
      const text = trimText(excerpt, 400)
      if (text) excerpts.push(text)
    }
  }

  if (profile.companyDescription?.evidence) {
    const text = trimText(profile.companyDescription.evidence, 400)
    if (text) excerpts.unshift(text)
  }

  return uniqueStrings(excerpts, MAX_EXCERPT)
}

export type BuildAvaDirectOutreachContextResult =
  | { ok: true; context: AvaDirectOutreachContext }
  | { ok: false; code: "lead_not_found" | "organization_unavailable"; message: string }

export async function buildAvaDirectOutreachContext(input: {
  admin: SupabaseClient
  organizationId: string
  leadId: string
}): Promise<BuildAvaDirectOutreachContextResult> {
  if (!input.organizationId) {
    return {
      ok: false,
      code: "organization_unavailable",
      message: "Growth organization is not configured.",
    }
  }

  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) {
    return { ok: false, code: "lead_not_found", message: "Lead not found." }
  }

  // Org isolation: reject when research exists only under a foreign org.
  const { data: orgScopedResearch, error: orgResearchError } = await input.admin
    .schema("growth")
    .from("research_runs")
    .select("id, organization_id")
    .eq("lead_id", input.leadId)
    .eq("organization_id", input.organizationId)
    .limit(1)
    .maybeSingle()

  if (orgResearchError) {
    throw new Error(orgResearchError.message)
  }

  const { count: foreignResearchCount, error: foreignError } = await input.admin
    .schema("growth")
    .from("research_runs")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", input.leadId)
    .neq("organization_id", input.organizationId)

  if (foreignError) {
    throw new Error(foreignError.message)
  }

  if ((foreignResearchCount ?? 0) > 0 && !orgScopedResearch) {
    return {
      ok: false,
      code: "lead_not_found",
      message: "Lead is not accessible for the active organization.",
    }
  }

  const [decisionMakers, completedResearch] = await Promise.all([
    listGrowthLeadDecisionMakers(input.admin, input.leadId),
    fetchLatestCompletedProspectResearchRun(input.admin, input.leadId).catch(() => null),
  ])

  const sellerBundle = await loadOutreachSellerTruthBundle(input.admin, {
    organizationId: input.organizationId,
    preparedAt: new Date().toISOString(),
    prospectIndustry: trimText(completedResearch?.industryGuess) ?? trimText(lead.metadata?.industry),
    prospectCompanyName: lead.companyName,
    leadId: lead.id,
  })

  const primaryDm =
    decisionMakers.find((dm) => dm.isPrimary) ?? decisionMakers[0] ?? null

  const seller = sellerBundle.sellerTruth
  const profile = sellerBundle.approvedProfile
  const enrichment = enrichCompanyIntelligenceFromEvidence(
    completedResearch?.signals?.companyEvidence_v22 ?? null,
  )

  const verifiedProductsServices = uniqueStrings(
    [
      ...(enrichment?.verifiedServices ?? []),
      ...(enrichment?.verifiedProducts ?? []),
    ],
    MAX_LIST,
  )

  // Operational capabilities: concrete service/capability language — not scores.
  const verifiedOperationalCapabilities = uniqueStrings(
    [
      ...(enrichment?.verifiedServices ?? []),
      ...(enrichment?.verifiedDifferentiators ?? []),
      ...(enrichment?.verifiedHiringSignals ?? []),
      lead.fieldServiceStackDetected
        ? `Field service stack observed on lead record: ${lead.fieldServiceStackDetected}`
        : null,
      lead.crmDetected ? `CRM observed on lead record: ${lead.crmDetected}` : null,
    ],
    MAX_LIST,
  )

  const knownRisks = uniqueStrings(
    [
      ...(enrichment?.missingEvidence ?? []).map((m) => `Missing evidence: ${m}`),
      // Seller disqualifiers are Equipify business rules for GPT — not a software reject.
      ...seller.disqualifiers.map((d) => `Equipify disqualifier guidance: ${d}`),
      ...(seller.whenNotToRecommend ?? []).map((d) => `Equipify when-not-to-recommend: ${d}`),
    ],
    MAX_LIST,
  )

  const missingInformation = uniqueStrings(
    [
      !enrichment?.verifiedBusinessDescription ? "No verified company description" : null,
      verifiedProductsServices.length === 0 ? "No verified products/services" : null,
      !primaryDm?.email && !lead.contactEmail ? "No decision-maker email" : null,
      !primaryDm?.title ? "No decision-maker title" : null,
      !lead.website && !completedResearch?.websiteUrl ? "No company website" : null,
      !completedResearch?.researchSummary && !enrichment?.verifiedBusinessDescription
        ? "No completed prospect research"
        : null,
      ...(enrichment?.missingEvidence ?? []),
    ],
    MAX_LIST,
  )

  const productSummary =
    trimText(seller.elevatorPitch, 600) ??
    trimText(seller.primaryValueProposition, 600) ??
    trimText(seller.companyIdentity, 600) ??
    "Equipify helps equipment-centric service businesses operate and grow."

  const context: AvaDirectOutreachContext = {
    company: {
      name: lead.companyName,
      website: lead.website ?? completedResearch?.websiteUrl ?? null,
      location: locationFromLead(lead),
      leadId: lead.id,
    },
    decisionMaker: {
      name: primaryDm?.fullName ?? lead.contactName,
      title: primaryDm?.title ?? null,
      email: primaryDm?.email ?? lead.contactEmail,
      linkedinUrl: primaryDm?.linkedinUrl ?? null,
    },
    verifiedCompanyDescription: trimText(enrichment?.verifiedBusinessDescription, 1200),
    verifiedProductsServices,
    verifiedOperationalCapabilities,
    researchSummary: preferEvidenceRichSummary(completedResearch?.researchSummary ?? null),
    relevantWebsiteExcerpts: extractWebsiteExcerpts(completedResearch),
    datamoonFindings: extractDatamoonFindings(lead.metadata),
    knownRisks,
    missingInformation,
    equipifyBusinessProfile: {
      name: seller.sellerCompanyName ?? profile?.company.companyName ?? "Equipify",
      productName: "Equipify",
      productSummary,
      idealCustomerSummary:
        uniqueStrings(seller.idealCustomerProfile, 8).join("; ") ||
        uniqueStrings(profile?.idealCustomers.targetIndustries ?? [], 8).join("; ") ||
        "Equipment service and field-service organizations that need operational software.",
      approvedCapabilities: uniqueStrings(
        [
          ...(seller.currentCapabilities ?? []),
          ...seller.productsServices,
          ...(profile?.company.productsServices ?? []),
        ],
        10,
      ),
      approvedValuePropositions: uniqueStrings(
        [
          seller.primaryValueProposition,
          ...seller.messagingAngles,
          ...seller.businessOutcomes,
          ...seller.differentiators,
        ],
        10,
      ),
      disqualifiers: uniqueStrings(
        [...seller.disqualifiers, ...(seller.whenNotToRecommend ?? [])],
        10,
      ),
    },
  }

  return { ok: true, context }
}
