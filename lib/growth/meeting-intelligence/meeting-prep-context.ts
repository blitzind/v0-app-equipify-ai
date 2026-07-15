import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthMeetingById } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { assembleMeetingPrepBundle } from "@/lib/growth/meeting-intelligence/meeting-prep-bundle"
import { resolveGrowthCanonicalMeetingBriefForMeeting } from "@/lib/growth/meeting-intelligence/growth-canonical-meeting-brief-service"
import { loadMeetingPrepAccountPlaybookContext } from "@/lib/growth/meeting-intelligence/meeting-prep-account-playbook-loader"
import type {
  GrowthMeetingPrepBundle,
  MeetingPrepBuyingStage,
  MeetingPrepLeadScore,
} from "@/lib/growth/meeting-intelligence/meeting-prep-types"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import { loadProspectSearchContactIntelligenceBatch } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-loader"
import {
  extractBuyingStageFromMetadata,
  extractLeadEngineScoreOverlay,
  resolveProspectSearchQualificationFields,
} from "@/lib/growth/prospect-search/prospect-search-qualification-overlays"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import { resolveCanonicalHumanMemoryForLead } from "@/lib/growth/lead-memory/resolve-canonical-human-memory-for-lead"
import { resolveGrowthCanonicalDecisionForLeadCached } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import {
  createGrowthAiOsRuntimeContext,
  type GrowthAiOsRuntimeContext,
} from "@/lib/growth/aios/runtime/growth-aios-runtime-context-1a"
import { projectGrowthCanonicalOperatorDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import { buildCanonicalMission } from "@/lib/growth/aios/missions/growth-canonical-mission-1a"
import { resolveGrowthEngineWorkspaceOrganizationId } from "@/lib/growth/growth-engine-workspace-organization"

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
  options?: { runtimeContext?: GrowthAiOsRuntimeContext },
): Promise<GrowthMeetingPrepBundle | null> {
  const lead = await fetchGrowthLeadById(admin, meeting.leadId)
  if (!lead) return null

  const metadata = metaRecord(lead.metadata)
  const workspaceOrg = resolveGrowthEngineWorkspaceOrganizationId()
  const organizationId = workspaceOrg?.organizationId ?? null

  const runtimeContext =
    options?.runtimeContext ??
    (organizationId
      ? createGrowthAiOsRuntimeContext(admin, {
          organizationId,
          leadId: lead.id,
          boundary: "meeting_load",
          cacheScope: "operator-surface",
          companyName: lead.companyName,
        })
      : null)

  const [decisionMakers, research, contactIntelMap, memoryBundle] = await Promise.all([
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
    runtimeContext
      ? runtimeContext.getMemory()
      : organizationId
        ? resolveCanonicalHumanMemoryForLead(admin, {
            organizationId,
            leadId: lead.id,
            companyName: lead.companyName,
          }).catch(() => null)
        : Promise.resolve(null),
  ])

  const memory = memoryBundle?.influence ?? null

  const contactIntelligence = contactIntelMap.get(`growth_lead:${lead.id}`) ?? null
  const accountPlaybookContext = await loadMeetingPrepAccountPlaybookContext(admin, meeting)

  const canonicalDecision = runtimeContext
    ? await runtimeContext.getDecision()
    : organizationId
      ? await resolveGrowthCanonicalDecisionForLeadCached(admin, {
          organizationId,
          leadId: lead.id,
          cacheScope: "operator-surface",
        }).catch(() => null)
      : null

  const bundle = assembleMeetingPrepBundle({
    meeting,
    lead,
    leadScore: resolveLeadScore(lead.score, metadata),
    buyingStage: resolveBuyingStage(null, metadata),
    decisionMakers,
    contactIntelligence,
    research,
    accountPlaybookContext,
    videoEngagementContext: readGrowthVideoMeetingPrepFromLeadMetadata(metadata),
    relationshipMemory: memory?.available
      ? {
          summary: memory.relationshipSummary,
          topObjections: memory.topObjections,
          priorInteractions: memory.priorInteractionSummaries,
          commitments: memory.commitmentSummaries,
          riskFlags: memory.riskFlags,
          preferences: memory.topPreferences,
        }
      : undefined,
  })

  if (!bundle) return null

  const canonicalProjection = canonicalDecision
    ? projectGrowthCanonicalOperatorDecision({
        decision: canonicalDecision.decision,
        freshness: canonicalDecision.freshness,
      })
    : null

  const enrichedBundle = {
    ...bundle,
    canonicalDecision,
    canonicalRecommendedNextAction: canonicalProjection?.whatToDo ?? bundle.researchSummary.recommendedNextAction,
  }

  const canonicalMeetingBrief = organizationId
    ? await resolveGrowthCanonicalMeetingBriefForMeeting(admin, {
        organizationId,
        meeting,
        prepBundle: enrichedBundle,
      }).catch(() => null)
    : null

  const canonicalMission =
    organizationId && canonicalDecision
      ? buildCanonicalMission({
          organizationId,
          leadId: lead.id,
          companyName: lead.companyName,
          contactName: lead.contactName,
          decisionResolution: canonicalDecision,
          relationshipSummary: memory?.relationshipSummary ?? null,
          conversationSummary: canonicalProjection?.whatToDo ?? null,
          openCommitments: memory?.commitmentSummaries ?? [],
          upcomingMeeting: {
            at: meeting.scheduledAt,
            objective: meeting.title ?? null,
          },
        })
      : null

  return {
    ...enrichedBundle,
    canonicalMeetingBrief,
    canonicalMission,
  }
}
