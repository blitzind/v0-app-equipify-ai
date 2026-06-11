/** Opportunity Approval Engine route gates — client-safe. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import { isApolloScale2ProductionRuntime } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"
import {
  OPPORTUNITY_APPROVAL_ENGINE_MIGRATION,
  OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-engine-types"
import { OPPORTUNITY_APPROVAL_SAFETY_FLAGS } from "@/lib/growth/meeting-intelligence/opportunity-approval-evidence"
import { buildOpportunityDraftEngineReadinessPayload } from "@/lib/growth/meeting-intelligence/opportunity-draft-route-gates"

export const OPPORTUNITY_APPROVAL_ENGINE_ROUTE_QA_MARKER =
  "opportunity-approval-engine-route-m1e-v1" as const

export const OPPORTUNITY_APPROVAL_ENGINE_EXECUTE_CONFIRM = "RUN_OPPORTUNITY_APPROVAL_ENGINE" as const

export const OPPORTUNITY_APPROVAL_ENGINE_CERTIFICATION_EXECUTE_CONFIRM =
  "RUN_OPPORTUNITY_APPROVAL_ENGINE_CERTIFICATION" as const

export function isOpportunityApprovalEngineEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_OPPORTUNITY_APPROVAL_ENGINE_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function assertOpportunityApprovalEngineExecuteAllowed(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean
  blockers: string[]
  error: string | null
} {
  const blockers: string[] = []
  const draftGates = buildOpportunityDraftEngineReadinessPayload({ env })

  if (!isOpportunityApprovalEngineEnabled(env)) {
    blockers.push("GROWTH_OPPORTUNITY_APPROVAL_ENGINE_ENABLED must be true")
  }
  if (env.GROWTH_OPPORTUNITY_APPROVAL_ENGINE_ACK !== "1") {
    blockers.push("GROWTH_OPPORTUNITY_APPROVAL_ENGINE_ACK must be 1")
  }
  if (!draftGates.gates_ok) {
    blockers.push(...draftGates.blockers)
  }

  return {
    ok: blockers.length === 0,
    blockers,
    error: blockers[0] ?? null,
  }
}

export function validateOpportunityApprovalEngineConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  draft_id: string | null
  certification_mode: boolean
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must include confirm: "${OPPORTUNITY_APPROVAL_ENGINE_EXECUTE_CONFIRM}".`,
      draft_id: null,
      certification_mode: false,
    }
  }

  const record = body as Record<string, unknown>
  const confirm = typeof record.confirm === "string" ? record.confirm.trim() : ""
  const draftId =
    typeof record.draftId === "string"
      ? record.draftId.trim()
      : typeof record.draft_id === "string"
        ? record.draft_id.trim()
        : ""

  const certification_mode = confirm === OPPORTUNITY_APPROVAL_ENGINE_CERTIFICATION_EXECUTE_CONFIRM
  const execute_mode = confirm === OPPORTUNITY_APPROVAL_ENGINE_EXECUTE_CONFIRM

  if (!certification_mode && !execute_mode) {
    return {
      ok: false,
      error: `confirm must be "${OPPORTUNITY_APPROVAL_ENGINE_EXECUTE_CONFIRM}" or "${OPPORTUNITY_APPROVAL_ENGINE_CERTIFICATION_EXECUTE_CONFIRM}".`,
      draft_id: null,
      certification_mode: false,
    }
  }

  if (!draftId) {
    return {
      ok: false,
      error: "draftId is required.",
      draft_id: null,
      certification_mode,
    }
  }

  return {
    ok: true,
    error: null,
    draft_id: draftId,
    certification_mode,
  }
}

export function buildOpportunityApprovalEngineReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  draft_id?: string | null
}) {
  const env = input?.env ?? process.env
  const gates = assertOpportunityApprovalEngineExecuteAllowed(env)
  const draftReadiness = buildOpportunityDraftEngineReadinessPayload({ env })

  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: OPPORTUNITY_APPROVAL_ENGINE_ROUTE_QA_MARKER,
    automation_qa_marker: OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER,
    migration: OPPORTUNITY_APPROVAL_ENGINE_MIGRATION,
    gates_ok: gates.ok,
    blockers: gates.blockers,
    production_runtime: isApolloScale2ProductionRuntime(env),
    draft_id: input?.draft_id ?? null,
    execute_confirm: OPPORTUNITY_APPROVAL_ENGINE_EXECUTE_CONFIRM,
    certification_confirm: OPPORTUNITY_APPROVAL_ENGINE_CERTIFICATION_EXECUTE_CONFIRM,
    safety: OPPORTUNITY_APPROVAL_SAFETY_FLAGS,
    funnel_stage: "Opportunity Approval Ready",
    pipeline_position: "Opportunity Draft → Human Confirm Create → Growth Opportunity",
    opportunity_draft_readiness: draftReadiness,
  })
}

export function redactOpportunityApprovalEngineSecrets<T extends Record<string, unknown>>(payload: T): T {
  return redactApolloEnrichmentCertProductionSecrets(payload)
}
