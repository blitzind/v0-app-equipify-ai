/** GE-AVA-LAUNCH-DOWNSTREAM-FAILURE-1 — Preserve downstream launch failure payloads (client-safe). */

export const GROWTH_AVA_LAUNCH_DOWNSTREAM_FAILURE_1_QA_MARKER =
  "ge-ava-launch-downstream-failure-1-v1" as const

export type AvaLaunchRunPropagatedFailureFields = {
  sourceFailure?: Record<string, unknown>
  issues?: unknown
}

export function extractAvaLaunchRunPropagatedFailureFields(
  downstream: Record<string, unknown>,
): AvaLaunchRunPropagatedFailureFields {
  const fields: AvaLaunchRunPropagatedFailureFields = { sourceFailure: downstream }
  if ("issues" in downstream && downstream.issues !== undefined) {
    fields.issues = downstream.issues
  }
  return fields
}

export function mergeAvaLaunchRunServiceFailure<
  T extends { ok: false; error: string; status: number },
>(
  failure: T,
  downstream: Record<string, unknown>,
): T & AvaLaunchRunPropagatedFailureFields {
  return { ...failure, ...extractAvaLaunchRunPropagatedFailureFields(downstream) }
}
