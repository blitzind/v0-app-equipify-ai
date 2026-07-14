/** GE-AIOS-CALL-WORKSPACE-INTELLIGENCE-2B — Stable closure fingerprints for idempotent completion. */

import {
  GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_SOURCE_SYSTEM,
} from "@/lib/growth/operator-assist/call-workspace-post-call-closure-types"

export function buildCallWorkspaceClosureFingerprint(input: {
  organizationId: string
  leadId: string
  sessionId: string
  completionVersion?: number
}): string {
  const version = input.completionVersion ?? 1
  return `${GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_SOURCE_SYSTEM}:${input.organizationId}:${input.leadId}:${input.sessionId}:v${version}`
}

export const CALL_WORKSPACE_CLOSURE_FINGERPRINT_METADATA_KEY = "call_workspace_closure_fingerprint" as const
