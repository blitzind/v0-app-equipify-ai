/** Maps live voice workspace snapshots to context input — UX only. */

import type { VoiceWorkspaceContextInput } from "@/lib/voice/workspace-context/types"
import type { UnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/types"
import type { VoiceAiCopilotWorkspaceSnapshot } from "@/lib/voice/ai-copilot/types"
import type { VoiceAiReceptionistWorkspaceSnapshot } from "@/lib/voice/ai-receptionist/types"
import type { VoiceMissedCallRecoveryWorkspaceSnapshot } from "@/lib/voice/missed-call-recovery/types"
import type { GrowthCallWorkspacePhase } from "@/components/growth/growth-call-workspace-center-panel"

export function buildWorkspaceContextInputFromVoiceSnapshot(input: {
  callPhase: GrowthCallWorkspacePhase
  startingCall?: boolean
  leadLinked?: boolean
  operatorAssist?: UnifiedOperatorAssistSnapshot | null
  aiCopilot?: VoiceAiCopilotWorkspaceSnapshot | null
  aiReceptionist?: VoiceAiReceptionistWorkspaceSnapshot | null
  missedCallRecovery?: VoiceMissedCallRecoveryWorkspaceSnapshot | null
  hasActiveTransfer?: boolean
  relationshipSummary?: string | null
  preferredChannel?: string | null
  workflowStatusLabel?: string | null
}): VoiceWorkspaceContextInput {
  const operatorAssist = input.operatorAssist
  const aiReceptionist = input.aiReceptionist
  const missedCallRecovery = input.missedCallRecovery
  const aiCopilot = input.aiCopilot

  const escalationFeedCount =
    operatorAssist?.feed.filter(
      (event) =>
        event.lifecycleStatus === "escalated" ||
        event.severity === "critical" ||
        event.category === "risk",
    ).length ?? 0

  const hasAiReceptionistHandoff = Boolean(
    aiReceptionist?.session &&
      (aiReceptionist.session.receptionistStatus === "transfer_pending" ||
        aiReceptionist.session.receptionistStatus === "escalated" ||
        aiReceptionist.operatorTakeoverAvailable),
  )

  const hasMissedCallRecovery = Boolean(
    missedCallRecovery?.activeRecoveries.some((item) => item.recoveryStatus === "active") ||
      missedCallRecovery?.callbackTasks.some(
        (task) => task.status === "recommended" || task.status === "assigned",
      ),
  )

  const hasOutboundAiSupervision = Boolean(
    aiCopilot?.activeSuggestions.some(
      (suggestion) =>
        suggestion.suggestionType === "escalation_recommendation" ||
        suggestion.suggestionType === "operator_pacing_alert" ||
        suggestion.suggestionType === "operator_interrupt_alert",
    ),
  )

  const hasComplianceHold = Boolean(
    aiCopilot?.activeSuggestions.some(
      (suggestion) =>
        suggestion.suggestionType === "compliance_reminder" ||
        suggestion.suggestionType === "compliance_recovery_prompt",
    ),
  )

  const unresolvedIssueCount =
    (missedCallRecovery?.activeRecoveries.filter((item) => item.recoveryStatus === "active").length ?? 0) +
    (operatorAssist?.feed.filter((event) => event.lifecycleStatus === "active" && event.category === "risk")
      .length ?? 0)

  const escalationLevel =
    escalationFeedCount > 0 || input.hasActiveTransfer
      ? Math.min(3, escalationFeedCount + (input.hasActiveTransfer ? 1 : 0))
      : 0

  return {
    callPhase: input.callPhase,
    startingCall: input.startingCall,
    operatorAssistEscalationCount: escalationFeedCount,
    hasAiReceptionistHandoff,
    hasMissedCallRecovery,
    hasOutboundAiSupervision,
    hasComplianceHold,
    unresolvedIssueCount,
    escalationLevel,
    preferredChannel: input.preferredChannel ?? null,
    workflowStatusLabel: input.workflowStatusLabel ?? null,
    nextRecommendedAction:
      operatorAssist?.nextBestAction.primary?.prompt ??
      missedCallRecovery?.activeRecoveries[0]?.recommendedAction ??
      aiReceptionist?.session?.handoffSummaryDraft ??
      null,
    relationshipSummary: input.relationshipSummary ?? null,
    leadLinked: input.leadLinked,
  }
}
