import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthAiCopilotInput } from "@/lib/growth/ai-copilot-input"
import {
  describeFrameworkKeys,
  GROWTH_AI_COPILOT_OBJECTION_FRAMEWORK,
  resolveGrowthAiCopilotFrameworkKeys,
} from "@/lib/growth/ai-copilot-frameworks"
import { fetchGrowthCopilotSettings } from "@/lib/growth/ai-copilot-repository"
import { buildPlaybookAttribution, computePlaybookInfluenceScore } from "@/lib/growth/ai-copilot-playbook-influence"
import { resolveGrowthAiCopilotPlaybookRules } from "@/lib/growth/ai-copilot-playbook-resolver"
import { resolveOutreachLeadIndustryTags } from "@/lib/growth/outreach/personalization/context-packet-builder"
import type { GrowthCallCopilotBriefing } from "@/lib/growth/call-copilot-types"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import type { GrowthLead } from "@/lib/growth/types"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { resolveCanonicalChannelContentForLead } from "@/lib/growth/aios/growth/growth-channels-1a-canonical-resolver"
import { GROWTH_AIOS_CHANNELS_1A_QA_MARKER } from "@/lib/growth/aios/growth/growth-channels-1a-types"

export {
  computeBriefEffectivenessScore,
  computeCallOutcomeConfidence,
  suggestCallDisposition,
} from "@/lib/growth/call-copilot-heuristics"

function isHighRiskCall(lead: GrowthLead, riskWarnings: string[]): boolean {
  if (lead.executivePriorityTier === "executive_now") return true
  if (lead.operationalCapacityTier === "critical") return true
  if ((lead.intelligenceConflictSeverityScore ?? 0) >= 50) return true
  if (lead.opportunityBlockers.some((b) => b.key === "suppressed" || b.key === "not_interested")) return true
  return riskWarnings.length >= 3
}

