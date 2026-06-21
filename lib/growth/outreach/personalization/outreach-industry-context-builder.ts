/** GS-AI-PLAYBOOK-1C — Outreach industry context builder (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildGrowthIndustryContext,
  type GrowthIndustryContext,
  type GrowthIndustryContextRegenerationFeedback,
} from "@/lib/growth/playbooks/growth-industry-context"
import { parsePersonalizationOperatorMetadata } from "@/lib/growth/personalization/personalization-generation-ux"
import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import { buildOutreachVerifiedFactsFromPacket } from "@/lib/growth/outreach/personalization/outreach-verified-facts"
import { fetchLatestUsableGrowthLeadResearchRun } from "@/lib/growth/research-repository"
import type { GrowthLead } from "@/lib/growth/types"

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean))]
}

function metadataCodes(metadata: Record<string, unknown>, ...keys: string[]): string[] {
  const values: string[] = []
  for (const key of keys) {
    const raw = metadata[key]
    if (typeof raw === "string" && raw.trim()) values.push(raw.trim())
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (typeof entry === "string" && entry.trim()) values.push(entry.trim())
      }
    }
  }
  return uniqueStrings(values)
}

export async function fetchLatestPersonalizationRegenerationFeedback(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthIndustryContextRegenerationFeedback | null> {
  const { data } = await admin
    .schema("growth")
    .from("personalization_generations")
    .select("id, metadata, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(12)

  for (const row of data ?? []) {
    const parsed = parsePersonalizationOperatorMetadata(row.metadata)
    if (parsed?.regeneration_feedback) {
      return {
        category: parsed.regeneration_feedback.category,
        customNotes: parsed.regeneration_feedback.customNotes ?? null,
        priorGenerationId: parsed.prior_generation_id ?? row.id,
        recordedAt: parsed.regeneration_feedback.recordedAt ?? row.created_at,
      }
    }
  }
  return null
}

export async function buildOutreachIndustryContextForLead(
  admin: SupabaseClient,
  lead: GrowthLead,
  options?: { packet?: OutreachContextPacket; regenerationFeedback?: GrowthIndustryContextRegenerationFeedback | null },
): Promise<GrowthIndustryContext> {
  const researchRun = lead.latestResearchRunId
    ? await fetchLatestUsableGrowthLeadResearchRun(admin, lead.id)
    : null
  const research = researchRun?.result
  const metadata = (lead.metadata ?? {}) as Record<string, unknown>
  const regenerationFeedback =
    options?.regenerationFeedback !== undefined
      ? options.regenerationFeedback
      : await fetchLatestPersonalizationRegenerationFeedback(admin, lead.id)

  const industryLabel =
    options?.packet?.industryLabel ?? research?.likelyServiceCategory ?? lead.industry ?? lead.sourceChannel

  const verifiedFacts = options?.packet
    ? buildOutreachVerifiedFactsFromPacket(options.packet)
    : uniqueStrings([
        research?.companySummary?.trim() ?? "",
        research?.websiteSummary?.trim() ?? "",
        ...(research?.equipmentServiceIndicators ?? []).map((entry) => `Service focus: ${entry}`),
        ...(research?.outreachAngles ?? []).map((entry) => `Observed: ${entry}`),
        ...(research?.serviceAreaClues ?? []),
      ])

  return buildGrowthIndustryContext({
    companyName: lead.companyName,
    industryLabel,
    description: research?.companySummary ?? null,
    websiteText: researchRun?.websiteTextExcerpt ?? null,
    researchSummary: research?.websiteSummary ?? null,
    naics: metadataCodes(metadata, "naics", "naics_codes", "naicsCodes"),
    sic: metadataCodes(metadata, "sic", "sic_codes", "sicCodes"),
    verifiedFacts,
    regenerationFeedback,
    leadSignals: [
      ...(research?.outreachAngles ?? []),
      ...(research?.equipmentServiceIndicators ?? []),
      ...(research?.hiringSignals ?? []),
    ],
    researchSignals: [research?.companySummary, research?.websiteSummary].filter(Boolean) as string[],
    hiringSignals: research?.hiringSignals ?? [],
    websiteSignals: [
      researchRun?.websiteTextExcerpt,
      ...(research?.equipmentServiceIndicators ?? []),
    ].filter(Boolean) as string[],
    decisionMakerTitle: options?.packet?.decisionMakerTitle ?? null,
    companySize: options?.packet?.employeeSize ?? null,
  })
}
