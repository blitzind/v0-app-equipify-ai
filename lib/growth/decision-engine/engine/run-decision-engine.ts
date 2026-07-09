/** GE-AIOS-10B — Canonical decision engine orchestrator (deterministic, no execution). */

import {
  buildDecisionContext,
  flattenDecisionCandidates,
  type BuildDecisionContextInput,
} from "@/lib/growth/decision-engine/context/build-decision-context"
import { rankNextActions } from "@/lib/growth/decision-engine/ranking/rank-next-actions"
import {
  buildNextBestActions,
  selectTopOperatorAction,
} from "@/lib/growth/decision-engine/recommendations/build-next-best-actions"
import {
  GROWTH_DECISION_ENGINE_QA_MARKER,
  type DecisionEngineResult,
} from "@/lib/growth/decision-engine/types"

export type RunDecisionEngineInput = BuildDecisionContextInput

export function runDecisionEngine(input: RunDecisionEngineInput): DecisionEngineResult {
  const context = buildDecisionContext(input)
  const candidates = flattenDecisionCandidates(context)
  const ranked = rankNextActions(candidates, context)
  const next_best_actions = buildNextBestActions(candidates, context, ranked)
  const top_action = selectTopOperatorAction(next_best_actions)

  return {
    qaMarker: GROWTH_DECISION_ENGINE_QA_MARKER,
    context,
    next_best_actions,
    top_action,
  }
}

export { buildDecisionContext, flattenDecisionCandidates, type BuildDecisionContextInput }
