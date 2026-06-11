/** Opportunity Draft Engine production route — server-only orchestration. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { certifyOpportunityDraftEngine } from "@/lib/growth/meeting-intelligence/opportunity-draft-certification"
import { buildOpportunityDraftFunnelMetrics } from "@/lib/growth/meeting-intelligence/opportunity-draft-funnel-metrics"
import { OPPORTUNITY_DRAFT_SAFETY_FLAGS } from "@/lib/growth/meeting-intelligence/opportunity-draft-evidence"
import { generateAndPersistOpportunityDraft } from "@/lib/growth/meeting-intelligence/opportunity-draft-service"
import type {
  OpportunityDraftEngineAutomationReport,
  OpportunityDraftEngineCertificationReport,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import {
  OPPORTUNITY_DRAFT_ENGINE_ID,
  OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import {
  assertOpportunityDraftEngineExecuteAllowed,
  buildOpportunityDraftEngineReadinessPayload,
  redactOpportunityDraftEngineSecrets,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-route-gates"

export type OpportunityDraftEngineExecuteResult = {
  ok: boolean
  execution_id: string
  report: OpportunityDraftEngineAutomationReport | null
  certification: OpportunityDraftEngineCertificationReport | null
  blockers: string[]
  error?: "gates_failed" | "meeting_not_found" | "draft_generation_failed" | "certification_failed"
  message?: string | null
}

export async function buildOpportunityDraftEngineReadiness(
  _admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv; meeting_id?: string | null },
) {
  return buildOpportunityDraftEngineReadinessPayload({
    env: input?.env ?? process.env,
    meeting_id: input?.meeting_id ?? null,
  })
}

export async function executeOpportunityDraftEngineInProduction(
  admin: SupabaseClient,
  input: {
    meeting_id: string
    certification_mode?: boolean
    env?: NodeJS.ProcessEnv
    actor_user_id?: string | null
    actor_email?: string | null
  },
): Promise<OpportunityDraftEngineExecuteResult> {
  const env = input.env ?? process.env
  const execution_id = randomUUID()
  const gates = assertOpportunityDraftEngineExecuteAllowed(env)

  if (!gates.ok) {
    return redactOpportunityDraftEngineSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: gates.blockers,
      error: "gates_failed",
      message: gates.error,
    })
  }

  const generated = await generateAndPersistOpportunityDraft(admin, {
    meeting_id: input.meeting_id,
    actor_user_id: input.actor_user_id ?? null,
    actor_email: input.actor_email ?? null,
    regenerate: input.certification_mode ?? false,
    trigger: "manual",
  })

  if (!generated.ok && generated.error === "meeting_not_completed") {
    return redactOpportunityDraftEngineSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: ["meeting_not_completed"],
      error: "meeting_not_found",
      message: "Opportunity drafts require a completed meeting.",
    })
  }

  if (!generated.ok && generated.error === "generator_input_not_found") {
    return redactOpportunityDraftEngineSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: ["generator_input_not_found"],
      error: "meeting_not_found",
      message: "Meeting or prep context not found.",
    })
  }

  const funnel_metrics = await buildOpportunityDraftFunnelMetrics(admin)
  const report: OpportunityDraftEngineAutomationReport = {
    qa_marker: OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
    automation_id: OPPORTUNITY_DRAFT_ENGINE_ID,
    execution_id,
    meeting_id: input.meeting_id,
    drafts_created: generated.ok && !generated.skipped_duplicate ? 1 : 0,
    drafts_skipped_duplicate: generated.skipped_duplicate ? 1 : 0,
    funnel_metrics,
    blockers: generated.ok ? [] : [generated.error ?? "draft_generation_failed"],
    completed_at: new Date().toISOString(),
    ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
  }

  await admin.schema("growth").from("opportunity_draft_runs").insert({
    execution_id,
    meeting_id: input.meeting_id,
    opportunity_draft_id: generated.draft?.draft_id ?? null,
    status: generated.ok ? "completed" : "failed",
    drafts_created: report.drafts_created,
    drafts_skipped_duplicate: report.drafts_skipped_duplicate,
    funnel_metrics,
    blockers: report.blockers,
    opportunity_created: false,
    crm_written: false,
    deal_created: false,
    calendar_written: false,
    metadata: {
      qa_marker: OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
      certification_mode: input.certification_mode ?? false,
    },
  })

  let certification: OpportunityDraftEngineCertificationReport | null = null
  if (input.certification_mode) {
    certification = await certifyOpportunityDraftEngine(admin, {
      execution_id,
      report,
    })

    if (!certification.certified) {
      await logGrowthEngine("opportunity_draft_engine_certification_failed", {
        execution_id,
        blockers: certification.blockers,
        ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
      })

      return redactOpportunityDraftEngineSecrets({
        ok: false,
        execution_id,
        report,
        certification,
        blockers: certification.blockers,
        error: "certification_failed",
        message: "Opportunity Draft Engine certification failed.",
      })
    }
  }

  await logGrowthEngine("opportunity_draft_engine_execute", {
    execution_id,
    meeting_id: input.meeting_id,
    drafts_created: report.drafts_created,
    certification_mode: input.certification_mode ?? false,
    ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
  })

  return redactOpportunityDraftEngineSecrets({
    ok: generated.ok,
    execution_id,
    report,
    certification,
    blockers: report.blockers,
    error: generated.ok ? undefined : "draft_generation_failed",
    message: generated.ok ? null : generated.error ?? "Draft generation failed.",
  })
}
