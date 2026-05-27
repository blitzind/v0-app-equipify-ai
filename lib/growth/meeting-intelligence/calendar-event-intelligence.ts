/** Deterministic calendar event intelligence (Sprint 3.2). Client-safe. */

import {
  GROWTH_CALENDAR_INTELLIGENCE_QA_MARKER,
  type CalendarFollowUpRisk,
  type CalendarFollowUpRiskPriority,
  type CalendarRiskLevel,
  type CalendarSuggestedNextAction,
  type GrowthCalendarEventIntelligence,
} from "@/lib/growth/meeting-intelligence/calendar-event-intelligence-types"
import type { GrowthMeetingPrepBundle, MeetingPrepRiskPriority } from "@/lib/growth/meeting-intelligence/meeting-prep-types"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"

function riskPriorityWeight(priority: CalendarFollowUpRiskPriority | MeetingPrepRiskPriority): number {
  switch (priority) {
    case "Critical":
      return 4
    case "High":
      return 3
    case "Medium":
      return 2
    default:
      return 1
  }
}

export function rankCalendarFollowUpRisks(risks: CalendarFollowUpRisk[]): CalendarFollowUpRisk[] {
  return [...risks].sort((a, b) => {
    const diff = riskPriorityWeight(b.priority) - riskPriorityWeight(a.priority)
    if (diff !== 0) return diff
    return a.label.localeCompare(b.label)
  })
}

export function buildCalendarFollowUpRisks(input: {
  meeting: GrowthMeeting
  prep: GrowthMeetingPrepBundle
  hasFollowUpMeeting: boolean
}): CalendarFollowUpRisk[] {
  const risks: CalendarFollowUpRisk[] = []
  const { meeting, prep } = input
  const now = Date.now()

  if (meeting.status === "completed") {
    if (!meeting.nextAction?.trim() && !meeting.outcome?.trim()) {
      risks.push({
        id: "completed_without_next_step",
        label: "Completed without next step",
        priority: "Critical",
        reason: "No outcome or next action recorded.",
        source: "meeting_record",
      })
    }

    if (!meeting.followUpDueAt) {
      risks.push({
        id: "no_follow_up_scheduled",
        label: "No follow-up scheduled",
        priority: "High",
        reason: "Completed meeting has no follow-up due date.",
        source: "meeting_record",
      })
    } else if (Date.parse(meeting.followUpDueAt) <= now) {
      risks.push({
        id: "follow_up_overdue",
        label: "Follow-up overdue",
        priority: "Critical",
        reason: `Follow-up was due ${new Date(meeting.followUpDueAt).toLocaleDateString()}.`,
        source: "meeting_record",
      })
    }

    if (!input.hasFollowUpMeeting) {
      risks.push({
        id: "missing_second_meeting",
        label: "Missing second meeting",
        priority: "High",
        reason: "No upcoming meeting scheduled for this lead.",
        source: "meeting_pipeline",
      })
    }
  }

  if (meeting.status === "proposed" || meeting.status === "scheduled") {
    if (prep.readiness.score < 50) {
      risks.push({
        id: "low_meeting_readiness",
        label: "Low meeting readiness",
        priority: prep.readiness.score < 35 ? "High" : "Medium",
        reason: prep.readiness.summary,
        source: "meeting_prep",
      })
    }

    if (!meeting.calendarEventId) {
      risks.push({
        id: "calendar_not_attached",
        label: "Calendar not attached",
        priority: "Medium",
        reason: "Meeting is not linked to a calendar event.",
        source: "calendar_sync",
      })
    }
  }

  if (prep.decisionMakers.length === 0) {
    risks.push({
      id: "no_decision_maker",
      label: "No decision maker",
      priority: "High",
      reason: "No evidence-backed decision makers indexed.",
      source: "decision_makers",
    })
  }

  const committeePct = prep.contactIntelligence?.committee_completeness_pct ?? null
  if (committeePct != null && committeePct < 50) {
    risks.push({
      id: "committee_incomplete",
      label: "Committee incomplete",
      priority: committeePct < 25 ? "Critical" : "High",
      reason: `Committee coverage ${committeePct}%.`,
      source: "contact_intelligence",
    })
  }

  const timelineRisk = prep.openRisks.find((risk) => risk.id === "missing_timeline")
  if (timelineRisk) {
    risks.push({
      id: "timeline_unknown",
      label: "Timeline unknown",
      priority: "Medium",
      reason: timelineRisk.reason,
      source: "buying_stage",
    })
  }

  return rankCalendarFollowUpRisks(risks)
}

