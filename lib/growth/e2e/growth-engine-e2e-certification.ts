/** Phase GE-HARDEN-1 — Growth Engine E2E certification runner — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  assertCertificationSafetyInvariants,
  assertReadinessSafetyInvariants,
  runGrowthEngineSafetyAudit,
} from "@/lib/growth/e2e/growth-engine-e2e-safety-audit"
import {
  GROWTH_ENGINE_E2E_CHAIN,
  GROWTH_ENGINE_E2E_SUBSYSTEMS,
} from "@/lib/growth/e2e/growth-engine-e2e-subsystems"
import {
  GROWTH_ENGINE_E2E_QA_MARKER,
  type GrowthEngineE2EAuditHealth,
  type GrowthEngineE2ECertificationReport,
  type GrowthEngineE2ESubsystemId,
  type GrowthEngineE2ESubsystemResult,
} from "@/lib/growth/e2e/growth-engine-e2e-types"
import { executeProspectDiscoveryFoundationCertification } from "@/lib/growth/prospect-discovery/prospect-search-certification"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

export { GROWTH_ENGINE_E2E_QA_MARKER }

type CertReport = Record<string, unknown> & {
  ok?: boolean
  final_verdict?: string
  checks?: Array<{ id: string; pass: boolean; detail?: Record<string, unknown> }>
  pass_count?: number
  check_count?: number
  blockers?: string[]
  certification_checks?: Array<{ id: string; pass: boolean }>
}

async function runSubsystemCertification(
  subsystemId: GrowthEngineE2ESubsystemId,
  admin: SupabaseClient | null,
): Promise<CertReport> {
  switch (subsystemId) {
    case "prospect_discovery":
      return executeProspectDiscoveryFoundationCertification({}) as CertReport
    case "signal_feed": {
      const { executeSignalFeedCertification } = await import("@/lib/growth/signal-intelligence/signal-feed-route")
      const { REVENUE_PATH_HENRY_LEAD_ID } = await import("@/lib/growth/qa/revenue-path-validation-types")
      if (!admin) throw new Error("admin_required")
      return (await executeSignalFeedCertification(admin, {
        henry_lead_id: REVENUE_PATH_HENRY_LEAD_ID,
      })) as CertReport
    }
    case "operator_inbox": {
      if (!admin) throw new Error("admin_required")
      const { executeOperatorInboxCertification } = await import(
        "@/lib/growth/operator-inbox/operator-inbox-certification"
      )
      return (await executeOperatorInboxCertification(admin, {})) as CertReport
    }
    case "campaign_readiness": {
      if (!admin) throw new Error("admin_required")
      const { executeCampaignReadinessCertification } = await import(
        "@/lib/growth/campaign-readiness/campaign-readiness-certification"
      )
      return (await executeCampaignReadinessCertification(admin, {})) as CertReport
    }
    case "conversational_playbooks": {
      if (!admin) throw new Error("admin_required")
      const { executeConversationalPlaybooksCertification } = await import(
        "@/lib/growth/conversational-playbooks/conversational-playbook-certification"
      )
      return (await executeConversationalPlaybooksCertification(admin, {})) as CertReport
    }
    case "human_interventions": {
      if (!admin) throw new Error("admin_required")
      const { executeHumanInterventionCertification } = await import(
        "@/lib/growth/human-interventions/human-intervention-certification"
      )
      return (await executeHumanInterventionCertification(admin, {})) as CertReport
    }
    case "follow_up_policies": {
      if (!admin) throw new Error("admin_required")
      const { executeSmartFollowUpPolicyCertification } = await import(
        "@/lib/growth/follow-up-policies/follow-up-policy-certification"
      )
      return (await executeSmartFollowUpPolicyCertification(admin, {})) as CertReport
    }
    case "sequence_preview": {
      if (!admin) throw new Error("admin_required")
      const { executeSequencePreviewCertification } = await import(
        "@/lib/growth/sequence-preview/sequence-preview-certification"
      )
      return (await executeSequencePreviewCertification(admin, {})) as CertReport
    }
    case "campaign_builder": {
      if (!admin) throw new Error("admin_required")
      const { executeCampaignBuilderCertification } = await import(
        "@/lib/growth/campaign-builder/campaign-builder-certification"
      )
      return (await executeCampaignBuilderCertification(admin, {})) as CertReport
    }
    case "realtime_events": {
      if (!admin) throw new Error("admin_required")
      const { executeRealtimeEventsCertification } = await import(
        "@/lib/growth/realtime-events/realtime-events-certification"
      )
      return (await executeRealtimeEventsCertification(admin, {})) as CertReport
    }
    case "agent_orchestration": {
      if (!admin) throw new Error("admin_required")
      const { executeAgentOrchestrationCertification } = await import(
        "@/lib/growth/agent-orchestration/agent-orchestration-certification"
      )
      return (await executeAgentOrchestrationCertification(admin, {})) as CertReport
    }
    case "command_center_unification": {
      if (!admin) throw new Error("admin_required")
      const { executeCommandCenterUnificationCertification } = await import(
        "@/lib/growth/command-center-unification/command-center-unification-certification"
      )
      return (await executeCommandCenterUnificationCertification(admin, {})) as CertReport
    }
    default:
      throw new Error(`unknown_subsystem:${subsystemId}`)
  }
}

function extractFailedChecks(report: CertReport, executeRoute: string): Array<{ id: string; hint: string }> {
  const checks = report.checks ?? report.certification_checks ?? []
  const fromChecks = checks
    .filter((check) => !check.pass)
    .map((check) => ({
      id: check.id,
      hint: `${executeRoute} — check failed: ${check.id}`,
    }))

  const fromBlockers = (report.blockers ?? [])
    .filter((b): b is string => typeof b === "string")
    .map((blocker) => ({
      id: blocker,
      hint: `${executeRoute} — gate blocker: ${blocker}`,
    }))

  return [...fromChecks, ...fromBlockers]
}

function extractPassCounts(report: CertReport): { pass_count: number; check_count: number } {
  if (typeof report.pass_count === "number" && typeof report.check_count === "number") {
    return { pass_count: report.pass_count, check_count: report.check_count }
  }
  const checks = report.checks ?? report.certification_checks ?? []
  return {
    pass_count: checks.filter((c) => c.pass).length,
    check_count: checks.length,
  }
}

async function verifyAuditEventHealth(admin: SupabaseClient): Promise<GrowthEngineE2EAuditHealth> {
  const schema_ready = await isGrowthSignalFoundationSchemaReady(admin)
  if (!schema_ready) {
    return { schema_ready: false, recent_event_count: 0, gs_marker_event_count: 0, verified: false }
  }

  const organization_id = getGrowthEngineAiOrgId()
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  let query = admin
    .schema("growth")
    .from("signal_events")
    .select("id, event_payload", { count: "exact", head: false })
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(200)

  if (organization_id) {
    query = query.eq("organization_id", organization_id)
  }

  const { data, count, error } = await query
  if (error) {
    return { schema_ready: true, recent_event_count: 0, gs_marker_event_count: 0, verified: false }
  }

  const gs_marker_event_count = (data ?? []).filter((row) => {
    const payload = row.event_payload as Record<string, unknown> | null
    const marker = typeof payload?.qa_marker === "string" ? payload.qa_marker : ""
    return marker.includes("growth-") && marker.includes("-gs")
  }).length

  return {
    schema_ready: true,
    recent_event_count: count ?? data?.length ?? 0,
    gs_marker_event_count,
    verified: (count ?? 0) > 0,
  }
}

export function assertGrowthEngineE2EExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export async function executeGrowthEngineE2ECertification(
  admin: SupabaseClient | null,
  input?: { production?: boolean; skip_live_certs?: boolean },
): Promise<GrowthEngineE2ECertificationReport> {
  const execution_id = randomUUID()
  const organization_id = admin ? getGrowthEngineAiOrgId() ?? null : null
  const production = input?.production === true
  const blockers: string[] = []

  if (production) {
    const gate = assertGrowthEngineE2EExecuteAllowed(process.env as Record<string, string | undefined>)
    if (!gate.ok) blockers.push(...gate.blockers)
    if (!admin) blockers.push("supabase_admin_required")
  }

  const safety_audit = runGrowthEngineSafetyAudit()
  if (safety_audit.violations.length > 0) {
    blockers.push(`safety_violations:${safety_audit.violations.length}`)
  }

  const subsystem_matrix: GrowthEngineE2ESubsystemResult[] = []

  for (const subsystemId of GROWTH_ENGINE_E2E_CHAIN) {
    const def = GROWTH_ENGINE_E2E_SUBSYSTEMS.find((s) => s.subsystem_id === subsystemId)!
    const readiness = def.buildReadiness()
    const readinessSafety = assertReadinessSafetyInvariants(readiness)

    let certification_ok = false
    let pass_count = 0
    let check_count = 0
    let failed_checks: Array<{ id: string; hint: string }> = []
    let certSafetyOk = true

    const shouldRunLiveCert = !input?.skip_live_certs

    if (shouldRunLiveCert) {
      try {
        const needsAdmin = subsystemId !== "prospect_discovery"
        if (needsAdmin && !admin) {
          throw new Error("admin_required")
        }
        const certReport = await runSubsystemCertification(subsystemId, admin)
        certification_ok = certReport.ok === true || certReport.final_verdict === "PASS"
        const counts = extractPassCounts(certReport)
        pass_count = counts.pass_count
        check_count = counts.check_count
        failed_checks = extractFailedChecks(certReport, def.execute_route)

        const certSafety = assertCertificationSafetyInvariants(certReport)
        certSafetyOk = certSafety.ok
        if (!certSafety.ok) {
          failed_checks.push(
            ...certSafety.failures.map((f) => ({ id: f, hint: `${def.execute_route} — safety invariant` })),
          )
        }

        if (!certification_ok || !certSafetyOk) {
          blockers.push(`${subsystemId}_certification_failed`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        certification_ok = false
        failed_checks = [{ id: "certification_exception", hint: `${def.execute_route} — ${message}` }]
        blockers.push(`${subsystemId}_certification_exception`)
      }
    } else if (!shouldRunLiveCert) {
      certification_ok = readinessSafety.ok
      pass_count = readinessSafety.ok ? 1 : 0
      check_count = 1
    }

    subsystem_matrix.push({
      subsystem_id: subsystemId,
      phase: def.phase,
      qa_marker: def.qa_marker,
      readiness_route: def.readiness_route,
      execute_route: def.execute_route,
      readiness_ok: readinessSafety.ok,
      certification_ok: certification_ok && certSafetyOk,
      pass_count,
      check_count,
      failed_checks,
      safety_invariants_ok: readinessSafety.ok && certSafetyOk,
    })

    if (!readinessSafety.ok) {
      blockers.push(`${subsystemId}_readiness_safety_failed`)
    }
  }

  let audit_health: GrowthEngineE2EAuditHealth | null = null
  if (admin && production) {
    audit_health = await verifyAuditEventHealth(admin)
    if (!audit_health.schema_ready) {
      blockers.push("audit_schema_not_ready")
    }
  }

  const allPass = subsystem_matrix.every(
    (row) => row.readiness_ok && row.certification_ok && row.safety_invariants_ok,
  )
  const safetyPass = safety_audit.violations.length === 0
  const final_verdict = allPass && safetyPass && blockers.length === 0 ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: GROWTH_ENGINE_E2E_QA_MARKER,
    organization_id,
    environment: production ? "production" : "local",
    final_verdict,
    subsystem_matrix,
    safety_audit,
    audit_health,
    chain_order: [...GROWTH_ENGINE_E2E_CHAIN],
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    blockers: [...new Set(blockers)],
  }
}
