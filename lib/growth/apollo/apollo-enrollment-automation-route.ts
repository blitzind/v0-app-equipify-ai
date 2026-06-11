/** Apollo Enrollment Automation production route — server-only orchestration. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { runApolloEnrollmentAutomation } from "@/lib/growth/apollo/apollo-enrollment-auto-enrollment"
import { certifyApolloEnrollmentAutomation } from "@/lib/growth/apollo/apollo-enrollment-certification"
import type {
  ApolloEnrollmentAutomationReport,
  ApolloEnrollmentCertificationReport,
} from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import {
  assertApolloEnrollmentAutomationExecuteAllowed,
  buildApolloEnrollmentAutomationReadinessPayload,
  redactApolloEnrollmentAutomationSecrets,
} from "@/lib/growth/apollo/apollo-enrollment-automation-route-gates"
import { buildApolloEnrollmentFunnelMetrics } from "@/lib/growth/apollo/apollo-enrollment-funnel-metrics"

export type ApolloEnrollmentAutomationExecuteResult = {
  ok: boolean
  execution_id: string
  report: ApolloEnrollmentAutomationReport | null
  certification: ApolloEnrollmentCertificationReport | null
  blockers: string[]
  error?: "gates_failed" | "company_not_found" | "automation_failed" | "certification_failed"
  message?: string | null
}

export async function buildApolloEnrollmentAutomationReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv; company_candidate_id?: string | null },
) {
  return buildApolloEnrollmentAutomationReadinessPayload({
    env: input?.env ?? process.env,
    company_candidate_id: input?.company_candidate_id ?? null,
  })
}

export async function executeApolloEnrollmentAutomationInProduction(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    certification_mode?: boolean
    created_by?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloEnrollmentAutomationExecuteResult> {
  const env = input.env ?? process.env
  const execution_id = randomUUID()
  const gates = assertApolloEnrollmentAutomationExecuteAllowed(env)

  if (!gates.ok) {
    return redactApolloEnrollmentAutomationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: gates.blockers,
      error: "gates_failed",
      message: gates.error,
    })
  }

  try {
    const report = await runApolloEnrollmentAutomation(admin, {
      execution_id,
      company_candidate_id: input.company_candidate_id,
      created_by: input.created_by ?? null,
      env,
    })

    let certification: ApolloEnrollmentCertificationReport | null = null
    if (input.certification_mode) {
      certification = await certifyApolloEnrollmentAutomation(admin, {
        company_candidate_id: input.company_candidate_id,
        execution_id,
        report,
      })
    }

    const ok = input.certification_mode
      ? Boolean(certification?.certified)
      : report.candidates_created > 0 || report.contacts_qualified > 0

    return redactApolloEnrollmentAutomationSecrets({
      ok,
      execution_id,
      report,
      certification,
      blockers: [
        ...report.blockers,
        ...(certification?.blockers ?? []),
      ],
      ...(ok
        ? {}
        : {
            error: input.certification_mode ? ("certification_failed" as const) : ("automation_failed" as const),
            message: input.certification_mode
              ? certification?.summary ?? "Enrollment certification failed."
              : "No qualified enrollment candidates created.",
          }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return redactApolloEnrollmentAutomationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: [message],
      error: "automation_failed",
      message,
    })
  }
}

export async function loadApolloEnrollmentFunnelMetrics(admin: SupabaseClient) {
  return buildApolloEnrollmentFunnelMetrics(admin)
}
