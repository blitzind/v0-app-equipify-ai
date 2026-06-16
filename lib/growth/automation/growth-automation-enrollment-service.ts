import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeGrowthActorUserIdForDb } from "@/lib/growth/actor-user-id"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import {
  fetchGrowthSequenceEnrollmentById,
  fetchGrowthSequenceEnrollmentForLeadAndPattern,
  insertGrowthSequenceEnrollment,
  insertGrowthSequenceEnrollmentStep,
  listGrowthSequenceEnrollmentSteps,
  setLeadActiveSequenceEnrollment,
  updateGrowthSequenceEnrollment,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { computeStepExecutionConfidence } from "@/lib/growth/sequence-enrollment/sequence-enrollment-health"
import { getFlow, getFlowGraph } from "@/lib/growth/automation/growth-automation-repository"
import {
  GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER,
  type GrowthAutomationBulkEnrollInput,
  type GrowthAutomationBulkEnrollResult,
  type GrowthAutomationEnrollmentRecord,
  type GrowthAutomationEnrollLeadInput,
  type GrowthAutomationTriggerMatchInput,
} from "@/lib/growth/automation/growth-automation-enrollment-types"
import type { GrowthAutomationValidationIssue } from "@/lib/growth/automation/growth-automation-types"
import {
  automationEnrollmentStatusFromSequenceStatus,
  buildAutomationEnrollmentMetadata,
  enrollmentIssue,
  isSupportedAutomationEnrollmentTrigger,
  mapSequenceEnrollmentToAutomationRecord,
  normalizeAutomationTriggerInput,
  resolvePublishedTriggerFromGraph,
} from "@/lib/growth/automation/growth-automation-enrollment-utils"
import { findMatchingAutomationRuntimes } from "@/lib/growth/automation/growth-automation-trigger-matcher"
import { extractRuntimeMetadata } from "@/lib/growth/automation/growth-automation-runtime-publisher-utils"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/automation/growth-automation-observability-utils"

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 24 * 60 * 60 * 1000).toISOString()
}

async function cancelAutomationSequenceEnrollmentDraft(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    leadId: string
    reason: string
  },
): Promise<void> {
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment || enrollment.leadId !== input.leadId) throw new Error("not_found")
  if (enrollment.status === "completed" || enrollment.status === "cancelled") throw new Error("invalid_status")

  const now = new Date().toISOString()
  await updateGrowthSequenceEnrollment(admin, enrollment.id, {
    status: "cancelled",
    cancelledAt: now,
    cancelledReason: input.reason,
    enrollmentStalled: false,
  })
  await setLeadActiveSequenceEnrollment(admin, input.leadId, null)
}

async function loadActiveRuntimeForFlow(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
) {
  const flow = await getFlow(admin, input)
  const publishedVersionId = flow.publishedVersionId
  if (!publishedVersionId) throw new Error("automation_published_version_missing")

  const publishedGraph = await getFlowGraph(admin, {
    flowId: input.flowId,
    organizationId: input.organizationId,
    versionId: publishedVersionId,
  })

  const metadata = extractRuntimeMetadata(publishedGraph.version.canvasLayoutJson)
  if (!publishedGraph.version.compiledPatternId) throw new Error("runtime_pattern_missing")
  if (metadata?.activationStatus !== "active") throw new Error("runtime_not_active")

  const patternRow = await admin
    .schema("growth")
    .from("sequence_patterns")
    .select("id, key, is_active, sequence_version, metadata")
    .eq("id", publishedGraph.version.compiledPatternId)
    .maybeSingle()

  if (!patternRow.data?.id || !patternRow.data.is_active) throw new Error("pattern_not_active")

  const patterns = await listGrowthSequencePatterns(admin)
  const pattern = patterns.find((entry) => entry.id === publishedGraph.version.compiledPatternId)
  if (!pattern) throw new Error("pattern_not_found")

  return { publishedGraph, metadata, pattern }
}

