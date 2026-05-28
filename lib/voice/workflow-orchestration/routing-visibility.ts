/** Routing visibility — Phase 5C. Recommendations only, no auto-reassignment. */

import type { VoiceWorkflowRoutingRecommendation } from "@/lib/voice/workflow-orchestration/types"

export type RoutingVisibilityInput = {
  orchestrationType: string
  escalationLevel: number
  complianceSensitive: boolean
  afterHours: boolean
  operatorCandidates: Array<{ operatorId: string; label: string; activeWorkflowCount: number; isAvailable: boolean }>
  relationshipOwnerId?: string | null
}

export function buildRoutingRecommendations(input: RoutingVisibilityInput): VoiceWorkflowRoutingRecommendation[] {
  const recommendations: VoiceWorkflowRoutingRecommendation[] = []

  if (input.relationshipOwnerId) {
    const owner = input.operatorCandidates.find((c) => c.operatorId === input.relationshipOwnerId)
    if (owner) {
      recommendations.push({
        operatorId: owner.operatorId,
        operatorLabel: owner.label,
        reason: "Relationship owner preference — recommendation only.",
        confidence: "high",
        autoAssignmentDisabled: true,
      })
    }
  }

  if (input.escalationLevel >= 2) {
    const specialist = input.operatorCandidates.find((c) => c.isAvailable && c.activeWorkflowCount <= 3)
    if (specialist) {
      recommendations.push({
        operatorId: specialist.operatorId,
        operatorLabel: specialist.label,
        reason: "Escalation specialist routing — low active workflow load.",
        confidence: "medium",
        autoAssignmentDisabled: true,
      })
    }
  }

  if (input.complianceSensitive) {
    recommendations.push({
      operatorId: null,
      operatorLabel: "Compliance-reviewed operator",
      reason: "Compliance-sensitive workflow — assign trained operator manually.",
      confidence: "high",
      autoAssignmentDisabled: true,
    })
  }

  if (input.afterHours) {
    recommendations.push({
      operatorId: null,
      operatorLabel: "After-hours on-call",
      reason: "After-hours routing visibility — overflow to on-call operator.",
      confidence: "medium",
      autoAssignmentDisabled: true,
    })
  }

  const available = input.operatorCandidates
    .filter((c) => c.isAvailable)
    .sort((a, b) => a.activeWorkflowCount - b.activeWorkflowCount)

  for (const candidate of available.slice(0, 3)) {
    if (recommendations.some((r) => r.operatorId === candidate.operatorId)) continue
    recommendations.push({
      operatorId: candidate.operatorId,
      operatorLabel: candidate.label,
      reason: `Workload balancing — ${candidate.activeWorkflowCount} active workflows.`,
      confidence: candidate.activeWorkflowCount <= 2 ? "high" : "low",
      autoAssignmentDisabled: true,
    })
  }

  if (recommendations.length === 0) {
    recommendations.push({
      operatorId: null,
      operatorLabel: "Next available operator",
      reason: "No operator candidates loaded — manual assignment required.",
      confidence: "low",
      autoAssignmentDisabled: true,
    })
  }

  return recommendations.slice(0, 5)
}
