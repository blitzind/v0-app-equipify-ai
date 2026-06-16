/** Growth Engine S2-H — Retell video agent provider foundation certification (client-safe). */

import {
  assertRetellVideoAgentProviderExecutionDisabled,
  cancelRetellVideoAgentProviderSession,
  createRetellVideoAgentProviderSession,
  endRetellVideoAgentProviderSession,
  getRetellVideoAgentProviderCapabilities,
  mapRetellVideoAgentProviderStatusToSessionStatus,
  pollRetellVideoAgentProviderSession,
} from "@/lib/growth/media/providers/retell-video-agent-provider"
import { RETELL_VIDEO_AGENT_PROVIDER_QA_MARKER } from "@/lib/growth/media/providers/retell-video-agent-provider-types"

export type RetellVideoAgentProviderDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type RetellVideoAgentProviderDiagnosticsReport = {
  ok: boolean
  qa_marker: typeof RETELL_VIDEO_AGENT_PROVIDER_QA_MARKER
  checks: RetellVideoAgentProviderDiagnosticsCheck[]
}

function pushCheck(
  checks: RetellVideoAgentProviderDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

function providerExecutionBlocked(error: unknown): boolean {
  return error instanceof Error && error.message === "provider_execution_disabled"
}

export function executeRetellVideoAgentProviderDiagnostics(): RetellVideoAgentProviderDiagnosticsReport {
  const checks: RetellVideoAgentProviderDiagnosticsCheck[] = []

  const capabilities = getRetellVideoAgentProviderCapabilities()
  pushCheck(checks, "provider_capabilities", capabilities.provider === "retell", "Provider identity resolved.")
  pushCheck(
    checks,
    "provider_execution_disabled",
    capabilities.executionEnabled === false &&
      capabilities.supportsWebRtc === false &&
      capabilities.provider_execution_enabled === false &&
      capabilities.autonomous_execution_enabled === false &&
      capabilities.no_conversation_execution === true &&
      capabilities.no_generated_media_assets === true,
    "Provider execution and WebRTC remain disabled.",
  )

  try {
    assertRetellVideoAgentProviderExecutionDisabled()
    pushCheck(checks, "provider_assert_guard", true, "Execution guard passes without provider calls.")
  } catch {
    pushCheck(checks, "provider_assert_guard", false, "Execution guard failed unexpectedly.")
  }

  let createBlocked = false
  try {
    createRetellVideoAgentProviderSession({
      agentId: "retell-agent-jordan-qualifier",
      systemPrompt: "Hi {{prospect.name}}",
    })
  } catch (error) {
    createBlocked = providerExecutionBlocked(error)
  }
  pushCheck(checks, "provider_create_blocked", createBlocked, "createSession blocked without provider execution.")

  let pollBlocked = false
  try {
    pollRetellVideoAgentProviderSession("stub-session-id")
  } catch (error) {
    pollBlocked = providerExecutionBlocked(error)
  }
  pushCheck(checks, "provider_poll_blocked", pollBlocked, "pollSession blocked without provider execution.")

  let endBlocked = false
  try {
    endRetellVideoAgentProviderSession("stub-session-id")
  } catch (error) {
    endBlocked = providerExecutionBlocked(error)
  }
  pushCheck(checks, "provider_end_blocked", endBlocked, "endSession blocked without provider execution.")

  let cancelBlocked = false
  try {
    cancelRetellVideoAgentProviderSession("stub-session-id")
  } catch (error) {
    cancelBlocked = providerExecutionBlocked(error)
  }
  pushCheck(checks, "provider_cancel_blocked", cancelBlocked, "cancelSession blocked without provider execution.")

  pushCheck(
    checks,
    "provider_status_mapping",
    mapRetellVideoAgentProviderStatusToSessionStatus("active") === "active" &&
      mapRetellVideoAgentProviderStatusToSessionStatus("cancelled") === "cancelled",
    "Provider status mapping deterministic.",
  )

  const failed = checks.filter((check) => !check.ok)
  return {
    ok: failed.length === 0,
    qa_marker: RETELL_VIDEO_AGENT_PROVIDER_QA_MARKER,
    checks,
  }
}