async function createAutomationSequenceEnrollment(input: {
  admin: SupabaseClient
  leadId: string
  pattern: Awaited<ReturnType<typeof listGrowthSequencePatterns>>[number]
  flowId: string
  versionId: string
  triggerSource: string
  triggerEvent: string | null
  triggerPayload: Record<string, unknown>
  entryReason: string
  actingUserId: string | null
}): Promise<{ enrollmentId: string; entryStepId: string | null }> {
  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) throw new Error("not_found")

  const actingUserId = normalizeGrowthActorUserIdForDb(input.actingUserId)

  const enrollment = await insertGrowthSequenceEnrollment(input.admin, {
    leadId: input.leadId,
    sequencePatternId: input.pattern.id,
    sequenceVersion: input.pattern.sequenceVersion,
    status: "draft",
    createdBy: actingUserId,
    ownerUserId: actingUserId,
  })

  const baseTime = new Date().toISOString()
  let cursor = baseTime
  let entryStepId: string | null = null

  for (const patternStep of [...input.pattern.steps].sort((a, b) => a.stepOrder - b.stepOrder)) {
    if (patternStep.stepOrder > 1) {
      cursor = addDays(cursor, patternStep.delayDaysMin)
    }
    const step = await insertGrowthSequenceEnrollmentStep(input.admin, {
      enrollmentId: enrollment.id,
      leadId: input.leadId,
      sequencePatternStepId: patternStep.id,
      stepOrder: patternStep.stepOrder,
      channel: patternStep.channel,
      generationType: patternStep.generationType,
      voiceDropCampaignId: patternStep.voiceDropCampaignId,
      scheduledFor: cursor,
      stepExecutionConfidence: computeStepExecutionConfidence({ lead, channel: patternStep.channel }),
    })
    if (patternStep.stepOrder === 1) entryStepId = step.id
  }

  await updateGrowthSequenceEnrollment(input.admin, enrollment.id, {
    metadata: buildAutomationEnrollmentMetadata({
      flowId: input.flowId,
      versionId: input.versionId,
      triggerSource: input.triggerSource,
      triggerEvent: input.triggerEvent,
      entryReason: input.entryReason,
      triggerPayload: input.triggerPayload,
    }),
  })

  return { enrollmentId: enrollment.id, entryStepId }
}

