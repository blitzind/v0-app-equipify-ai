import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"
import type { MeetingOutcomeIntelligenceScorePublicView } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"

export async function emitMeetingOutcomeIntelligenceNotifications(
  admin: SupabaseClient,
  input: { score: MeetingOutcomeIntelligenceScorePublicView; companyName: string },
): Promise<void> {
  const { score, companyName } = input
  const actionUrl = `/admin/growth/leads?open=${score.leadId}&focus=meetings&highlight=${score.meetingId}`

  if (score.followUpRecommendation === "needs_follow_up" || score.followUpRecommendation === "risk_of_stall") {
    await emitGrowthNotification(admin, {
      leadId: score.leadId,
      ownerUserId: score.ownerUserId,
      notificationType: "meeting_follow_up_recommended",
      title: "Meeting follow-up recommended",
      body: `${companyName}: ${score.recommendedNextStep}`,
      sourceSystem: "intelligence",
      sourceId: score.id,
      actionUrl,
      metadata: { meetingId: score.meetingId, recommendation: score.followUpRecommendation },
    })
  }

  if (score.momentumTrend === "at_risk" || score.followUpRecommendation === "executive_escalation_recommended") {
    await emitGrowthNotification(admin, {
      leadId: score.leadId,
      ownerUserId: score.ownerUserId,
      notificationType: "meeting_at_risk",
      title: "Meeting at risk",
      body: `${companyName}: outcome score ${score.meetingOutcomeScore}/100 — operator review recommended.`,
      sourceSystem: "intelligence",
      sourceId: score.id,
      actionUrl,
      metadata: { meetingId: score.meetingId },
    })
  }

  if (score.meetingQualityScore >= 70 || score.followUpRecommendation === "strong_opportunity") {
    await emitGrowthNotification(admin, {
      leadId: score.leadId,
      ownerUserId: score.ownerUserId,
      notificationType: "meeting_high_quality",
      title: "High-quality meeting",
      body: `${companyName}: quality ${score.meetingQualityScore}/100 — capitalize with operator follow-up.`,
      sourceSystem: "intelligence",
      sourceId: score.id,
      actionUrl,
      metadata: { meetingId: score.meetingId },
    })
  }

  if (score.followUpRecommendation === "risk_of_stall") {
    await emitGrowthNotification(admin, {
      leadId: score.leadId,
      ownerUserId: score.ownerUserId,
      notificationType: "meeting_stalled",
      title: "Meeting stalled",
      body: `${companyName}: stall risk detected — operator action recommended.`,
      sourceSystem: "intelligence",
      sourceId: score.id,
      actionUrl,
      metadata: { meetingId: score.meetingId },
    })
  }
}
