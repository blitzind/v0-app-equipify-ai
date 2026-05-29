/** Deterministic research brief assembly from existing Growth Engine data — client-safe. */

import type { GrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-types"
import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthBrowserIntakeResearchBriefArtifact } from "@/lib/growth/browser-intake/browser-intake-research-brief-types"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"

export type BrowserIntakeResearchBriefAssemblyInput = {
  lead: {
    id: string
    companyName: string
    nextBestActionReason: string | null
  }
  researchRun: GrowthResearchRunPublicView | null
  accountBrief: GrowthLeadEngineAccountBriefOutput | null
  companyDiscovery: GrowthLeadEngineCompanyDiscoveryOutput | null
}

function claimList(
  items: Array<{ claim?: string }> | undefined,
  limit = 6,
): string[] {
  return (items ?? [])
    .map((item) => (item.claim ?? "").trim())
    .filter(Boolean)
    .slice(0, limit)
}

export function assembleBrowserIntakeResearchBrief(
  input: BrowserIntakeResearchBriefAssemblyInput,
): GrowthBrowserIntakeResearchBriefArtifact {
  const brief = input.accountBrief
  const research = input.researchRun
  const discovery = input.companyDiscovery

  const sources: string[] = ["lead_record"]
  if (research?.status === "completed") sources.push("prospect_research")
  if (brief) sources.push("account_brief")
  if (discovery) sources.push("company_discovery")

  return {
    lead_id: input.lead.id,
    company_name: input.lead.companyName,
    company_summary:
      brief?.company_summary?.trim() ||
      research?.researchSummary?.trim() ||
      `${input.lead.companyName} — limited research on file.`,
    why_this_account:
      brief?.why_this_account?.trim() ||
      discovery?.fit_assessment.matched_icp_rules.join(", ") ||
      input.lead.nextBestActionReason?.trim() ||
      "Review ICP fit before outreach.",
    fit_summary:
      brief?.fit_summary?.trim() ||
      (discovery
        ? `${discovery.fit_assessment.fit_tier} fit (${discovery.fit_assessment.fit_score}/100)`
        : "Fit assessment not available."),
    pain_points:
      claimList(brief?.pain_points).length > 0
        ? claimList(brief?.pain_points)
        : (discovery?.signals.pain_signals ?? []).slice(0, 6),
    growth_signals:
      claimList(brief?.growth_signals).length > 0
        ? claimList(brief?.growth_signals)
        : (discovery?.signals.growth_signals ?? []).slice(0, 6),
    buying_signals:
      claimList(brief?.buying_signals).length > 0
        ? claimList(brief?.buying_signals)
        : (discovery?.signals.buying_triggers ?? []).slice(0, 6),
    technology_summary:
      brief?.technology_summary?.trim() ||
      (research?.detectedTechnologies?.length
        ? research.detectedTechnologies.slice(0, 6).join(", ")
        : "No technology signals captured."),
    risk_summary:
      brief?.risk_summary?.trim() ||
      (discovery?.fit_assessment.disqualifiers ?? []).slice(0, 3).join("; ") ||
      "No major risks flagged in existing data.",
    recommended_angle:
      brief?.recommended_angle?.trim() ||
      research?.suggestedPitchAngle?.trim() ||
      "Lead with operational efficiency and customer experience improvements.",
    recommended_next_step:
      brief?.recommended_cta?.trim() ||
      research?.recommendedNextAction?.trim() ||
      discovery?.recommended_next_step.action?.trim() ||
      "Run deeper research or schedule discovery call.",
    research_confidence:
      brief?.research_confidence ??
      research?.researchConfidence ??
      (discovery ? Math.round(discovery.fit_assessment.confidence * 100) : null),
    generated_at: new Date().toISOString(),
    sources_used: sources,
  }
}
