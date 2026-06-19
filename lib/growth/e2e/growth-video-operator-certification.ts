/** Growth Engine E1 — Video operator end-to-end certification (server-only). */

import "server-only"

import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getElevenLabsGrowthAvatarProviderCapabilities,
  resetElevenLabsGrowthAvatarProviderStateForCert,
} from "@/lib/growth/media/providers/elevenlabs-growth-avatar-provider"
import {
  getElevenLabsGrowthVoiceProviderCapabilities,
  resetElevenLabsGrowthVoiceProviderStateForCert,
} from "@/lib/growth/media/providers/elevenlabs-growth-voice-provider"
import {
  getRetellGrowthAvatarProviderCapabilities,
  resetRetellGrowthAvatarProviderStateForCert,
} from "@/lib/growth/media/providers/retell-growth-avatar-provider"
import { buildAvatarVideoStoragePath } from "@/lib/growth/media/growth-media-video-writeback-service"
import { buildVoiceoverStoragePath } from "@/lib/growth/media/growth-media-audio-writeback-service"
import { probeGrowthMediaGenerationRunsSchema } from "@/lib/growth/media/growth-media-generation-schema-health"
import {
  buildGrowthVideoOperatorCheck,
  buildGrowthVideoOperatorReport,
  buildGrowthVideoOperatorScenarioResult,
  GROWTH_VIDEO_OPERATOR_CERT_CONFIRM,
  GROWTH_VIDEO_OPERATOR_CERT_QA_MARKER,
  type GrowthVideoOperatorCertificationReport,
  type GrowthVideoOperatorCheckResult,
  type GrowthVideoOperatorScenarioResult,
} from "@/lib/growth/e2e/growth-video-operator-report"
import { runGrowthVideoFoundationAudit } from "@/lib/growth/e2e/growth-video-foundation-audit"
import {
  buildGrowthVideoIntelligenceMetrics,
  deriveGrowthVideoIntelligenceSignals,
  mapGrowthVideoSignalsToNbaSuggestions,
  buildGrowthVideoOpportunitySignals,
  buildGrowthVideoCallWorkspaceContext,
  buildGrowthVideoMeetingPrepContext,
  buildGrowthVideoRelationshipContext,
} from "@/lib/growth/sequences/growth-sequence-video-intelligence-mappings"
import { mapSequenceVideoAttachmentRow } from "@/lib/growth/sequences/growth-sequence-video-attachment-service"
import { buildSequenceVideoChannelPreviewFromRender } from "@/lib/growth/sequences/growth-sequence-video-send-render"
import { buildSequenceVideoAttachmentAnalyticsHooks } from "@/lib/growth/sequences/growth-sequence-video-preview-service"
import { probeSequenceVideoAttachmentsSchema } from "@/lib/growth/sequences/growth-sequence-video-attachment-schema-health"
import {
  computeGrowthVideoEngagementScore,
  rollupGrowthVideoPageEventsBySession,
} from "@/lib/growth/videos/growth-video-engagement-scoring-service"
import {
  buildGrowthVideoPreviewFormMergeValues,
  renderGrowthVideoPreviewText,
} from "@/lib/growth/videos/growth-video-preview-render-service"
import { previewGrowthVideoThumbnail } from "@/lib/growth/videos/growth-video-thumbnail-preview-service"
import {
  appendGrowthVideoScriptVersion,
  emptyGrowthVideoScriptMetadata,
  parseGrowthVideoScriptMetadata,
} from "@/lib/growth/videos/growth-video-script-version-service"
import {
  buildDeterministicGrowthVideoScript,
  previewGrowthVideoScriptContext,
} from "@/lib/growth/videos/growth-video-script-preview-service"
import {
  isGrowthVideoPageEventsSchemaReady,
  probeGrowthVideoFoundationSchema,
} from "@/lib/growth/videos/growth-video-schema-health"
import {
  resolveGrowthVideoVariableAlias,
} from "@/lib/growth/videos/growth-video-variable-alias-service"
import {
  GROWTH_VIDEOS_STORAGE_BUCKET,
} from "@/lib/growth/videos/growth-video-types"

export {
  GROWTH_VIDEO_OPERATOR_CERT_CONFIRM,
  GROWTH_VIDEO_OPERATOR_CERT_QA_MARKER,
} from "@/lib/growth/e2e/growth-video-operator-report"

const UNTOUCHED_EXECUTION = [
  "lib/growth/sequences/execution/sequence-job-runner.ts",
  "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
] as const

const E1_REQUIRED_MODULES = [
  "lib/growth/videos/growth-video-upload-service.ts",
  "lib/growth/videos/growth-video-page-service.ts",
  "lib/growth/videos/growth-video-personalization-service.ts",
  "lib/growth/videos/growth-video-thumbnail-preview-service.ts",
  "lib/growth/videos/growth-video-script-version-service.ts",
  "lib/growth/media/growth-ai-voice-generation-service.ts",
  "lib/growth/media/growth-ai-avatar-generation-service.ts",
  "lib/growth/sequences/growth-sequence-video-attachment-service.ts",
  "lib/growth/sequences/growth-sequence-video-send-builder-service.ts",
  "lib/growth/videos/growth-video-analytics-summary-service.ts",
  "lib/growth/sequences/growth-sequence-video-intelligence-service.ts",
] as const

function fileExists(relativePath: string, cwd = process.cwd()): boolean {
  return fs.existsSync(path.join(cwd, relativePath))
}

