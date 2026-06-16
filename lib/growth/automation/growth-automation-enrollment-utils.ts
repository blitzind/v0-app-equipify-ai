/** Growth Engine S5-I — automation enrollment helpers (client-safe). */

import {
  GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER,
  GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS,
  GROWTH_AUTOMATION_ENROLLMENT_SUPPORTED_TRIGGERS,
  type GrowthAutomationEnrollmentRecord,
  type GrowthAutomationEnrollmentStatus,
  type GrowthAutomationEnrollmentSupportedTrigger,
  type GrowthAutomationRuntimeMatch,
} from "@/lib/growth/automation/growth-automation-enrollment-types"
import { extractRuntimeMetadata } from "@/lib/growth/automation/growth-automation-runtime-publisher-utils"
import type {
  GrowthAutomationFlow,
  GrowthAutomationFlowVersion,
  GrowthAutomationNode,
  GrowthAutomationValidationIssue,
} from "@/lib/growth/automation/growth-automation-types"
import { SEQUENCE_TRIGGER_RUNTIME_EVENT_TO_SOURCE } from "@/lib/growth/sequences/runtime/sequence-trigger-runtime-types"

export function enrollmentIssue(
  severity: GrowthAutomationValidationIssue["severity"],
  ruleCode: string,
  message: string,
): GrowthAutomationValidationIssue {
  return { severity, ruleCode, message, nodeId: null }
}

export function isSupportedAutomationEnrollmentTrigger(
  value: string,
): value is GrowthAutomationEnrollmentSupportedTrigger {
  return (GROWTH_AUTOMATION_ENROLLMENT_SUPPORTED_TRIGGERS as readonly string[]).includes(value)
}

export function normalizeAutomationTriggerInput(input: {
  triggerSource?: string
  triggerEvent?: string | null
}): { triggerSource: string; triggerEvent: string | null } {
  const triggerSource = (input.triggerSource ?? "manual.enrollment").trim()
  const triggerEvent =
    input.triggerEvent?.trim() ||
    (triggerSource === "manual.enrollment" ? null : triggerSource.includes(".") ? triggerSource : null)
  return { triggerSource, triggerEvent }
}

export function resolvePublishedTriggerFromGraph(input: {
  nodes: GrowthAutomationNode[]
}): { triggerSource: string; triggerEvent: string | null } {
  const trigger = input.nodes.find((node) => node.nodeType === "trigger")
  const triggerSource =
    typeof trigger?.configJson.triggerSource === "string"
      ? trigger.configJson.triggerSource.trim()
      : "manual.enrollment"
  return normalizeAutomationTriggerInput({ triggerSource, triggerEvent: triggerSource })
}

export function triggerMatchesRuntimePattern(input: {
  patternTriggerKey: string | null
  requestedTriggerSource: string
  requestedTriggerEvent?: string | null
}): boolean {
  if (!input.patternTriggerKey) return false
  if (input.requestedTriggerSource === "manual.enrollment") {
    return input.patternTriggerKey === "manual.enrollment"
  }
  if (input.patternTriggerKey === input.requestedTriggerSource) return true
  if (input.requestedTriggerEvent && input.patternTriggerKey === input.requestedTriggerEvent) return true
  const mappedSource =
    input.requestedTriggerEvent &&
    (SEQUENCE_TRIGGER_RUNTIME_EVENT_TO_SOURCE as Record<string, string | undefined>)[
      input.requestedTriggerEvent
    ]
  if (mappedSource && input.patternTriggerKey.startsWith(mappedSource)) return true
  return false
}

export function buildAutomationRuntimeMatch(input: {
  flow: GrowthAutomationFlow
  version: GrowthAutomationFlowVersion
  patternKey: string
  patternActive: boolean
  triggerSource: string
  triggerEvent: string | null
}): GrowthAutomationRuntimeMatch | null {
  const metadata = extractRuntimeMetadata(input.version.canvasLayoutJson)
  if (!input.version.compiledPatternId) return null
  if (metadata?.activationStatus !== "active" && !input.patternActive) return null

  return {
    flowId: input.flow.id,
    flowName: input.flow.name,
    versionId: input.version.id,
    compiledPatternId: input.version.compiledPatternId,
    patternKey: input.patternKey,
    triggerSource: input.triggerSource,
    triggerEvent: input.triggerEvent,
    activationStatus: metadata?.activationStatus ?? "published",
    patternActive: input.patternActive,
    entryReason: `Matched ${input.triggerSource} on active automation runtime`,
  }
}

export function mapSequenceEnrollmentToAutomationRecord(input: {
  enrollmentId: string
  flowId: string
  versionId: string
  compiledPatternId: string
  leadId: string
  organizationId: string
  triggerSource: string
  triggerEvent: string | null
  triggerPayload: Record<string, unknown>
  status: GrowthAutomationEnrollmentStatus
  entryStepId: string | null
  entryReason: string
  duplicateEnrollment: boolean
  warnings: GrowthAutomationValidationIssue[]
  errors: GrowthAutomationValidationIssue[]
  createdAt: string
  updatedAt: string
}): GrowthAutomationEnrollmentRecord {
  return {
    enrollmentId: input.enrollmentId,
    flowId: input.flowId,
    versionId: input.versionId,
    compiledPatternId: input.compiledPatternId,
    leadId: input.leadId,
    organizationId: input.organizationId,
    triggerSource: input.triggerSource,
    triggerEvent: input.triggerEvent,
    triggerPayload: input.triggerPayload,
    status: input.status,
    entryStepId: input.entryStepId,
    entryReason: input.entryReason,
    duplicateEnrollment: input.duplicateEnrollment,
    warnings: input.warnings,
    errors: input.errors,
    safety: GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  }
}

export function buildAutomationEnrollmentMetadata(input: {
  flowId: string
  versionId: string
  triggerSource: string
  triggerEvent: string | null
  entryReason: string
  triggerPayload?: Record<string, unknown>
}): Record<string, unknown> {
  return {
    qa_marker: GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER,
    automation_flow_id: input.flowId,
    automation_version_id: input.versionId,
    trigger_source: input.triggerSource,
    trigger_event: input.triggerEvent,
    entry_reason: input.entryReason,
    trigger_payload: input.triggerPayload ?? {},
    execution_enabled: false,
  }
}

export function automationEnrollmentStatusFromSequenceStatus(
  sequenceStatus: string,
  duplicate: boolean,
  blocked: boolean,
): GrowthAutomationEnrollmentStatus {
  if (duplicate) return "duplicate"
  if (blocked) return "blocked"
  if (sequenceStatus === "cancelled") return "cancelled"
  if (sequenceStatus === "completed") return "completed"
  if (sequenceStatus === "draft" || sequenceStatus === "active" || sequenceStatus === "paused") {
    return "enrolled"
  }
  return "failed"
}
