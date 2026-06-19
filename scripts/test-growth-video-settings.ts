/**
 * Growth Engine — Video workspace settings certification.
 *
 * Local: pnpm test:growth-video-settings
 * Production: pnpm test:growth-video-settings:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  DEFAULT_GROWTH_VIDEO_SETTINGS_BRANDING,
  GROWTH_VIDEO_SETTINGS_METADATA_KEY,
  GROWTH_VIDEO_SETTINGS_QA_MARKER,
  GROWTH_VIDEO_WORKSPACE_SETTINGS_TEMPLATE_NAME,
} from "../lib/growth/videos/growth-video-settings-types"
import {
  loadGrowthVideoSettings,
  patchGrowthVideoSettings,
} from "../lib/growth/videos/growth-video-settings-service"
import { mergeGrowthVideoSettingsBranding } from "../lib/growth/videos/growth-video-settings-validation"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/videos/growth-video-settings-types.ts",
  "lib/growth/videos/growth-video-settings-validation.ts",
  "lib/growth/videos/growth-video-settings-service.ts",
  "app/api/growth/videos/settings/route.ts",
  "components/growth/videos/growth-video-settings-shell.tsx",
  "components/growth/videos/growth-video-storage-settings-panel.tsx",
  "components/growth/videos/growth-video-branding-settings-panel.tsx",
  "components/growth/videos/growth-video-permissions-settings-panel.tsx",
  "components/growth/videos/growth-video-recording-settings-panel.tsx",
  "app/(growth)/growth/videos/settings/storage/page.tsx",
  "app/(growth)/growth/videos/settings/branding/page.tsx",
  "app/(growth)/growth/videos/settings/permissions/page.tsx",
  "app/(growth)/growth/videos/settings/recording/page.tsx",
] as const

function runLocalRegression(): void {
  console.log(`\n=== Video workspace settings (${GROWTH_VIDEO_SETTINGS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_VIDEO_SETTINGS_QA_MARKER, "growth-video-settings-v2")
  console.log("  ✓ QA marker")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} settings module files exist`)

  const shell = fs.readFileSync(
    path.join(process.cwd(), "components/growth/videos/growth-video-settings-shell.tsx"),
    "utf8",
  )
  assert.match(shell, /Configure/)
  assert.match(shell, /href=\{`\$\{basePath\}\/\$\{section\.href\}`\}/)
  assert.match(shell, /focus-visible:ring-2/)
  assert.ok(!shell.match(/Coming soon/))
  console.log("  ✓ settings hub cards are clickable links with focus states")

  const apiRoute = fs.readFileSync(path.join(process.cwd(), "app/api/growth/videos/settings/route.ts"), "utf8")
  assert.match(apiRoute, /requireGrowthVideoPlatformAccess/)
  assert.match(apiRoute, /growthVideoSafetyJson/)
  assert.match(apiRoute, /patchGrowthVideoSettings/)
  assert.ok(!apiRoute.includes("ELEVENLABS_API_KEY"))
  console.log("  ✓ settings API uses platform access + safety JSON (no secret leakage)")

  const service = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/videos/growth-video-settings-service.ts"),
    "utf8",
  )
  assert.match(service, /GROWTH_VIDEO_WORKSPACE_SETTINGS_TEMPLATE_NAME/)
  assert.match(service, /GROWTH_VIDEO_SETTINGS_METADATA_KEY/)
  assert.match(service, /resolveStorageView/)
  assert.match(service, /buildPermissionsView/)
  console.log("  ✓ settings persist in video_templates configuration_json metadata")

  const merged = mergeGrowthVideoSettingsBranding(DEFAULT_GROWTH_VIDEO_SETTINGS_BRANDING, {
    defaultCtaLabel: "Watch now",
  })
  assert.equal(merged.defaultCtaLabel, "Watch now")
  console.log("  ✓ branding merge validation")

  console.log("\nVideo workspace settings local regression PASS\n")
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
  const orgId = process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()
  if (!orgId) {
    return { ok: false, final_verdict: "FAIL", error: "growth_engine_ai_org_id_missing" }
  }

  const loaded = await loadGrowthVideoSettings(admin, orgId)
  assert.equal(loaded.permissions.autonomousExecutionEnabled, false)
  assert.equal(loaded.storage.readOnly, true)
  assert.ok(loaded.storage.videoBucket)

  const patched = await patchGrowthVideoSettings(admin, orgId, {
    branding: { defaultCtaLabel: "Growth Video Settings Cert" },
  })
  assert.equal(patched.branding.defaultCtaLabel, "Growth Video Settings Cert")

  const { data: row } = await admin
    .schema("growth")
    .from("video_templates")
    .select("name, configuration_json")
    .eq("organization_id", orgId)
    .eq("name", GROWTH_VIDEO_WORKSPACE_SETTINGS_TEMPLATE_NAME)
    .maybeSingle()

  const config = (row?.configuration_json ?? {}) as Record<string, unknown>
  const settingsRoot = config[GROWTH_VIDEO_SETTINGS_METADATA_KEY] as Record<string, unknown>
  assert.ok(settingsRoot)

  return {
    ok: true,
    qa_marker: GROWTH_VIDEO_SETTINGS_QA_MARKER,
    settings_template_row_ready: Boolean(row),
    storage_video_bucket: loaded.storage.videoBucket,
    autonomous_execution_enabled: loaded.permissions.autonomousExecutionEnabled,
    final_verdict: "PASS",
  }
}

async function main(): Promise<void> {
  runLocalRegression()

  if (process.argv.includes("--production")) {
    const result = await runProductionCertification()
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    console.log("\nVideo workspace settings production certification PASS\n")
  }
}

void main()