export async function enrollLeadIntoAutomationRuntime(
  admin: SupabaseClient,
  input: GrowthAutomationEnrollLeadInput,
): Promise<GrowthAutomationEnrollmentRecord> {
  const now = new Date().toISOString()
  const warnings: GrowthAutomationValidationIssue[] = []
  const errors: GrowthAutomationValidationIssue[] = []
  const { triggerSource, triggerEvent } = normalizeAutomationTriggerInput(input)
  const triggerPayload = input.triggerPayload ?? {}

  if (!isSupportedAutomationEnrollmentTrigger(triggerSource)) {
    return mapSequenceEnrollmentToAutomationRecord({
      enrollmentId: "",
      flowId: input.flowId,
      versionId: "",
      compiledPatternId: "",
      leadId: input.leadId,
      organizationId: input.organizationId,
      triggerSource,
      triggerEvent,
      triggerPayload,
      status: "blocked",
      entryStepId: null,
      entryReason: input.entryReason ?? "Enrollment blocked",
      duplicateEnrollment: false,
      warnings,
      errors: [
        enrollmentIssue("error", "unsupported_trigger", `Unsupported trigger source: ${triggerSource}`),
      ],
      createdAt: now,
      updatedAt: now,
    })
  }

  try {
    const { publishedGraph, metadata, pattern } = await loadActiveRuntimeForFlow(admin, {
      flowId: input.flowId,
      organizationId: input.organizationId,
    })

    if (
      isRuntimeKillSwitchEnabled(metadata) &&
      !(triggerSource === "manual.enrollment" && input.allowReEnrollmentOverride)
    ) {
      return mapSequenceEnrollmentToAutomationRecord({
        enrollmentId: "",
        flowId: input.flowId,
        versionId: publishedGraph.version.id,
        compiledPatternId: publishedGraph.version.compiledPatternId!,
        leadId: input.leadId,
        organizationId: input.organizationId,
        triggerSource,
        triggerEvent,
        triggerPayload,
        status: "blocked",
        entryStepId: null,
        entryReason: "Runtime kill switch is enabled.",
        duplicateEnrollment: false,
        warnings,
        errors: [enrollmentIssue("error", "kill_switch_active", "Runtime kill switch blocks enrollment.")],
        createdAt: now,
        updatedAt: now,
      })
    }

    const publishedTrigger = resolvePublishedTriggerFromGraph({ nodes: publishedGraph.nodes })
    if (
      triggerSource !== "manual.enrollment" &&
      publishedTrigger.triggerSource !== triggerSource &&
      publishedTrigger.triggerEvent !== triggerEvent
    ) {
      return mapSequenceEnrollmentToAutomationRecord({
        enrollmentId: "",
        flowId: input.flowId,
        versionId: publishedGraph.version.id,
        compiledPatternId: publishedGraph.version.compiledPatternId!,
        leadId: input.leadId,
        organizationId: input.organizationId,
        triggerSource,
        triggerEvent,
        triggerPayload,
        status: "blocked",
        entryStepId: null,
        entryReason: input.entryReason ?? "Trigger mismatch",
        duplicateEnrollment: false,
        warnings,
        errors: [enrollmentIssue("error", "trigger_mismatch", "Trigger does not match published runtime.")],
        createdAt: now,
        updatedAt: now,
      })
    }

    const existing = await fetchGrowthSequenceEnrollmentForLeadAndPattern(
      admin,
      input.leadId,
      pattern.id,
    )

    if (existing) {
      if (!input.allowReEnrollmentOverride) {
        return mapSequenceEnrollmentToAutomationRecord({
          enrollmentId: existing.id,
          flowId: input.flowId,
          versionId: publishedGraph.version.id,
          compiledPatternId: pattern.id,
          leadId: input.leadId,
          organizationId: input.organizationId,
          triggerSource,
          triggerEvent,
          triggerPayload,
          status: "duplicate",
          entryStepId: null,
          entryReason: "Active enrollment already exists for this lead and runtime pattern.",
          duplicateEnrollment: true,
          warnings: [
            enrollmentIssue(
              "warning",
              "duplicate_enrollment",
              "Lead already enrolled in this automation runtime.",
            ),
          ],
          errors,
          createdAt: existing.createdAt,
          updatedAt: now,
        })
      }

      await cancelAutomationSequenceEnrollmentDraft(admin, {
        enrollmentId: existing.id,
        leadId: input.leadId,
        reason: `${GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER}: re-enrollment override`,
      })
    }

    const created = await createAutomationSequenceEnrollment({
      admin,
      leadId: input.leadId,
      pattern,
      flowId: input.flowId,
      versionId: publishedGraph.version.id,
      triggerSource,
      triggerEvent,
      triggerPayload,
      entryReason: input.entryReason ?? `Enrolled via ${triggerSource}`,
      actingUserId: input.actingUserId ?? null,
    })

    return mapSequenceEnrollmentToAutomationRecord({
      enrollmentId: created.enrollmentId,
      flowId: input.flowId,
      versionId: publishedGraph.version.id,
      compiledPatternId: pattern.id,
      leadId: input.leadId,
      organizationId: input.organizationId,
      triggerSource,
      triggerEvent,
      triggerPayload,
      status: "enrolled",
      entryStepId: created.entryStepId,
      entryReason: input.entryReason ?? `Enrolled via ${triggerSource}`,
      duplicateEnrollment: false,
      warnings,
      errors,
      createdAt: now,
      updatedAt: now,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "enrollment_failed"
    return mapSequenceEnrollmentToAutomationRecord({
      enrollmentId: "",
      flowId: input.flowId,
      versionId: "",
      compiledPatternId: "",
      leadId: input.leadId,
      organizationId: input.organizationId,
      triggerSource,
      triggerEvent,
      triggerPayload,
      status: automationEnrollmentStatusFromSequenceStatus("draft", false, true),
      entryStepId: null,
      entryReason: input.entryReason ?? "Enrollment failed",
      duplicateEnrollment: false,
      warnings,
      errors: [enrollmentIssue("error", message, message)],
      createdAt: now,
      updatedAt: now,
    })
  }
}

export async function bulkEnrollLeads(
  admin: SupabaseClient,
  input: GrowthAutomationBulkEnrollInput,
): Promise<GrowthAutomationBulkEnrollResult> {
  const enrolled: GrowthAutomationEnrollmentRecord[] = []
  const blocked: GrowthAutomationEnrollmentRecord[] = []
  const duplicates: GrowthAutomationEnrollmentRecord[] = []
  const failed: GrowthAutomationEnrollmentRecord[] = []

  for (const leadId of input.leadIds) {
    const result = await enrollLeadIntoAutomationRuntime(admin, {
      flowId: input.flowId,
      organizationId: input.organizationId,
      leadId,
      triggerSource: input.triggerSource,
      triggerEvent: input.triggerEvent,
      triggerPayload: input.triggerPayload,
      entryReason: input.entryReason,
      allowReEnrollmentOverride: input.allowReEnrollmentOverride,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })

    if (result.status === "enrolled") enrolled.push(result)
    else if (result.status === "duplicate") duplicates.push(result)
    else if (result.status === "blocked") blocked.push(result)
    else failed.push(result)
  }

  return {
    ok: enrolled.length > 0 && failed.length === 0,
    enrolled,
    blocked,
    duplicates,
    failed,
  }
}

export async function cancelEnrollment(
  admin: SupabaseClient,
  input: {
    flowId: string
    organizationId: string
    enrollmentId: string
    leadId: string
    reason?: string
    actingUserId?: string | null
    actingUserEmail?: string | null
  },
): Promise<GrowthAutomationEnrollmentRecord> {
  const now = new Date().toISOString()
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment || enrollment.leadId !== input.leadId) throw new Error("not_found")

  const metadata = enrollment.metadata ?? {}
  if (String(metadata.automation_flow_id ?? "") !== input.flowId) throw new Error("flow_mismatch")

  await cancelAutomationSequenceEnrollmentDraft(admin, {
    enrollmentId: input.enrollmentId,
    leadId: input.leadId,
    reason: input.reason ?? `${GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER}: cancelled`,
  })

  return mapSequenceEnrollmentToAutomationRecord({
    enrollmentId: enrollment.id,
    flowId: input.flowId,
    versionId: String(metadata.automation_version_id ?? ""),
    compiledPatternId: enrollment.sequencePatternId,
    leadId: input.leadId,
    organizationId: input.organizationId,
    triggerSource: String(metadata.trigger_source ?? "manual.enrollment"),
    triggerEvent: typeof metadata.trigger_event === "string" ? metadata.trigger_event : null,
    triggerPayload:
      metadata.trigger_payload && typeof metadata.trigger_payload === "object"
        ? (metadata.trigger_payload as Record<string, unknown>)
        : {},
    status: "cancelled",
    entryStepId: null,
    entryReason: input.reason ?? "Enrollment cancelled",
    duplicateEnrollment: false,
    warnings: [],
    errors: [],
    createdAt: enrollment.createdAt,
    updatedAt: now,
  })
}

async function mapEnrollmentRows(
  admin: SupabaseClient,
  input: {
    rows: Array<Record<string, unknown>>
    organizationId: string
    flowId?: string
  },
): Promise<GrowthAutomationEnrollmentRecord[]> {
  const records: GrowthAutomationEnrollmentRecord[] = []

  for (const row of input.rows) {
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
    const flowId = String(metadata.automation_flow_id ?? "")
    if (input.flowId && flowId !== input.flowId) continue

    const steps = await listGrowthSequenceEnrollmentSteps(admin, String(row.id))
    records.push(
      mapSequenceEnrollmentToAutomationRecord({
        enrollmentId: String(row.id),
        flowId,
        versionId: String(metadata.automation_version_id ?? ""),
        compiledPatternId: String(row.sequence_pattern_id ?? ""),
        leadId: String(row.lead_id ?? ""),
        organizationId: input.organizationId,
        triggerSource: String(metadata.trigger_source ?? "manual.enrollment"),
        triggerEvent: typeof metadata.trigger_event === "string" ? metadata.trigger_event : null,
        triggerPayload:
          metadata.trigger_payload && typeof metadata.trigger_payload === "object"
            ? (metadata.trigger_payload as Record<string, unknown>)
            : {},
        status: automationEnrollmentStatusFromSequenceStatus(String(row.status ?? "draft"), false, false),
        entryStepId: steps[0]?.id ?? null,
        entryReason: String(metadata.entry_reason ?? "Automation enrollment"),
        duplicateEnrollment: false,
        warnings: [],
        errors: [],
        createdAt: String(row.created_at ?? new Date().toISOString()),
        updatedAt: String(row.updated_at ?? new Date().toISOString()),
      }),
    )
  }

  return records
}

export async function getAutomationEnrollments(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<GrowthAutomationEnrollmentRecord[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("*")
    .contains("metadata", { automation_flow_id: input.flowId, qa_marker: GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER })
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return mapEnrollmentRows(admin, {
    rows: (data ?? []) as Array<Record<string, unknown>>,
    organizationId: input.organizationId,
    flowId: input.flowId,
  })
}

export async function getLeadAutomationEnrollments(
  admin: SupabaseClient,
  input: { leadId: string; organizationId: string },
): Promise<GrowthAutomationEnrollmentRecord[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("*")
    .eq("lead_id", input.leadId)
    .contains("metadata", { qa_marker: GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER })
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return mapEnrollmentRows(admin, {
    rows: (data ?? []) as Array<Record<string, unknown>>,
    organizationId: input.organizationId,
  })
}

export { findMatchingAutomationRuntimes }

export type { GrowthAutomationTriggerMatchInput }
