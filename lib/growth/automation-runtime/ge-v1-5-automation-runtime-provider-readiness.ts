/** GE-v1-5 — Provider/runtime readiness probe (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
  GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS,
  GE_V1_5_AUTOMATION_RUNTIME_TRIGGERS,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import { GE_V1_5_BUILTIN_PLAYBOOKS } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-playbooks"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export type GeV15ProviderReadinessReport = {
  qaMarker: typeof GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER
  runtimeEnabled: boolean
  killSwitchEnabled: boolean
  safetyFlags: typeof GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS
  supportedTriggers: typeof GE_V1_5_AUTOMATION_RUNTIME_TRIGGERS
  playbookCount: number
  certPlaybooks: string[]
  humanApprovalRequired: boolean
  outboundSendBlocked: boolean
}

export async function buildGeV15ProviderReadinessReport(
  admin: SupabaseClient,
): Promise<GeV15ProviderReadinessReport> {
  const killSwitchEnabled = await isRuntimeKillSwitchEnabled(admin, "automation_runtime_enabled")

  return {
    qaMarker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
    runtimeEnabled: GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.runtime_enabled && killSwitchEnabled,
    killSwitchEnabled,
    safetyFlags: GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS,
    supportedTriggers: GE_V1_5_AUTOMATION_RUNTIME_TRIGGERS,
    playbookCount: GE_V1_5_BUILTIN_PLAYBOOKS.length,
    certPlaybooks: ["pricing_intent", "video_completion", "booking_completed", "inactivity_follow_up"],
    humanApprovalRequired: GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.human_approval_required,
    outboundSendBlocked: !GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.outbound_send_execution_enabled,
  }
}