function readSource(relativePath: string, cwd = process.cwd()): string {
  return fs.readFileSync(path.join(cwd, relativePath), "utf8")
}

function sourceMatches(relativePath: string, pattern: RegExp): boolean {
  return pattern.test(readSource(relativePath))
}

function assertExecutionIsolation(cwd = process.cwd()): GrowthVideoOperatorCheckResult[] {
  const checks: GrowthVideoOperatorCheckResult[] = []
  for (const relativePath of UNTOUCHED_EXECUTION) {
    const source = readSource(relativePath, cwd)
    checks.push(
      buildGrowthVideoOperatorCheck({
        id: `execution_isolation_${relativePath.replace(/[/.]/g, "_")}`,
        label: `${relativePath} unchanged by video pipeline`,
        pass:
          !source.includes("syncGrowthVideoEngagementIntelligence") &&
          !source.includes("processGrowthVideoPageEventIntelligence") &&
          !source.includes("buildSequenceVideoEngagementSignals") &&
          !source.includes("insertGrowthSequenceEnrollment"),
        rootCause: "Sequence execution runner references video operator automation.",
        recommendedFix: "Remove execution hooks — E1 is metadata-only.",
        blockingSeverity: "critical",
      }),
    )
  }
  return checks
}

function runScenario1UploadPublish(cwd = process.cwd()): GrowthVideoOperatorScenarioResult {
  const checks: GrowthVideoOperatorCheckResult[] = [...runHarnessPreflight(cwd)]

  for (const relativePath of [
    "lib/growth/videos/growth-video-upload-service.ts",
    "lib/growth/videos/growth-video-service.ts",
    "lib/growth/videos/growth-video-page-service.ts",
    "lib/growth/videos/growth-video-public-page-service.ts",
  ]) {
    checks.push(
      buildGrowthVideoOperatorCheck({
        id: `module_${relativePath.replace(/[/.]/g, "_")}`,
        label: `${relativePath} exists`,
        pass: fileExists(relativePath, cwd),
        recommendedFix: `Restore missing module ${relativePath}.`,
        blockingSeverity: "high",
      }),
    )
  }

  checks.push(
    buildGrowthVideoOperatorCheck({
      id: "upload_service_video_assets_row",
      label: "Upload service creates video asset records via growth-video-service",
      pass:
        sourceMatches("lib/growth/videos/growth-video-upload-service.ts", /createGrowthVideoUploadAsset/) &&
        sourceMatches("lib/growth/videos/growth-video-upload-service.ts", /createAsset/),
      recommendedFix: "Wire upload service to growth.video_assets insert path.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "page_service_video_pages_row",
      label: "Page service writes growth.video_pages rows",
      pass: sourceMatches("lib/growth/videos/growth-video-page-service.ts", /video_pages/),
      recommendedFix: "Wire page service to growth.video_pages insert path.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "page_service_public_slug",
      label: "Page service assigns public slug",
      pass: sourceMatches("lib/growth/videos/growth-video-page-service.ts", /slug/),
      recommendedFix: "Ensure slug generation on page publish.",
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "storage_signed_url",
      label: "Storage provider exposes signed URL creation",
      pass:
        sourceMatches("lib/growth/videos/providers/supabase-video-storage-provider.ts", /createSignedUrl|signedUrl/) ||
        sourceMatches("lib/growth/videos/growth-video-storage-service.ts", /signed/i),
      recommendedFix: "Verify Supabase storage signed URL helper for video assets.",
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "public_page_publish",
      label: "Public page service resolves published pages",
      pass:
        sourceMatches("lib/growth/videos/growth-video-public-page-service.ts", /published/) &&
        sourceMatches("lib/growth/videos/growth-video-public-page-service.ts", /slug/),
      recommendedFix: "Ensure published page lookup by slug is wired.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "storage_bucket",
      label: `Storage bucket is ${GROWTH_VIDEOS_STORAGE_BUCKET}`,
      pass: GROWTH_VIDEOS_STORAGE_BUCKET === "growth-videos",
      blockingSeverity: "low",
    }),
  )

  return buildGrowthVideoOperatorScenarioResult({
    scenario_id: "scenario_1_upload_publish",
    title: "Upload video, create page, publish page",
    sections: ["video_assets", "pages"],
    checks,
  })
}

function runScenario2Personalization(cwd = process.cwd()): GrowthVideoOperatorScenarioResult {
  const mergeValues = buildGrowthVideoPreviewFormMergeValues({
    firstName: "Alex",
    lastName: "Rivera",
    company: "Summit Diagnostics",
    industry: "Healthcare",
  })
  const rendered = renderGrowthVideoPreviewText(
    "Hi {{first_name}}, welcome to {{company}} in {{industry}}.",
    mergeValues,
  )
  const aliasOk = resolveGrowthVideoVariableAlias("company") === "lead.company_name"

  const checks: GrowthVideoOperatorCheckResult[] = [
    buildGrowthVideoOperatorCheck({
      id: "merge_values_resolve",
      label: "Merge values resolve in preview text",
      pass: rendered.includes("Alex") && rendered.includes("Summit Diagnostics") && !rendered.includes("{{"),
      recommendedFix: "Fix preview merge rendering in growth-video-preview-render-service.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "aliases_resolve",
      label: "Legacy aliases resolve to canonical keys",
      pass: aliasOk,
      recommendedFix: "Verify growth-video-variable-alias-service mappings.",
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "preview_renders",
      label: "Personalization preview renders merged copy",
      pass: rendered.length > 10,
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "ai_payload_exists",
      label: "Personalization service exposes AI payload builder",
      pass:
        sourceMatches("lib/growth/videos/growth-video-personalization-service.ts", /buildGrowthVideoAiPayload/) &&
        sourceMatches("lib/growth/videos/growth-video-personalization-service.ts", /resolved_variables/),
      recommendedFix: "Ensure buildGrowthVideoAiPayload stores resolved variables for operator review.",
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "personalization_no_sequence_execution",
      label: "Personalization service does not trigger sequence execution",
      pass:
        !readSource("lib/growth/videos/growth-video-personalization-service.ts", cwd).includes(
          "runSequenceExecutionJob",
        ),
      blockingSeverity: "critical",
    }),
  ]

  return buildGrowthVideoOperatorScenarioResult({
    scenario_id: "scenario_2_personalization",
    title: "Apply personalization",
    sections: ["personalization"],
    checks,
  })
}

