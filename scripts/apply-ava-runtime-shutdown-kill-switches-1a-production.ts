/**
 * AVA RUNTIME SHUTDOWN — set platform autonomy kill switches to safe state.
 *
 * Dry-run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/apply-ava-runtime-shutdown-kill-switches-1a-production.ts
 *
 * Apply:
 *   CONFIRM_AVA_RUNTIME_SHUTDOWN_KILL_SWITCHES_1A=1 node -r ./scripts/server-only-shim.cjs --import tsx scripts/apply-ava-runtime-shutdown-kill-switches-1a-production.ts -- --apply
 */
import { createClient } from "@supabase/supabase-js"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"
import {
  getRuntimeKillSwitchStates,
  setRuntimeKillSwitch,
} from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export const CONFIRM_AVA_RUNTIME_SHUTDOWN_KILL_SWITCHES_1A =
  "CONFIRM_AVA_RUNTIME_SHUTDOWN_KILL_SWITCHES_1A" as const

const TARGET_SWITCHES = {
  autonomy_enabled: false,
  autonomy_outbound_enabled: false,
  autonomy_objective_mode_enabled: false,
} as const

function wantsApply(argv: string[]): boolean {
  return argv.includes("--apply")
}

async function main(): Promise<void> {
  const apply = wantsApply(process.argv.slice(2))
  const projectRef = resolveLinkedSupabaseProjectRef()
  if (!projectRef) throw new Error("linked_supabase_project_ref_missing")
  const jwt = fetchSupabaseServiceRoleKeyFromCli(projectRef)
  if (!jwt) throw new Error("supabase_service_role_key_unavailable")
  const admin = createClient(resolveSupabaseUrlForProjectRef(projectRef), jwt, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const before = await getRuntimeKillSwitchStates(admin)
  const changes: string[] = []

  for (const [key, desired] of Object.entries(TARGET_SWITCHES)) {
    const current = before[key as keyof typeof TARGET_SWITCHES]
    if (current !== desired) {
      changes.push(`${key}: ${current} → ${desired}`)
      if (apply) {
        await setRuntimeKillSwitch(admin, {
          key: key as keyof typeof TARGET_SWITCHES,
          enabled: desired,
        })
      }
    }
  }

  const after = apply ? await getRuntimeKillSwitchStates(admin) : before

  console.log(
    JSON.stringify(
      {
        phase: "AVA_RUNTIME_SHUTDOWN_KILL_SWITCHES",
        apply,
        before: {
          autonomy_enabled: before.autonomy_enabled,
          autonomy_outbound_enabled: before.autonomy_outbound_enabled,
          autonomy_objective_mode_enabled: before.autonomy_objective_mode_enabled,
        },
        after: {
          autonomy_enabled: after.autonomy_enabled,
          autonomy_outbound_enabled: after.autonomy_outbound_enabled,
          autonomy_objective_mode_enabled: after.autonomy_objective_mode_enabled,
        },
        changes,
      },
      null,
      2,
    ),
  )

  if (changes.length > 0 && !apply) {
    console.error(
      `\nDry-run only. Re-run with CONFIRM_AVA_RUNTIME_SHUTDOWN_KILL_SWITCHES_1A=1 and --apply to write.`,
    )
    process.exit(2)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
