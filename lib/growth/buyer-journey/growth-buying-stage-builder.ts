/** GS-AI-PLAYBOOK-4A — Buying stage builder (client-safe). */

import type {
  GrowthBuyingStage,
  GrowthBuyingStageAssessment,
  GrowthBuyingStageConfidence,
} from "@/lib/growth/buyer-journey/growth-buying-stage-types"
import type { GrowthBuyingStageSignalInput } from "@/lib/growth/buyer-journey/growth-buying-stage-signals"

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function resolveConfidence(score: number): GrowthBuyingStageConfidence {
  if (score >= 75) return "high"
  if (score >= 55) return "medium"
  return "low"
}

const OPPORTUNITY_STAGE_MAP: Record<string, GrowthBuyingStage> = {
  new_opportunity: "solution_aware",
  discovery: "problem_aware",
  qualified: "evaluating",
  proposal: "proposal",
  negotiation: "decision",
  verbal_commit: "decision",
  closed_won: "customer",
  closed_lost: "dormant",
}

export function buildGrowthBuyingStageAssessment(
  signals: GrowthBuyingStageSignalInput,
): GrowthBuyingStageAssessment {
  const detectedSignals: string[] = []
  const blockers: string[] = []
  const progressionTriggers: string[] = []

  if (signals.isExistingCustomer || signals.relationshipStage === "customer") {
    detectedSignals.push("Existing customer relationship")
    return {
      stage: "customer",
      confidence: "high",
      confidenceScore: 92,
      signals: detectedSignals,
      blockers,
      progressionTriggers: ["Expansion or renewal conversation"],
    }
  }

  if (signals.opportunityStageKey && OPPORTUNITY_STAGE_MAP[signals.opportunityStageKey]) {
    const stage = OPPORTUNITY_STAGE_MAP[signals.opportunityStageKey]!
    detectedSignals.push(`Opportunity stage: ${signals.opportunityStageKey}`)
    if (signals.memoryCommitteeSummaries && signals.memoryCommitteeSummaries.length > 0) {
      return {
        stage: stage === "evaluating" || stage === "proposal" ? "buying_committee" : stage,
        confidence: "high",
        confidenceScore: 84,
        signals: [...detectedSignals, "Buying committee signals present"],
        blockers: signals.memoryUnresolvedObjectionCount > 0 ? ["Unresolved objections"] : [],
        progressionTriggers: ["Confirm decision process and next stakeholder step"],
      }
    }
    return {
      stage,
      confidence: "high",
      confidenceScore: 80,
      signals: detectedSignals,
      blockers: signals.objectionSummaries?.length ? ["Active objections noted"] : blockers,
      progressionTriggers:
        stage === "proposal"
          ? ["Confirm implementation timeline"]
          : stage === "decision"
            ? ["Remove remaining friction"]
            : ["Advance to next pipeline stage"],
    }
  }

  const daysIdle = signals.daysSinceLastTouch ?? null
  const isDormant =
    (daysIdle != null && daysIdle >= 30 && (signals.priorTouchCount ?? 0) > 0) ||
    signals.relationshipStage === "inactive" ||
    signals.engagementTier === "cold"

  if (isDormant) {
    detectedSignals.push("Extended inactivity or cold engagement")
    return {
      stage: "dormant",
      confidence: daysIdle != null && daysIdle >= 45 ? "high" : "medium",
      confidenceScore: clampScore(60 + Math.min(25, (daysIdle ?? 30) / 2)),
      signals: detectedSignals,
      blockers: ["Low recent engagement"],
      progressionTriggers: ["Provide fresh value before asking for time"],
    }
  }

  if ((signals.priorMeetingCount ?? 0) > 0 || signals.relationshipStage === "evaluating") {
    detectedSignals.push("Evaluation activity detected")
    if (signals.memoryCommitteeSummaries && signals.memoryCommitteeSummaries.length > 0) {
      return {
        stage: "buying_committee",
        confidence: "medium",
        confidenceScore: 72,
        signals: [...detectedSignals, "Multiple stakeholders referenced"],
        blockers: blockers,
        progressionTriggers: ["Align messaging to committee concerns"],
      }
    }
    return {
      stage: "evaluating",
      confidence: "medium",
      confidenceScore: 70,
      signals: detectedSignals,
      blockers: signals.memoryUnresolvedObjectionCount > 0 ? ["Objections need resolution"] : blockers,
      progressionTriggers: ["Compare approaches and differentiation"],
    }
  }

  if (
    ((signals.researchPainPoints?.length ?? 0) > 0 ||
      signals.relationshipStage === "aware" ||
      /\b(pain|challenge|struggle|issue)\b/i.test((signals.buyingIntent ?? "") + (signals.researchPainPoints ?? []).join(" "))) &&
    (signals.priorReplyCount ?? 0) === 0 &&
    (signals.priorMeetingCount ?? 0) === 0
  ) {
    detectedSignals.push("Problem signals without evaluation activity")
    return {
      stage: "problem_aware",
      confidence: "medium",
      confidenceScore: 58,
      signals: detectedSignals,
      blockers: [],
      progressionTriggers: ["Diagnose workflow pain with discovery questions"],
    }
  }

  if (
    (signals.priorReplyCount ?? 0) > 0 ||
    (signals.emailOpens ?? 0) >= 2 ||
    signals.relationshipStage === "engaged" ||
    signals.engagementTier === "warm" ||
    signals.engagementTier === "engaged"
  ) {
    detectedSignals.push("Engagement without formal evaluation yet")
    return {
      stage: "solution_aware",
      confidence: "medium",
      confidenceScore: 64,
      signals: detectedSignals,
      blockers: [],
      progressionTriggers: ["Share proof and workflow relevance"],
    }
  }


  detectedSignals.push("No meaningful prior engagement detected")
  return {
    stage: "unaware",
    confidence: (signals.priorTouchCount ?? 0) === 0 ? "high" : "medium",
    confidenceScore: (signals.priorTouchCount ?? 0) === 0 ? 78 : 52,
    signals: detectedSignals,
    blockers: ["Limited relationship context"],
    progressionTriggers: ["Educate and ask thoughtful questions"],
  }
}
