/** Growth Engine S2-F — ElevenLabs provider foundation certification (client-safe). */

import {
  assertElevenLabsProviderExecutionDisabled,
  cancelElevenLabsVideoProviderJob,
  createElevenLabsVideoProviderJob,
  getElevenLabsVideoProviderCapabilities,
  mapElevenLabsProviderStatusToGenerationStatus,
  pollElevenLabsVideoProviderJob,
} from "@/lib/growth/media/providers/elevenlabs-video-provider"
import { ELEVENLABS_VIDEO_PROVIDER_QA_MARKER } from "@/lib/growth/media/providers/elevenlabs-video-provider-types"

export type ElevenLabsVideoProviderDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type ElevenLabsVideoProviderDiagnosticsReport = {
  ok: boolean
  qa_marker: typeof ELEVENLABS_VIDEO_PROVIDER_QA_MARKER
  checks: ElevenLabsVideoProviderDiagnosticsCheck[]
}

function pushCheck(
  checks: ElevenLabsVideoProviderDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

function providerExecutionBlocked(error: unknown): boolean {
  return error instanceof Error && error.message === "provider_execution_disabled"
}

export function executeElevenLabsVideoProviderDiagnostics(): ElevenLabsVideoProviderDiagnosticsReport {
  const checks: ElevenLabsVideoProviderDiagnosticsCheck[] = []

  const capabilities = getElevenLabsVideoProviderCapabilities()
  pushCheck(checks, "provider_capabilities", capabilities.provider === "elevenlabs", "Provider identity resolved.")
  pushCheck(
    checks,
    "provider_execution_disabled",
    capabilities.executionEnabled === false &&
      capabilities.provider_execution_enabled === false &&
      capabilities.autonomous_execution_enabled === false &&
      capabilities.no_video_generation_executed === true,
    "Provider execution remains disabled.",
  )

  try {
    assertElevenLabsProviderExecutionDisabled()
    pushCheck(checks, "provider_assert_guard", true, "Execution guard passes without provider calls.")
  } catch {
    pushCheck(checks, "provider_assert_guard", false, "Execution guard failed unexpectedly.")
  }

  let createBlocked = false
  try {
    createElevenLabsVideoProviderJob({ avatarId: "elevenlabs-avatar-jordan", script: "Hi {{prospect.name}}" })
  } catch (error) {
    createBlocked = providerExecutionBlocked(error)
  }
  pushCheck(checks, "provider_create_blocked", createBlocked, "createJob blocked without provider execution.")

  let pollBlocked = false
  try {
    pollElevenLabsVideoProviderJob("stub-job-id")
  } catch (error) {
    pollBlocked = providerExecutionBlocked(error)
  }
  pushCheck(checks, "provider_poll_blocked", pollBlocked, "pollJob blocked without provider execution.")

  let cancelBlocked = false
  try {
    cancelElevenLabsVideoProviderJob("stub-job-id")
  } catch (error) {
    cancelBlocked = providerExecutionBlocked(error)
  }
  pushCheck(checks, "provider_cancel_blocked", cancelBlocked, "cancelJob blocked without provider execution.")

  pushCheck(
    checks,
    "provider_status_mapping",
    mapElevenLabsProviderStatusToGenerationStatus("processing") === "processing" &&
      mapElevenLabsProviderStatusToGenerationStatus("cancelled") === "cancelled",
    "Provider status mapping deterministic.",
  )

  const failed = checks.filter((check) => !check.ok)
  return {
    ok: failed.length === 0,
    qa_marker: ELEVENLABS_VIDEO_PROVIDER_QA_MARKER,
    checks,
  }
}
