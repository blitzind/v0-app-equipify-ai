/** Growth Engine S1.5 — Media asset integration diagnostics & certification scaffolding. */

import "server-only"

import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  archiveMediaAsset,
  attachMediaAsset,
  completeUploadSession,
  createMediaAsset,
  createUploadSession,
  detachMediaAsset,
  getMediaAsset,
  listMediaAssets,
  listRelationships,
  updateMediaAsset,
} from "@/lib/growth/media/media-asset-repository"
import { probeGrowthMediaAssetsSchema } from "@/lib/growth/media/media-asset-schema-health"
import { resolveMediaStorageProvider } from "@/lib/growth/media/media-asset-storage-providers"
import {
  GROWTH_MEDIA_ASSETS_CONFIRM,
  GROWTH_MEDIA_ASSETS_QA_MARKER,
} from "@/lib/growth/media/media-asset-types"
import {
  attachGrowthMediaVideoAsset,
  completeGrowthMediaVideoUpload,
  createGrowthMediaVideoAsset,
  createGrowthMediaVideoUploadSession,
} from "@/lib/growth/media/media-video-upload-service"
import {
  completeGrowthMediaVideoThumbnailUpload,
  createGrowthMediaVideoThumbnailUploadSession,
  getGrowthMediaVideoThumbnail,
  removeGrowthMediaVideoThumbnail,
} from "@/lib/growth/media/media-video-thumbnail-service"

export { GROWTH_MEDIA_ASSETS_CONFIRM }

const CERT_PREFIX = "growth-media-assets-s1-5-cert"
const VIDEO_CERT_PREFIX = "growth-media-video-upload-s2a-cert"
const THUMBNAIL_CERT_PREFIX = "growth-media-video-thumbnail-s2c-cert"
const CERT_VIDEO_CHECKSUM = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const CERT_THUMBNAIL_CHECKSUM = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

export type GrowthMediaAssetsDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthMediaAssetsDiagnosticsReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_MEDIA_ASSETS_QA_MARKER
  checks: GrowthMediaAssetsDiagnosticsCheck[]
  blockers: string[]
  final_verdict: "PASS" | "FAIL" | "SKIP"
  asset_id?: string
  no_upload_execution: true
  no_playback: true
  no_ai_generation: true
  no_notifications: true
  no_sequence_execution: true
}