function runScenario3Thumbnails(cwd = process.cwd()): GrowthVideoOperatorScenarioResult {
  const preview = previewGrowthVideoThumbnail({
    type: "prospect",
    form: {
      firstName: "Jordan",
      lastName: "Lee",
      company: "Northwind Labs",
      industry: "Biotech",
      title: "VP Operations",
      ctaLabel: "Watch Now",
    },
    pageTitle: "Personalized Video",
    primaryColor: "#2563eb",
  })

  const checks: GrowthVideoOperatorCheckResult[] = [
    buildGrowthVideoOperatorCheck({
      id: "thumbnail_preview_generated",
      label: "Thumbnail preview SVG generated",
      pass: preview.previewDataUrl.startsWith("data:image/svg+xml"),
      recommendedFix: "Verify growth-video-thumbnail-preview-service render path.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "storage_paths_generated",
      label: "Thumbnail storage path helpers present",
      pass:
        sourceMatches("lib/growth/videos/growth-video-thumbnail-service.ts", /storage_path|storagePath/) ||
        sourceMatches("lib/growth/videos/growth-video-thumbnail-service.ts", /upload/i),
      recommendedFix: "Ensure thumbnail service writes storage paths on generate.",
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "og_metadata_generated",
      label: "Open Graph preview generated",
      pass: preview.ogPreviewDataUrl.startsWith("data:image/svg+xml"),
      recommendedFix: "Verify OG render branch in thumbnail preview service.",
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "ai_payload_stored",
      label: "Thumbnail AI payload stores render metadata",
      pass:
        Boolean(preview.aiPayload) &&
        typeof preview.aiPayload.thumbnail_score === "number" &&
        Boolean(preview.aiPayload.resolved_values),
      recommendedFix: "Ensure thumbnail AI payload stores human-review metadata.",
      blockingSeverity: "low",
    }),
  ]

  return buildGrowthVideoOperatorScenarioResult({
    scenario_id: "scenario_3_thumbnails",
    title: "Generate thumbnails",
    sections: ["thumbnails"],
    checks,
  })
}

function runScenario4Scripts(cwd = process.cwd()): GrowthVideoOperatorScenarioResult {
  const generationInput = {
    goal: "Book a demo",
    tone: "professional" as const,
    targetPersona: "Operations leader",
  }
  const mergeVariables = {
    first_name: "Alex",
    company: "Summit Diagnostics",
  }
  const scriptOutput = buildDeterministicGrowthVideoScript({
    generationInput,
    mergeVariables,
    sourcesUsed: ["cert_preview"],
  })
  const preview = previewGrowthVideoScriptContext({
    generationInput,
    mergeVariables,
    sourcesUsed: ["cert_preview"],
  })
  const appended = appendGrowthVideoScriptVersion({
    existing: emptyGrowthVideoScriptMetadata(),
    generationInput,
    output: scriptOutput,
    aiPayload: preview.aiPayload,
    provider: "deterministic_cert",
    model: "cert-preview",
  })
  const parsed = parseGrowthVideoScriptMetadata({
    growth_video_scripts_b4: appended,
  })

  const checks: GrowthVideoOperatorCheckResult[] = [
    buildGrowthVideoOperatorCheck({
      id: "script_version_created",
      label: "Script version appended to metadata",
      pass: parsed.versions.length === 1,
      recommendedFix: "Verify appendGrowthVideoScriptVersion helper.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "current_version_selected",
      label: "Current script version selected",
      pass: parsed.current_version_id === parsed.versions[0]?.id,
      recommendedFix: "Ensure current_version_id tracks latest append.",
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "script_preview_generated",
      label: "Script preview context generated",
      pass: preview.fallbackScript.hook === scriptOutput.hook,
      recommendedFix: "Verify growth-video-script-preview-service.",
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "script_ai_payload_stored",
      label: "Script metadata enforces human review",
      pass: parsed.requires_human_review === true && parsed.autonomous_execution_enabled === false,
      recommendedFix: "Ensure B4 metadata stores safety flags.",
      blockingSeverity: "low",
    }),
    buildGrowthVideoOperatorCheck({
      id: "script_generation_service_wired",
      label: "Script generation service registered",
      pass: fileExists("lib/growth/videos/growth-video-script-generation-service.ts", cwd),
      blockingSeverity: "high",
    }),
  ]

  return buildGrowthVideoOperatorScenarioResult({
    scenario_id: "scenario_4_scripts",
    title: "Generate scripts",
    sections: ["scripts"],
    checks,
  })
}