export async function buildGrowthCallCopilotBriefing(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<GrowthCallCopilotBriefing> {
  const [decisionMakers, inputSnapshot, settings, memory] = await Promise.all([
    listGrowthLeadDecisionMakers(admin, lead.id),
    buildGrowthAiCopilotInput(admin, lead),
    fetchGrowthCopilotSettings(admin),
    buildLeadMemoryInfluenceContext(admin, lead.id),
  ])

  const frameworks = resolveGrowthAiCopilotFrameworkKeys(lead)
  const likelyObjections = [
    ...memory.topObjections,
    ...describeFrameworkKeys(frameworks.objections, GROWTH_AI_COPILOT_OBJECTION_FRAMEWORK),
  ].filter((entry, index, all) => all.indexOf(entry) === index)

  const leadIndustryTags = await resolveOutreachLeadIndustryTags(admin, lead)

  const playbookRules = settings.aiCopilotPlaybookEnabled
    ? (
        await resolveGrowthAiCopilotPlaybookRules(admin, {
          generationType: "call_opening",
          maxRules: settings.aiCopilotPlaybookMaxRulesPerGeneration,
          leadIndustryTags,
        })
      ).rules
    : []

  const doNotSay: string[] = []
  for (const rule of playbookRules) {
    if (rule.category === "words_to_avoid") doNotSay.push(rule.title)
  }
  for (const pref of memory.topPreferences) {
    doNotSay.push(`Do not contradict known preference: ${pref}`)
  }
  for (const topic of memory.avoidRepeating) {
    doNotSay.push(`Avoid re-asking: ${topic}`)
  }
  if (lead.opportunityBlockers.some((b) => b.key === "suppressed")) {
    doNotSay.push("Do not pitch — lead is suppressed.")
  }

  const riskWarnings: string[] = []
  for (const flag of memory.riskFlags) {
    riskWarnings.push(`Memory risk: ${flag}`)
  }
  if (lead.executivePriorityTier === "executive_now") {
    riskWarnings.push("Executive intervention tier — leadership attention required.")
  }
  if (lead.operationalCapacityTier === "constrained" || lead.operationalCapacityTier === "critical") {
    riskWarnings.push(`Capacity ${lead.operationalCapacityTier} — protect close motion pacing.`)
  }
  if ((lead.intelligenceConflictSeverityScore ?? 0) >= 40) {
    riskWarnings.push("Intelligence conflicts detected across caches.")
  }
  if (lead.revenueTrajectory === "at_risk" || lead.revenueTrajectory === "slowing") {
    riskWarnings.push("Revenue trajectory slowing or at risk.")
  }
  if (lead.decisionMakerStatus !== "confirmed" && lead.decisionMakerStatus !== "verified_contactable") {
    riskWarnings.push("Decision maker not confirmed.")
  }

  const whyNow =
    memory.relationshipSummary?.trim() ||
    lead.nextBestActionReason?.trim() ||
    lead.executiveRecommendation?.trim() ||
    `NBA: ${lead.nextBestAction ?? "call_now"} with ${lead.engagementTier ?? "unknown"} engagement.`

  const openingLine = lead.contactName
    ? `Hi ${lead.contactName.split(" ")[0]} — calling from Equipify about ${lead.companyName}.`
    : `Hi — calling about ${lead.companyName}.`

  let canonicalCallGuide: string | null = null
  let canonicalCallGuideSource: string | null = null
  const organizationId = getGrowthEngineAiOrgId()
  if (organizationId) {
    const materialized = await resolveCanonicalChannelContentForLead(admin, {
      organizationId,
      leadId: lead.id,
      channel: "call",
    })
    if (materialized?.transportReady && materialized.body.trim()) {
      canonicalCallGuide = materialized.body
      canonicalCallGuideSource = materialized.sourcePackageId
        ? `package:${materialized.sourcePackageId}`
        : "canonical_brief"
    }
  }

  const resolvedOpeningLine = canonicalCallGuide
    ? (canonicalCallGuide.match(/Opening:\s*"([^"]+)"/)?.[1]?.trim() ??
      canonicalCallGuide.split("\n")[0]?.replace(/^Opening:\s*/i, "").replace(/^"|"$/g, "").trim() ??
      openingLine)
    : openingLine

  const recommendedCta =
    lead.nextBestAction === "call_now" || lead.nextBestAction === "call_immediately"
      ? "Confirm a short follow-up or demo slot before ending the call."
      : "Agree on one concrete next step with a date."

  const influenceScore = computePlaybookInfluenceScore(playbookRules)
  const attribution = buildPlaybookAttribution({ rules: playbookRules, conflicts: [] })

  const briefing: GrowthCallCopilotBriefing = {
    whoToCall: {
      contactName: lead.contactName,
      companyName: lead.companyName,
      phone: lead.contactPhone,
      decisionMakers: decisionMakers.slice(0, 4).map((dm) => ({
        name: dm.fullName,
        title: dm.title,
        status: dm.status,
      })),
    },
    whyNow,
    likelyObjections,
    openingLine: resolvedOpeningLine,
    canonicalCallGuide,
    canonicalCallGuideSource,
    channelsParityMarker: GROWTH_AIOS_CHANNELS_1A_QA_MARKER,
    recommendedCta,
    doNotSay,
    riskWarnings,
    highRiskCall: isHighRiskCall(lead, riskWarnings),
    playbookInfluence:
      playbookRules.length > 0
        ? { score: influenceScore, ruleTitles: attribution.ruleTitles }
        : undefined,
    relationshipMemory: {
      available: memory.available,
      relationshipStage: memory.relationshipStage,
      relationshipSummary: memory.relationshipSummary,
      topObjections: memory.topObjections,
      topPreferences: memory.topPreferences,
      priorInteractions: memory.priorInteractionSummaries,
      commitments: memory.commitmentSummaries,
      riskFlags: memory.riskFlags,
    },
  }

  void inputSnapshot
  return briefing
}
