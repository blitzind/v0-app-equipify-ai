/** GE-AIOS-3C — Executive Decision Preparation types (client-safe). */

export const GROWTH_AIOS_3C_PHASE = "GE-AIOS-3C" as const

export const GROWTH_AI_EXECUTIVE_DECISION_PREPARATION_QA_MARKER =
  "growth-aios-3c-executive-decision-preparation-v1" as const

export type AiExecutiveDecisionPreparationInput = {
  organizationId: string
  executiveRuntimeId: string
  missionId: string
  workOrderId: string
  enableAiEvidence?: boolean
  decisionKey?: string
  source?: string
}

export type AiExecutiveDecisionPreparationResult =
  | {
      prepared: true
      decisionRecordId: string
      decisionKey: string
      requestStatus: string
      aiEnrichmentUsed: boolean
    }
  | {
      prepared: false
      failureReason: string
    }

/** Executive prepares Decision Records before agents claim — it never executes or claims Work Orders. */
export const AI_EXECUTIVE_DECISION_PREPARATION_RUNTIME_RULE =
  "Executive Decision Preparation invokes the Decision Engine to attach Decision Records before Agent Runtime claims — it does not transition to executing, send outbound, or claim Work Orders." as const
