/** CALLS-OPS-1 — client-side power dial operator preferences (no migration). */

import {
  CALL_WORKSPACE_POWER_DIAL_SETTINGS_STORAGE_KEY,
  DEFAULT_CALL_WORKSPACE_POWER_DIAL_SETTINGS,
  type CallWorkspacePowerDialSettings,
} from "@/lib/growth/native-dialer/call-workspace-operator-types"

export function readCallWorkspacePowerDialSettings(): CallWorkspacePowerDialSettings {
  if (typeof window === "undefined") return DEFAULT_CALL_WORKSPACE_POWER_DIAL_SETTINGS
  try {
    const raw = window.localStorage.getItem(CALL_WORKSPACE_POWER_DIAL_SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_CALL_WORKSPACE_POWER_DIAL_SETTINGS
    const parsed = JSON.parse(raw) as Partial<CallWorkspacePowerDialSettings>
    return {
      powerDialAutoAdvance:
        typeof parsed.powerDialAutoAdvance === "boolean"
          ? parsed.powerDialAutoAdvance
          : DEFAULT_CALL_WORKSPACE_POWER_DIAL_SETTINGS.powerDialAutoAdvance,
      powerDialAutoDialDelayMs:
        typeof parsed.powerDialAutoDialDelayMs === "number" && parsed.powerDialAutoDialDelayMs >= 0
          ? parsed.powerDialAutoDialDelayMs
          : DEFAULT_CALL_WORKSPACE_POWER_DIAL_SETTINGS.powerDialAutoDialDelayMs,
    }
  } catch {
    return DEFAULT_CALL_WORKSPACE_POWER_DIAL_SETTINGS
  }
}

export function writeCallWorkspacePowerDialSettings(settings: CallWorkspacePowerDialSettings): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CALL_WORKSPACE_POWER_DIAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}
