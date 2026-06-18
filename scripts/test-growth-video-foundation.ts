/**
 * Growth Engine A1 — Video Recording Studio foundation certification.
 *
 * Local: pnpm test:growth-video-foundation
 * Production: pnpm test:growth-video-foundation:production
 */
import assert from "node:assert/strict"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_VIDEO_FOUNDATION_AUDIT_QA_MARKER,
  GROWTH_VIDEO_FOUNDATION_REQUIRED_FILES,
  runGrowthVideoFoundationAudit,
} from "../lib/growth/e2e/growth-video-foundation-audit"
import { probeGrowthVideoFoundationSchema } from "../lib/growth/videos/growth-video-schema-health"
import {
  buildGrowthVideoWorkspaceReadinessPayload,
  isGrowthVideoWorkspaceEnabled,
} from "../lib/growth/videos/growth-video-route-gates"
import {
  GROWTH_VIDEO_FOUNDATION_CONFIRM,
  GROWTH_VIDEO_FOUNDATION_MIGRATION,
  GROWTH_VIDEO_FOUNDATION_QA_MARKER,
} from "../lib/growth/videos/growth-video-types"
import { GrowthVideoStorageService } from "../lib/growth/videos/growth-video-storage-service"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== A1 Video foundation (${GROWTH_VIDEO_FOUNDATION_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_VIDEO_FOUNDATION_QA_MARKER, "growth-video-foundation-a1-v1")
  assert.equal(GROWTH_VIDEO_FOUNDATION_CONFIRM, "RUN_GROWTH_VIDEO_FOUNDATION_CERTIFICATION")
  assert.equal(GROWTH_VIDEO_FOUNDATION_MIGRATION, "20270828130000_growth_engine_video_recording_studio_foundation.sql")
  console.log("  ✓ QA marker, confirm token, and migration constant")

  console.log(`  ✓ ${GROWTH_VIDEO_FOUNDATION_REQUIRED_FILES.length} foundation files registered`)

  const audit = runGrowthVideoFoundationAudit()
  assert.equal(audit.qa_marker, GROWTH_VIDEO_FOUNDATION_AUDIT_QA_MARKER)
  assert.ok(audit.ok, JSON.stringify(audit.findings, null, 2))
  console.log("  ✓ foundation audit passes (routes, nav, services, feature flag)")

  assert.ok(isGrowthVideoWorkspaceEnabled())
  const readiness = buildGrowthVideoWorkspaceReadinessPayload()
  assert.equal(readiness.requires_human_review, true)
  assert.equal(readiness.autonomous_execution_enabled, false)
  assert.equal(readiness.outreach_execution, false)
  assert.equal(readiness.enrollment_execution, false)
  console.log("  ✓ feature flag and human-supervised readiness payload")

  const storage = new GrowthVideoStorageService({ resolveAdapter: () => null })
  void storage
    .createUploadHandle("supabase_storage", {
      organizationId: "org",
      assetId: "asset",
      contentType: "video/webm",
      byteLength: 0,
    })
    .then((handle) => assert.equal(handle, null))
  console.log("  ✓ storage abstraction compiles without provider implementations")

  console.log("\nA1 Video foundation local regression PASS\n")
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

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const schema = await probeGrowthVideoFoundationSchema(admin)
  const audit = runGrowthVideoFoundationAudit()

  return {
    ok: audit.ok && schema.ready,
    qa_marker: GROWTH_VIDEO_FOUNDATION_QA_MARKER,
    final_verdict: audit.ok && schema.ready ? "PASS" : "FAIL",
    workspace_enabled: isGrowthVideoWorkspaceEnabled(),
    schema,
    audit,
    readiness: buildGrowthVideoWorkspaceReadinessPayload(),
  }
}

async function main(): Promise<void> {
  const production = process.argv.includes("--production")

  if (production) {
    const result = await runProductionCertification()
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    return
  }

  runLocalRegression()
  console.log(
    JSON.stringify({
      ok: true,
      local_only: true,
      qa_marker: GROWTH_VIDEO_FOUNDATION_QA_MARKER,
      hint: "Run pnpm test:growth-video-foundation:production for schema probe",
    }),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
