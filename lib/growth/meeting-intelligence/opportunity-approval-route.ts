/** Opportunity Approval Engine production route — server-only orchestration. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { certifyOpportunityApprovalEngine } from "@/lib/growth/meeting-intelligence/opportunity-approval-certification"
import { confirmCreateOpportunityFromDraft } from "@/lib/growth/meeting-intelligence/opportunity-approval-service"
import { OPPORTUNITY_APPROVAL_SAFETY_FLAGS } from "@/lib/growth/meeting-intelligence/opportunity-approval-evidence"
import type {
  OpportunityApprovalEngineAutomationReport,
  OpportunityApprovalEngineCertificationReport,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-engine-types"
import {
  OPPORTUNITY_APPROVAL_ENGINE_ID,
  OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-engine-types"
import {
  assertOpportunityApprovalEngineExecuteAllowed,
  buildOpportunityApprovalEngineReadinessPayload,
  redactOpportunityApprovalEngineSecrets,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-route-gates"

export type OpportunityApprovalEngineExecuteResult = {
  ok: boolean
  execution_id: string
  report: OpportunityApprovalEngineAutomationReport | null
  certification: OpportunityApprovalEngineCertificationReport | null
  blockers: string[]
  error?: "gates_failed" | "draft_not_found" | "conversion_failed" | "certification_failed"
  message?: string | null
}

export async function buildOpportunityApprovalEngineReadiness(
  _admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv; draft_id?: string | null },
) {
  return buildOpportunityApprovalEngineReadinessPayload({
    env: input?.env ?? process.env,
    draft_id: input?.draft_id ?? null,
  })
}

export async function executeOpportunityApprovalEngineInProduction(
  admin: SupabaseClient,
  input: {
    draft_id: string
    certification_mode?: boolean
    env?: NodeJS.ProcessEnv
    operator_id?: string | null
    operator_email?: string | null
  },
): Promise<OpportunityApprovalEngineExecuteResult> {
  const env = input.env ?? process.env
  const execution_id = randomUUID()
  const gates = assertOpportunityApprovalEngineExecuteAllowed(env)

  if (!gates.ok) {
    return redactOpportunityApprovalEngineSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: gates.blockers,
      error: "gates_failed",
      message: gates.error,
    })
  }

  const conversion = await confirmCreateOpportunityFromDraft(admin, {
    opportunity_draft_id: input.draft_id,
    operator_id: input.operator_id ?? null,
    operator_email: input.operator_email ?? null,
  })

  const report: OpportunityApprovalEngineAutomationReport = {
    qa_marker: OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER,
    automation_id: OPPORTUNITY_APPROVAL_ENGINE_ID,
    execution_id,
    draft_id: input.draft_id,
    opportunity_id: conversion.opportunity_id,
    draft_status: conversion.draft_status,
    attribution_chain: conversion.attribution_chain,
    blockers: conversion.ok ? [] : [conversion.error ?? "conversion_failed"],
    completed_at: new Date().toISOString(),
    opportunity_created: conversion.opportunity_created,
    ...OPPORTUNITY_APPROVAL_SAFETY_FLAGS,
  }

  await admin.schema("growth").from("opportunity_approval_runs").insert({
    execution_id,
    opportunity_draft_id: input.draft_id,
    opportunity_id: conversion.opportunity_id,
    status: conversion.ok ? "completed" : "failed",
    opportunity_created: conversion.opportunity_created,
    draft_status: conversion.draft_status,
    attribution_chain: conversion.attribution_chain,
    blockers: report.blockers,
    auto_created: false,
    human_confirmed: true,
    operator_required: true,
    metadata: {
      qa_marker: OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER,
      certification_mode: input.certification_mode ?? false,
    },
  })

  let certification: OpportunityApprovalEngineCertificationReport | null = null
  if (input.certification_mode) {
    certification = await certifyOpportunityApprovalEngine(admin, {
      execution_id,
      report,
    })

    if (!certification.certified) {
      return redactOpportunityApprovalEngineSecrets({
        ok: false,
        execution_id,
        report,
        certification,
        blockers: certification.blockers,
        error: "certification_failed",
        message: "Opportunity Approval Engine certification failed.",
      })
    }
  }

  if (!conversion.ok) {
    return redactOpportunityApprovalEngineSecrets({
      ok: false,
      execution_id,
      report,
      certification,
      blockers: report.blockers,
      error: conversion.error === "opportunity_draft_not_found" ? "draft_not_found" : "conversion_failed",
      message: conversion.error ?? "Opportunity creation from draft failed.",
    })
  }

  await logGrowthEngine("opportunity_approval_engine_execute", {
    execution_id,
    draft_id: input.draft_id,
    opportunity_id: conversion.opportunity_id,
    certification_mode: input.certification_mode ?? false,
    ...OPPORTUNITY_APPROVAL_SAFETY_FLAGS,
  })

  return redactOpportunityApprovalEngineSecrets({
    ok: true,
    execution_id,
    report,
    certification,
    blockers: [],
    message: null,
  })
}
