import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { assembleMeetingPrepBundle } from "@/lib/growth/meeting-intelligence/meeting-prep-bundle"
import type {
  GrowthMeetingPrepBundle,
  MeetingPrepBuyingStage,
  MeetingPrepLeadScore,
} from "@/lib/growth/meeting-intelligence/meeting-prep-types"
import { fetchGrowthMeetingById } from "@/lib/growth/meeting-intelligence/meeting-repository"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import { loadProspectSearchContactIntelligenceBatch } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-loader"
import {
  extractBuyingStageFromMetadata,
  extractLeadEngineScoreOverlay,
  resolveProspectSearchQualificationFields,
} from "@/lib/growth/prospect-search/prospect-search-qualification-overlays"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function resolveLeadScore(
  leadScore: number | null,
  metadata: Record<string, unknown>,
): MeetingPrepLeadScore {
  const leadEngine = extractLeadEngineScoreOverlay(metadata)
  if (leadEngine?.lead_engine_score != null) {
    return {
      score: leadEngine.lead_engine_score,
      label: leadEngine.lead_engine_score_label,
      explanation: leadEngine.lead_engine_score_explanation,
      source: "lead_engine",
    }
  }
  return {
    score: leadScore,
    label: leadScore != null && leadScore >= 70 ? "Strong" : leadScore != null && leadScore >= 50 ? "Moderate" : null,
    explanation: null,
    source: leadScore != null ? "lead_score" : null,
  }
}

function resolveBuyingStage(
  leadBuyingStage: string | null,
  metadata: Record<string, unknown>,
): MeetingPrepBuyingStage {
  const qualified = resolveProspectSearchQualificationFields(
    { lead_score: null, buying_stage: leadBuyingStage },
    { metadata },
  )
  const fromMeta = extractBuyingStageFromMetadata(metadata)
  const stage = qualified.buying_stage ?? fromMeta?.buying_stage ?? leadBuyingStage
  const confidence = qualified.buying_stage_confidence ?? fromMeta?.buying_stage_confidence ?? null
  const reason = qualified.buying_stage_reason ?? fromMeta?.buying_stage_reason ?? null
  return { stage, confidence, reason }
}

export async function gatherMeetingPrepBundle(
  admin: SupabaseClient,
  meetingId: string,
): Promise<GrowthMeetingPrepBundle | null> {
  const meeting = await fetchGrowthMeetingById(admin, meetingId)
  if (!meeting) return null
  return gatherMeetingPrepBundleForMeeting(admin, meeting)
}

export async function gatherMeetingPrepBundleForMeeting(
  admin: SupabaseClient,
  meeting: GrowthMeeting,
): Promise<GrowthMeetingPrepBundle | null> {
  const lead = await fetchGrowthLeadById(admin, meeting.leadId)
  if (!lead) return null

  const metadata = metaRecord(lead.metadata)

  const [decisionMakers, research, contactIntelMap] = await Promise.all([
    listGrowthLeadDecisionMakers(admin, lead.id),
    fetchLatestCompletedProspectResearchRun(admin, lead.id),
    loadProspectSearchContactIntelligenceBatch(admin, [
      {
        id: lead.id,
        source_type: "growth_lead",
        growth_lead_id: lead.id,
        company_name: lead.companyName,
      },
    ]),
  ])

  const contactIntelligence = contactIntelMap.get(`growth_lead:${lead.id}`) ?? null

  return assembleMeetingPrepBundle({
    meeting,
    lead,
    leadScore: resolveLeadScore(lead.score, metadata),
    buyingStage: resolveBuyingStage(null, metadata),
    decisionMakers,
    contactIntelligence,
    research,
  })
}