export function buildCalendarSuggestedNextAction(input: {
  meeting: GrowthMeeting
  prep: GrowthMeetingPrepBundle
  followUpRisks: CalendarFollowUpRisk[]
}): CalendarSuggestedNextAction | null {
  const { meeting, prep, followUpRisks } = input

  if (meeting.nextAction?.trim()) {
    return {
      action: meeting.nextAction.trim(),
      reasons: ["Recorded on meeting"],
      evidence: [meeting.outcome?.trim() ? `Outcome: ${meeting.outcome.trim()}` : "Existing next action"].filter(
        Boolean,
      ) as string[],
    }
  }

  if (followUpRisks.some((risk) => risk.id === "follow_up_overdue" || risk.id === "no_follow_up_scheduled")) {
    return {
      action: "Schedule next meeting",
      reasons: ["Follow-up gap detected"],
      evidence: followUpRisks
        .filter((risk) => risk.id === "follow_up_overdue" || risk.id === "no_follow_up_scheduled")
        .map((risk) => risk.reason),
    }
  }

  if (followUpRisks.some((risk) => risk.id === "missing_second_meeting")) {
    return {
      action: "Schedule next meeting",
      reasons: ["No upcoming meeting on calendar"],
      evidence: ["Completed meeting without a follow-up booking"],
    }
  }

  if (followUpRisks.some((risk) => risk.id === "committee_incomplete")) {
    return {
      action: "Expand committee",
      reasons: ["Buying committee coverage is incomplete"],
      evidence:
        prep.contactIntelligence?.committee_roles.slice(0, 2).map((role) => role.role) ??
        prep.recommendedObjectives.find((item) => item.objective === "Expand buying committee")?.evidence ??
        [],
    }
  }

  const timelineObjective = prep.recommendedObjectives.find(
    (item) => item.objective === "Confirm timeline" || item.objective.toLowerCase().includes("timeline"),
  )
  if (followUpRisks.some((risk) => risk.id === "timeline_unknown") || timelineObjective) {
    return {
      action: "Validate timeline",
      reasons: timelineObjective?.reasons ?? ["Buying stage lacks timeline confidence"],
      evidence: timelineObjective?.evidence ?? [prep.buyingStage.reason ?? prep.buyingStage.stage ?? "Unknown stage"].filter(
        Boolean,
      ) as string[],
    }
  }

  const budgetObjective = prep.recommendedObjectives.find((item) => item.objective === "Validate budget ownership")
  if (budgetObjective) {
    return {
      action: "Validate budget ownership",
      reasons: budgetObjective.reasons,
      evidence: budgetObjective.evidence,
    }
  }

  const stage = (prep.buyingStage.stage ?? "").toLowerCase()
  if (stage.includes("purchase") || stage.includes("active") || stage.includes("evaluation")) {
    return {
      action: "Send proposal",
      reasons: ["Buying stage indicates active evaluation"],
      evidence: [prep.buyingStage.reason ?? prep.buyingStage.stage ?? "Assessed stage"].filter(Boolean) as string[],
    }
  }

  const topObjective = prep.recommendedObjectives[0]
  if (topObjective) {
    return {
      action: topObjective.objective,
      reasons: topObjective.reasons,
      evidence: topObjective.evidence,
    }
  }

  if (meeting.status === "completed" && !meeting.outcome) {
    return {
      action: "Record meeting outcome",
      reasons: ["Outcome missing on completed meeting"],
      evidence: ["Required for follow-up intelligence"],
    }
  }

  return null
}

export function resolveCalendarRiskLevel(input: {
  prep: GrowthMeetingPrepBundle
  followUpRisks: CalendarFollowUpRisk[]
}): CalendarRiskLevel {
  const priorities = [
    ...input.followUpRisks.map((risk) => risk.priority),
    ...input.prep.openRisks.map((risk) => risk.priority),
  ]
  if (priorities.some((priority) => priority === "Critical")) return "critical"
  if (priorities.some((priority) => priority === "High")) return "high"
  if (priorities.some((priority) => priority === "Medium")) return "medium"
  return "low"
}

export function assembleCalendarEventIntelligence(input: {
  meeting: GrowthMeeting
  prep: GrowthMeetingPrepBundle
  hasFollowUpMeeting: boolean
}): GrowthCalendarEventIntelligence {
  const followUpRisks = buildCalendarFollowUpRisks(input)
  const topPrepRisk = input.prep.openRisks[0] ?? null
  const topFollowUpRisk = followUpRisks[0] ?? null
  const topRisk =
    topFollowUpRisk && topPrepRisk
      ? riskPriorityWeight(topFollowUpRisk.priority) >= riskPriorityWeight(topPrepRisk.priority)
        ? topFollowUpRisk.label
        : topPrepRisk.label
      : topFollowUpRisk?.label ?? topPrepRisk?.label ?? null
  const topRiskPriority =
    topFollowUpRisk && topPrepRisk
      ? riskPriorityWeight(topFollowUpRisk.priority) >= riskPriorityWeight(topPrepRisk.priority)
        ? topFollowUpRisk.priority
        : topPrepRisk.priority
      : topFollowUpRisk?.priority ?? topPrepRisk?.priority ?? null

  return {
    qa_marker: GROWTH_CALENDAR_INTELLIGENCE_QA_MARKER,
    meetingId: input.meeting.id,
    leadId: input.meeting.leadId,
    leadScore: input.prep.leadScore.score,
    leadScoreLabel: input.prep.leadScore.label,
    buyingStage: input.prep.buyingStage.stage,
    meetingReadiness: input.prep.readiness.score,
    meetingReadinessLabel: input.prep.readiness.label,
    decisionMakerCount: input.prep.decisionMakers.length,
    committeeCoveragePct: input.prep.contactIntelligence?.committee_completeness_pct ?? null,
    topObjective: input.prep.recommendedObjectives[0]?.objective ?? null,
    topRisk,
    topRiskPriority,
    followUpRisks,
    suggestedNextAction: buildCalendarSuggestedNextAction({
      meeting: input.meeting,
      prep: input.prep,
      followUpRisks,
    }),
    riskLevel: resolveCalendarRiskLevel({ prep: input.prep, followUpRisks }),
    calendarAttached: Boolean(input.meeting.calendarEventId),
    prepAvailable: input.meeting.status === "proposed" || input.meeting.status === "scheduled",
  }
}