function pushCheck(
  checks: GrowthMediaAssetsDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

async function resolveCertOrganizationId(admin: SupabaseClient): Promise<string | null> {
  const configured = process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()
  if (configured) return configured

  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id
}

async function cleanupCertAsset(admin: SupabaseClient, assetId: string): Promise<void> {
  const asset = await getMediaAsset(admin, assetId)
  const thumbMeta = asset?.metadata.video_thumbnail
  const thumbId =
    thumbMeta && typeof thumbMeta === "object"
      ? String((thumbMeta as { asset_id?: string }).asset_id ?? "")
      : ""
  if (thumbId) {
    await admin.schema("growth").from("media_asset_relationships").delete().eq("asset_id", thumbId)
    await admin.schema("growth").from("media_assets").delete().eq("id", thumbId)
  }
  await admin.schema("growth").from("media_asset_relationships").delete().eq("asset_id", assetId)
  await admin.schema("growth").from("media_asset_relationships").delete().eq("relationship_id", assetId)
  await admin.schema("growth").from("media_assets").delete().eq("id", assetId)
}

async function runRepositoryDiagnostics(
  admin: SupabaseClient,
  checks: GrowthMediaAssetsDiagnosticsCheck[],
): Promise<{ assetId: string | null }> {
  const organizationId = await resolveCertOrganizationId(admin)
  if (!organizationId) {
    pushCheck(checks, "organization_scope", false, "Could not resolve certification organization id.")
    return { assetId: null }
  }
  pushCheck(checks, "organization_scope", true, "Organization scope resolved.")

  const created = await createMediaAsset(admin, {
    organizationId,
    assetType: "video",
    provider: "local_stub",
    title: `${CERT_PREFIX}-${randomUUID()}`,
    description: "S1.5 certification fixture",
    tags: [CERT_PREFIX],
    extension: "mp4",
    mimeType: "video/mp4",
    metadata: { cert: true },
  })
  pushCheck(checks, "create_asset", Boolean(created.id), "Media asset row created in draft status.")
  pushCheck(checks, "create_asset_draft", created.status === "draft", "New assets start as draft.")

  const updated = await updateMediaAsset(admin, created.id, {
    title: `${created.title}-updated`,
    tags: [...created.tags, `${CERT_PREFIX}-updated`],
  })
  pushCheck(checks, "update_asset", updated.title.endsWith("-updated"), "Asset metadata updated.")

  const sessionResult = await createUploadSession(admin, {
    organizationId,
    assetId: created.id,
    fileSizeBytes: 1024,
  })
  pushCheck(
    checks,
    "upload_session",
    sessionResult.asset.status === "upload_pending" && Boolean(sessionResult.session.sessionId),
    "Upload session created without executing upload.",
  )
  pushCheck(
    checks,
    "upload_session_stub_url",
    sessionResult.session.writeUrl?.startsWith("stub://upload/") === true,
    "Local stub provider returns non-executing write URL.",
  )

  const completed = await completeUploadSession(admin, {
    organizationId,
    assetId: created.id,
    checksumSha256: "cert-checksum",
    fileSizeBytes: 1024,
  })
  pushCheck(checks, "complete_upload", completed.status === "ready", "Upload session completes to ready status.")
  pushCheck(checks, "complete_upload_metadata", completed.uploadedAt != null, "Uploaded timestamp recorded.")

  const relationshipId = randomUUID()
  const attached = await attachMediaAsset(admin, {
    organizationId,
    assetId: created.id,
    relationshipType: "share_page_template",
    relationshipId,
    metadata: { cert: true },
  })
  pushCheck(checks, "attach_asset", attached.relationshipId === relationshipId, "Relationship attached.")

  const relationships = await listRelationships(admin, {
    organizationId,
    assetId: created.id,
  })
  pushCheck(checks, "list_relationships", relationships.length === 1, "Relationships listed for asset.")

  await detachMediaAsset(admin, {
    organizationId,
    assetId: created.id,
    relationshipType: "share_page_template",
    relationshipId,
  })
  const afterDetach = await listRelationships(admin, { organizationId, assetId: created.id })
  pushCheck(checks, "detach_asset", afterDetach.length === 0, "Relationship detached cleanly.")

  const listed = await listMediaAssets(admin, { organizationId, tag: CERT_PREFIX, limit: 10 })
  pushCheck(checks, "list_assets", listed.items.some((item) => item.id === created.id), "List assets returns cert fixture.")

  const provider = resolveMediaStorageProvider("local_stub")
  const signedRead = await provider.generateSignedReadUrl({
    organizationId,
    assetId: created.id,
    storageKey: completed.storageKey ?? "",
  })
  pushCheck(checks, "signed_read_url", signedRead.url.startsWith("stub://read/"), "Signed read URL generated.")

  await archiveMediaAsset(admin, created.id)
  const archived = await getMediaAsset(admin, created.id)
  pushCheck(checks, "archive_asset", archived?.status === "archived", "Asset archived instead of hard delete.")

  await cleanupCertAsset(admin, created.id)
  pushCheck(checks, "cleanup", (await getMediaAsset(admin, created.id)) == null, "Cert fixtures deleted.")

  pushCheck(
    checks,
    "safety_no_upload_execution",
    sessionResult.session.metadata.no_upload_executed === true &&
      (completed.metadata.upload_completion as Record<string, unknown> | undefined)?.no_upload_executed === true,
    "Upload session + completion preserve no_upload_executed guard.",
  )
  pushCheck(
    checks,
    "safety_no_playback",
    !JSON.stringify(completed.metadata).includes("playback") &&
      completed.metadata.playback_started !== true,
    "Cert fixture metadata contains no playback execution.",
  )
  pushCheck(
    checks,
    "safety_no_ai_generation",
    !JSON.stringify(completed.metadata).includes("elevenlabs") &&
      !JSON.stringify(completed.metadata).includes("retell") &&
      completed.metadata.ai_generation_started !== true,
    "Cert fixture metadata contains no AI generation hooks.",
  )

  await runVideoUploadDiagnostics(admin, organizationId, checks)
  await runVideoThumbnailDiagnostics(admin, organizationId, checks)

  return { assetId: created.id }
}

async function runVideoUploadDiagnostics(
  admin: SupabaseClient,
  organizationId: string,
  checks: GrowthMediaAssetsDiagnosticsCheck[],
): Promise<void> {
  const created = await createGrowthMediaVideoAsset(admin, {
    organizationId,
    provider: "local_stub",
    originalFilename: `${VIDEO_CERT_PREFIX}.mp4`,
    title: `${VIDEO_CERT_PREFIX}-${randomUUID()}`,
    fileSizeBytes: 2048,
    tags: [VIDEO_CERT_PREFIX],
  })
  pushCheck(checks, "video_create_asset", created.assetType === "video" && created.status === "draft", "Video asset row created.")

  const session = await createGrowthMediaVideoUploadSession(admin, {
    organizationId,
    assetId: created.id,
    fileSizeBytes: 2048,
  })
  pushCheck(
    checks,
    "video_upload_session",
    session.session.writeUrl?.startsWith("stub://upload/") === true,
    "Signed upload session created (stub URL only).",
  )

  let duplicateBlocked = false
  try {
    await createGrowthMediaVideoUploadSession(admin, {
      organizationId,
      assetId: created.id,
      fileSizeBytes: 2048,
    })
  } catch (error) {
    duplicateBlocked = error instanceof Error && error.message === "duplicate_upload_session"
  }
  pushCheck(checks, "video_duplicate_upload_session", duplicateBlocked, "Duplicate upload session rejected.")

  const completed = await completeGrowthMediaVideoUpload(admin, {
    organizationId,
    assetId: created.id,
    checksumSha256: CERT_VIDEO_CHECKSUM,
    fileSizeBytes: 2048,
    durationSeconds: 12.5,
    width: 1280,
    height: 720,
  })
  pushCheck(checks, "video_complete_upload", completed.status === "ready", "Upload completion persisted metadata.")
  pushCheck(
    checks,
    "video_metadata_persisted",
    completed.mimeType === "video/mp4" &&
      completed.fileSizeBytes === 2048 &&
      completed.checksumSha256 === CERT_VIDEO_CHECKSUM &&
      completed.durationSeconds === 12.5,
    "MP4 metadata fields populated.",
  )

  const templateId = randomUUID()
  await attachGrowthMediaVideoAsset(admin, {
    organizationId,
    assetId: created.id,
    relationshipType: "share_page_template",
    relationshipId: templateId,
  })
  const relationships = await listRelationships(admin, {
    organizationId,
    assetId: created.id,
    relationshipType: "share_page_template",
  })
  pushCheck(
    checks,
    "video_template_relationship",
    relationships.some((entry) => entry.relationshipId === templateId),
    "Video asset attached to share_page_template relationship.",
  )

  pushCheck(
    checks,
    "video_safety_flags",
    completed.metadata.no_playback === true &&
      completed.metadata.no_ai_generation === true &&
      completed.metadata.no_notifications === true &&
      completed.metadata.no_sequence_execution === true &&
      completed.metadata.no_thumbnail_generation === true,
    "S2-A safety flags preserved on asset metadata.",
  )

  await cleanupCertAsset(admin, created.id)
  pushCheck(checks, "video_cleanup", (await getMediaAsset(admin, created.id)) == null, "Video cert fixtures deleted.")
}

async function runVideoThumbnailDiagnostics(
  admin: SupabaseClient,
  organizationId: string,
  checks: GrowthMediaAssetsDiagnosticsCheck[],
): Promise<void> {
  const video = await createGrowthMediaVideoAsset(admin, {
    organizationId,
    provider: "local_stub",
    originalFilename: `${THUMBNAIL_CERT_PREFIX}.mp4`,
    title: `${THUMBNAIL_CERT_PREFIX}-${randomUUID()}`,
    fileSizeBytes: 2048,
    tags: [THUMBNAIL_CERT_PREFIX],
  })
  const videoSession = await createGrowthMediaVideoUploadSession(admin, {
    organizationId,
    assetId: video.id,
    fileSizeBytes: 2048,
  })
  pushCheck(
    checks,
    "thumbnail_video_session",
    videoSession.session.writeUrl?.startsWith("stub://upload/") === true,
    "Video fixture prepared for thumbnail cert.",
  )

  const readyVideo = await completeGrowthMediaVideoUpload(admin, {
    organizationId,
    assetId: video.id,
    checksumSha256: CERT_VIDEO_CHECKSUM,
    fileSizeBytes: 2048,
    durationSeconds: 3,
    width: 640,
    height: 360,
  })
  pushCheck(checks, "thumbnail_video_ready", readyVideo.status === "ready", "Video fixture ready for thumbnail linking.")

  const created = await createGrowthMediaVideoThumbnailUploadSession(admin, {
    organizationId,
    videoAssetId: video.id,
    fileSizeBytes: 4096,
    provider: "local_stub",
  })
  pushCheck(
    checks,
    "thumbnail_create_asset",
    created.thumbnailAsset.assetType === "thumbnail",
    "Thumbnail asset row created.",
  )
  pushCheck(
    checks,
    "thumbnail_upload_session",
    created.session.signedUploadUrl?.startsWith("stub://upload/") === true,
    "Thumbnail upload session created (stub URL only).",
  )

  const completed = await completeGrowthMediaVideoThumbnailUpload(admin, {
    organizationId,
    videoAssetId: video.id,
    thumbnailAssetId: created.thumbnailAsset.id,
    checksumSha256: CERT_THUMBNAIL_CHECKSUM,
    fileSizeBytes: 4096,
    width: 640,
    height: 360,
  })
  pushCheck(
    checks,
    "thumbnail_complete_upload",
    completed.thumbnail.status === "ready" && completed.video.thumbnailStorageKey != null,
    "Thumbnail completion updated parent thumbnail_storage_key.",
  )

  const relationships = await listRelationships(admin, {
    organizationId,
    relationshipType: "other",
    relationshipId: video.id,
  })
  pushCheck(
    checks,
    "thumbnail_relationship",
    relationships.some((entry) => entry.metadata.link_role === "video_thumbnail"),
    "Thumbnail linked to parent video via relationship.",
  )

  const fetched = await getGrowthMediaVideoThumbnail(admin, {
    organizationId,
    videoAssetId: video.id,
  })
  pushCheck(
    checks,
    "thumbnail_get_metadata",
    fetched.thumbnail?.assetId === completed.thumbnail.id,
    "Thumbnail metadata fetched for parent video.",
  )

  const replaced = await createGrowthMediaVideoThumbnailUploadSession(admin, {
    organizationId,
    videoAssetId: video.id,
    fileSizeBytes: 5120,
    provider: "local_stub",
    replaceExisting: true,
  })
  const replacedComplete = await completeGrowthMediaVideoThumbnailUpload(admin, {
    organizationId,
    videoAssetId: video.id,
    thumbnailAssetId: replaced.thumbnailAsset.id,
    checksumSha256: CERT_THUMBNAIL_CHECKSUM,
    fileSizeBytes: 5120,
    width: 320,
    height: 180,
  })
  pushCheck(
    checks,
    "thumbnail_replace",
    replacedComplete.video.thumbnailStorageKey !== completed.video.thumbnailStorageKey,
    "Thumbnail replace updated parent storage key.",
  )

  const removed = await removeGrowthMediaVideoThumbnail(admin, {
    organizationId,
    videoAssetId: video.id,
  })
  pushCheck(checks, "thumbnail_remove", removed.thumbnailStorageKey == null, "Thumbnail removed from parent video.")

  pushCheck(
    checks,
    "thumbnail_safety_flags",
    completed.video.metadata.no_playback === true &&
      completed.thumbnail.metadata.no_video_transcoding === true &&
      completed.thumbnail.metadata.no_ai_generation === true &&
      completed.thumbnail.metadata.no_notifications === true &&
      completed.thumbnail.metadata.no_sequence_execution === true,
    "S2-C safety flags preserved on thumbnail metadata.",
  )

  await cleanupCertAsset(admin, video.id)
  pushCheck(checks, "thumbnail_cleanup", (await getMediaAsset(admin, video.id)) == null, "Thumbnail cert fixtures deleted.")
}

function runSafetySourceGuards(checks: GrowthMediaAssetsDiagnosticsCheck[]): void {
  const repositorySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/media-asset-repository.ts"),
    "utf8",
  )
  pushCheck(
    checks,
    "safety_no_notifications",
    !repositorySource.includes("createGrowthNotificationsForEvent") &&
      !repositorySource.includes("growth-notification"),
    "Repository does not invoke operator notifications.",
  )
  pushCheck(
    checks,
    "safety_no_sequence_execution",
    !repositorySource.includes("dispatchSequenceWake") &&
      !repositorySource.includes("sequence-event-wake"),
    "Repository does not invoke sequence wake execution.",
  )
}

