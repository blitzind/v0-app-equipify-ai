/** Opportunity Draft Engine route gates — client-safe. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import { isApolloScale2ProductionRuntime } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"
import {
  OPPORTUNITY_DRAFT_ENGINE_MIGRATION,
  OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import { OPPORTUNITY_DRAFT_SAFETY_FLAGS } from "@/lib/growth/meeting-intelligence/opportunity-draft-evidence"

export const OPPORTUNITY_DRAFT_ENGINE_ROUTE_QA_MARKER =
  "opportunity-draft-engine-route-m1d-v1" as const

export const OPPORTUNITY_DRAFT_ENGINE_EXECUTE_CONFIRM = "RUN_OPPORTUNITY_DRAFT_ENGINE" as const

export const OPPORTUNITY_DRAFT_ENGINE_CERTIFICATION_EXECUTE_CONFIRM =
  "RUN_OPPORTUNITY_DRAFT_ENGINE_CERTIFICATION" as const

export const OPPORTUNITY_DRAFT_ENGINE_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Opportunity Draft Engine (M1-D) — draft queue only (Vercel Production)
await fetch("/api/platform/growth/opportunity-drafts/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("opportunity-draft readiness", payload))

await fetch("/api/platform/growth/opportunity-drafts/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    confirm: "${OPPORTUNITY_DRAFT_ENGINE_EXECUTE_CONFIRM}",
    meetingId: "<completed-meeting-id>",
  }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("execution_id", payload.execution_id)
    console.log("drafts_created", payload.report?.drafts_created)
    console.log("funnel", payload.report?.funnel_metrics)
    return payload
  })`

export function isOpportunityDraftEngineEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_OPPORTUNITY_DRAFT_ENGINE_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function assertOpportunityDraftEngineExecuteAllowed(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean
  blockers: string[]
  error: string | null
} {
  const blockers: string[] = []

  if (!isOpportunityDraftEngineEnabled(env)) {
    blockers.push("GROWTH_OPPORTUNITY_DRAFT_ENGINE_ENABLED must be true")
  }
  if (env.GROWTH_OPPORTUNITY_DRAFT_ENGINE_ACK !== "1") {
    blockers.push("GROWTH_OPPORTUNITY_DRAFT_ENGINE_ACK must be 1")
  }

  return {
    ok: blockers.length === 0,
    blockers,
    error: blockers[0] ?? null,
  }
}

export function validateOpportunityDraftEngineConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  meeting_id: string | null
  certification_mode: boolean
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must include confirm: "${OPPORTUNITY_DRAFT_ENGINE_EXECUTE_CONFIRM}".`,
      meeting_id: null,
      certification_mode: false,
    }
  }

  const record = body as Record<string, unknown>
  const confirm = typeof record.confirm === "string" ? record.confirm.trim() : ""
  const meetingId =
    typeof record.meetingId === "string"
      ? record.meetingId.trim()
      : typeof record.meeting_id === "string"
        ? record.meeting_id.trim()
        : ""

  const certification_mode = confirm === OPPORTUNITY_DRAFT_ENGINE_CERTIFICATION_EXECUTE_CONFIRM
  const execute_mode = confirm === OPPORTUNITY_DRAFT_ENGINE_EXECUTE_CONFIRM

  if (!certification_mode && !execute_mode) {
    return {
      ok: false,
      error: `confirm must be "${OPPORTUNITY_DRAFT_ENGINE_EXECUTE_CONFIRM}" or "${OPPORTUNITY_DRAFT_ENGINE_CERTIFICATION_EXECUTE_CONFIRM}".`,
      meeting_id: null,
      certification_mode: false,
    }
  }

  if (!meetingId) {
    return {
      ok: false,
      error: "meetingId is required.",
      meeting_id: null,
      certification_mode,
    }
  }

  return {
    ok: true,
    error: null,
    meeting_id: meetingId,
    certification_mode,
  }
}

export function buildOpportunityDraftEngineReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  meeting_id?: string | null
}) {
  const env = input?.env ?? process.env
  const gates = assertOpportunityDraftEngineExecuteAllowed(env)

  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: OPPORTUNITY_DRAFT_ENGINE_ROUTE_QA_MARKER,
    automation_qa_marker: OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
    migration: OPPORTUNITY_DRAFT_ENGINE_MIGRATION,
    gates_ok: gates.ok,
    blockers: gates.blockers,
    production_runtime: isApolloScale2ProductionRuntime(env),
    meeting_id: input?.meeting_id ?? null,
    execute_confirm: OPPORTUNITY_DRAFT_ENGINE_EXECUTE_CONFIRM,
    certification_confirm: OPPORTUNITY_DRAFT_ENGINE_CERTIFICATION_EXECUTE_CONFIRM,
    browser_console_snippet: OPPORTUNITY_DRAFT_ENGINE_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    safety: OPPORTUNITY_DRAFT_SAFETY_FLAGS,
    funnel_stage: "Opportunity Draft Ready",
    pipeline_position:
      "Meeting → Opportunity Draft (human approval required before opportunity creation)",
  })
}

export function redactOpportunityDraftEngineSecrets<T extends Record<string, unknown>>(payload: T): T {
  return redactApolloEnrichmentCertProductionSecrets(payload)
}
