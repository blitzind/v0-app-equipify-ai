/**
 * Growth Engine B1 — Video personalization wiring certification.
 *
 * Local: pnpm test:growth-video-personalization
 * Production: pnpm test:growth-video-personalization:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_VIDEO_PERSONALIZATION_CONFIRM,
  GROWTH_VIDEO_PERSONALIZATION_QA_MARKER,
} from "../lib/growth/videos/growth-video-types"
import {
  buildGrowthVideoPreviewFormMergeValues,
  renderGrowthVideoPreviewText,
} from "../lib/growth/videos/growth-video-preview-render-service"
import {
  GROWTH_VIDEO_LEGACY_ALIAS_KEYS,
  GROWTH_VIDEO_VARIABLE_ALIAS_TO_CANONICAL,
  resolveGrowthVideoVariableAlias,
} from "../lib/growth/videos/growth-video-variable-alias-service"
import { probeGrowthVideoFoundationSchema } from "../lib/growth/videos/growth-video-schema-health"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/videos/growth-video-variable-alias-service.ts",
  "lib/growth/videos/growth-video-merge-context-service.ts",
  "lib/growth/videos/growth-video-personalization-service.ts",
  "lib/growth/videos/growth-video-preview-render-service.ts",
  "app/api/growth/videos/personalization/variables/route.ts",
  "app/api/growth/videos/personalization/preview/route.ts",
  "app/api/growth/videos/pages/[id]/personalization/route.ts",
  "components/growth/videos/growth-video-page-personalization-section.tsx",
] as const

const MANAGEMENT_API_ROUTES = [
  "app/api/growth/videos/personalization/variables/route.ts",
  "app/api/growth/videos/personalization/preview/route.ts",
  "app/api/growth/videos/pages/[id]/personalization/route.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== B1 Video personalization (${GROWTH_VIDEO_PERSONALIZATION_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_VIDEO_PERSONALIZATION_QA_MARKER, "growth-video-personalization-b1-v1")
  assert.equal(GROWTH_VIDEO_PERSONALIZATION_CONFIRM, "RUN_GROWTH_VIDEO_PERSONALIZATION_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} B1 module files exist`)

  for (const routePath of MANAGEMENT_API_ROUTES) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
    assert.match(source, /requireGrowthVideoPlatformAccess/)
    assert.match(source, /growthVideoSafetyJson/)
  }
  console.log("  ✓ management API routes use platform access + safety payloads")

  const publicPageService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-public-page-service.ts"),
    "utf8",
  )
  assert.ok(!publicPageService.includes("requireGrowthVideoPlatformAccess"))
  assert.match(publicPageService, /renderGrowthVideoPageFields/)
  assert.match(publicPageService, /personalization_json/)
  console.log("  ✓ public page service applies personalization without admin auth")

  const mergeContextService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-merge-context-service.ts"),
    "utf8",
  )
  assert.match(mergeContextService, /listContentVariables/)
  assert.match(mergeContextService, /personalization_profiles/)
  assert.match(mergeContextService, /resolveGrowthVideoMergeContext/)
  assert.ok(!mergeContextService.includes("renderContentTemplate"))
  console.log("  ✓ merge context reuses registry + profiles (no duplicate merge engine)")

  const aliasService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-variable-alias-service.ts"),
    "utf8",
  )
  assert.ok(!aliasService.includes("new Map"))
  assert.match(aliasService, /first_name/)
  assert.match(aliasService, /lead\.company_name/)
  console.log("  ✓ alias layer maps legacy tokens to canonical keys")

  const personalizationService = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-personalization-service.ts"),
    "utf8",
  )
  assert.match(personalizationService, /applySharePageTemplateMergeFields/)
  assert.match(personalizationService, /buildGrowthVideoAiPayload/)
  assert.ok(!personalizationService.includes("insertGrowthSequenceEnrollment"))
  assert.ok(!personalizationService.includes("runSequenceExecutionJob"))
  console.log("  ✓ personalization service reuses share-page merge + no sequence execution")

  const detailPanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/videos/growth-video-page-detail-panel.tsx"),
    "utf8",
  )
  assert.match(detailPanel, /Personalization/)
  assert.match(detailPanel, /GrowthVideoPagePersonalizationSection/)
  console.log("  ✓ page detail panel includes Personalization tab")

  assert.equal(resolveGrowthVideoVariableAlias("company"), "lead.company_name")
  assert.equal(resolveGrowthVideoVariableAlias("calendar_url"), "booking.link")
  assert.equal(GROWTH_VIDEO_LEGACY_ALIAS_KEYS.length, 13)
  assert.ok(GROWTH_VIDEO_VARIABLE_ALIAS_TO_CANONICAL.first_name)
  console.log("  ✓ alias resolution helpers")

  const mergeValues = buildGrowthVideoPreviewFormMergeValues({
    firstName: "John",
    lastName: "Smith",
    company: "Precision Biomedical",
    industry: "Medical Equipment",
  })
  const rendered = renderGrowthVideoPreviewText(
    "Hi {{first_name}},\n\nI noticed {{company}} operates in {{industry}}...",
    mergeValues,
  )
  assert.match(rendered, /Hi John,/)
  assert.match(rendered, /Precision Biomedical/)
  assert.match(rendered, /Medical Equipment/)
  assert.ok(!rendered.includes("{{first_name}}"))
  console.log("  ✓ preview form rendering")

  const pagesMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270828150000_growth_engine_personalized_video_pages_a3.sql"),
    "utf8",
  )
  assert.ok(pagesMigration.includes("personalization_json"))
  assert.ok(!pagesMigration.includes("video_personalization_registry"))
  console.log("  ✓ no new personalization tables — reuses A3 personalization_json")

  console.log("\nB1 Video personalization local regression PASS\n")
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

  const { data: registryRows, error: registryError } = await admin
    .schema("growth")
    .from("content_variable_registry")
    .select("variable_key")
    .limit(1)

  const { data: profileRows, error: profileError } = await admin
    .schema("growth")
    .from("personalization_profiles")
    .select("id")
    .limit(1)

  const blockers = [
    !schema.pages_schema_ready ? "pages_schema_not_ready" : null,
    registryError ? `content_variable_registry:${registryError.message}` : null,
    profileError ? `personalization_profiles:${profileError.message}` : null,
  ].filter(Boolean)

  return {
    ok: schema.pages_schema_ready && !registryError && !profileError,
    qa_marker: GROWTH_VIDEO_PERSONALIZATION_QA_MARKER,
    env_bootstrap: boot.source ?? "process",
    pages_schema_ready: schema.pages_schema_ready,
    content_variable_registry_ready: !registryError && Array.isArray(registryRows),
    personalization_profiles_ready: !profileError && Array.isArray(profileRows),
    blockers,
    final_verdict:
      schema.pages_schema_ready && !registryError && !profileError ? "PASS" : "FAIL",
  }
}

async function main(): Promise<void> {
  runLocalRegression()

  if (process.argv.includes("--production")) {
    const result = await runProductionCertification()
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    console.log("\nB1 Video personalization production certification PASS\n")
  }
}

void main()