export async function executeGrowthMediaAssetsDiagnostics(
  admin: SupabaseClient,
  input?: { dry_run?: boolean; skip_repository?: boolean },
): Promise<GrowthMediaAssetsDiagnosticsReport> {
  const execution_id = randomUUID()
  const checks: GrowthMediaAssetsDiagnosticsCheck[] = []
  const blockers: string[] = []

  const schemaProbe = await probeGrowthMediaAssetsSchema(admin)
  pushCheck(
    checks,
    "schema_tables",
    schemaProbe.ready,
    schemaProbe.ready
      ? "media_assets and media_asset_relationships are queryable."
      : schemaProbe.tables
          .filter((entry) => !entry.ok)
          .map((entry) => `${entry.table}: ${entry.error ?? "missing"}`)
          .join("; "),
  )

  if (!schemaProbe.ready) {
    blockers.push("media_assets_schema_not_ready")
  }

  runSafetySourceGuards(checks)

  let assetId: string | undefined
  if (!input?.dry_run && schemaProbe.ready && !input?.skip_repository) {
    try {
      const repositoryResult = await runRepositoryDiagnostics(admin, checks)
      assetId = repositoryResult.assetId ?? undefined
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      pushCheck(checks, "repository_crud", false, message)
      blockers.push("repository_crud_failed")
    }

    try {
      const { executeGrowthMediaAssetAnalyticsDiagnostics } = await import(
        "@/lib/growth/media/media-asset-analytics-diagnostics"
      )
      const analyticsReport = await executeGrowthMediaAssetAnalyticsDiagnostics(admin)
      for (const check of analyticsReport.checks) {
        pushCheck(checks, check.id, check.ok, check.detail)
      }
      if (analyticsReport.final_verdict === "FAIL") {
        blockers.push("analytics_crud_failed")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      pushCheck(checks, "analytics_crud", false, message)
      blockers.push("analytics_crud_failed")
    }

    try {
      const organizationId = await resolveCertOrganizationId(admin)
      if (!organizationId) {
        pushCheck(checks, "generation_org_scope", false, "Could not resolve organization for generation cert.")
        blockers.push("generation_org_scope_missing")
      } else {
        const { executeGrowthMediaVideoGenerationDiagnostics } = await import(
          "@/lib/growth/media/media-video-generation-diagnostics"
        )
        const generationReport = executeGrowthMediaVideoGenerationDiagnostics({ organizationId })
        for (const check of generationReport.checks) {
          pushCheck(checks, check.id, check.ok, check.detail)
        }
        if (generationReport.final_verdict === "FAIL") {
          blockers.push("generation_cert_failed")
        }

        const { executeGrowthMediaVoiceGenerationDiagnostics } = await import(
          "@/lib/growth/media/media-voice-generation-diagnostics"
        )
        const voiceGenerationReport = executeGrowthMediaVoiceGenerationDiagnostics({ organizationId })
        for (const check of voiceGenerationReport.checks) {
          pushCheck(checks, check.id, check.ok, check.detail)
        }
        if (voiceGenerationReport.final_verdict === "FAIL") {
          blockers.push("voice_generation_cert_failed")
        }

        const { executeGrowthMediaConversationalSessionDiagnostics } = await import(
          "@/lib/growth/media/media-conversational-session-diagnostics"
        )
        const conversationalReport = executeGrowthMediaConversationalSessionDiagnostics({ organizationId })
        for (const check of conversationalReport.checks) {
          pushCheck(checks, check.id, check.ok, check.detail)
        }
        if (conversationalReport.final_verdict === "FAIL") {
          blockers.push("conversational_session_cert_failed")
        }

        const { executeGrowthMediaAiQaDiagnostics } = await import("@/lib/growth/media/media-ai-qa-diagnostics")
        const aiQaReport = executeGrowthMediaAiQaDiagnostics({ organizationId })
        for (const check of aiQaReport.checks) {
          pushCheck(checks, check.id, check.ok, check.detail)
        }
        if (aiQaReport.final_verdict === "FAIL") {
          blockers.push("ai_qa_cert_failed")
        }

        const { executeGrowthMediaBookingHandoffDiagnostics } = await import(
          "@/lib/growth/media/media-booking-handoff-diagnostics"
        )
        const bookingHandoffReport = executeGrowthMediaBookingHandoffDiagnostics({ organizationId })
        for (const check of bookingHandoffReport.checks) {
          pushCheck(checks, check.id, check.ok, check.detail)
        }
        if (bookingHandoffReport.final_verdict === "FAIL") {
          blockers.push("booking_handoff_cert_failed")
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      pushCheck(checks, "generation_cert", false, message)
      blockers.push("generation_cert_failed")
    }
  } else if (input?.dry_run) {
    pushCheck(checks, "repository_crud", true, "Dry run — repository CRUD skipped.")
  }

  const failedChecks = checks.filter((check) => !check.ok)
  const ok = failedChecks.length === 0 && blockers.length === 0

  const safetyOk = [
    "safety_no_upload_execution",
    "safety_no_playback",
    "safety_no_ai_generation",
    "safety_no_notifications",
    "safety_no_sequence_execution",
  ].every((id) => checks.find((check) => check.id === id)?.ok === true)

  return {
    ok: ok && safetyOk,
    execution_id,
    qa_marker: GROWTH_MEDIA_ASSETS_QA_MARKER,
    checks,
    blockers,
    final_verdict: ok && safetyOk ? "PASS" : "FAIL",
    asset_id: assetId,
    no_upload_execution: true,
    no_playback: true,
    no_ai_generation: true,
    no_notifications: true,
    no_sequence_execution: true,
  }
}
