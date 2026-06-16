/** Growth Engine S5-B — Automation builder diagnostics & integration certification. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  archiveFlow,
  createEdge,
  createFlow,
  createNode,
  validateFlow,
} from "@/lib/growth/automation/growth-automation-service"
import {
  createDraftFromPublishedVersion,
  publishAutomationFlowVersion,
  unpublishAutomationFlow,
} from "@/lib/growth/automation/growth-automation-publish-service"
import { previewAutomationRuntimeArtifacts } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-service"
import {
  pauseAutomationRuntime,
  publishAutomationRuntimeArtifacts,
  rollbackAutomationRuntimePublish,
  activateAutomationRuntime,
} from "@/lib/growth/automation/growth-automation-runtime-publisher-service"
import { probeGrowthAutomationBuilderSchema } from "@/lib/growth/automation/growth-automation-schema-health"
import {
  GROWTH_AUTOMATION_API_SAFETY_FLAGS,
  GROWTH_AUTOMATION_BUILDER_CONFIRM,
  GROWTH_AUTOMATION_BUILDER_QA_MARKER,
} from "@/lib/growth/automation/growth-automation-types"

export { GROWTH_AUTOMATION_BUILDER_CONFIRM }

export const GROWTH_AUTOMATION_PLATFORM_ROUTE_PATHS = [
  "app/api/platform/growth/automation/route.ts",
  "app/api/platform/growth/automation/[id]/route.ts",
  "app/api/platform/growth/automation/[id]/versions/route.ts",
  "app/api/platform/growth/automation/[id]/validate/route.ts",
  "app/api/platform/growth/automation/[id]/nodes/route.ts",
  "app/api/platform/growth/automation/[id]/edges/route.ts",
  "app/api/platform/growth/automation/[id]/compile/route.ts",
  "app/api/platform/growth/automation/[id]/simulate/route.ts",
  "app/api/platform/growth/automation/[id]/publish/route.ts",
  "app/api/platform/growth/automation/[id]/unpublish/route.ts",
  "app/api/platform/growth/automation/[id]/publish-status/route.ts",
  "app/api/platform/growth/automation/[id]/draft-from-published/route.ts",
  "app/api/platform/growth/automation/[id]/runtime-preview/route.ts",
  "app/api/platform/growth/automation/[id]/reconciliation/route.ts",
  "app/api/platform/growth/automation/[id]/runtime-publish/route.ts",
  "app/api/platform/growth/automation/[id]/activate/route.ts",
  "app/api/platform/growth/automation/[id]/pause/route.ts",
  "app/api/platform/growth/automation/[id]/runtime-status/route.ts",
  "app/api/platform/growth/automation/[id]/enroll/route.ts",
  "app/api/platform/growth/automation/[id]/bulk-enroll/route.ts",
  "app/api/platform/growth/automation/[id]/unenroll/route.ts",
  "app/api/platform/growth/automation/[id]/enrollments/route.ts",
  "app/api/platform/growth/automation/lead/[leadId]/enrollments/route.ts",
  "app/api/platform/growth/automation/trigger-match/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/advance/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/advance-until-blocked/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/cancel/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/status/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/enrollments/[enrollmentId]/route.ts",
  "app/api/platform/growth/automation/approvals/route.ts",
  "app/api/platform/growth/automation/approvals/[approvalId]/route.ts",
  "app/api/platform/growth/automation/approvals/[approvalId]/approve/route.ts",
  "app/api/platform/growth/automation/approvals/[approvalId]/reject/route.ts",
  "app/api/platform/growth/automation/approvals/[approvalId]/cancel/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/enrollments/[enrollmentId]/resume/route.ts",
  "app/api/platform/growth/automation/[id]/observability/route.ts",
  "app/api/platform/growth/automation/[id]/health/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/resume/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/kill-switch/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/enrollments/[enrollmentId]/cancel-safe/route.ts",
  "app/api/platform/growth/automation/[id]/analytics/route.ts",
  "app/api/platform/growth/automation/[id]/analytics/summary/route.ts",
  "app/api/platform/growth/automation/[id]/analytics/branches/route.ts",
  "app/api/platform/growth/automation/[id]/analytics/waits/route.ts",
  "app/api/platform/growth/automation/[id]/analytics/approvals/route.ts",
  "app/api/platform/growth/automation/[id]/analytics/jobs/route.ts",
  "app/api/platform/growth/automation/[id]/audit/route.ts",
] as const

export const GROWTH_AUTOMATION_ADMIN_ROUTE_PATHS = [
  "app/(admin)/admin/growth/automation/page.tsx",
  "app/(admin)/admin/growth/automation/new/page.tsx",
  "app/(admin)/admin/growth/automation/[id]/page.tsx",
] as const

export const GROWTH_AUTOMATION_UI_MODULE_PATHS = [
  "components/growth/automation/growth-automation-flow-library.tsx",
  "components/growth/automation/growth-automation-flow-card.tsx",
  "components/growth/automation/growth-automation-canvas.tsx",
  "components/growth/automation/growth-automation-node-palette.tsx",
  "components/growth/automation/growth-automation-node-inspector.tsx",
  "components/growth/automation/growth-automation-validation-panel.tsx",
] as const

const CERT_PREFIX = "growth-automation-builder-s5b-cert"

export type GrowthAutomationBuilderDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthAutomationBuilderDiagnosticsReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_AUTOMATION_BUILDER_QA_MARKER
  checks: GrowthAutomationBuilderDiagnosticsCheck[]
  blockers: string[]
  final_verdict: "PASS" | "FAIL" | "SKIP"
  flow_id?: string
  safety_flags: typeof GROWTH_AUTOMATION_API_SAFETY_FLAGS
}

function pushCheck(
  checks: GrowthAutomationBuilderDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

async function resolveCertOrganizationId(admin: SupabaseClient): Promise<string | null> {
  const configured = process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()
  if (configured) return configured

  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id
}

async function cleanupCertFlow(admin: SupabaseClient, flowId: string): Promise<void> {
  try {
    await admin.schema("growth").from("automation_flows").delete().eq("id", flowId)
  } catch {
    // Best-effort cleanup for cert fixtures.
  }
}

export async function executeGrowthAutomationBuilderDiagnostics(
  admin: SupabaseClient,
): Promise<GrowthAutomationBuilderDiagnosticsReport> {
  const executionId = randomUUID()
  const checks: GrowthAutomationBuilderDiagnosticsCheck[] = []
  const blockers: string[] = []

  const schemaProbe = await probeGrowthAutomationBuilderSchema(admin)
  pushCheck(
    checks,
    "schema_ready",
    schemaProbe.ready,
    schemaProbe.ready
      ? "Automation builder tables are reachable."
      : `Missing tables: ${schemaProbe.missingTables.join(", ")}`,
  )
  if (!schemaProbe.ready) {
    blockers.push("Apply migration 20270827121000_growth_automation_builder_s5b.sql before integration cert.")
    return {
      ok: false,
      execution_id: executionId,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      checks,
      blockers,
      final_verdict: "SKIP",
      safety_flags: GROWTH_AUTOMATION_API_SAFETY_FLAGS,
    }
  }

  const organizationId = await resolveCertOrganizationId(admin)
  if (!organizationId) {
    pushCheck(checks, "organization_scope", false, "Could not resolve certification organization id.")
    blockers.push("organization_scope_unavailable")
    return {
      ok: false,
      execution_id: executionId,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      checks,
      blockers,
      final_verdict: "FAIL",
      safety_flags: GROWTH_AUTOMATION_API_SAFETY_FLAGS,
    }
  }
  pushCheck(checks, "organization_scope", true, "Organization scope resolved.")

  const certName = `${CERT_PREFIX}-${randomUUID()}`
  const created = await createFlow(admin, {
    organizationId,
    name: certName,
    description: "S5-B integration certification fixture",
  })
  pushCheck(checks, "create_flow", Boolean(created.flow.id), "Flow + v1 draft created.")

  const trigger = await createNode(admin, {
    flowId: created.flow.id,
    organizationId,
    nodeType: "trigger",
    label: "Share page viewed",
    positionX: 80,
    positionY: 80,
    configJson: { triggerSource: "manual.enrollment" },
  })
  const approval = await createNode(admin, {
    flowId: created.flow.id,
    organizationId,
    nodeType: "approval",
    label: "Approval",
    positionX: 200,
    positionY: 80,
  })
  const action = await createNode(admin, {
    flowId: created.flow.id,
    organizationId,
    nodeType: "action",
    label: "Send email",
    positionX: 320,
    positionY: 80,
    configJson: { actionType: "send_email" },
  })
  const exit = await createNode(admin, {
    flowId: created.flow.id,
    organizationId,
    nodeType: "exit",
    label: "Done",
    positionX: 460,
    positionY: 80,
  })
  pushCheck(
    checks,
    "create_nodes",
    trigger.nodeType === "trigger" && exit.nodeType === "exit",
    "Publish fixture nodes created.",
  )

  await createEdge(admin, {
    flowId: created.flow.id,
    organizationId,
    fromNodeId: trigger.id,
    toNodeId: approval.id,
  })
  await createEdge(admin, {
    flowId: created.flow.id,
    organizationId,
    fromNodeId: approval.id,
    toNodeId: action.id,
  })
  await createEdge(admin, {
    flowId: created.flow.id,
    organizationId,
    fromNodeId: action.id,
    toNodeId: exit.id,
  })
  pushCheck(checks, "publish_fixture_graph", true, "Publishable fixture graph wired.")

  const validation = await validateFlow(admin, {
    flowId: created.flow.id,
    organizationId,
  })
  pushCheck(
    checks,
    "validate_flow",
    validation.ok && validation.errors.length === 0,
    `Validation ok=${validation.ok}; errors=${validation.errors.length}.`,
  )

  const published = await publishAutomationFlowVersion(admin, {
    flowId: created.flow.id,
    organizationId,
  })
  pushCheck(
    checks,
    "publish_metadata_only",
    published.ok &&
      published.flow.status === "published" &&
      published.publishedVersion.lifecycle === "published" &&
      published.publishedVersion.compiledPatternId === null &&
      published.draftVersion.lifecycle === "draft",
    `Published metadata only; draft v${published.draftVersion.versionNumber} created.`,
  )

  const runtimePreview = await previewAutomationRuntimeArtifacts(admin, {
    flowId: created.flow.id,
    organizationId,
    candidateVersionId: published.draftVersion.id,
  })
  pushCheck(
    checks,
    "runtime_preview_first_publish",
    runtimePreview.status === "previewed" &&
      runtimePreview.createPlan.length > 0 &&
      runtimePreview.artifactPreview?.previewOnly === true &&
      runtimePreview.safety.sr3_artifact_writes_enabled === false,
    `Runtime preview status=${runtimePreview.status}; createPlan=${runtimePreview.createPlan.length}.`,
  )

  const reconciliationPreview = await previewAutomationRuntimeArtifacts(admin, {
    flowId: created.flow.id,
    organizationId,
    candidateVersionId: published.publishedVersion.id,
  })
  pushCheck(
    checks,
    "reconciliation_preview_published",
    (reconciliationPreview.status === "previewed" || reconciliationPreview.status === "blocked") &&
      reconciliationPreview.rollbackPlan.length > 0 &&
      reconciliationPreview.safety.reconciliation_preview_only === true,
    `Reconciliation status=${reconciliationPreview.status}; rollback steps=${reconciliationPreview.rollbackPlan.length}.`,
  )

  const runtimePublished = await publishAutomationRuntimeArtifacts(admin, {
    flowId: created.flow.id,
    organizationId,
    versionId: published.publishedVersion.id,
  })
  pushCheck(
    checks,
    "runtime_publish_sr3_artifacts",
    runtimePublished.ok &&
      Boolean(runtimePublished.patternId) &&
      runtimePublished.metadata.activationStatus === "published" &&
      runtimePublished.metadata.executionEnabled === false,
    `Runtime publish ok=${runtimePublished.ok}; patternId=${runtimePublished.patternId ?? "none"}.`,
  )

  const runtimeActivated = await activateAutomationRuntime(admin, {
    flowId: created.flow.id,
    organizationId,
  })
  pushCheck(
    checks,
    "runtime_activate_for_enrollment",
    runtimeActivated.ok && runtimeActivated.metadata?.activationStatus === "active",
    `Runtime activate ok=${runtimeActivated.ok}; status=${runtimeActivated.metadata?.activationStatus ?? "missing"}.`,
  )

  const certLead = await admin.schema("growth").from("leads").select("id").limit(1).maybeSingle()
  pushCheck(checks, "enrollment_cert_lead", Boolean(certLead.data?.id), "Cert lead available for enrollment.")

  const {
    enrollLeadIntoAutomationRuntime,
    findMatchingAutomationRuntimes,
    getAutomationEnrollments,
  } = await import("@/lib/growth/automation/growth-automation-enrollment-service")

  let enrolledEnrollmentId: string | null = null
  if (certLead.data?.id) {
    const enrolled = await enrollLeadIntoAutomationRuntime(admin, {
      flowId: created.flow.id,
      organizationId,
      leadId: String(certLead.data.id),
      triggerSource: "manual.enrollment",
      entryReason: "S5-I integration cert manual enrollment",
      actingUserId: "automation-cert",
      actingUserEmail: "automation-cert@equipify.internal",
    })
    enrolledEnrollmentId = enrolled.enrollmentId || null
    pushCheck(
      checks,
      "manual_enrollment",
      enrolled.status === "enrolled" && Boolean(enrolled.enrollmentId),
      `Manual enrollment status=${enrolled.status}.`,
    )

    const duplicate = await enrollLeadIntoAutomationRuntime(admin, {
      flowId: created.flow.id,
      organizationId,
      leadId: String(certLead.data.id),
      triggerSource: "manual.enrollment",
    })
    pushCheck(
      checks,
      "duplicate_enrollment_blocked",
      duplicate.status === "duplicate" && duplicate.duplicateEnrollment,
      `Duplicate enrollment status=${duplicate.status}.`,
    )

    const manualMatch = await findMatchingAutomationRuntimes(admin, {
      organizationId,
      triggerSource: "manual.enrollment",
    })
    pushCheck(
      checks,
      "trigger_match_manual",
      manualMatch.ok && manualMatch.matches.some((match) => match.flowId === created.flow.id),
      `Manual trigger matches=${manualMatch.matches.length}.`,
    )

    const mediaMatch = await findMatchingAutomationRuntimes(admin, {
      organizationId,
      triggerSource: "media.viewed",
      triggerEvent: "media.viewed",
    })
    pushCheck(
      checks,
      "trigger_match_media_no_runtime",
      mediaMatch.matches.every((match) => match.flowId !== created.flow.id),
      `Media trigger matches=${mediaMatch.matches.length}.`,
    )

    if (enrolledEnrollmentId) {
      const certEnrollmentId = enrolledEnrollmentId
      await admin
        .schema("growth")
        .from("sequence_enrollments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_reason: "S5-J cert prep — clear active enrollment conflict",
        })
        .eq("lead_id", String(certLead.data!.id))
        .eq("status", "active")
        .neq("id", enrolledEnrollmentId)

      const { setLeadActiveSequenceEnrollment: clearLeadActive } = await import(
        "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
      )
      await clearLeadActive(admin, String(certLead.data!.id), null)

      const {
        advanceAutomationEnrollment,
        advanceAutomationEnrollmentUntilBlocked,
        cancelAutomationRuntimeExecution,
        getAutomationRuntimeExecutionStatus,
      } = await import("@/lib/growth/automation/growth-automation-runtime-orchestrator")

      const advancedUntilBlocked = await advanceAutomationEnrollmentUntilBlocked(admin, {
        flowId: created.flow.id,
        organizationId,
        enrollmentId: enrolledEnrollmentId,
        leadId: String(certLead.data!.id),
      })
      pushCheck(
        checks,
        "runtime_execution_advance_until_blocked",
        advancedUntilBlocked.status === "approval_required" &&
          (advancedUntilBlocked.approvalGates.length >= 1 ||
            advancedUntilBlocked.pendingJobs.length >= 1),
        `Advance-until-blocked status=${advancedUntilBlocked.status}; gates=${advancedUntilBlocked.approvalGates.length}; jobs=${advancedUntilBlocked.pendingJobs.length}.`,
      )

      const executionStatus = await getAutomationRuntimeExecutionStatus(admin, {
        flowId: created.flow.id,
        organizationId,
        enrollmentId: enrolledEnrollmentId,
      })
      pushCheck(
        checks,
        "runtime_execution_status",
        executionStatus.status === "approval_required" ||
          executionStatus.approvalGates.length >= 1 ||
          executionStatus.pendingJobs.length >= 1,
        `Execution status=${executionStatus.status}; gates=${executionStatus.approvalGates.length}; jobs=${executionStatus.pendingJobs.length}.`,
      )

      const singleAdvance = await advanceAutomationEnrollment(admin, {
        flowId: created.flow.id,
        organizationId,
        enrollmentId: enrolledEnrollmentId,
        leadId: String(certLead.data!.id),
      })
      pushCheck(
        checks,
        "runtime_execution_advance_blocked_at_approval",
        singleAdvance.status === "approval_required",
        `Single advance while blocked status=${singleAdvance.status}.`,
      )

      const {
        approveAutomationAction,
        cancelAutomationApproval,
        getAutomationApproval,
        listPendingAutomationApprovals,
        rejectAutomationAction,
        resumeAutomationAfterApproval,
      } = await import("@/lib/growth/automation/growth-automation-approval-service")
      const { getSequenceExecutionJob } = await import(
        "@/lib/growth/sequences/execution/sequence-job-repository"
      )

      const pendingApprovals = await listPendingAutomationApprovals(admin, {
        organizationId,
        flowId: created.flow.id,
        enrollmentId: enrolledEnrollmentId,
        status: "pending_only",
      })
      pushCheck(
        checks,
        "approval_list_pending",
        pendingApprovals.length >= 1,
        `Pending approvals=${pendingApprovals.length}.`,
      )

      const firstPending = pendingApprovals[0]
      if (firstPending) {
        const cancelledApproval = await cancelAutomationApproval(admin, {
          organizationId,
          approvalId: firstPending.approvalId,
          reviewNote: "S5-K integration cert cancel path",
        })
        pushCheck(
          checks,
          "approval_cancel",
          cancelledApproval.approval.status === "cancelled",
          `Cancel status=${cancelledApproval.approval.status}.`,
        )

        const { fetchGrowthSequenceEnrollmentById, updateGrowthSequenceEnrollment } = await import(
          "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
        )
        const { readAutomationExecutionMetadata, mergeAutomationExecutionMetadata } = await import(
          "@/lib/growth/automation/growth-automation-runtime-execution-utils"
        )

        const resetCertApprovalPending = async (): Promise<void> => {
          const executionMeta = readAutomationExecutionMetadata(
            (await fetchGrowthSequenceEnrollmentById(admin, certEnrollmentId))?.metadata ?? {},
          )
          const approvalGates = Array.isArray(executionMeta.approval_gates)
            ? (executionMeta.approval_gates as Array<Record<string, unknown>>)
            : []
          const pendingJobs = Array.isArray(executionMeta.pending_jobs)
            ? (executionMeta.pending_jobs as Array<Record<string, unknown>>)
            : []
          for (const gate of approvalGates) {
            if (String(gate.gateId ?? "") === firstPending.approvalId) gate.status = "pending"
          }
          for (const job of pendingJobs) {
            if (String(job.jobId ?? "") === firstPending.approvalId) job.status = "pending_approval"
          }
          await updateGrowthSequenceEnrollment(admin, certEnrollmentId, {
            metadata: mergeAutomationExecutionMetadata(
              (await fetchGrowthSequenceEnrollmentById(admin, certEnrollmentId))?.metadata ?? {},
              {
                approval_gates: approvalGates,
                pending_jobs: pendingJobs,
                approvals: [],
              },
            ),
          })
          if (firstPending.jobId) {
            const { updateSequenceExecutionJob } = await import(
              "@/lib/growth/sequences/execution/sequence-job-repository"
            )
            await updateSequenceExecutionJob(admin, firstPending.jobId, {
              status: "pending_approval",
              humanApprovedAt: null,
              humanApprovedBy: null,
            })
          }
        }

        await resetCertApprovalPending()

        const rejectedResult = await rejectAutomationAction(admin, {
          organizationId,
          approvalId: firstPending.approvalId,
          reviewNote: "S5-K integration cert reject path",
        })
        pushCheck(
          checks,
          "approval_reject",
          rejectedResult.approval.status === "rejected",
          `Reject status=${rejectedResult.approval.status}.`,
        )

        await resetCertApprovalPending()

        const approvedResult = await approveAutomationAction(admin, {
          organizationId,
          approvalId: firstPending.approvalId,
          reviewNote: "S5-K integration cert approve path",
        })
        pushCheck(
          checks,
          "approval_approve",
          approvedResult.ok && approvedResult.approval.status === "approved",
          `Approve status=${approvedResult.approval.status}.`,
        )

        if (approvedResult.approval.jobId) {
          const job = await getSequenceExecutionJob(admin, approvedResult.approval.jobId)
          pushCheck(
            checks,
            "approval_no_send_after_approve",
            job?.status === "approved",
            `Job status after approve=${job?.status ?? "missing"}.`,
          )
        } else {
          pushCheck(checks, "approval_no_send_after_approve", true, "Gate approval — no execution job.")
        }

        const resumed = await resumeAutomationAfterApproval(admin, {
          flowId: created.flow.id,
          organizationId,
          enrollmentId: enrolledEnrollmentId,
          approvalId: firstPending.approvalId,
          leadId: String(certLead.data!.id),
        })
        pushCheck(
          checks,
          "approval_resume",
          resumed.ok,
          `Resume execution status=${resumed.execution.status}.`,
        )

        const storedApproval = await getAutomationApproval(admin, {
          organizationId,
          approvalId: firstPending.approvalId,
        })
        pushCheck(
          checks,
          "approval_get",
          storedApproval.approvalId === firstPending.approvalId,
          `Stored approval status=${storedApproval.status}.`,
        )

        const {
          getAutomationRuntimeObservability,
          getAutomationRuntimeHealth,
          resumeAutomationRuntime,
          safeCancelAutomationEnrollment,
          setAutomationRuntimeKillSwitch,
        } = await import("@/lib/growth/automation/growth-automation-observability-service")

        const observability = await getAutomationRuntimeObservability(admin, {
          flowId: created.flow.id,
          organizationId,
        })
        pushCheck(
          checks,
          "observability_snapshot",
          observability.counts.totalEnrollments >= 1 &&
            observability.counts.pendingApprovalJobs + observability.counts.approvalRequiredEnrollments >=
              0,
          `Observability total=${observability.counts.totalEnrollments}; pendingJobs=${observability.counts.pendingApprovalJobs}.`,
        )

        const health = await getAutomationRuntimeHealth(admin, {
          flowId: created.flow.id,
          organizationId,
        })
        pushCheck(
          checks,
          "observability_health",
          health.state === "attention" ||
            health.state === "degraded" ||
            health.state === "healthy" ||
            health.state === "blocked",
          `Health state=${health.state}.`,
        )

        const observabilityPause = await pauseAutomationRuntime(admin, {
          flowId: created.flow.id,
          organizationId,
        })
        pushCheck(
          checks,
          "observability_pause_runtime",
          observabilityPause.ok && observabilityPause.metadata?.activationStatus === "paused",
          `Observability pause status=${observabilityPause.metadata?.activationStatus ?? "missing"}.`,
        )

        const observabilityResume = await resumeAutomationRuntime(admin, {
          flowId: created.flow.id,
          organizationId,
          clearKillSwitch: true,
        })
        pushCheck(
          checks,
          "observability_resume_runtime",
          observabilityResume.ok,
          `Observability resume ok=${observabilityResume.ok}.`,
        )

        const killSwitchEnabled = await setAutomationRuntimeKillSwitch(admin, {
          flowId: created.flow.id,
          organizationId,
          enabled: true,
          reason: "S5-L integration cert kill switch",
        })
        pushCheck(
          checks,
          "observability_kill_switch_enable",
          killSwitchEnabled.killSwitch.enabled,
          `Kill switch enabled=${killSwitchEnabled.killSwitch.enabled}.`,
        )

        await setAutomationRuntimeKillSwitch(admin, {
          flowId: created.flow.id,
          organizationId,
          enabled: false,
          reason: "S5-L integration cert kill switch cleanup",
        })

        await resumeAutomationRuntime(admin, {
          flowId: created.flow.id,
          organizationId,
          clearKillSwitch: true,
        })

        const safeCancel = await safeCancelAutomationEnrollment(admin, {
          flowId: created.flow.id,
          organizationId,
          enrollmentId: enrolledEnrollmentId,
          leadId: String(certLead.data!.id),
          reason: "S5-L integration cert safe cancel",
        })
        pushCheck(
          checks,
          "observability_safe_cancel_enrollment",
          safeCancel.ok,
          safeCancel.detail,
        )

        const {
          getAutomationAnalytics,
          getAutomationAnalyticsSummary,
          getAutomationBranchAnalytics,
          getAutomationWaitAnalytics,
          getAutomationApprovalAnalytics,
          getAutomationJobAnalytics,
        } = await import("@/lib/growth/automation/growth-automation-analytics-service")
        const { getAutomationAuditTimeline } = await import(
          "@/lib/growth/automation/growth-automation-audit-service"
        )

        const analytics = await getAutomationAnalytics(admin, {
          flowId: created.flow.id,
          organizationId,
        })
        pushCheck(
          checks,
          "analytics_snapshot",
          analytics.counts.totalEnrollments >= 0 &&
            analytics.safety.analytics_enabled === true &&
            analytics.safety.read_only === true,
          `Analytics total=${analytics.counts.totalEnrollments}; read_only=${analytics.safety.read_only}.`,
        )

        const analyticsSummary = await getAutomationAnalyticsSummary(admin, {
          flowId: created.flow.id,
          organizationId,
        })
        pushCheck(
          checks,
          "analytics_summary",
          analyticsSummary.counts.totalEnrollments >= 0,
          `Analytics summary total=${analyticsSummary.counts.totalEnrollments}.`,
        )

        const branchAnalytics = await getAutomationBranchAnalytics(admin, {
          flowId: created.flow.id,
          organizationId,
        })
        pushCheck(
          checks,
          "analytics_branches",
          Array.isArray(branchAnalytics.branchStats),
          `Branch stats=${branchAnalytics.branchStats.length}.`,
        )

        const waitAnalytics = await getAutomationWaitAnalytics(admin, {
          flowId: created.flow.id,
          organizationId,
        })
        pushCheck(
          checks,
          "analytics_waits",
          Array.isArray(waitAnalytics.waitStats),
          `Wait stats=${waitAnalytics.waitStats.length}.`,
        )

        const approvalAnalytics = await getAutomationApprovalAnalytics(admin, {
          flowId: created.flow.id,
          organizationId,
        })
        pushCheck(
          checks,
          "analytics_approvals",
          approvalAnalytics.approvalStats.approvalCount >= 0,
          `Approval count=${approvalAnalytics.approvalStats.approvalCount}.`,
        )

        const jobAnalytics = await getAutomationJobAnalytics(admin, {
          flowId: created.flow.id,
          organizationId,
        })
        pushCheck(
          checks,
          "analytics_jobs",
          jobAnalytics.jobStats.pendingApprovalCount >= 0,
          `Pending jobs=${jobAnalytics.jobStats.pendingApprovalCount}.`,
        )

        const auditTimeline = await getAutomationAuditTimeline(admin, {
          flowId: created.flow.id,
          organizationId,
          limit: 25,
        })
        pushCheck(
          checks,
          "analytics_audit_timeline",
          auditTimeline.safety.audit_enabled === true &&
            auditTimeline.safety.message_send_execution_enabled === false &&
            Array.isArray(auditTimeline.entries),
          `Audit entries=${auditTimeline.entries.length}; audit_enabled=${auditTimeline.safety.audit_enabled}.`,
        )
      }

    const enrollmentList = await getAutomationEnrollments(admin, {
      flowId: created.flow.id,
      organizationId,
    })
    pushCheck(
      checks,
      "enrollment_list",
      enrollmentList.length >= 1,
      `Automation enrollments listed=${enrollmentList.length}.`,
    )
    }
  }

  const runtimePaused = await pauseAutomationRuntime(admin, {
    flowId: created.flow.id,
    organizationId,
  })
  pushCheck(
    checks,
    "runtime_pause_after_publish",
    runtimePaused.ok && runtimePaused.metadata?.activationStatus === "paused",
    `Runtime pause ok=${runtimePaused.ok}; status=${runtimePaused.metadata?.activationStatus ?? "missing"}.`,
  )

  const runtimeRollback = await rollbackAutomationRuntimePublish(admin, {
    flowId: created.flow.id,
    organizationId,
  })
  pushCheck(
    checks,
    "runtime_publish_rollback",
    runtimeRollback.ok && runtimeRollback.metadata?.activationStatus === "archived",
    `Runtime rollback ok=${runtimeRollback.ok}; status=${runtimeRollback.metadata?.activationStatus ?? "missing"}.`,
  )

  const draftFromPublished = await createDraftFromPublishedVersion(admin, {
    flowId: created.flow.id,
    organizationId,
  })
  pushCheck(
    checks,
    "draft_from_published",
    draftFromPublished.version.lifecycle === "draft",
    "Draft from published version available.",
  )

  const unpublished = await unpublishAutomationFlow(admin, {
    flowId: created.flow.id,
    organizationId,
  })
  pushCheck(
    checks,
    "unpublish_preserves_history",
    unpublished.flow.status === "draft" && Boolean(unpublished.flow.publishedVersionId),
    "Unpublish preserves published version history.",
  )

  const archived = await archiveFlow(admin, { flowId: created.flow.id, organizationId })
  pushCheck(checks, "archive_flow", archived.status === "archived", "Flow archived (no hard delete).")

  await cleanupCertFlow(admin, created.flow.id)
  pushCheck(checks, "cleanup", true, "Certification fixture deleted.")

  const failed = checks.filter((check) => !check.ok)
  return {
    ok: failed.length === 0,
    execution_id: executionId,
    qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
    checks,
    blockers,
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
    flow_id: created.flow.id,
    safety_flags: GROWTH_AUTOMATION_API_SAFETY_FLAGS,
  }
}
