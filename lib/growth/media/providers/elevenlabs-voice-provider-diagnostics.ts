/** Growth Engine S2-G — ElevenLabs voice provider foundation certification (client-safe). */

import {
  assertElevenLabsVoiceProviderExecutionDisabled,
  cancelElevenLabsVoiceProviderJob,
  createElevenLabsVoiceProviderJob,
  getElevenLabsVoiceProviderCapabilities,
  mapElevenLabsVoiceProviderStatusToGenerationStatus,
  pollElevenLabsVoiceProviderJob,
} from "@/lib/growth/media/providers/elevenlabs-voice-provider"
import { ELEVENLABS_VOICE_PROVIDER_QA_MARKER } from "@/lib/growth/media/providers/elevenlabs-voice-provider-types"

export type ElevenLabsVoiceProviderDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type ElevenLabsVoiceProviderDiagnosticsReport = {
  ok: boolean
  qa_marker: typeof ELEVENLABS_VOICE_PROVIDER_QA_MARKER
  checks: ElevenLabsVoiceProviderDiagnosticsCheck[]
}

function pushCheck(
  checks: ElevenLabsVoiceProviderDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

function providerExecutionBlocked(error: unknown): boolean {
  return error instanceof Error && error.message === "provider_execution_disabled"
}

export function executeElevenLabsVoiceProviderDiagnostics(): ElevenLabsVoiceProviderDiagnosticsReport {
  const checks: ElevenLabsVoiceProviderDiagnosticsCheck[] = []

  const capabilities = getElevenLabsVoiceProviderCapabilities()
  pushCheck(checks, "provider_capabilities", capabilities.provider === "elevenlabs", "Provider identity resolved.")
  pushCheck(
    checks,
    "provider_execution_disabled",
    capabilities.executionEnabled === false &&
      capabilities.provider_execution_enabled === false &&
      capabilities.autonomous_execution_enabled === false &&
      capabilities.no_voice_generation_executed === true &&
      capabilities.no_generated_audio_assets === true,
    "Provider execution remains disabled.",
  )

  try {
    assertElevenLabsVoiceProviderExecutionDisabled()
    pushCheck(checks, "provider_assert_guard", true, "Execution guard passes without provider calls.")
  } catch {
    pushCheck(checks, "provider_assert_guard", false, "Execution guard failed unexpectedly.")
  }

  let createBlocked = false
  try {
    createElevenLabsVoiceProviderJob({ voiceId: "elevenlabs-voice-jordan-clone", script: "Hi {{prospect.name}}" })
  } catch (error) {
    createBlocked = providerExecutionBlocked(error)
  }
  pushCheck(checks, "provider_create_blocked", createBlocked, "createJob blocked without provider execution.")

  let pollBlocked = false
  try {
    pollElevenLabsVoiceProviderJob("stub-job-id")
  } catch (error) {
    pollBlocked = providerExecutionBlocked(error)
  }
  pushCheck(checks, "provider_poll_blocked", pollBlocked, "pollJob blocked without provider execution.")

  let cancelBlocked = false
  try {
    cancelElevenLabsVoiceProviderJob("stub-job-id")
  } catch (error) {
    cancelBlocked = providerExecutionBlocked(error)
  }
  pushCheck(checks, "provider_cancel_blocked", cancelBlocked, "cancelJob blocked without provider execution.")

  pushCheck(
    checks,
    "provider_status_mapping",
    mapElevenLabsVoiceProviderStatusToGenerationStatus("processing") === "processing" &&
      mapElevenLabsVoiceProviderStatusToGenerationStatus("cancelled") === "cancelled",
    "Provider status mapping deterministic.",
  )

  const failed = checks.filter((check) => !check.ok)
  return {
    ok: failed.length === 0,
    qa_marker: ELEVENLABS_VOICE_PROVIDER_QA_MARKER,
    checks,
  }
}
