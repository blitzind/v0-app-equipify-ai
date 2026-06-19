/** CALLS-OPS-1 — operator workflow types (client-safe). */

import type { NativeDialerQueueMode } from "@/lib/growth/native-dialer/native-dialer-types"

export const GROWTH_CALL_WORKSPACE_OPS_QA_MARKER = "growth-call-workspace-ops-v1" as const

export const CALL_WORKSPACE_POWER_DIAL_SETTINGS_STORAGE_KEY =
  "growth-call-workspace-power-dial-settings-v1" as const

export type QueuePreviewState = {
  queueItemId?: string
  leadId?: string
  company?: string
  contact?: string
  phone?: string
  queueMode?: NativeDialerQueueMode
  reason?: string
}

export type CallWorkspacePowerDialSettings = {
  powerDialAutoAdvance: boolean
  powerDialAutoDialDelayMs: number
}

export const DEFAULT_CALL_WORKSPACE_POWER_DIAL_SETTINGS: CallWorkspacePowerDialSettings = {
  powerDialAutoAdvance: true,
  powerDialAutoDialDelayMs: 3000,
}

export type CallWorkspaceQueueAction = "preview" | "skip" | "snooze" | "complete"
