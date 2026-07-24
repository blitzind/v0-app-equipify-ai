/**
 * FUZOR-COMPANY-INTELLIGENCE-1A — Gather existing evidence only.
 * No scoring. No ICP. No Equipify seller truth.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { enrichCompanyIntelligenceFromEvidence } from "@/lib/growth/research/company-evidence/company-evidence-intelligence-enrichment"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import type { FuzorCompanyIntelligenceEvidencePacket } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"

const MAX_LIST = 24
const MAX_EXCERPT = 16

function trimText(value: unknown, max = 1200): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().replace(/\s+/g, " ")
  if (!trimmed) return null
  // Decode a few common HTML entities from crawls without becoming an HTML parser.
  const decoded = trimmed
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
  if (!decoded) return null
  return decoded.length > max ? `${decoded.slice(0, max - 1)}…` : decoded
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

function extractDatamoonFindings(
  metadata: Record<string, unknown> | null | undefined,
): { findings: string[]; linkedinCompanyUrl: string | null } {
  if (!metadata || typeof metadata !== "object") {
    return { findings: [], linkedinCompanyUrl: null }
  }
  const datamoon = metadata.datamoon
  if (!datamoon || typeof datamoon !== "object") {
    return { findings: [], linkedinCompanyUrl: null }
  }
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

  const linkedinCompanyUrl =
    trimText(dm.companyLinkedinUrl ?? dm.company_linkedin_url ?? dm.linkedinUrl, 400) ?? null

  return { findings: uniqueStrings(findings, 8), linkedinCompanyUrl }
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
  if (profile.companyDescription?.value) {
    const text = trimText(profile.companyDescription.value, 400)
    if (text) excerpts.unshift(text)
  }

  return uniqueStrings(excerpts, MAX_EXCERPT)
}

function stripLegacyScoreLanguage(summary: string | null): string | null {
  const full = trimText(summary, 4000)
  if (!full) return null
  return (
    trimText(
      full
        .replace(/\bWebsite maturity\s+\d+\/100\b[^.]*\.?/gi, "")
        .replace(/\(\d{1,3}%\s*confidence\)/gi, "")
        .replace(/\b\d{1,3}%\s*confidence\b/gi, "")
        .replace(/\bTop opportunities:[^.]*\.?/gi, "")
        .replace(/\bSuggested operator action:[^.]*\.?/gi, "")
        .replace(/\bDetected technologies:[^.]*\.?/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
      4000,
    ) ?? full
  )
}

export type GatherFuzorCompanyIntelligenceEvidenceResult =
  | { ok: true; packet: FuzorCompanyIntelligenceEvidencePacket }
  | { ok: false; code: "lead_not_found"; message: string }

export async function gatherFuzorCompanyIntelligenceEvidence(input: {
  admin: SupabaseClient
  leadId: string
  organizationId?: string | null
}): Promise<GatherFuzorCompanyIntelligenceEvidenceResult> {
  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) {
    return { ok: false, code: "lead_not_found", message: "Lead not found." }
  }

  // Optional org isolation when organizationId is supplied.
  if (input.organizationId?.trim()) {
    const orgId = input.organizationId.trim()
    const { data: orgScopedResearch, error: orgResearchError } = await input.admin
      .schema("growth")
      .from("research_runs")
      .select("id")
      .eq("lead_id", input.leadId)
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle()
    if (orgResearchError) throw new Error(orgResearchError.message)

    const { count: foreignResearchCount, error: foreignError } = await input.admin
      .schema("growth")
      .from("research_runs")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", input.leadId)
      .neq("organization_id", orgId)
    if (foreignError) throw new Error(foreignError.message)

    if ((foreignResearchCount ?? 0) > 0 && !orgScopedResearch) {
      return {
        ok: false,
        code: "lead_not_found",
        message: "Lead is not accessible for the active organization.",
      }
    }
  }

  const research = await fetchLatestCompletedProspectResearchRun(input.admin, input.leadId).catch(
    () => null,
  )

  const enrichment = enrichCompanyIntelligenceFromEvidence(
    research?.signals?.companyEvidence_v22 ?? null,
  )
  const datamoon = extractDatamoonFindings(lead.metadata)
  const metadataLinkedin = trimText(
    (lead.metadata as { company_linkedin_url?: unknown; linkedin_url?: unknown } | null)
      ?.company_linkedin_url ??
      (lead.metadata as { linkedin_url?: unknown } | null)?.linkedin_url,
    400,
  )

  const pagesObserved =
    research?.signals?.companyEvidence_v22?.crawlState?.pageSelections
      ?.filter((p) => p.status === "crawled" || p.status === "selected")
      .slice(0, 20)
      .map((p) => ({
        url: p.url,
        pageType: p.pageType,
        status: p.status,
      })) ?? []

  const packet: FuzorCompanyIntelligenceEvidencePacket = {
    companyName: lead.companyName,
    website: lead.website ?? research?.websiteUrl ?? null,
    leadId: lead.id,
    linkedinCompanyUrl: datamoon.linkedinCompanyUrl ?? metadataLinkedin,
    verifiedDescription: trimText(enrichment?.verifiedBusinessDescription, 1200),
    verifiedOfferings: uniqueStrings(
      [...(enrichment?.verifiedServices ?? []), ...(enrichment?.verifiedProducts ?? [])],
      MAX_LIST,
    ),
    verifiedIndustries: uniqueStrings(enrichment?.verifiedIndustries ?? [], 12),
    verifiedCustomers: uniqueStrings(enrichment?.verifiedCustomerTypes ?? [], 12),
    verifiedMarkets: uniqueStrings(enrichment?.verifiedMarkets ?? [], 12),
    verifiedDifferentiators: uniqueStrings(enrichment?.verifiedDifferentiators ?? [], 12),
    verifiedTechnologySignals: uniqueStrings(enrichment?.verifiedTechnologySignals ?? [], 12),
    verifiedHiringSignals: uniqueStrings(enrichment?.verifiedHiringSignals ?? [], 12),
    websiteExcerpts: extractWebsiteExcerpts(research),
    pagesObserved,
    datamoonFindings: datamoon.findings,
    priorResearchNotes: stripLegacyScoreLanguage(research?.researchSummary ?? null),
    missingFromCollection: uniqueStrings(
      [
        ...(enrichment?.missingEvidence ?? []),
        !enrichment?.verifiedBusinessDescription ? "No verified company description collected" : null,
        !(enrichment?.verifiedServices?.length || enrichment?.verifiedProducts?.length)
          ? "No verified products/services collected"
          : null,
        !research ? "No completed prospect research run" : null,
      ],
      16,
    ),
  }

  return { ok: true, packet }
}
