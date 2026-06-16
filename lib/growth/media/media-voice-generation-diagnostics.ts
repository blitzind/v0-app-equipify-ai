/** Growth Engine S2-G — in-memory voice generation certification (no DB, no provider execution). */

import { randomUUID } from "node:crypto"
import { validateMediaVoiceId } from "@/lib/growth/media/media-voice-types"
import {
  cancelGeneration,
  createGenerationRequest,
  getGenerationStatus,
  queueGeneration,
  resetMediaVoiceGenerationStoreForCert,
} from "@/lib/growth/media/media-voice-generation-service"
import {
  GROWTH_MEDIA_VOICE_GENERATION_QA_MARKER,
  GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS,
} from "@/lib/growth/media/media-voice-generation-types"
import { buildPersonalizedVoiceScriptPreview } from "@/lib/growth/media/media-voice-generation-utils"
import { executeElevenLabsVoiceProviderDiagnostics } from "@/lib/growth/media/providers/elevenlabs-voice-provider-diagnostics"

export type GrowthMediaVoiceGenerationDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthMediaVoiceGenerationDiagnosticsReport = {
  ok: boolean
  qa_marker: typeof GROWTH_MEDIA_VOICE_GENERATION_QA_MARKER
  checks: GrowthMediaVoiceGenerationDiagnosticsCheck[]
  final_verdict: "PASS" | "FAIL"
} & typeof GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS

function pushCheck(
  checks: GrowthMediaVoiceGenerationDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

export function executeGrowthMediaVoiceGenerationDiagnostics(input: {
  organizationId: string
}): GrowthMediaVoiceGenerationDiagnosticsReport {
  const checks: GrowthMediaVoiceGenerationDiagnosticsCheck[] = []
  resetMediaVoiceGenerationStoreForCert()

  pushCheck(
    checks,
    "generation_safety_flags",
    GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.provider_execution_enabled === false &&
      GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.autonomous_execution_enabled === false &&
      GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.no_voice_generation_executed === true &&
      GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.no_generated_audio_assets === true &&
      GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.no_playback === true &&
      GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.no_notifications === true &&
      GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.no_sequence_execution === true,
    "Voice generation safety flags enforced.",
  )

  pushCheck(
    checks,
    "voice_catalog_validation",
    validateMediaVoiceId("elevenlabs-voice-jordan-clone") && !validateMediaVoiceId("invalid-voice"),
    "Voice metadata validation deterministic.",
  )

  const preview = buildPersonalizedVoiceScriptPreview({
    scriptTemplate: "Hi {{prospect.name}}, quick note from {{sender.name}} at {{sender.company}}.",
    personalizationContext: {
      prospectName: "Alex Rivera",
      senderName: "Jordan Lee",
      senderCompany: "Equipify",
    },
  })
  pushCheck(
    checks,
    "script_merge_resolution",
    preview.resolvedScript.includes("Alex Rivera") && preview.resolvedScript.includes("Jordan Lee"),
    "Voice script merge resolution works.",
  )

  const providerReport = executeElevenLabsVoiceProviderDiagnostics()
  pushCheck(
    checks,
    "provider_abstraction",
    providerReport.ok,
    "ElevenLabs voice provider abstraction loads with execution disabled.",
  )

  const created = createGenerationRequest({
    organizationId: input.organizationId,
    templateAssetId: null,
    voiceId: "elevenlabs-voice-jordan-clone",
    scriptTemplate: "Hi {{prospect.name}}",
    personalizationContext: { prospectName: "Alex Rivera" },
  })
  pushCheck(checks, "generation_create_draft", created.status === "draft", "Generation request created as draft.")
  pushCheck(checks, "generation_no_output_asset", created.outputAssetId == null, "No output audio asset created.")

  const queued = queueGeneration(created.generationId)
  pushCheck(
    checks,
    "generation_queue_local",
    queued.status === "queued" && queued.providerJobId == null,
    "Queue transition local-only (no provider job id).",
  )

  const cancelled = cancelGeneration(created.generationId, input.organizationId)
  pushCheck(checks, "generation_cancel", cancelled.status === "cancelled", "Cancellation state machine works.")

  const orgScoped = getGenerationStatus(created.generationId, input.organizationId)
  pushCheck(checks, "generation_status_read", orgScoped.status === "cancelled", "Status read after cancel.")

  let wrongOrgBlocked = false
  try {
    getGenerationStatus(created.generationId, randomUUID())
  } catch (error) {
    wrongOrgBlocked = error instanceof Error && error.message === "organization_scope_mismatch"
  }
  pushCheck(checks, "generation_org_scope", wrongOrgBlocked, "Organization scope enforced on status read.")

  resetMediaVoiceGenerationStoreForCert()
  pushCheck(checks, "generation_cleanup", true, "In-memory voice generation fixtures cleared.")

  const failed = checks.filter((check) => !check.ok)
  return {
    ok: failed.length === 0,
    qa_marker: GROWTH_MEDIA_VOICE_GENERATION_QA_MARKER,
    checks,
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
    ...GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS,
  }
}
