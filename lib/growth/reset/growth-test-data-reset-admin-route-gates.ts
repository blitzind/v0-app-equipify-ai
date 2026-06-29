/** Growth test data reset — production admin route gates (client-safe, no secrets). */

import {
  GROWTH_RESET_CONFIRM_ENV,
  GROWTH_RESET_CONFIRM_VALUE,
  GROWTH_TEST_DATA_RESET_QA_MARKER,
} from "./growth-test-data-reset-constants"

export const GROWTH_RESET_ADMIN_ROUTE_QA_MARKER = "growth-reset-admin-route-v1" as const

/** Typed confirmation phrase required in the POST body for confirm mode. */
export const GROWTH_RESET_ADMIN_CONFIRM_PHRASE = "RESET_GROWTH_TEST_DATA_NOW" as const

export type GrowthResetAdminRunMode = "dry_run" | "confirm"

export const GROWTH_RESET_ADMIN_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "Uses server-side SUPABASE_SERVICE_ROLE_KEY — never sent to the browser.",
  "Default mode is dry_run (counts + delete preflight only; no writes).",
  "Confirm mode requires GROWTH_RESET_TEST_DATA_CONFIRM=yes on the deployment and the typed confirmation phrase.",
  "Apply migration 20270629123000_growth_reset_service_role_grants.sql before counting tables missing service_role grants.",
] as const

export function isGrowthResetAdminProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === "production"
}

export function assertGrowthResetAdminDryRunAllowed(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (!isGrowthResetAdminProductionRuntime(env)) {
    blockers.push("VERCEL_ENV must be production (Vercel Production deployment only)")
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    blockers.push("NEXT_PUBLIC_SUPABASE_URL must be configured")
  }
  return { ok: blockers.length === 0, blockers }
}

export function assertGrowthResetAdminConfirmAllowed(
  env: NodeJS.ProcessEnv = process.env,
  confirmationPhrase: string | null | undefined,
): { ok: boolean; blockers: string[] } {
  const dryRunGate = assertGrowthResetAdminDryRunAllowed(env)
  const blockers = [...dryRunGate.blockers]

  if (env[GROWTH_RESET_CONFIRM_ENV]?.trim() !== GROWTH_RESET_CONFIRM_VALUE) {
    blockers.push(`${GROWTH_RESET_CONFIRM_ENV} must be ${GROWTH_RESET_CONFIRM_VALUE} on the deployment`)
  }

  if (confirmationPhrase !== GROWTH_RESET_ADMIN_CONFIRM_PHRASE) {
    blockers.push(`confirmation_phrase must exactly match ${GROWTH_RESET_ADMIN_CONFIRM_PHRASE}`)
  }

  return { ok: blockers.length === 0, blockers }
}

export function parseGrowthResetAdminRunMode(body: unknown): GrowthResetAdminRunMode {
  if (body === null || body === undefined || typeof body !== "object") {
    return "dry_run"
  }
  const mode = (body as Record<string, unknown>).mode
  if (mode === "confirm") return "confirm"
  return "dry_run"
}

export function buildGrowthResetAdminReadinessPayload(env: NodeJS.ProcessEnv = process.env) {
  const dryRunGate = assertGrowthResetAdminDryRunAllowed(env)
  const confirmEnvSet = env[GROWTH_RESET_CONFIRM_ENV]?.trim() === GROWTH_RESET_CONFIRM_VALUE

  return {
    qa_marker: GROWTH_RESET_ADMIN_ROUTE_QA_MARKER,
    reset_qa_marker: GROWTH_TEST_DATA_RESET_QA_MARKER,
    production_runtime: isGrowthResetAdminProductionRuntime(env),
    dry_run_allowed: dryRunGate.ok,
    confirm_allowed: dryRunGate.ok && confirmEnvSet,
    confirm_env: GROWTH_RESET_CONFIRM_ENV,
    confirm_env_set: confirmEnvSet,
    confirmation_phrase: GROWTH_RESET_ADMIN_CONFIRM_PHRASE,
    default_mode: "dry_run" as const,
    allowed_modes: ["dry_run", "confirm"] as const,
    checklist: GROWTH_RESET_ADMIN_READINESS_CHECKLIST,
    blockers: dryRunGate.blockers,
  }
}
