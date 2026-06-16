import { NextResponse } from "next/server"
import {
  GROWTH_AUTOMATION_API_SAFETY_FLAGS,
} from "@/lib/growth/automation/growth-automation-types"
import { GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-compiler-types"
import { GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-simulation-types"
import { GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-publish-types"
import { GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-runtime-artifact-types"
import { GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-runtime-publisher-types"
import { GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-enrollment-types"
import { GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-runtime-execution-types"
import { GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-approval-types"
import { GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-observability-types"
import { GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-analytics-types"

export function automationApiSafetyPayload(): typeof GROWTH_AUTOMATION_API_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_API_SAFETY_FLAGS }
}

export function automationCompileApiSafetyPayload(): typeof GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS }
}

export function automationSimulationApiSafetyPayload(): typeof GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS }
}

export function automationPublishApiSafetyPayload(): typeof GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS }
}

export function automationRuntimeReconciliationApiSafetyPayload(): typeof GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS }
}

export function automationRuntimePublisherApiSafetyPayload(): typeof GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS }
}

export function automationEnrollmentApiSafetyPayload(): typeof GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS }
}

export function automationRuntimeExecutionApiSafetyPayload(): typeof GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS }
}

export function automationApprovalApiSafetyPayload(): typeof GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS }
}

export function automationObservabilityApiSafetyPayload(): typeof GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS }
}

export function automationAnalyticsApiSafetyPayload(): typeof GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS }
}

export function mapAutomationError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "automation_flow_not_found" || message === "automation_node_not_found" || message === "automation_edge_not_found" || message === "automation_version_not_found") {
    return NextResponse.json({ ok: false, error: message }, { status: 404 })
  }
  if (
    message === "organization_scope_mismatch" ||
    message === "automation_flow_archived" ||
    message === "version_not_editable" ||
    message === "version_flow_mismatch"
  ) {
    return NextResponse.json({ ok: false, error: message }, { status: 403 })
  }
  if (message === "invalid_status_transition" || message === "version_not_draft" || message === "invalid_status") {
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
  if (message === "not_found" || message === "approval_not_approved") {
    return NextResponse.json({ ok: false, error: message }, { status: 404 })
  }
  if (message === "flow_mismatch") {
    return NextResponse.json({ ok: false, error: message }, { status: 403 })
  }
  if (message === "flow_not_published" || message === "no_published_version" || message === "runtime_metadata_missing") {
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
  if (message === "published_version_immutable") {
    return NextResponse.json({ ok: false, error: message }, { status: 403 })
  }
  return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
}
