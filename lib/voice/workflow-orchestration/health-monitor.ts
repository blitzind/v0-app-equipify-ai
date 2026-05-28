/** Workflow health monitoring — Phase 5C. */

import type {
  VoiceWorkflowHealthSummary,
  VoiceWorkflowOrchestrationPublicView,
} from "@/lib/voice/workflow-orchestration/types"
import { VOICE_WORKFLOW_STALE_HOURS } from "@/lib/voice/workflow-orchestration/types"

export function detectStalledWorkflows(
  orchestrations: VoiceWorkflowOrchestrationPublicView[],
  staleHours: number = VOICE_WORKFLOW_STALE_HOURS,
): VoiceWorkflowOrchestrationPublicView[] {
  const cutoff = Date.now() - staleHours * 60 * 60 * 1000
  const activeStatuses = new Set(["pending", "active", "awaiting_operator", "awaiting_customer", "escalated"])

  return orchestrations.filter((o) => {
    if (!activeStatuses.has(o.orchestrationStatus)) return false
    return new Date(o.updatedAt).getTime() < cutoff
  })
}

export function buildWorkflowHealthSummary(
  orchestrations: VoiceWorkflowOrchestrationPublicView[],
): VoiceWorkflowHealthSummary {
  const stalled = detectStalledWorkflows(orchestrations)
  const active = orchestrations.filter((o) =>
    ["pending", "active", "awaiting_operator", "awaiting_customer", "escalated"].includes(o.orchestrationStatus),
  )

  const bottleneckMap = new Map<string, number>()
  const hotspotMap = new Map<string, number>()

  for (const o of active) {
    if (o.orchestrationStatus === "awaiting_operator") {
      bottleneckMap.set("awaiting_operator", (bottleneckMap.get("awaiting_operator") ?? 0) + 1)
    }
    if (o.orchestrationStatus === "compliance_hold") {
      bottleneckMap.set("compliance_hold", (bottleneckMap.get("compliance_hold") ?? 0) + 1)
    }
    if (o.escalationLevel >= 1) {
      hotspotMap.set(o.orchestrationType, (hotspotMap.get(o.orchestrationType) ?? 0) + 1)
    }
  }

  const handoffCount = orchestrations.filter(
    (o) => o.orchestrationType === "ai_receptionist_handoff" || o.orchestrationType === "operator_takeover",
  ).length

  return {
    stalledCount: stalled.length,
    unresolvedEscalationCount: active.filter((o) => o.orchestrationStatus === "escalated").length,
    complianceHoldCount: active.filter((o) => o.orchestrationStatus === "compliance_hold").length,
    longRunningCallbackCount: active.filter((o) => o.orchestrationType === "callback_followup").length,
    abandonedCount: orchestrations.filter((o) => o.orchestrationStatus === "expired").length,
    excessiveHandoffCount: handoffCount >= 5 ? handoffCount : 0,
    unresolvedObjectionCount: active.filter((o) => o.orchestrationType === "unresolved_objection").length,
    overdueFollowUpCount: stalled.filter((o) =>
      ["callback_followup", "scheduling_followup", "outbound_followup"].includes(o.orchestrationType),
    ).length,
    bottleneckTypes: [...bottleneckMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    escalationHotspots: [...hotspotMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
  }
}
