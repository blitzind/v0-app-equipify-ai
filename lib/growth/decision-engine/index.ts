/** GE-AIOS-10B — Ava Decision Intelligence Engine (canonical export). */

export {
  GROWTH_DECISION_ENGINE_QA_MARKER,
  type DecisionActionKind,
  type DecisionCandidate,
  type DecisionCandidateSource,
  type DecisionContext,
  type DecisionEngineResult,
  type DecisionExplainReason,
  type DecisionScoreBreakdown,
  type NextBestAction,
} from "@/lib/growth/decision-engine/types"

export {
  buildDecisionContext,
  flattenDecisionCandidates,
  type BuildDecisionContextInput,
} from "@/lib/growth/decision-engine/context/build-decision-context"

export { scoreRevenueImpact } from "@/lib/growth/decision-engine/scoring/revenue-impact"
export { scoreUrgency } from "@/lib/growth/decision-engine/scoring/urgency-score"
export { scoreConfidence } from "@/lib/growth/decision-engine/scoring/confidence-score"
export { scoreDependencies } from "@/lib/growth/decision-engine/scoring/dependency-score"
export { scoreApprovalGate } from "@/lib/growth/decision-engine/scoring/approval-score"
export {
  scoreEffort,
  scoreCustomerImpact,
  scoreBusinessUnderstanding,
} from "@/lib/growth/decision-engine/scoring/effort-score"

export { rankNextActions, scoreDecisionCandidate } from "@/lib/growth/decision-engine/ranking/rank-next-actions"

export {
  buildNextBestActionReasons,
  buildNextBestActions,
  selectTopOperatorAction,
} from "@/lib/growth/decision-engine/recommendations/build-next-best-actions"

export {
  runDecisionEngine,
  type RunDecisionEngineInput,
} from "@/lib/growth/decision-engine/engine/run-decision-engine"

export { mapDecisionActionsToStoryPriority } from "@/lib/growth/decision-engine/narrative/decision-narrative-bridge"

export { buildPrimaryDecisionFromDecisionEngine } from "@/lib/growth/decision-engine/home/build-primary-decision"