function runScenario5Voice(cwd = process.cwd()): GrowthVideoOperatorScenarioResult {
  resetElevenLabsGrowthVoiceProviderStateForCert()
  const capabilities = getElevenLabsGrowthVoiceProviderCapabilities()
  const storagePath = buildVoiceoverStoragePath({
    organizationId: "00000000-0000-4000-8000-000000000001",
    runId: "00000000-0000-4000-8000-000000000002",
  })

  const checks: GrowthVideoOperatorCheckResult[] = [
    buildGrowthVideoOperatorCheck({
      id: "voice_service_media_generation_runs",
      label: "Voice service creates media generation runs via C3 jobs",
      pass: sourceMatches("lib/growth/media/growth-ai-voice-generation-service.ts", /createMediaGenerationJob/),
      recommendedFix: "Wire C1 voice service to C3 media_generation_runs.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "voice_service_ai_jobs",
      label: "Voice service creates ai_jobs rows",
      pass: sourceMatches("lib/growth/media/growth-ai-voice-generation-service.ts", /ai_jobs|createMediaGenerationJob/),
      recommendedFix: "Wire C1 voice service to C3 ai_jobs.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "voice_service_media_asset",
      label: "Voice writeback creates media_asset row",
      pass: sourceMatches("lib/growth/media/growth-media-audio-writeback-service.ts", /media_assets|media_asset/),
      recommendedFix: "Verify growth-media-audio-writeback-service persistence.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "voice_signed_audio_path",
      label: "Voice storage path generated for signed audio URL",
      pass: storagePath.includes("voiceover") && storagePath.length > 10,
      recommendedFix: "Verify buildVoiceoverStoragePath output.",
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "voice_dry_run_provider",
      label: "Voice provider supports dry-run mode",
      pass: typeof capabilities.dryRunOnly === "boolean",
      detail: {
        dryRunOnly: capabilities.dryRunOnly,
        enabled: capabilities.enabled,
        liveProviderReady: capabilities.enabled === true,
      },
      blockingSeverity: "low",
    }),
    buildGrowthVideoOperatorCheck({
      id: "voice_live_provider_wiring",
      label: "Voice provider exposes live generation contract",
      pass: sourceMatches("lib/growth/media/providers/elevenlabs-growth-voice-provider.ts", /generateVoice/),
      recommendedFix: "Verify ElevenLabs growth voice provider contract.",
      blockingSeverity: "medium",
    }),
  ]

  return buildGrowthVideoOperatorScenarioResult({
    scenario_id: "scenario_5_voice",
    title: "Generate voice",
    sections: ["voice"],
    checks,
  })
}

function runScenario6Avatar(cwd = process.cwd()): GrowthVideoOperatorScenarioResult {
  resetElevenLabsGrowthAvatarProviderStateForCert()
  resetRetellGrowthAvatarProviderStateForCert()
  const elevenLabs = getElevenLabsGrowthAvatarProviderCapabilities()
  const retell = getRetellGrowthAvatarProviderCapabilities()
  const storagePath = buildAvatarVideoStoragePath({
    organizationId: "00000000-0000-4000-8000-000000000001",
    runId: "00000000-0000-4000-8000-000000000003",
  })

  const checks: GrowthVideoOperatorCheckResult[] = [
    buildGrowthVideoOperatorCheck({
      id: "avatar_service_media_generation_runs",
      label: "Avatar service creates media generation runs via C3 jobs",
      pass: sourceMatches("lib/growth/media/growth-ai-avatar-generation-service.ts", /createMediaGenerationJob/),
      recommendedFix: "Wire C2 avatar service to C3 media_generation_runs.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "avatar_service_ai_jobs",
      label: "Avatar service creates ai_jobs rows",
      pass: sourceMatches("lib/growth/media/growth-ai-avatar-generation-service.ts", /ai_jobs|createMediaGenerationJob/),
      recommendedFix: "Wire C2 avatar service to C3 ai_jobs.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "avatar_service_media_asset",
      label: "Avatar writeback creates media_asset row",
      pass: sourceMatches("lib/growth/media/growth-media-video-writeback-service.ts", /media_assets|media_asset/),
      recommendedFix: "Verify growth-media-video-writeback-service persistence.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "avatar_signed_video_path",
      label: "Avatar storage path generated for signed video URL",
      pass: storagePath.includes("avatar") && storagePath.length > 10,
      recommendedFix: "Verify buildAvatarVideoStoragePath output.",
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "avatar_dry_run_providers",
      label: "Avatar providers expose dry-run capability",
      pass:
        typeof elevenLabs.dryRunOnly === "boolean" &&
        typeof retell.dryRunOnly === "boolean" &&
        elevenLabs.requires_human_review === true &&
        retell.requires_human_review === true,
      detail: {
        elevenlabs_dry_run_only: elevenLabs.dryRunOnly,
        retell_dry_run_only: retell.dryRunOnly,
      },
      blockingSeverity: "low",
    }),
    buildGrowthVideoOperatorCheck({
      id: "avatar_live_provider_wiring",
      label: "Avatar providers expose live generation contract",
      pass:
        sourceMatches("lib/growth/media/providers/elevenlabs-growth-avatar-provider.ts", /generateAvatarVideo|generateVideo/) ||
        sourceMatches("lib/growth/media/providers/retell-growth-avatar-provider.ts", /generateAvatarVideo|generateVideo/),
      recommendedFix: "Verify avatar provider contracts for live generation.",
      blockingSeverity: "medium",
    }),
  ]

  return buildGrowthVideoOperatorScenarioResult({
    scenario_id: "scenario_6_avatar",
    title: "Generate avatar",
    sections: ["avatar"],
    checks,
  })
}

