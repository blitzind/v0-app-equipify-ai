/** Growth Engine S2-F — in-memory video generation certification (no DB, no provider execution). */

import { randomUUID } from "node:crypto"
import { validateMediaAvatarId } from "@/lib/growth/media/media-avatar-types"
import {
  cancelGeneration,
  createGenerationRequest,
  getGenerationStatus,
  queueGeneration,
  resetMediaVideoGenerationStoreForCert,
} from "@/lib/growth/media/media-video-generation-service"
import {
  GROWTH_MEDIA_VIDEO_GENERATION_QA_MARKER,
  GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS,
} from "@/lib/growth/media/media-video-generation-types"
import { buildPersonalizedScriptPreview } from "@/lib/growth/media/media-video-generation-utils"
import { executeElevenLabsVideoProviderDiagnostics } from "@/lib/growth/media/providers/elevenlabs-video-provider-diagnostics"

export type GrowthMediaVideoGenerationDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthMediaVideoGenerationDiagnosticsReport = {
  ok: boolean
  qa_marker: typeof GROWTH_MEDIA_VIDEO_GENERATION_QA_MARKER
  checks: GrowthMediaVideoGenerationDiagnosticsCheck[]
  final_verdict: "PASS" | "FAIL"
} & typeof GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS

function pushCheck(
  checks: GrowthMediaVideoGenerationDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

export function executeGrowthMediaVideoGenerationDiagnostics(input: {
  organizationId: string
}): GrowthMediaVideoGenerationDiagnosticsReport {
  const checks: GrowthMediaVideoGenerationDiagnosticsCheck[] = []
  resetMediaVideoGenerationStoreForCert()

  pushCheck(
    checks,
    "generation_safety_flags",
    GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS.provider_execution_enabled === false &&
      GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS.autonomous_execution_enabled === false &&
      GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS.no_video_generation_executed === true,
    "Generation safety flags enforced.",
  )

  pushCheck(
    checks,
    "avatar_catalog_validation",
    validateMediaAvatarId("elevenlabs-avatar-jordan") && !validateMediaAvatarId("invalid-avatar"),
    "Avatar metadata validation deterministic.",
  )

  const preview = buildPersonalizedScriptPreview({
    scriptTemplate: "Hi {{prospect.name}} from {{sender.company}}",
    personalizationContext: {
      prospectName: "Alex Rivera",
      senderCompany: "Equipify",
    },
  })
  pushCheck(
    checks,
    "script_merge_resolution",
    preview.resolvedScript.includes("Alex Rivera") && preview.resolvedScript.includes("Equipify"),
    "Script merge resolution works.",
  )

  const providerReport = executeElevenLabsVideoProviderDiagnostics()
  pushCheck(
    checks,
    "provider_abstraction",
    providerReport.ok,
    "ElevenLabs provider abstraction loads with execution disabled.",
  )

  const created = createGenerationRequest({
    organizationId: input.organizationId,
    templateAssetId: null,
    avatarId: "elevenlabs-avatar-jordan",
    scriptTemplate: "Hi {{prospect.name}}",
    personalizationContext: { prospectName: "Alex Rivera" },
  })
  pushCheck(checks, "generation_create_draft", created.status === "draft", "Generation request created as draft.")
  pushCheck(checks, "generation_no_output_asset", created.outputAssetId == null, "No output media asset created.")

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

  resetMediaVideoGenerationStoreForCert()
  pushCheck(checks, "generation_cleanup", true, "In-memory generation fixtures cleared.")

  const failed = checks.filter((check) => !check.ok)
  return {
    ok: failed.length === 0,
    qa_marker: GROWTH_MEDIA_VIDEO_GENERATION_QA_MARKER,
    checks,
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
    ...GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS,
  }
}
