/**
 * S1.5 — Media asset foundation certification.
 *
 * Local: pnpm test:growth-media-assets
 * Integration: pnpm test:growth-media-assets:integration
 * Production: pnpm test:growth-media-assets:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import {
  bootstrapGrowthMediaAssetsCertEnv,
  describeMediaAssetsCertBootstrapFailure,
} from "../lib/growth/media/media-asset-cert-bootstrap"
import {
  GROWTH_MEDIA_ANALYTICS_EVENT_TYPES,
} from "../lib/growth/media/media-asset-analytics-types"
import {
  GROWTH_MEDIA_ASSET_API_ROUTE_PATHS,
  GROWTH_MEDIA_ASSET_MODULE_PATHS,
} from "../lib/growth/media/media-asset-production-diagnostics"
import { GROWTH_MEDIA_VIDEO_UPLOAD_QA_MARKER } from "../lib/growth/media/media-video-upload-types"
import { GROWTH_MEDIA_WEBCAM_RECORDING_QA_MARKER } from "../lib/growth/media/media-webcam-recording-types"
import { GROWTH_MEDIA_VIDEO_THUMBNAIL_QA_MARKER } from "../lib/growth/media/media-video-thumbnail-types"
import {
  GROWTH_MEDIA_ANALYTICS_MIGRATION,
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_EVENT_TYPES,
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
} from "../lib/growth/media/media-asset-analytics-types"
import {
  GROWTH_MEDIA_ANALYTICS_API_ROUTE_PATHS,
  GROWTH_MEDIA_ANALYTICS_MODULE_PATHS,
} from "../lib/growth/media/media-asset-analytics-production-diagnostics"
import { resolveMediaStorageProvider } from "../lib/growth/media/media-asset-storage-providers"
import {
  GROWTH_MEDIA_ASSET_PROVIDERS,
  GROWTH_MEDIA_ASSET_RELATIONSHIP_TYPES,
  GROWTH_MEDIA_ASSET_STATUSES,
  GROWTH_MEDIA_ASSET_TYPES,
  GROWTH_MEDIA_ASSETS_BUCKET,
  GROWTH_MEDIA_ASSETS_CONFIRM,
  GROWTH_MEDIA_ASSETS_MIGRATION,
  GROWTH_MEDIA_ASSETS_QA_MARKER,
} from "../lib/growth/media/media-asset-types"

async function runLocalRegression(): Promise<void> {
  console.log(`\n=== S1.5 local regression (${GROWTH_MEDIA_ASSETS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_MEDIA_ASSETS_QA_MARKER, "growth-media-assets-s1-5-v1")
  assert.equal(GROWTH_MEDIA_ASSETS_CONFIRM, "RUN_GROWTH_MEDIA_ASSETS_CERTIFICATION")
  assert.equal(GROWTH_MEDIA_ASSETS_MIGRATION, "20270827120700_growth_media_assets_s1_5.sql")
  assert.equal(GROWTH_MEDIA_ASSETS_BUCKET, "growth-media-assets")
  assert.equal(GROWTH_MEDIA_ASSET_TYPES.length, 10)
  assert.equal(GROWTH_MEDIA_ASSET_RELATIONSHIP_TYPES.length, 10)
  assert.equal(GROWTH_MEDIA_ASSET_PROVIDERS.length, 4)
  assert.equal(GROWTH_MEDIA_ASSET_STATUSES.length, 7)
  assert.deepEqual([...GROWTH_MEDIA_ANALYTICS_EVENT_TYPES], [
    "view",
    "play",
    "completion",
    "clickthrough",
    "download",
  ])
  console.log("  ✓ QA marker, enums, and analytics hook types")

  for (const relativePath of [
    `supabase/migrations/${GROWTH_MEDIA_ASSETS_MIGRATION}`,
    ...GROWTH_MEDIA_ASSET_MODULE_PATHS,
    ...GROWTH_MEDIA_ASSET_API_ROUTE_PATHS,
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ migration, modules, and API routes exist")

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_MEDIA_ASSETS_MIGRATION}`),
    "utf8",
  )
  for (const indexName of [
    "idx_growth_media_assets_organization",
    "idx_growth_media_assets_asset_type",
    "idx_growth_media_assets_status",
    "idx_growth_media_assets_provider",
    "idx_growth_media_assets_tags",
    "idx_growth_media_asset_relationships_asset_id",
    "idx_growth_media_asset_relationships_relationship_type",
    "idx_growth_media_asset_relationships_relationship_id",
  ]) {
    assert.ok(migration.includes(indexName), `Missing index in migration: ${indexName}`)
  }
  assert.ok(migration.includes("growth.media_assets"))
  assert.ok(migration.includes("growth.media_asset_relationships"))
  assert.ok(migration.includes("growth-media-assets"))
  assert.ok(migration.includes("requires_human_review boolean not null default true"))
  console.log("  ✓ migration tables, indexes, bucket, and human review default")

  const repositorySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/media-asset-repository.ts"),
    "utf8",
  )
  for (const fn of [
    "createMediaAsset",
    "updateMediaAsset",
    "archiveMediaAsset",
    "getMediaAsset",
    "listMediaAssets",
    "attachMediaAsset",
    "detachMediaAsset",
    "listRelationships",
    "createUploadSession",
    "completeUploadSession",
  ]) {
    assert.ok(repositorySource.includes(`export async function ${fn}`), `Missing repository fn: ${fn}`)
  }
  assert.ok(!repositorySource.includes("createGrowthNotificationsForEvent"))
  assert.ok(!repositorySource.includes("dispatchSequenceWake"))
  console.log("  ✓ repository surface area + safety guards")

  const storageSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/media-asset-storage-providers.ts"),
    "utf8",
  )
  assert.ok(storageSource.includes("LocalStubMediaStorageProvider"))
  assert.ok(storageSource.includes("SupabaseMediaStorageProvider"))
  assert.ok(storageSource.includes("FutureMediaStorageProvider"))
  assert.ok(storageSource.includes("no_upload_executed"))
  console.log("  ✓ storage provider abstraction")

  const listRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/media-assets/route.ts"),
    "utf8",
  )
  assert.ok(listRoute.includes("requireMediaAssetPlatformAccess"))
  assert.ok(listRoute.includes("no_upload_execution"))
  assert.ok(listRoute.includes("no_playback"))
  console.log("  ✓ platform list/create route auth + safety copy")

  const uploadSessionRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/media-assets/[id]/upload-session/route.ts"),
    "utf8",
  )
  assert.ok(uploadSessionRoute.includes("createUploadSession"))
  assert.ok(uploadSessionRoute.includes("no_upload_execution: true"))
  console.log("  ✓ upload session route preserves no-upload guard")

  const localProvider = resolveMediaStorageProvider("local_stub")
  const session = await localProvider.createUploadSession({
    organizationId: "00000000-0000-4000-8000-000000000001",
    assetId: "00000000-0000-4000-8000-000000000002",
    storageKey: "org/asset/original.mp4",
  })
  assert.ok(session.writeUrl?.startsWith("stub://upload/"))
  assert.equal(session.metadata.no_upload_executed, true)

  await assert.rejects(
    () => resolveMediaStorageProvider("future_s3").createUploadSession({
      organizationId: "org",
      assetId: "asset",
      storageKey: "key",
    }),
    /future_s3_not_implemented/,
  )
  console.log("  ✓ local stub session + future provider guard")

  console.log("\nS1.5 local regression PASS\n")

  console.log(`\n=== S2-A local regression (${GROWTH_MEDIA_VIDEO_UPLOAD_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_MEDIA_VIDEO_UPLOAD_QA_MARKER, "growth-media-video-upload-s2a-v1")
  console.log("  ✓ S2-A QA marker")

  const videoRoutes = [
    "app/api/platform/growth/media-assets/video/route.ts",
    "app/api/platform/growth/media-assets/video/upload-session/route.ts",
    "app/api/platform/growth/media-assets/video/complete-upload/route.ts",
    "app/api/platform/growth/media-assets/video/[id]/route.ts",
  ]
  for (const relativePath of videoRoutes) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S2-A video API routes exist")

  const videoModules = [
    "lib/growth/media/media-video-upload-types.ts",
    "lib/growth/media/media-video-upload-utils.ts",
    "lib/growth/media/media-video-upload-service.ts",
    "lib/growth/media/media-video-metadata.ts",
    "lib/growth/media/media-video-upload-route-utils.ts",
  ]
  for (const relativePath of videoModules) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S2-A video modules exist")

  const videoServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/media-video-upload-service.ts"),
    "utf8",
  )
  for (const fn of [
    "createGrowthMediaVideoAsset",
    "createGrowthMediaVideoUploadSession",
    "completeGrowthMediaVideoUpload",
    "attachGrowthMediaVideoAsset",
  ]) {
    assert.ok(videoServiceSource.includes(`export async function ${fn}`), `Missing video service fn: ${fn}`)
  }
  assert.ok(!videoServiceSource.includes("createGrowthNotificationsForEvent"))
  assert.ok(!videoServiceSource.includes("dispatchSequenceWake"))
  console.log("  ✓ video upload service surface + safety guards")

  const videoUtilsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/media-video-upload-utils.ts"),
    "utf8",
  )
  assert.ok(videoUtilsSource.includes("sanitizeMediaVideoFilename"))
  assert.ok(videoUtilsSource.includes("assertGrowthMediaVideoMimeType"))
  assert.ok(videoUtilsSource.includes("assertGrowthMediaVideoChecksum"))
  assert.ok(videoUtilsSource.includes("isUploadSessionExpired"))
  console.log("  ✓ video upload validation utilities")

  const createVideoRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/media-assets/video/route.ts"),
    "utf8",
  )
  assert.ok(createVideoRoute.includes("createGrowthMediaVideoAsset"))
  assert.ok(createVideoRoute.includes("GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS"))
  console.log("  ✓ video create route auth + safety copy")

  const blockTypesSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-template-block-types.ts"),
    "utf8",
  )
  assert.ok(blockTypesSource.includes("videoAssetId"))
  console.log("  ✓ template block video_asset_id persistence field")

  console.log("\nS2-A local regression PASS\n")

  console.log(`\n=== S2-B local regression (${GROWTH_MEDIA_WEBCAM_RECORDING_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_MEDIA_WEBCAM_RECORDING_QA_MARKER, "growth-media-webcam-recording-s2b-v1")
  console.log("  ✓ S2-B QA marker")

  const recordingComponents = [
    "components/growth/media/growth-media-webcam-recorder.tsx",
    "components/growth/media/growth-media-recording-upload-panel.tsx",
  ]
  for (const relativePath of recordingComponents) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S2-B recorder UI components exist")

  const recordingModules = [
    "lib/growth/media/media-webcam-recording-types.ts",
    "lib/growth/media/media-webcam-recording-utils.ts",
  ]
  for (const relativePath of recordingModules) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S2-B recording modules exist")

  const recordingUtilsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/media-webcam-recording-utils.ts"),
    "utf8",
  )
  for (const fn of [
    "getSupportedVideoRecordingMimeType",
    "isWebcamRecordingSupported",
    "formatRecordingDuration",
    "buildRecordedVideoFilename",
    "uploadRecordedVideoBlob",
  ]) {
    assert.ok(recordingUtilsSource.includes(`export function ${fn}`) || recordingUtilsSource.includes(`export async function ${fn}`), `Missing fn: ${fn}`)
  }
  assert.ok(recordingUtilsSource.includes("/api/platform/growth/media-assets/video"))
  assert.ok(!recordingUtilsSource.includes("createGrowthNotificationsForEvent"))
  assert.ok(!recordingUtilsSource.includes("dispatchSequenceWake"))
  console.log("  ✓ browser capability + S2-A upload reuse helpers")

  const { formatRecordingDuration, buildRecordedVideoFilename, normalizeRecordedVideoMimeType } = await import(
    "../lib/growth/media/media-webcam-recording-utils"
  )
  assert.equal(formatRecordingDuration(65), "1:05")
  assert.equal(buildRecordedVideoFilename("video/webm;codecs=vp9").endsWith(".webm"), true)
  assert.equal(buildRecordedVideoFilename("video/mp4").endsWith(".mp4"), true)
  assert.equal(normalizeRecordedVideoMimeType("video/webm;codecs=vp8"), "video/webm")
  console.log("  ✓ duration/filename/mime normalization helpers")

  const recorderSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/media/growth-media-webcam-recorder.tsx"),
    "utf8",
  )
  assert.ok(recorderSource.includes("Start recording"))
  assert.ok(recorderSource.includes("Stop recording"))
  assert.ok(recorderSource.includes("Discard"))
  assert.ok(recorderSource.includes("Retry recording"))
  assert.ok(recorderSource.includes("permission_denied"))
  assert.ok(recorderSource.includes("unsupported"))
  assert.ok(!recorderSource.includes("<video controls"))
  assert.ok(!recorderSource.includes("elevenlabs"))
  console.log("  ✓ webcam recorder states + no hosted playback player")

  const uploadPanelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/media/growth-media-recording-upload-panel.tsx"),
    "utf8",
  )
  assert.ok(uploadPanelSource.includes("uploadRecordedVideoBlob"))
  assert.ok(uploadPanelSource.includes("Uploading via signed URL"))
  assert.ok(uploadPanelSource.includes("Upload complete"))
  assert.ok(uploadPanelSource.includes("S2-A signed-upload pipeline"))
  assert.ok(!uploadPanelSource.includes("createGrowthNotificationsForEvent"))
  console.log("  ✓ recording upload panel progress + success/failure states")

  const templatePanelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/templates/growth-share-page-template-video-asset-panel.tsx"),
    "utf8",
  )
  assert.ok(templatePanelSource.includes("GrowthMediaRecordingUploadPanel"))
  assert.ok(templatePanelSource.includes("Record video"))
  assert.ok(templatePanelSource.includes("videoAssetId"))
  console.log("  ✓ template editor record-video integration (placeholder only)")

  const videoTypesSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/media-video-upload-types.ts"),
    "utf8",
  )
  assert.ok(videoTypesSource.includes('"video/webm"'))
  console.log("  ✓ WebM accepted alongside MP4 for browser recordings")

  console.log("\nS2-B local regression PASS\n")

  console.log(`\n=== S2-C local regression (${GROWTH_MEDIA_VIDEO_THUMBNAIL_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_MEDIA_VIDEO_THUMBNAIL_QA_MARKER, "growth-media-video-thumbnail-s2c-v1")
  console.log("  ✓ S2-C QA marker")

  const thumbnailRoute = "app/api/platform/growth/media-assets/video/[id]/thumbnail/route.ts"
  assert.ok(fs.existsSync(path.join(process.cwd(), thumbnailRoute)), `Missing: ${thumbnailRoute}`)
  console.log("  ✓ S2-C thumbnail API route exists")

  for (const relativePath of [
    "lib/growth/media/media-video-thumbnail-types.ts",
    "lib/growth/media/media-video-thumbnail-utils.ts",
    "lib/growth/media/media-video-thumbnail-service.ts",
    "lib/growth/media/media-video-thumbnail-route-utils.ts",
    "components/growth/media/growth-media-video-thumbnail-panel.tsx",
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S2-C thumbnail modules + UI exist")

  const thumbnailServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/media-video-thumbnail-service.ts"),
    "utf8",
  )
  for (const fn of [
    "createGrowthMediaVideoThumbnailUploadSession",
    "completeGrowthMediaVideoThumbnailUpload",
    "getGrowthMediaVideoThumbnail",
    "removeGrowthMediaVideoThumbnail",
  ]) {
    assert.ok(
      thumbnailServiceSource.includes(`export async function ${fn}`),
      `Missing thumbnail service fn: ${fn}`,
    )
  }
  assert.ok(!thumbnailServiceSource.includes("ffmpeg"))
  assert.ok(!thumbnailServiceSource.includes("createGrowthNotificationsForEvent"))
  console.log("  ✓ thumbnail service surface + no ffmpeg/notifications")

  const thumbnailUtilsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/media-video-thumbnail-utils.ts"),
    "utf8",
  )
  for (const fn of [
    "extractVideoThumbnailFromFile",
    "extractVideoThumbnailFromBlob",
    "createThumbnailBlobFromCanvas",
    "buildThumbnailFilename",
    "validateThumbnailImage",
    "uploadVideoThumbnailBlob",
  ]) {
    assert.ok(
      thumbnailUtilsSource.includes(`export function ${fn}`) ||
        thumbnailUtilsSource.includes(`export async function ${fn}`),
      `Missing thumbnail util fn: ${fn}`,
    )
  }
  console.log("  ✓ browser extraction + upload helpers")

  const { buildThumbnailFilename, assertGrowthMediaVideoThumbnailMimeType } = await import(
    "../lib/growth/media/media-video-thumbnail-utils"
  )
  assert.equal(buildThumbnailFilename("00000000-0000-4000-8000-000000000001").endsWith(".jpg"), true)
  assert.equal(assertGrowthMediaVideoThumbnailMimeType("image/png"), "image/png")
  console.log("  ✓ thumbnail filename + mime validation")

  const panelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/media/growth-media-video-thumbnail-panel.tsx"),
    "utf8",
  )
  assert.ok(panelSource.includes("Generate from recording"))
  assert.ok(panelSource.includes("Upload thumbnail"))
  assert.ok(panelSource.includes("Remove thumbnail"))
  assert.ok(!panelSource.includes("<video controls"))
  console.log("  ✓ thumbnail panel actions + no video player")

  const templatePanelSourceS2C = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/templates/growth-share-page-template-video-asset-panel.tsx"),
    "utf8",
  )
  assert.ok(templatePanelSourceS2C.includes("GrowthMediaVideoThumbnailPanel"))
  console.log("  ✓ template editor thumbnail panel integration")

  const placeholderSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/templates/growth-share-page-template-placeholder-panel.tsx"),
    "utf8",
  )
  assert.ok(placeholderSource.includes("useVideoThumbnailPreviewUrl"))
  assert.ok(placeholderSource.includes("videoAssetId"))
  console.log("  ✓ template preview thumbnail placeholder integration")

  console.log("\nS2-C local regression PASS\n")

  console.log(`\n=== S2-D local regression (${GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER, "growth-media-playback-analytics-s2d-v1")
  assert.equal(GROWTH_MEDIA_ANALYTICS_MIGRATION, "20270827120800_growth_media_asset_analytics_s2d.sql")
  assert.equal(GROWTH_MEDIA_PLAYBACK_ANALYTICS_EVENT_TYPES.length, 7)
  console.log("  ✓ S2-D QA marker + event types")

  assert.ok(fs.existsSync(path.join(process.cwd(), `supabase/migrations/${GROWTH_MEDIA_ANALYTICS_MIGRATION}`)))
  for (const relativePath of [...GROWTH_MEDIA_ANALYTICS_API_ROUTE_PATHS, ...GROWTH_MEDIA_ANALYTICS_MODULE_PATHS]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S2-D migration, routes, modules, and hook exist")

  const analyticsServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/media-asset-analytics-service.ts"),
    "utf8",
  )
  assert.ok(!analyticsServiceSource.includes("createGrowthNotificationsForEvent"))
  assert.ok(!analyticsServiceSource.includes("dispatchSequenceWake"))
  assert.ok(!analyticsServiceSource.includes("ffmpeg"))
  console.log("  ✓ analytics service safety guards")

  const { computeMediaAssetEventRollup } = await import("../lib/growth/media/media-asset-analytics-repository")
  const rollup = computeMediaAssetEventRollup([
    {
      id: "1",
      organizationId: "org",
      assetId: "asset",
      relationshipId: null,
      eventType: "video_viewed",
      leadId: null,
      sharePageId: null,
      templateId: null,
      sequenceId: null,
      sessionId: "s1",
      anonymousIdHash: null,
      eventTimestamp: "2026-06-16T00:00:00.000Z",
      progressSeconds: null,
      progressPercent: null,
      durationSeconds: null,
      ctaKey: null,
      metadata: {},
      createdAt: "2026-06-16T00:00:00.000Z",
    },
    {
      id: "2",
      organizationId: "org",
      assetId: "asset",
      relationshipId: null,
      eventType: "video_play_started",
      leadId: null,
      sharePageId: null,
      templateId: null,
      sequenceId: null,
      sessionId: "s1",
      anonymousIdHash: null,
      eventTimestamp: "2026-06-16T00:00:01.000Z",
      progressSeconds: null,
      progressPercent: null,
      durationSeconds: 60,
      ctaKey: null,
      metadata: {},
      createdAt: "2026-06-16T00:00:01.000Z",
    },
    {
      id: "3",
      organizationId: "org",
      assetId: "asset",
      relationshipId: null,
      eventType: "video_progress",
      leadId: null,
      sharePageId: null,
      templateId: null,
      sequenceId: null,
      sessionId: "s1",
      anonymousIdHash: null,
      eventTimestamp: "2026-06-16T00:00:02.000Z",
      progressSeconds: 54,
      progressPercent: 90,
      durationSeconds: 60,
      ctaKey: null,
      metadata: {},
      createdAt: "2026-06-16T00:00:02.000Z",
    },
    {
      id: "4",
      organizationId: "org",
      assetId: "asset",
      relationshipId: null,
      eventType: "video_completed",
      leadId: null,
      sharePageId: null,
      templateId: null,
      sequenceId: null,
      sessionId: "s1",
      anonymousIdHash: null,
      eventTimestamp: "2026-06-16T00:00:03.000Z",
      progressSeconds: 60,
      progressPercent: 100,
      durationSeconds: 60,
      ctaKey: null,
      metadata: {},
      createdAt: "2026-06-16T00:00:03.000Z",
    },
  ])
  assert.equal(rollup.views, 1)
  assert.equal(rollup.playStarts, 1)
  assert.equal(rollup.completions, 1)
  assert.equal(rollup.averageWatchSeconds, 60)
  console.log("  ✓ deterministic rollup math")

  const { shouldEmitGrowthMediaPlaybackAnalytics } = await import(
    "../hooks/growth/use-growth-media-playback-analytics"
  )
  assert.equal(
    shouldEmitGrowthMediaPlaybackAnalytics({
      assetId: "00000000-0000-4000-8000-000000000001",
      analyticsPreviewMode: true,
      trackingToken: "token",
      enabled: true,
    }),
    false,
  )
  assert.equal(
    shouldEmitGrowthMediaPlaybackAnalytics({
      assetId: "00000000-0000-4000-8000-000000000001",
      analyticsPreviewMode: false,
      trackingToken: null,
      enabled: true,
    }),
    false,
  )
  console.log("  ✓ preview/editor analytics emission blocked")

  const previewContextSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-template-preview-context.ts"),
    "utf8",
  )
  assert.ok(previewContextSource.includes("analyticsPreviewMode: true"))
  console.log("  ✓ template preview analyticsPreviewMode default")

  console.log("\nS2-D local regression PASS\n")

  console.log(`\n=== S2-E local regression (growth-media-video-overlays-s2e-v1) ===\n`)

  const { GROWTH_MEDIA_VIDEO_OVERLAY_QA_MARKER, GROWTH_MEDIA_VIDEO_OVERLAY_SAFETY_FLAGS } = await import(
    "../lib/growth/media/media-video-overlay-types"
  )
  assert.equal(GROWTH_MEDIA_VIDEO_OVERLAY_QA_MARKER, "growth-media-video-overlays-s2e-v1")
  assert.equal(GROWTH_MEDIA_VIDEO_OVERLAY_SAFETY_FLAGS.no_rendered_video, true)
  assert.equal(GROWTH_MEDIA_VIDEO_OVERLAY_SAFETY_FLAGS.no_media_personalization, true)
  assert.equal(GROWTH_MEDIA_VIDEO_OVERLAY_SAFETY_FLAGS.no_playback, true)
  assert.equal(GROWTH_MEDIA_VIDEO_OVERLAY_SAFETY_FLAGS.no_ai_generation, true)
  console.log("  ✓ S2-E QA marker + safety flags")

  for (const relativePath of [
    "lib/growth/media/media-video-overlay-types.ts",
    "lib/growth/media/media-video-overlay-utils.ts",
    "components/growth/media/growth-media-video-overlay-builder.tsx",
    "components/growth/media/growth-media-video-overlay-preview.tsx",
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S2-E overlay modules + UI exist")

  const {
    addVideoOverlayToSpec,
    createDefaultVideoOverlaySpec,
    extractVideoOverlayMergeFields,
    resolveVideoOverlayItems,
    validateVideoOverlaySpec,
    buildVideoOverlayAllowedMergeKeys,
  } = await import("../lib/growth/media/media-video-overlay-utils")

  const overlaySpec = addVideoOverlayToSpec(createDefaultVideoOverlaySpec(), "lower_third")
  overlaySpec.overlays[0].textTemplate = "Hi {{prospect.name}} at {{company.name}}"
  const validation = validateVideoOverlaySpec({
    spec: overlaySpec,
    allowedMergeKeys: buildVideoOverlayAllowedMergeKeys(),
  })
  assert.equal(validation.valid, true)
  assert.deepEqual(extractVideoOverlayMergeFields(overlaySpec).sort(), ["company.name", "prospect.name"])
  console.log("  ✓ overlay spec type validation + merge-field extraction")

  const resolved = resolveVideoOverlayItems(overlaySpec, {
    "prospect.name": "Alex Rivera",
    "company.name": "Summit Field Services",
  })
  assert.ok(resolved[0]?.resolvedText.includes("Alex Rivera"))
  console.log("  ✓ overlay preview merge resolution")

  const overlayBlockTypesSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-template-block-types.ts"),
    "utf8",
  )
  assert.ok(overlayBlockTypesSource.includes("settings?: GrowthSharePageTemplateVideoPlaceholderSettings"))
  assert.ok(overlayBlockTypesSource.includes("overlaySpec"))
  console.log("  ✓ overlay spec persisted on video_placeholder block type")

  const videoPanelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/templates/growth-share-page-template-video-asset-panel.tsx"),
    "utf8",
  )
  assert.ok(videoPanelSource.includes("GrowthMediaVideoOverlayBuilder"))
  assert.ok(!videoPanelSource.includes("<video"))
  console.log("  ✓ video asset panel overlay builder integration (no playback player)")

  const overlayPreviewSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/media/growth-media-video-overlay-preview.tsx"),
    "utf8",
  )
  assert.ok(overlayPreviewSource.includes("no playback"))
  assert.ok(!overlayPreviewSource.includes("useGrowthMediaPlaybackAnalytics"))
  console.log("  ✓ overlay preview static render + no analytics hook")

  console.log("\nS2-E local regression PASS\n")

  console.log(`\n=== S2-F local regression (growth-media-video-generation-s2f-v1) ===\n`)

  const { GROWTH_MEDIA_VIDEO_GENERATION_QA_MARKER, GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS } =
    await import("../lib/growth/media/media-video-generation-types")
  assert.equal(GROWTH_MEDIA_VIDEO_GENERATION_QA_MARKER, "growth-media-video-generation-s2f-v1")
  assert.equal(GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS.provider_execution_enabled, false)
  assert.equal(GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS.no_video_generation_executed, true)
  console.log("  ✓ S2-F QA marker + safety flags")

  for (const relativePath of [
    "lib/growth/media/media-avatar-types.ts",
    "lib/growth/media/media-video-generation-types.ts",
    "lib/growth/media/media-video-generation-utils.ts",
    "lib/growth/media/media-video-generation-service.ts",
    "lib/growth/media/media-video-generation-diagnostics.ts",
    "lib/growth/media/providers/elevenlabs-video-provider-types.ts",
    "lib/growth/media/providers/elevenlabs-video-provider.ts",
    "lib/growth/media/providers/elevenlabs-video-provider-diagnostics.ts",
    "app/api/platform/growth/media-assets/video/generation/route.ts",
    "app/api/platform/growth/media-assets/video/generation/[id]/route.ts",
    "app/api/platform/growth/media-assets/video/generation/[id]/cancel/route.ts",
    "components/growth/media/growth-media-ai-video-panel.tsx",
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S2-F modules, provider abstraction, APIs, and UI exist")

  const { validateMediaAvatarId, listEnabledMediaAvatars } = await import("../lib/growth/media/media-avatar-types")
  assert.ok(listEnabledMediaAvatars().length >= 3)
  assert.ok(validateMediaAvatarId("elevenlabs-avatar-jordan"))
  console.log("  ✓ avatar metadata validation")

  const { buildPersonalizedScriptPreview } = await import("../lib/growth/media/media-video-generation-utils")
  const scriptPreview = buildPersonalizedScriptPreview({
    scriptTemplate: "Hi {{prospect.name}} — {{sender.name}} @ {{sender.company}}",
    personalizationContext: { prospectName: "Alex Rivera", senderName: "Jordan Lee", senderCompany: "Equipify" },
  })
  assert.ok(scriptPreview.resolvedScript.includes("Alex Rivera"))
  assert.ok(scriptPreview.resolvedScript.includes("Jordan Lee"))
  console.log("  ✓ script merge resolution")

  const {
    createGenerationRequest,
    queueGeneration,
    cancelGeneration,
    resetMediaVideoGenerationStoreForCert,
  } = await import("../lib/growth/media/media-video-generation-service")
  resetMediaVideoGenerationStoreForCert()
  const generation = createGenerationRequest({
    organizationId: "00000000-0000-4000-8000-000000000001",
    avatarId: "elevenlabs-avatar-jordan",
    scriptTemplate: "Hi {{prospect.name}}",
  })
  assert.equal(generation.status, "draft")
  assert.equal(generation.outputAssetId, null)
  const queued = queueGeneration(generation.generationId)
  assert.equal(queued.status, "queued")
  assert.equal(queued.providerJobId, null)
  const cancelled = cancelGeneration(generation.generationId, generation.organizationId)
  assert.equal(cancelled.status, "cancelled")
  resetMediaVideoGenerationStoreForCert()
  console.log("  ✓ generation lifecycle + cancellation (in-memory, no provider execution)")

  const providerSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/providers/elevenlabs-video-provider.ts"),
    "utf8",
  )
  assert.ok(providerSource.includes("provider_execution_disabled"))
  assert.ok(!providerSource.includes("ELEVENLABS_API_KEY"))
  assert.ok(!providerSource.includes("fetch("))
  console.log("  ✓ provider abstraction guards (no API keys, no fetch)")

  const aiPanelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/media/growth-media-ai-video-panel.tsx"),
    "utf8",
  )
  assert.ok(aiPanelSource.includes("GrowthMediaAiVideoPanel"))
  assert.ok(aiPanelSource.includes("no Generate button"))
  assert.ok(!aiPanelSource.includes("useGrowthMediaPlaybackAnalytics"))
  console.log("  ✓ AI video panel preview-only (no generate, no analytics)")

  const blockTypesSourceS2F = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-template-block-types.ts"),
    "utf8",
  )
  assert.ok(blockTypesSourceS2F.includes("aiVideo"))
  console.log("  ✓ template block aiVideo settings persistence")

  console.log("\nS2-F local regression PASS\n")

  console.log(`\n=== S2-G local regression (growth-media-voice-generation-s2g-v1) ===\n`)

  const { GROWTH_MEDIA_VOICE_GENERATION_QA_MARKER, GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS } =
    await import("../lib/growth/media/media-voice-generation-types")
  assert.equal(GROWTH_MEDIA_VOICE_GENERATION_QA_MARKER, "growth-media-voice-generation-s2g-v1")
  assert.equal(GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.provider_execution_enabled, false)
  assert.equal(GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.no_voice_generation_executed, true)
  assert.equal(GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.no_generated_audio_assets, true)
  assert.equal(GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.no_playback, true)
  assert.equal(GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.no_notifications, true)
  assert.equal(GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.no_sequence_execution, true)
  console.log("  ✓ S2-G QA marker + safety flags")

  for (const relativePath of [
    "lib/growth/media/media-voice-types.ts",
    "lib/growth/media/media-voice-generation-types.ts",
    "lib/growth/media/media-voice-generation-utils.ts",
    "lib/growth/media/media-voice-generation-service.ts",
    "lib/growth/media/media-voice-generation-diagnostics.ts",
    "lib/growth/media/providers/elevenlabs-voice-provider-types.ts",
    "lib/growth/media/providers/elevenlabs-voice-provider.ts",
    "lib/growth/media/providers/elevenlabs-voice-provider-diagnostics.ts",
    "app/api/platform/growth/media-assets/voice/generation/route.ts",
    "app/api/platform/growth/media-assets/voice/generation/[id]/route.ts",
    "app/api/platform/growth/media-assets/voice/generation/[id]/cancel/route.ts",
    "components/growth/media/growth-media-ai-voice-panel.tsx",
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S2-G modules, provider abstraction, APIs, and UI exist")

  const { validateMediaVoiceId, listEnabledMediaVoices } = await import("../lib/growth/media/media-voice-types")
  assert.ok(listEnabledMediaVoices().length >= 3)
  assert.ok(validateMediaVoiceId("elevenlabs-voice-jordan-clone"))
  console.log("  ✓ voice metadata validation")

  const { buildPersonalizedVoiceScriptPreview } = await import("../lib/growth/media/media-voice-generation-utils")
  const voiceScriptPreview = buildPersonalizedVoiceScriptPreview({
    scriptTemplate: "Hi {{prospect.name}} — {{sender.name}} @ {{sender.company}}",
    personalizationContext: { prospectName: "Alex Rivera", senderName: "Jordan Lee", senderCompany: "Equipify" },
  })
  assert.ok(voiceScriptPreview.resolvedScript.includes("Alex Rivera"))
  assert.ok(voiceScriptPreview.resolvedScript.includes("Jordan Lee"))
  console.log("  ✓ voice script merge resolution")

  const {
    createGenerationRequest: createVoiceGenerationRequest,
    queueGeneration: queueVoiceGeneration,
    cancelGeneration: cancelVoiceGeneration,
    resetMediaVoiceGenerationStoreForCert,
  } = await import("../lib/growth/media/media-voice-generation-service")
  resetMediaVoiceGenerationStoreForCert()
  const voiceGeneration = createVoiceGenerationRequest({
    organizationId: "00000000-0000-4000-8000-000000000001",
    voiceId: "elevenlabs-voice-jordan-clone",
    scriptTemplate: "Hi {{prospect.name}}",
  })
  assert.equal(voiceGeneration.status, "draft")
  assert.equal(voiceGeneration.outputAssetId, null)
  const voiceQueued = queueVoiceGeneration(voiceGeneration.generationId)
  assert.equal(voiceQueued.status, "queued")
  assert.equal(voiceQueued.providerJobId, null)
  const voiceCancelled = cancelVoiceGeneration(voiceGeneration.generationId, voiceGeneration.organizationId)
  assert.equal(voiceCancelled.status, "cancelled")
  resetMediaVoiceGenerationStoreForCert()
  console.log("  ✓ voice generation lifecycle + cancellation (in-memory, no provider execution)")

  const voiceProviderSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/providers/elevenlabs-voice-provider.ts"),
    "utf8",
  )
  assert.ok(voiceProviderSource.includes("provider_execution_disabled"))
  assert.ok(!voiceProviderSource.includes("ELEVENLABS_API_KEY"))
  assert.ok(!voiceProviderSource.includes("fetch("))
  console.log("  ✓ voice provider abstraction guards (no API keys, no fetch)")

  const voicePanelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/media/growth-media-ai-voice-panel.tsx"),
    "utf8",
  )
  assert.ok(voicePanelSource.includes("GrowthMediaAiVoicePanel"))
  assert.ok(voicePanelSource.includes("no Generate button"))
  assert.ok(!voicePanelSource.includes("useGrowthMediaPlaybackAnalytics"))
  console.log("  ✓ AI voice panel preview-only (no generate, no playback, no analytics)")

  const blockTypesSourceS2G = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-template-block-types.ts"),
    "utf8",
  )
  assert.ok(blockTypesSourceS2G.includes("voiceClone"))
  console.log("  ✓ template block aiVideo.voiceClone settings persistence")

  console.log("\nS2-G local regression PASS\n")

  console.log(`\n=== S2-H local regression (growth-media-conversational-session-s2h-v1) ===\n`)

  const { GROWTH_MEDIA_CONVERSATIONAL_SESSION_QA_MARKER, GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS } =
    await import("../lib/growth/media/media-conversational-session-types")
  assert.equal(GROWTH_MEDIA_CONVERSATIONAL_SESSION_QA_MARKER, "growth-media-conversational-session-s2h-v1")
  assert.equal(GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.provider_execution_enabled, false)
  assert.equal(GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.no_conversation_execution, true)
  assert.equal(GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.no_generated_media_assets, true)
  assert.equal(GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.no_playback, true)
  assert.equal(GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.no_notifications, true)
  assert.equal(GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.no_sequence_execution, true)
  console.log("  ✓ S2-H QA marker + safety flags")

  for (const relativePath of [
    "lib/growth/media/media-conversational-agent-types.ts",
    "lib/growth/media/media-conversational-qualification-types.ts",
    "lib/growth/media/media-conversational-session-types.ts",
    "lib/growth/media/media-conversational-session-utils.ts",
    "lib/growth/media/media-conversational-session-service.ts",
    "lib/growth/media/media-conversational-session-diagnostics.ts",
    "lib/growth/media/providers/retell-video-agent-provider-types.ts",
    "lib/growth/media/providers/retell-video-agent-provider.ts",
    "lib/growth/media/providers/retell-video-agent-provider-diagnostics.ts",
    "app/api/platform/growth/media-assets/conversation/route.ts",
    "app/api/platform/growth/media-assets/conversation/[id]/route.ts",
    "app/api/platform/growth/media-assets/conversation/[id]/cancel/route.ts",
    "components/growth/media/growth-media-conversational-agent-panel.tsx",
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S2-H modules, provider abstraction, APIs, and UI exist")

  const { validateConversationalAgentId, listEnabledConversationalAgents } = await import(
    "../lib/growth/media/media-conversational-agent-types"
  )
  assert.ok(listEnabledConversationalAgents().length >= 3)
  assert.ok(validateConversationalAgentId("retell-agent-jordan-qualifier"))
  console.log("  ✓ agent metadata validation")

  const { validateConversationalQualificationGoal } = await import(
    "../lib/growth/media/media-conversational-qualification-types"
  )
  assert.ok(validateConversationalQualificationGoal("meeting_readiness"))
  console.log("  ✓ qualification definition validation")

  const {
    buildConversationPreview,
    buildQualificationPreview,
    evaluateQualificationState,
  } = await import("../lib/growth/media/media-conversational-session-utils")
  const conversationPreview = buildConversationPreview({
    agentId: "retell-agent-jordan-qualifier",
    systemPromptTemplate: "Hi {{prospect.name}} — {{sender.name}} @ {{sender.company}}",
    conversationContext: { prospectName: "Alex Rivera", senderName: "Jordan Lee", senderCompany: "Equipify" },
  })
  assert.ok(conversationPreview.resolvedPrompt.includes("Alex Rivera"))
  assert.ok(conversationPreview.resolvedPrompt.includes("Jordan Lee"))
  console.log("  ✓ prompt merge resolution")

  const qualificationPreview = buildQualificationPreview({ qualificationGoal: "meeting_readiness" })
  assert.ok(qualificationPreview.steps.length >= 3)
  console.log("  ✓ qualification preview steps")

  const evaluation = evaluateQualificationState({ qualificationGoal: "booking_recommendation" })
  assert.equal(evaluation.meetingRecommendation.readinessTier, "ready")
  console.log("  ✓ qualification state evaluation")

  const {
    createConversationSession,
    startConversation,
    cancelConversation,
    resetMediaConversationalSessionStoreForCert,
  } = await import("../lib/growth/media/media-conversational-session-service")
  resetMediaConversationalSessionStoreForCert()
  const conversationalSession = createConversationSession({
    organizationId: "00000000-0000-4000-8000-000000000001",
    agentId: "retell-agent-jordan-qualifier",
    qualificationGoal: "meeting_readiness",
    systemPromptTemplate: "Hi {{prospect.name}}",
  })
  assert.equal(conversationalSession.status, "draft")
  assert.equal(conversationalSession.transcript, null)
  assert.equal(conversationalSession.providerSessionId, null)
  const conversationalReady = startConversation(conversationalSession.sessionId, conversationalSession.organizationId)
  assert.equal(conversationalReady.status, "ready")
  const conversationalCancelled = cancelConversation(
    conversationalSession.sessionId,
    conversationalSession.organizationId,
  )
  assert.equal(conversationalCancelled.status, "cancelled")
  resetMediaConversationalSessionStoreForCert()
  console.log("  ✓ conversation lifecycle + cancellation (in-memory, no provider execution)")

  const retellProviderSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/providers/retell-video-agent-provider.ts"),
    "utf8",
  )
  assert.ok(retellProviderSource.includes("provider_execution_disabled"))
  assert.ok(!retellProviderSource.includes("RETELL_API_KEY"))
  assert.ok(!retellProviderSource.includes("fetch("))
  assert.ok(!retellProviderSource.includes("WebRTC"))
  console.log("  ✓ Retell provider abstraction guards (no API keys, no fetch, no WebRTC)")

  const conversationalPanelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/media/growth-media-conversational-agent-panel.tsx"),
    "utf8",
  )
  assert.ok(conversationalPanelSource.includes("GrowthMediaConversationalAgentPanel"))
  assert.ok(conversationalPanelSource.includes("no Start Conversation button"))
  assert.ok(!conversationalPanelSource.includes("useGrowthMediaPlaybackAnalytics"))
  console.log("  ✓ conversational agent panel preview-only (no start, no playback, no analytics)")

  const blockTypesSourceS2H = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-template-block-types.ts"),
    "utf8",
  )
  assert.ok(blockTypesSourceS2H.includes("conversationalAgent"))
  console.log("  ✓ template block aiVideo.conversationalAgent settings persistence")

  console.log("\nS2-H local regression PASS\n")

  console.log(`\n=== S2-I local regression (growth-media-ai-qa-s2i-v1) ===\n`)

  const { GROWTH_MEDIA_AI_QA_QA_MARKER, GROWTH_MEDIA_AI_QA_SAFETY_FLAGS } = await import(
    "../lib/growth/media/media-ai-qa-types"
  )
  assert.equal(GROWTH_MEDIA_AI_QA_QA_MARKER, "growth-media-ai-qa-s2i-v1")
  assert.equal(GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.provider_execution_enabled, false)
  assert.equal(GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_ai_answer_generated, true)
  assert.equal(GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_retrieval_executed, true)
  assert.equal(GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_public_qa_widget, true)
  assert.equal(GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_notifications, true)
  assert.equal(GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_sequence_execution, true)
  console.log("  ✓ S2-I QA marker + safety flags")

  for (const relativePath of [
    "lib/growth/media/media-ai-qa-types.ts",
    "lib/growth/media/media-ai-qa-policy-types.ts",
    "lib/growth/media/media-ai-qa-knowledge-types.ts",
    "lib/growth/media/media-ai-qa-utils.ts",
    "lib/growth/media/media-ai-qa-service.ts",
    "lib/growth/media/media-ai-qa-diagnostics.ts",
    "app/api/platform/growth/media-assets/qa/route.ts",
    "app/api/platform/growth/media-assets/qa/[id]/route.ts",
    "app/api/platform/growth/media-assets/qa/[id]/cancel/route.ts",
    "components/growth/media/growth-media-ai-qa-panel.tsx",
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S2-I modules, APIs, and UI exist")

  const { validateQaPolicy } = await import("../lib/growth/media/media-ai-qa-policy-types")
  assert.ok(validateQaPolicy("qa-policy-safe-default"))
  console.log("  ✓ answer policy validation")

  const { validateKnowledgeSourceRefs } = await import("../lib/growth/media/media-ai-qa-knowledge-types")
  assert.ok(validateKnowledgeSourceRefs([{ sourceType: "product_faq", enabled: true }]))
  console.log("  ✓ knowledge source ref validation")

  const {
    buildQuestionPreview,
    buildSafeAnswerPreview,
    buildBookingRecommendationPreview,
  } = await import("../lib/growth/media/media-ai-qa-utils")
  const aiQaQuestionPreview = buildQuestionPreview({
    questionTemplate: "Hi {{prospect.name}}, ask us anything about {{company.name}}",
    personalizationContext: { prospectName: "Alex Rivera", companyName: "Summit Field Services" },
  })
  assert.ok(aiQaQuestionPreview.resolvedQuestion.includes("Alex Rivera"))
  console.log("  ✓ prompt merge resolution")

  const aiQaSafeAnswer = buildSafeAnswerPreview({
    policyId: "qa-policy-safe-default",
    questionTemplate: "What is your pricing?",
    personalizationContext: { prospectName: "Alex Rivera" },
  })
  assert.ok(aiQaSafeAnswer.usesFallback)
  assert.ok(aiQaSafeAnswer.requiresHumanReview)
  console.log("  ✓ safe answer preview")

  const aiQaBookingPreview = buildBookingRecommendationPreview({
    bookingHandoffEnabled: true,
    qualificationGoal: "booking_recommendation",
    policyId: "qa-policy-qualification-bridge",
  })
  assert.ok(aiQaBookingPreview.handoffReady)
  console.log("  ✓ booking recommendation preview")

  const {
    createQaSession,
    cancelQaSession,
    resetMediaAiQaStoreForCert,
  } = await import("../lib/growth/media/media-ai-qa-service")
  resetMediaAiQaStoreForCert()
  const aiQaSession = createQaSession({
    organizationId: "00000000-0000-4000-8000-000000000001",
    policyId: "qa-policy-share-page-guided",
    questionTemplate: "What can {{sender.company}} help {{prospect.name}} with?",
    knowledgeSourceRefs: [{ sourceType: "share_page_template", enabled: true }],
    bookingHandoffEnabled: true,
  })
  assert.equal(aiQaSession.status, "draft")
  assert.ok(aiQaSession.suggestedAnswer)
  const aiQaCancelled = cancelQaSession(aiQaSession.qaId, aiQaSession.organizationId)
  assert.equal(aiQaCancelled.status, "cancelled")
  resetMediaAiQaStoreForCert()
  console.log("  ✓ Q&A lifecycle + cancellation (in-memory, no LLM, no retrieval)")

  const aiQaServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/media-ai-qa-service.ts"),
    "utf8",
  )
  assert.ok(!aiQaServiceSource.includes("openai"))
  assert.ok(!aiQaServiceSource.includes("anthropic"))
  assert.ok(!aiQaServiceSource.includes("fetch("))
  console.log("  ✓ Q&A service guards (no LLM calls, no fetch, no retrieval)")

  const aiQaPanelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/media/growth-media-ai-qa-panel.tsx"),
    "utf8",
  )
  assert.ok(aiQaPanelSource.includes("GrowthMediaAiQaPanel"))
  assert.ok(aiQaPanelSource.includes("no public Q&A widget"))
  assert.ok(!aiQaPanelSource.includes("useGrowthMediaPlaybackAnalytics"))
  console.log("  ✓ AI Q&A panel preview-only (no widget, no provider execution, no analytics)")

  const blockTypesSourceS2I = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-template-block-types.ts"),
    "utf8",
  )
  assert.ok(blockTypesSourceS2I.includes("aiQa"))
  console.log("  ✓ template block conversationalAgent.aiQa settings persistence")

  console.log("\nS2-I local regression PASS\n")

  console.log(`\n=== S2-J local regression (growth-media-booking-handoff-s2j-v1) ===\n`)

  const { GROWTH_MEDIA_BOOKING_HANDOFF_QA_MARKER, GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS } = await import(
    "../lib/growth/media/media-booking-handoff-types"
  )
  assert.equal(GROWTH_MEDIA_BOOKING_HANDOFF_QA_MARKER, "growth-media-booking-handoff-s2j-v1")
  assert.equal(GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.calendar_execution_enabled, false)
  assert.equal(GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.booking_execution_enabled, false)
  assert.equal(GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.no_calendar_creation, true)
  assert.equal(GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.no_notifications, true)
  assert.equal(GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.no_sequence_execution, true)
  assert.equal(GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.requires_human_review, true)
  console.log("  ✓ S2-J QA marker + safety flags")

  for (const relativePath of [
    "lib/growth/media/media-booking-handoff-types.ts",
    "lib/growth/media/media-meeting-readiness-types.ts",
    "lib/growth/media/media-booking-handoff-utils.ts",
    "lib/growth/media/media-booking-handoff-service.ts",
    "lib/growth/media/media-booking-handoff-diagnostics.ts",
    "app/api/platform/growth/media-assets/booking-handoff/route.ts",
    "app/api/platform/growth/media-assets/booking-handoff/[id]/route.ts",
    "app/api/platform/growth/media-assets/booking-handoff/[id]/cancel/route.ts",
    "components/growth/media/growth-media-booking-handoff-panel.tsx",
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ S2-J modules, APIs, and UI exist")

  const {
    evaluateMeetingReadiness,
    buildBookingPreview,
    buildRecommendedAgenda,
    buildRecommendedAttendees,
    buildNextStepRecommendations,
    validateBookingHandoffQualificationGoal,
  } = await import("../lib/growth/media/media-booking-handoff-utils")
  assert.ok(validateBookingHandoffQualificationGoal("meeting_readiness"))
  console.log("  ✓ qualification bridge validation")

  const handoffReadiness = evaluateMeetingReadiness({
    qualificationGoal: "booking_recommendation",
    aiQaEnabled: true,
    conversationEnabled: true,
    bookingHandoffEnabled: true,
  })
  assert.ok(handoffReadiness.readinessScore >= 60)
  console.log("  ✓ readiness scoring")

  const handoffPreview = buildBookingPreview({
    qualificationGoal: "meeting_readiness",
    prospectName: "Alex Rivera",
    companyName: "Summit Field Services",
    conversationEnabled: true,
    aiQaEnabled: true,
  })
  assert.ok(handoffPreview.recommendation.recommendedMeetingType.includes("Discovery"))
  console.log("  ✓ booking recommendation generation")

  const handoffAgenda = buildRecommendedAgenda({
    qualificationGoal: "meeting_readiness",
    readiness: handoffReadiness,
    prospectName: "Alex Rivera",
    companyName: "Summit Field Services",
  })
  assert.ok(handoffAgenda.includes("Alex Rivera"))
  console.log("  ✓ agenda generation")

  const handoffAttendees = buildRecommendedAttendees({
    qualificationGoal: "buying_committee_discovery",
    readiness: evaluateMeetingReadiness({ qualificationGoal: "buying_committee_discovery" }),
  })
  assert.ok(handoffAttendees.includes("economic_buyer"))
  console.log("  ✓ attendee recommendation generation")

  const handoffNextSteps = buildNextStepRecommendations({
    qualificationGoal: "next_best_action",
    readiness: evaluateMeetingReadiness({ qualificationGoal: "next_best_action" }),
  })
  assert.ok(handoffNextSteps.length >= 2)
  console.log("  ✓ next-step recommendations")

  const {
    createBookingHandoff,
    cancelBookingHandoff,
    resetMediaBookingHandoffStoreForCert,
  } = await import("../lib/growth/media/media-booking-handoff-service")
  resetMediaBookingHandoffStoreForCert()
  const handoffRecord = createBookingHandoff({
    organizationId: "00000000-0000-4000-8000-000000000001",
    qualificationGoal: "booking_recommendation",
    prospectName: "Alex Rivera",
    companyName: "Summit Field Services",
    aiQaEnabled: true,
    conversationEnabled: true,
  })
  assert.ok(handoffRecord.status === "ready" || handoffRecord.status === "draft")
  const handoffCancelled = cancelBookingHandoff(handoffRecord.handoffId, handoffRecord.organizationId)
  assert.equal(handoffCancelled.status, "cancelled")
  resetMediaBookingHandoffStoreForCert()
  console.log("  ✓ booking handoff lifecycle + cancellation (in-memory, no calendar execution)")

  const handoffServiceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/media/media-booking-handoff-service.ts"),
    "utf8",
  )
  assert.ok(!handoffServiceSource.includes("googleapis"))
  assert.ok(!handoffServiceSource.includes("Google Calendar"))
  assert.ok(!handoffServiceSource.includes("fetch("))
  console.log("  ✓ booking handoff service guards (no calendar, no fetch)")

  const handoffPanelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/media/growth-media-booking-handoff-panel.tsx"),
    "utf8",
  )
  assert.ok(handoffPanelSource.includes("GrowthMediaBookingHandoffPanel"))
  assert.ok(handoffPanelSource.includes("no scheduling"))
  assert.ok(!handoffPanelSource.includes("useGrowthMediaPlaybackAnalytics"))
  console.log("  ✓ booking handoff panel preview-only (no scheduling, no analytics)")

  const blockTypesSourceS2J = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-template-block-types.ts"),
    "utf8",
  )
  assert.ok(blockTypesSourceS2J.includes("bookingHandoff"))
  console.log("  ✓ template block conversationalAgent.bookingHandoff settings persistence")

  console.log("\nS2-J local regression PASS\n")
}

async function runIntegrationDiagnostics(): Promise<Record<string, unknown>> {
  process.env.GROWTH_MEDIA_ASSETS_CERT_ALLOW_LOCAL = process.env.GROWTH_MEDIA_ASSETS_CERT_ALLOW_LOCAL ?? "1"

  const boot = bootstrapGrowthMediaAssetsCertEnv()
  if (!boot) return { ok: false, final_verdict: "FAIL", error: "supabase_unavailable" }

  process.env.NEXT_PUBLIC_SUPABASE_URL = boot.url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || boot.jwt

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { executeGrowthMediaAssetsDiagnostics } = await import("../lib/growth/media/media-asset-diagnostics")
  return executeGrowthMediaAssetsDiagnostics(admin)
}

async function runProductionDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthMediaAssetsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    return describeMediaAssetsCertBootstrapFailure({ requireVercelProductionEnvRun: true })
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { executeGrowthMediaAssetsProductionDiagnostics } = await import(
    "../lib/growth/media/media-asset-production-diagnostics"
  )
  return executeGrowthMediaAssetsProductionDiagnostics(admin)
}

async function main(): Promise<void> {
  const production = process.argv.includes("--production")
  const integration = process.argv.includes("--integration") || production
  await runLocalRegression()

  if (!integration) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          qa_marker: GROWTH_MEDIA_ASSETS_QA_MARKER,
          hint: "Apply migration then run pnpm test:growth-media-assets:integration",
        },
        null,
        2,
      ),
    )
    return
  }

  const report = production ? await runProductionDiagnostics() : await runIntegrationDiagnostics()
  console.log(JSON.stringify(report, null, 2))
  if (report.final_verdict !== "PASS" && report.final_verdict !== "SKIP") {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