function runScenario7SequenceAttach(cwd = process.cwd()): GrowthVideoOperatorScenarioResult {
  const mapped = mapSequenceVideoAttachmentRow({
    id: "00000000-0000-4000-8000-000000000010",
    organization_id: "00000000-0000-4000-8000-000000000001",
    sequence_pattern_step_id: "00000000-0000-4000-8000-000000000011",
    attachment_type: "email",
    attachment_status: "pending_approval",
    video_page_id: "00000000-0000-4000-8000-000000000012",
    voice_media_asset_id: null,
    metadata_json: {
      analytics_hooks: buildSequenceVideoAttachmentAnalyticsHooks({
        sequencePatternStepId: "00000000-0000-4000-8000-000000000011",
      }),
    },
    approved_by: null,
    approved_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  const approved = mapSequenceVideoAttachmentRow({
    ...{
      id: mapped.id,
      organization_id: mapped.organizationId,
      sequence_pattern_step_id: mapped.sequencePatternStepId,
      attachment_type: mapped.attachmentType,
      attachment_status: "approved",
      video_page_id: mapped.videoPageId,
      voice_media_asset_id: null,
      metadata_json: { analytics_hooks: mapped.analyticsHooks },
      approved_by: "00000000-0000-4000-8000-000000000099",
      approved_at: new Date().toISOString(),
      created_at: mapped.createdAt,
      updated_at: mapped.updatedAt,
    },
  })

  const checks: GrowthVideoOperatorCheckResult[] = [
    buildGrowthVideoOperatorCheck({
      id: "attachment_row_mapped",
      label: "sequence_video_attachments row maps cleanly",
      pass: mapped.id.length > 0 && mapped.videoPageId !== null,
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "attachment_pending_approval",
      label: "Pending approval state supported",
      pass: mapped.attachmentStatus === "pending_approval",
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "attachment_approved_state",
      label: "Approved state supported",
      pass: approved.attachmentStatus === "approved" && approved.approvedBy !== null,
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "attachment_metadata_hooks",
      label: "Metadata hooks stored on attachment",
      pass: Boolean(mapped.metadataHooks),
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "attachment_analytics_hooks",
      label: "Analytics hooks include sequence attribution fields",
      pass:
        mapped.analyticsHooks.sequence_step_id !== undefined &&
        mapped.analyticsHooks.engagement_summary_id !== undefined,
      recommendedFix: "Verify buildSequenceVideoAttachmentAnalyticsHooks fields.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "attachment_service_no_execution",
      label: "Attachment service does not execute outreach",
      pass: !readSource("lib/growth/sequences/growth-sequence-video-attachment-service.ts", cwd).includes(
        "runSequenceExecutionJob",
      ),
      blockingSeverity: "critical",
    }),
  ]

  return buildGrowthVideoOperatorScenarioResult({
    scenario_id: "scenario_7_sequence_attach",
    title: "Attach to sequence",
    sections: ["sequence_attachments"],
    checks,
  })
}

function runScenario8ChannelPreviews(cwd = process.cwd()): GrowthVideoOperatorScenarioResult {
  const emailPreview = buildSequenceVideoChannelPreviewFromRender({
    attachmentType: "email",
    firstName: "Taylor",
    publicUrl: "https://example.com/v/demo",
    signedThumbnailUrl: "https://example.com/thumb.png",
    ctaLabel: "Watch Personalized Video",
  })
  const smsPreview = buildSequenceVideoChannelPreviewFromRender({
    attachmentType: "sms",
    firstName: "Taylor",
    publicUrl: "https://example.com/v/demo",
    ctaLabel: "Book a Demo",
    ctaUrl: "https://example.com/book",
  })
  const voicePreview = buildSequenceVideoChannelPreviewFromRender({
    attachmentType: "voice_drop",
    firstName: "Taylor",
    publicUrl: "https://example.com/v/demo",
    voiceMediaAssetId: "00000000-0000-4000-8000-000000000020",
  })

  const checks: GrowthVideoOperatorCheckResult[] = [
    buildGrowthVideoOperatorCheck({
      id: "email_thumbnail",
      label: "Email preview includes thumbnail",
      pass: (emailPreview.emailHtml ?? "").includes("thumb.png"),
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "email_page_url",
      label: "Email preview includes page URL",
      pass: (emailPreview.emailHtml ?? "").includes("https://example.com/v/demo"),
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "email_cta",
      label: "Email preview includes CTA",
      pass: (emailPreview.emailHtml ?? "").includes("Watch Personalized Video"),
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "sms_page_url",
      label: "SMS preview includes page URL",
      pass: (smsPreview.smsText ?? "").includes("https://example.com/v/demo"),
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "sms_cta",
      label: "SMS preview includes CTA URL",
      pass: (smsPreview.smsText ?? "").includes("https://example.com/book"),
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "voice_asset",
      label: "Voice preview references voice asset",
      pass: (voicePreview.voiceDropSummary ?? "").includes("00000000-0000-4000-8000-000000000020"),
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "voice_follow_up_url",
      label: "Voice preview includes follow-up page URL",
      pass: (voicePreview.voiceDropSummary ?? "").includes("https://example.com/v/demo"),
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "send_builder_wired",
      label: "Send builder service wires approved attachments",
      pass: fileExists("lib/growth/sequences/growth-sequence-video-send-builder-service.ts", cwd),
      blockingSeverity: "high",
    }),
  ]

  return buildGrowthVideoOperatorScenarioResult({
    scenario_id: "scenario_8_channel_previews",
    title: "Build channel previews",
    sections: ["sequence_attachments"],
    checks,
  })
}

function runScenario9Engagement(cwd = process.cwd()): GrowthVideoOperatorScenarioResult {
  const orgId = "00000000-0000-4000-8000-000000000001"
  const assetId = "00000000-0000-4000-8000-000000000002"
  const pageId = "00000000-0000-4000-8000-000000000003"
  const sessionId = "cert-session-1"
  const now = new Date().toISOString()

  const events = [
    { organization_id: orgId, video_asset_id: assetId, video_page_id: pageId, visitor_identifier: "visitor-1", session_id: sessionId, event_type: "page_view", metadata_json: {}, created_at: now },
    { organization_id: orgId, video_asset_id: assetId, video_page_id: pageId, visitor_identifier: "visitor-1", session_id: sessionId, event_type: "video_play", metadata_json: {}, created_at: now },
    { organization_id: orgId, video_asset_id: assetId, video_page_id: pageId, visitor_identifier: "visitor-1", session_id: sessionId, event_type: "video_progress", metadata_json: { percent: 50 }, created_at: now },
    { organization_id: orgId, video_asset_id: assetId, video_page_id: pageId, visitor_identifier: "visitor-1", session_id: sessionId, event_type: "video_complete", metadata_json: { percent: 100 }, created_at: now },
    { organization_id: orgId, video_asset_id: assetId, video_page_id: pageId, visitor_identifier: "visitor-1", session_id: sessionId, event_type: "cta_click", metadata_json: { label: "Book Demo" }, created_at: now },
    { organization_id: orgId, video_asset_id: assetId, video_page_id: pageId, visitor_identifier: "visitor-1", session_id: sessionId, event_type: "calendar_click", metadata_json: { label: "Schedule" }, created_at: now },
  ]

  const rollups = rollupGrowthVideoPageEventsBySession(events)
  const rollup = rollups[0]
  const score = rollup
    ? computeGrowthVideoEngagementScore({ rollup, visitorSessionCount: 1 })
    : null

  const checks: GrowthVideoOperatorCheckResult[] = [
    buildGrowthVideoOperatorCheck({
      id: "engagement_page_view",
      label: "Page view event rolls up",
      pass: Boolean(rollup && rollup.totalViews >= 1),
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "engagement_play_progress_complete",
      label: "Play/progress/complete events roll up",
      pass: Boolean(rollup && rollup.totalPlays >= 1 && rollup.highestPercentWatched >= 50),
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "engagement_cta_calendar",
      label: "CTA and calendar clicks roll up",
      pass: Boolean(rollup && rollup.totalCtaClicks >= 1 && rollup.totalCalendarClicks >= 1),
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "engagement_score_computed",
      label: "Engagement score computed from rollup",
      pass: Boolean(score && score.engagementScore > 0),
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "analytics_summary_service_wired",
      label: "Analytics summary service rebuilds video_engagement_summaries",
      pass: sourceMatches("lib/growth/videos/growth-video-analytics-summary-service.ts", /video_engagement_summaries/),
      recommendedFix: "Verify A4 summary rebuild from video_page_events.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "page_events_service_wired",
      label: "Page event ingest writes video_page_events",
      pass: sourceMatches("lib/growth/videos/growth-video-page-event-service.ts", /video_page_events/),
      recommendedFix: "Verify A3 public page event ingest path.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "analytics_qa_marker",
      label: "Analytics ingest carries A3 QA marker",
      pass: sourceMatches("lib/growth/videos/growth-video-page-event-service.ts", /GROWTH_VIDEO_PAGES_QA_MARKER/),
      blockingSeverity: "low",
    }),
  ]

  return buildGrowthVideoOperatorScenarioResult({
    scenario_id: "scenario_9_engagement",
    title: "Simulate engagement",
    sections: ["analytics"],
    checks,
  })
}

function runScenario10Intelligence(cwd = process.cwd()): GrowthVideoOperatorScenarioResult {
  const metrics = buildGrowthVideoIntelligenceMetrics([
    {
      id: "00000000-0000-4000-8000-000000000001",
      video_asset_id: "00000000-0000-4000-8000-000000000002",
      video_page_id: "00000000-0000-4000-8000-000000000003",
      total_views: 3,
      highest_percent_watched: 96,
      total_cta_clicks: 1,
      total_calendar_clicks: 1,
      last_viewed_at: new Date().toISOString(),
      engagement_score: 92,
      session_id: "session-a",
      visitor_identifier: "visitor-a",
    },
    {
      id: "00000000-0000-4000-8000-000000000004",
      video_asset_id: "00000000-0000-4000-8000-000000000002",
      video_page_id: "00000000-0000-4000-8000-000000000003",
      total_views: 1,
      highest_percent_watched: 40,
      total_cta_clicks: 0,
      total_calendar_clicks: 0,
      last_viewed_at: new Date().toISOString(),
      engagement_score: 20,
      session_id: "session-b",
      visitor_identifier: "visitor-b",
    },
  ])
  const signals = deriveGrowthVideoIntelligenceSignals({
    totalViews: metrics.totalViews,
    highestPercentWatched: metrics.highestPercentWatched,
    totalCtaClicks: metrics.totalCtaClicks,
    totalCalendarClicks: metrics.totalCalendarClicks,
    sessionCount: metrics.sessionCount,
  })
  const nba = mapGrowthVideoSignalsToNbaSuggestions({ signals, metrics })
  const opportunity = buildGrowthVideoOpportunitySignals({
    signals,
    metrics,
    videoPageId: metrics.lastVideoPageId ?? "00000000-0000-4000-8000-000000000003",
  })
  const relationship = buildGrowthVideoRelationshipContext(metrics)
  const callWorkspace = buildGrowthVideoCallWorkspaceContext({
    metrics,
    pageTitle: "Demo Page",
    videoTitle: "Personalized Intro",
  })
  const meetingPrep = buildGrowthVideoMeetingPrepContext({
    metrics,
    videoTitle: "Personalized Intro",
  })

  const checks: GrowthVideoOperatorCheckResult[] = [
    buildGrowthVideoOperatorCheck({
      id: "intelligence_timeline_wiring",
      label: "Timeline integration module exists",
      pass: fileExists("lib/growth/sequences/growth-sequence-video-intelligence-timeline.ts", cwd),
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "intelligence_conversation_wiring",
      label: "Conversation integration module exists",
      pass: fileExists("lib/growth/sequences/growth-sequence-video-intelligence-conversations.ts", cwd),
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "intelligence_relationship_metadata",
      label: "Relationship metadata derived from engagement metrics",
      pass:
        relationship.lastVideoViewedAt !== undefined &&
        relationship.videoEngagementScore === metrics.videoEngagementScore,
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "intelligence_nba_suggestions",
      label: "NBA suggestions mapped from video signals",
      pass: nba.length > 0 && nba.every((item) => item.requiresHumanReview === true),
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "intelligence_opportunity_signals",
      label: "Opportunity signals derived from engagement",
      pass: opportunity.some((item) => item.signal === "video_high_intent"),
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "intelligence_call_workspace_context",
      label: "Call workspace context exposes completion and clicks",
      pass:
        callWorkspace.highestCompletionPercent === metrics.highestPercentWatched &&
        callWorkspace.ctaClicked === true,
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "intelligence_meeting_prep_context",
      label: "Meeting prep context exposes watch/completion/views",
      pass:
        meetingPrep.prospectWatched === "Personalized Intro" &&
        meetingPrep.completionPercent === metrics.highestPercentWatched,
      blockingSeverity: "medium",
    }),
    buildGrowthVideoOperatorCheck({
      id: "intelligence_service_wired",
      label: "Intelligence sync wired from page events",
      pass: sourceMatches("lib/growth/videos/growth-video-page-event-service.ts", /processGrowthVideoPageEventIntelligence/),
      recommendedFix: "Ensure D3 intelligence sync runs after A4 summary rebuild.",
      blockingSeverity: "high",
    }),
  ]

  return buildGrowthVideoOperatorScenarioResult({
    scenario_id: "scenario_10_intelligence",
    title: "Verify intelligence",
    sections: ["intelligence"],
    checks,
  })
}

function runHarnessPreflight(cwd = process.cwd()): GrowthVideoOperatorCheckResult[] {
  const checks: GrowthVideoOperatorCheckResult[] = [
    buildGrowthVideoOperatorCheck({
      id: "qa_marker",
      label: "E1 QA marker registered",
      pass: GROWTH_VIDEO_OPERATOR_CERT_QA_MARKER === "growth-video-operator-certification-e1-v1",
      blockingSeverity: "critical",
    }),
    buildGrowthVideoOperatorCheck({
      id: "confirm_token",
      label: "E1 confirm token registered",
      pass: GROWTH_VIDEO_OPERATOR_CERT_CONFIRM === "RUN_GROWTH_VIDEO_OPERATOR_CERTIFICATION",
      blockingSeverity: "critical",
    }),
  ]

  for (const relativePath of E1_REQUIRED_MODULES) {
    checks.push(
      buildGrowthVideoOperatorCheck({
        id: `required_module_${relativePath.replace(/[/.]/g, "_")}`,
        label: `${relativePath} exists`,
        pass: fileExists(relativePath, cwd),
        recommendedFix: `Restore missing pipeline module ${relativePath}.`,
        blockingSeverity: "high",
      }),
    )
  }

  const foundationAudit = runGrowthVideoFoundationAudit(cwd)
  checks.push(
    buildGrowthVideoOperatorCheck({
      id: "foundation_audit",
      label: "A1 foundation audit passes",
      pass: foundationAudit.ok,
      rootCause: foundationAudit.findings.map((finding) => finding.message).join("; ") || null,
      recommendedFix: "Resolve A1 foundation audit findings before operator certification.",
      blockingSeverity: "high",
      detail: { finding_count: foundationAudit.findings.length },
    }),
  )

  checks.push(...assertExecutionIsolation(cwd))
  return checks
}

export function runGrowthVideoOperatorCertificationLocal(cwd = process.cwd()): GrowthVideoOperatorCertificationReport {
  const scenarios = [
    runScenario1UploadPublish(cwd),
    runScenario2Personalization(cwd),
    runScenario3Thumbnails(cwd),
    runScenario4Scripts(cwd),
    runScenario5Voice(cwd),
    runScenario6Avatar(cwd),
    runScenario7SequenceAttach(cwd),
    runScenario8ChannelPreviews(cwd),
    runScenario9Engagement(cwd),
    runScenario10Intelligence(cwd),
  ]

  return buildGrowthVideoOperatorReport({
    environment: "local",
    scenarios,
  })
}

export async function runGrowthVideoOperatorCertificationProduction(
  admin: SupabaseClient,
): Promise<GrowthVideoOperatorCertificationReport> {
  const localReport = runGrowthVideoOperatorCertificationLocal()
  const blockers: string[] = []

  const foundationProbe = await probeGrowthVideoFoundationSchema(admin)
  const pageEventsReady = await isGrowthVideoPageEventsSchemaReady(admin)
  if (!foundationProbe.ready) {
    blockers.push("foundation_schema_not_ready")
  }
  if (!foundationProbe.pages_schema_ready) {
    blockers.push("pages_schema_not_ready")
  }
  if (!pageEventsReady) {
    blockers.push("page_events_schema_not_ready")
  }
  if (!foundationProbe.analytics_schema_ready) {
    blockers.push("analytics_schema_not_ready")
  }

  const mediaProbe = await probeGrowthMediaGenerationRunsSchema(admin)
  if (!mediaProbe.media_generation_runs_ready) {
    blockers.push("media_generation_runs_not_ready")
  }

  const attachmentProbe = await probeSequenceVideoAttachmentsSchema(admin)
  if (!attachmentProbe.sequence_video_attachments_ready) {
    blockers.push("sequence_video_attachments_not_ready")
  }

  const productionChecks: GrowthVideoOperatorCheckResult[] = [
    buildGrowthVideoOperatorCheck({
      id: "production_foundation_schema",
      label: "Production foundation schema ready",
      pass: foundationProbe.ready,
      rootCause: foundationProbe.tables.find((table) => !table.ok)?.error ?? null,
      recommendedFix: "Apply A1/A2 migrations in production Supabase.",
      blockingSeverity: "critical",
    }),
    buildGrowthVideoOperatorCheck({
      id: "production_pages_schema",
      label: "Production video_pages schema ready",
      pass: foundationProbe.pages_schema_ready,
      recommendedFix: "Apply A3 pages migration in production Supabase.",
      blockingSeverity: "critical",
    }),
    buildGrowthVideoOperatorCheck({
      id: "production_page_events_schema",
      label: "Production video_page_events schema ready",
      pass: pageEventsReady,
      recommendedFix: "Apply A3/A4 event tables in production Supabase.",
      blockingSeverity: "critical",
    }),
    buildGrowthVideoOperatorCheck({
      id: "production_analytics_schema",
      label: "Production video_engagement_summaries schema ready",
      pass: foundationProbe.analytics_schema_ready,
      recommendedFix: "Apply A4 analytics migration in production Supabase.",
      blockingSeverity: "critical",
    }),
    buildGrowthVideoOperatorCheck({
      id: "production_media_generation_schema",
      label: "Production media_generation_runs schema ready",
      pass: mediaProbe.media_generation_runs_ready,
      rootCause: mediaProbe.error,
      recommendedFix: "Apply C3 media generation migration in production Supabase.",
      blockingSeverity: "high",
    }),
    buildGrowthVideoOperatorCheck({
      id: "production_sequence_attachments_schema",
      label: "Production sequence_video_attachments schema ready",
      pass: attachmentProbe.sequence_video_attachments_ready,
      rootCause: attachmentProbe.error,
      recommendedFix: "Apply D1 sequence video attachments migration in production Supabase.",
      blockingSeverity: "high",
    }),
  ]

  const productionScenario = buildGrowthVideoOperatorScenarioResult({
    scenario_id: "scenario_10_intelligence",
    title: "Production schema certification",
    sections: ["video_assets", "pages", "analytics", "voice", "avatar", "sequence_attachments", "intelligence"],
    checks: productionChecks,
  })

  return buildGrowthVideoOperatorReport({
    environment: "production",
    scenarios: [...localReport.scenario_matrix, productionScenario],
    blockers,
  })
}

export function formatGrowthVideoOperatorCertificationSummary(
  report: GrowthVideoOperatorCertificationReport,
): string {
  const lines = [
    `\n=== E1 Video operator certification (${report.qa_marker}) ===\n`,
    `Environment: ${report.environment}`,
    `Final verdict: ${report.final_verdict}`,
    `Checks: ${report.pass_count}/${report.check_count} pass (${report.warn_count} warn, ${report.fail_count} fail)\n`,
  ]

  for (const scenario of report.scenario_matrix) {
    lines.push(`Scenario — ${scenario.title}: ${scenario.status}`)
    for (const check of scenario.checks) {
      const icon = check.status === "PASS" ? "✓" : check.status === "WARN" ? "!" : "✗"
      lines.push(`  ${icon} ${check.label}`)
    }
    lines.push("")
  }

  lines.push("Operator report sections:")
  for (const section of report.section_reports) {
    lines.push(
      `  ${section.label}: ${section.status} (${section.pass_count}/${section.check_count} pass)` +
        (section.root_cause ? ` — ${section.root_cause}` : ""),
    )
  }

  if (report.blockers.length > 0) {
    lines.push(`\nBlockers: ${report.blockers.join(", ")}`)
  }

  lines.push(
    report.ok
      ? `\nE1 Video operator certification ${report.environment.toUpperCase()} PASS\n`
      : `\nE1 Video operator certification ${report.environment.toUpperCase()} FAIL\n`,
  )

  return lines.join("\n")
}
