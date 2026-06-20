import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES,
  GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
  type GrowthRuntimeKillSwitchKey,
} from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { probeRuntimeTable } from "@/lib/growth/runtime-guardrails/growth-runtime-schema-probe"

function settingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("runtime_guardrail_settings")
}

export async function isRuntimeKillSwitchEnabled(
  admin: SupabaseClient,
  key: GrowthRuntimeKillSwitchKey,
): Promise<boolean> {
  const probe = await probeRuntimeTable(admin, "runtime_guardrail_settings")
  if (probe.missing) return GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES[key]

  const { data, error } = await settingsTable(admin).select("enabled").eq("key", key).maybeSingle()
  if (error || !data) return GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES[key]
  return Boolean((data as { enabled: boolean }).enabled)
}

export async function getRuntimeKillSwitchStates(
  admin: SupabaseClient,
): Promise<Record<GrowthRuntimeKillSwitchKey, boolean>> {
  const keys = Object.keys(GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES) as GrowthRuntimeKillSwitchKey[]
  const probe = await probeRuntimeTable(admin, "runtime_guardrail_settings")
  if (probe.missing) return { ...GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES }

  const { data, error } = await settingsTable(admin).select("key, enabled").in("key", keys)
  if (error) return { ...GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES }

  const result = { ...GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES }
  for (const row of data ?? []) {
    const key = String((row as { key: string }).key) as GrowthRuntimeKillSwitchKey
    if (key in result) {
      result[key] = Boolean((row as { enabled: boolean }).enabled)
    }
  }
  return result
}

export async function setRuntimeKillSwitch(
  admin: SupabaseClient,
  input: { key: GrowthRuntimeKillSwitchKey; enabled: boolean },
): Promise<void> {
  const { error } = await settingsTable(admin).upsert(
    {
      key: input.key,
      enabled: input.enabled,
      qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  )
  if (error) throw new Error(error.message)
}

/** Convenience alias for wake engine kill switch. */
export async function isWakeExecutionEnabled(admin: SupabaseClient): Promise<boolean> {
  return isRuntimeKillSwitchEnabled(admin, "wake_execution_enabled")
}
