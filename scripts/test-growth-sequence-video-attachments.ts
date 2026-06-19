/**
 * Growth Engine D1 — Sequence video attachment orchestration certification.
 *
 * Local: pnpm test:growth-sequence-video-attachments
 * Production: pnpm test:growth-sequence-video-attachments:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_SEQUENCE_VIDEO_ATTACHMENT_CONFIRM,
  GROWTH_SEQUENCE_VIDEO_ATTACHMENT_MIGRATION,
  GROWTH_SEQUENCE_VIDEO_ATTACHMENT_QA_MARKER,
} from "../lib/growth/sequences/growth-sequence-video-attachment-types"
import { mapSequenceVideoAttachmentRow } from "../lib/growth/sequences/growth-sequence-video-attachment-service"
import {
  buildSequenceVideoAttachmentAiPayload,
  renderSequenceVideoChannelPreview,
  validateSequenceVideoChannelCompatibility,
} from "../lib/growth/sequences/growth-sequence-video-render-service"
import { probeSequenceVideoAttachmentsSchema } from "../lib/growth/sequences/growth-sequence-video-attachment-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "supabase/migrations/20270828190000_growth_sequence_video_attachments_d1.sql",
  "lib/growth/sequences/growth-sequence-video-attachment-service.ts",
  "lib/growth/sequences/growth-sequence-video-render-service.ts",
  "lib/growth/sequences/growth-sequence-video-preview-service.ts",
  "lib/growth/sequences/growth-sequence-video-approval-service.ts",
  "lib/growth/sequences/growth-sequence-video-attachment-platform-access.ts",
  "lib/growth/sequences/growth-sequence-video-attachment-api-schema.ts",
  "app/api/growth/sequences/video-assets/route.ts",
  "app/api/growth/sequences/video-assets/attach/route.ts",
  "app/api/growth/sequences/video-assets/preview/route.ts",
  "app/api/growth/sequences/video-assets/approve/route.ts",
  "components/growth/automation/growth-automation-video-attachment-picker.tsx",
] as const

const REUSED_INFRASTRUCTURE = [
  "lib/growth/access.ts",
  "lib/growth/videos/growth-video-page-validation.ts",
  "lib/growth/automation/growth-automation-approval-service.ts",
  "lib/growth/sequences/execution/sequence-send-builder.ts",
  "components/growth/automation/growth-automation-inspector-sidebar.tsx",
] as const

const UNTOUCHED_EXECUTION = [
  "lib/growth/sequences/execution/sequence-job-runner.ts",
  "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== D1 Sequence video attachments (${GROWTH_SEQUENCE_VIDEO_ATTACHMENT_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SEQUENCE_VIDEO_ATTACHMENT_QA_MARKER, "growth-sequence-video-attachments-d1-v1")
  assert.equal(
    GROWTH_SEQUENCE_VIDEO_ATTACHMENT_CONFIRM,
    "RUN_GROWTH_SEQUENCE_VIDEO_ATTACHMENT_CERTIFICATION",
  )
  assert.equal(
    GROWTH_SEQUENCE_VIDEO_ATTACHMENT_MIGRATION,
    "20270828190000_growth_sequence_video_attachments_d1.sql",
  )
  console.log("  ✓ QA marker, confirm token, migration id")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} D1 module files exist`)

  for (const relativePath of REUSED_INFRASTRUCTURE) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing reused: ${relativePath}`)
  }
  console.log(`  ✓ ${REUSED_INFRASTRUCTURE.length} reused infrastructure modules exist`)

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270828190000_growth_sequence_video_attachments_d1.sql"),
    "utf8",
  )
  assert.match(migration, /growth\.sequence_video_attachments/)
  assert.match(migration, /attachment_type/)
  assert.match(migration, /attachment_status/)
  assert.match(migration, /video_page_id/)
  assert.match(migration, /voice_media_asset_id/)
  assert.match(migration, /enable row level security/)
  assert.match(migration, /force row level security/)
  console.log("  ✓ migration defines attachment table, channel refs, RLS")

  const attachmentService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/growth-sequence-video-attachment-service.ts"),
    "utf8",
  )
  assert.match(attachmentService, /validateSequenceVideoChannelCompatibility/)
  assert.match(attachmentService, /pending_approval/)
  assert.match(attachmentService, /buildSequenceVideoAttachmentAnalyticsHooks/)
  assert.ok(!attachmentService.includes("runSequenceExecutionJob"))
  assert.ok(!attachmentService.includes("queueSequenceStepTransportJob"))
  console.log("  ✓ attachment service validates channels + analytics hooks (no sequence execution)")

  const renderService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/growth-sequence-video-render-service.ts"),
    "utf8",
  )
  assert.match(renderService, /Watch Personalized Video/)
  assert.match(renderService, /Hey \$\{firstName\}/)
  assert.match(renderService, /Voice asset attached/)
  assert.match(renderService, /requires_human_review: true/)
  assert.match(renderService, /autonomous_execution_enabled: false/)

  validateSequenceVideoChannelCompatibility({
    attachmentType: "email",
    videoPageId: "00000000-0000-4000-8000-000000000001",
  })
  assert.throws(() =>
    validateSequenceVideoChannelCompatibility({ attachmentType: "sms", videoPageId: null }),
  )
  assert.throws(() =>
    validateSequenceVideoChannelCompatibility({ attachmentType: "voice_drop", voiceMediaAssetId: null }),
  )

  const emailPreview = renderSequenceVideoChannelPreview({
    attachmentType: "email",
    publicUrl: "https://example.com/v/demo",
    thumbnailUrl: "https://example.com/thumb.png",
  })
  assert.match(emailPreview.emailHtml ?? "", /Watch Personalized Video/)
  assert.match(emailPreview.emailHtml ?? "", /Open Video Page/)

  const smsPreview = renderSequenceVideoChannelPreview({
    attachmentType: "sms",
    publicUrl: "https://example.com/v/demo",
    previewFirstName: "Jane",
  })
  assert.match(smsPreview.smsText ?? "", /Hey Jane/)
  assert.match(smsPreview.smsText ?? "", /https:\/\/example.com\/v\/demo/)

  const voicePreview = renderSequenceVideoChannelPreview({
    attachmentType: "voice_drop",
    voiceMediaAssetId: "00000000-0000-4000-8000-000000000002",
    publicUrl: "https://example.com/v/demo",
  })
  assert.match(voicePreview.voiceDropSummary ?? "", /Voice asset attached/)
  console.log("  ✓ channel rendering rules + AI payload safety flags")

  const approvalService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/growth-sequence-video-approval-service.ts"),
    "utf8",
  )
  assert.match(approvalService, /approveGrowthSequenceVideoAttachment/)
  assert.match(approvalService, /removeGrowthSequenceVideoAttachment/)
  assert.match(approvalService, /replaceGrowthSequenceVideoAttachment/)
  console.log("  ✓ approval service supports approve/remove/replace")

  const platformAccess = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/growth-sequence-video-attachment-platform-access.ts"),
    "utf8",
  )
  assert.match(platformAccess, /requires_human_review: true/)
  assert.match(platformAccess, /outreach_execution: false/)
  assert.match(platformAccess, /sequence_execution_modified: false/)
  console.log("  ✓ platform access safety JSON present")

  for (const routePath of [
    "app/api/growth/sequences/video-assets/route.ts",
    "app/api/growth/sequences/video-assets/attach/route.ts",
    "app/api/growth/sequences/video-assets/preview/route.ts",
    "app/api/growth/sequences/video-assets/approve/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthSequenceVideoAttachmentPlatformAccess/)
    assert.match(source, /growthSequenceVideoAttachmentSafetyJson/)
    assert.ok(!source.includes("runSequenceExecutionJob"))
    assert.ok(!source.includes("queueSequenceStepTransportJob"))
  }
  console.log("  ✓ D1 API routes use platform access + safety payloads (no sends)")

  const picker = fs.readFileSync(
    path.join(process.cwd(), "components/growth/automation/growth-automation-video-attachment-picker.tsx"),
    "utf8",
  )
  assert.match(picker, /Video assets/)
  assert.match(picker, /Preview/)
  assert.match(picker, /Approve/)
  assert.match(picker, /Remove/)
  assert.match(picker, /Replace/)

  const sidebar = fs.readFileSync(
    path.join(process.cwd(), "components/growth/automation/growth-automation-inspector-sidebar.tsx"),
    "utf8",
  )
  assert.match(sidebar, /GrowthAutomationVideoAttachmentPicker/)
  console.log("  ✓ automation UI picker wired into inspector sidebar")

  for (const relativePath of UNTOUCHED_EXECUTION) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    assert.ok(!source.includes("sequence_video_attachments"))
  }
  console.log("  ✓ sequence execution jobs unchanged")

  const mapped = mapSequenceVideoAttachmentRow({
    id: "00000000-0000-4000-8000-000000000001",
    organization_id: "00000000-0000-4000-8000-000000000002",
    automation_flow_id: null,
    automation_node_id: "00000000-0000-4000-8000-000000000003",
    sequence_pattern_step_id: null,
    attachment_type: "email",
    attachment_status: "pending_approval",
    video_asset_id: null,
    video_page_id: "00000000-0000-4000-8000-000000000004",
    voice_media_asset_id: null,
    avatar_media_asset_id: null,
    thumbnail_url: "https://example.com/thumb.png",
    metadata_json: {
      metadata_hooks: { lead_id: "00000000-0000-4000-8000-000000000005" },
      analytics_hooks: { sequence_step_id: null },
    },
    ai_payload: buildSequenceVideoAttachmentAiPayload({
      attachment: {
        attachmentType: "email",
        videoAssetId: null,
        videoPageId: "00000000-0000-4000-8000-000000000004",
        thumbnailUrl: "https://example.com/thumb.png",
        voiceMediaAssetId: null,
        avatarMediaAssetId: null,
        sequencePatternStepId: null,
      },
    }),
    approved_by: null,
    approved_at: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  assert.equal(mapped.metadataHooks.lead_id, "00000000-0000-4000-8000-000000000005")
  assert.equal(mapped.aiPayload.requires_human_review, true)
  assert.equal(mapped.aiPayload.autonomous_execution_enabled, false)
  console.log("  ✓ metadata + analytics hooks round-trip on attachment mapper")

  console.log("\nD1 Sequence video attachments local regression PASS\n")
}

async function runProductionCertification(): Promise<Record<string, unknown>> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })

  if (!boot) {
    return { ok: false, final_verdict: "FAIL", error: "supabase_unavailable" }
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false, autoRefreshToken: false } })

  const schema = await probeSequenceVideoAttachmentsSchema(admin)

  return {
    ok: schema.sequence_video_attachments_ready,
    qa_marker: GROWTH_SEQUENCE_VIDEO_ATTACHMENT_QA_MARKER,
    migration: GROWTH_SEQUENCE_VIDEO_ATTACHMENT_MIGRATION,
    env_bootstrap: boot.audit.loaded_files[0] ?? "process",
    sequence_video_attachments_ready: schema.sequence_video_attachments_ready,
    schema_error: schema.error ?? null,
    blockers: [
      !schema.sequence_video_attachments_ready ? "sequence_video_attachments_schema_not_ready" : null,
    ].filter(Boolean),
    production_deploy_required: [
      "D1 sequence video attachment APIs require Vercel Production deploy",
      "Automation video attachment picker UI requires Vercel Production deploy",
      "Apply migration 20270828190000 on production Supabase before live attachment persistence",
    ],
    d2_dependencies: [
      "Wire approved attachments into sequence-send-builder at send time (human-gated)",
      "Resolve signed thumbnail URLs at execution",
      "Populate analytics_hooks on send completion",
    ],
    d3_dependencies: [
      "Autopilot video step suggestions (requires_human_review only)",
      "Bulk attachment approval queue integration",
    ],
    outreach_execution: false,
    sequence_execution_modified: false,
    final_verdict: schema.sequence_video_attachments_ready ? "PASS" : "FAIL",
  }
}

async function main(): Promise<void> {
  runLocalRegression()

  if (process.argv.includes("--production")) {
    const result = await runProductionCertification()
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    console.log("\nD1 Sequence video attachments production certification PASS\n")
  }
}

void main()
