import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getPlatformRuntimeKillSwitchStates,
  isPlatformRuntimeKillSwitchEnabled,
  isPlatformWakeExecutionEnabled,
  setPlatformRuntimeKillSwitch,
} from "@fuzor/configuration"

import type { GrowthRuntimeKillSwitchKey } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

export async function isRuntimeKillSwitchEnabled(
  admin: SupabaseClient,
  key: GrowthRuntimeKillSwitchKey,
): Promise<boolean> {
  return isPlatformRuntimeKillSwitchEnabled(admin, key)
}

export async function getRuntimeKillSwitchStates(
  admin: SupabaseClient,
): Promise<Record<GrowthRuntimeKillSwitchKey, boolean>> {
  return getPlatformRuntimeKillSwitchStates(admin)
}

export async function setRuntimeKillSwitch(
  admin: SupabaseClient,
  input: { key: GrowthRuntimeKillSwitchKey; enabled: boolean },
): Promise<void> {
  return setPlatformRuntimeKillSwitch(admin, input)
}

/** Convenience alias for wake engine kill switch. */
export async function isWakeExecutionEnabled(admin: SupabaseClient): Promise<boolean> {
  return isPlatformWakeExecutionEnabled(admin)
}
