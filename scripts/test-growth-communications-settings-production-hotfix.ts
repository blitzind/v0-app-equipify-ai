/**
 * PROD-HOTFIX — Communications settings production page load certification.
 * Run: pnpm test:growth-communications-settings-production-hotfix
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { growthEngineCustomerSettingsHref } from "../lib/growth/navigation/growth-workspace-settings-canonical"

export const GROWTH_COMMUNICATIONS_SETTINGS_PRODUCTION_HOTFIX_QA_MARKER =
  "growth-communications-settings-production-hotfix-v1" as const

const COMMUNICATIONS_SECTIONS = [
  {
    sectionId: "connected-mailboxes",
    panelExport: "LiftedConnectedMailboxesPanel",
    panelModule: "components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx",
    panelExportName: "GrowthConnectedMailboxesDashboard",
    route: "/settings/growth-engine/connected-mailboxes",
    growthRoute: "/growth/settings/communications/mailboxes",
  },
  {
    sectionId: "sending-limits",
    panelExport: "LiftedSendingLimitsPanel",
    panelModule: "components/growth/deliverability/deliverability-protection-console.tsx",
    panelExportName: "GrowthDeliverabilityProtectionConsole",
    route: "/settings/growth-engine/sending-limits",
    growthRoute: "/growth/settings/communications/reputation",
  },
  {
    sectionId: "sender-pools",
    panelExport: "LiftedSenderPoolsPanel",
    panelModule: "components/growth/growth-sender-pools-dashboard.tsx",
    panelExportName: "GrowthSenderPoolsDashboardView",
    route: "/settings/growth-engine/sender-pools",
    growthRoute: "/growth/settings/communications/sender-pools",
  },
  {
    sectionId: "warmup",
    panelExport: "LiftedWarmupPanel",
    panelModule: "components/growth/growth-warmup-dashboard.tsx",
    panelExportName: "GrowthWarmupDashboardPanel",
    route: "/settings/growth-engine/warmup",
    growthRoute: "/growth/settings/communications/warmup",
  },
  {
    sectionId: "dns-verification",
    panelExport: "LiftedDnsVerificationPanel",
    panelModule: "components/growth/growth-deliverability-dashboard.tsx",
    panelExportName: "GrowthDeliverabilityDashboard",
    route: "/settings/growth-engine/dns-verification",
    growthRoute: "/growth/settings/communications/deliverability",
  },
  {
    sectionId: "sending-domains",
    panelExport: "LiftedSendingDomainsPanel",
    panelModule: "components/growth/growth-sender-infrastructure-dashboard.tsx",
    panelExportName: "GrowthSenderInfrastructureDashboard",
    route: "/settings/growth-engine/sending-domains",
    growthRoute: "/growth/settings/communications/sending-domains",
  },
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function assertImportSafeWithoutSupabaseEnv(modulePath: string): Promise<void> {
  const envSnapshot = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  try {
    await import(modulePath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`import failed for ${modulePath}: ${message}`)
  } finally {
    if (envSnapshot.NEXT_PUBLIC_SUPABASE_URL) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = envSnapshot.NEXT_PUBLIC_SUPABASE_URL
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
    }
    if (envSnapshot.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = envSnapshot.NEXT_PUBLIC_SUPABASE_ANON_KEY
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    }
  }
}

async function main(): Promise<void> {
  assert.equal(
    GROWTH_COMMUNICATIONS_SETTINGS_PRODUCTION_HOTFIX_QA_MARKER,
    "growth-communications-settings-production-hotfix-v1",
  )

  const liftedPanels = readSource("components/settings/workspace-settings-growth-engine-lifted-panels.tsx")
  assert.match(liftedPanels, /dynamic\(/)
  assert.match(liftedPanels, /GrowthAdminWidgetErrorBoundary/)
  assert.match(liftedPanels, /WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANEL_ERROR_BOUNDARY_QA_MARKER/)
  assert.match(
    liftedPanels,
    /import\("@\/components\/growth\/deliverability\/deliverability-protection-console"\)/,
  )
  assert.doesNotMatch(liftedPanels, /^import \{ GrowthDeliverabilityDashboard \}/m)
  assert.doesNotMatch(liftedPanels, /^import \{ GrowthConnectedMailboxesDashboard \}/m)
  assert.doesNotMatch(liftedPanels, /^import \{ GrowthSenderInfrastructureDashboard \}/m)
  assert.doesNotMatch(liftedPanels, /^import \{ GrowthSenderPoolsDashboardView \}/m)
  assert.doesNotMatch(liftedPanels, /^import \{ GrowthReputationProtectionDashboardView \}/m)

  const reputationShim = readSource("components/growth/growth-reputation-protection-dashboard.tsx")
  assert.match(reputationShim, /^"use client"/m)

  const supabaseClient = readSource("lib/supabase/client.ts")
  assert.doesNotMatch(supabaseClient, /^if \(!supabaseAnonKey\)/m)
  assert.match(supabaseClient, /export function createBrowserSupabaseClient/)

  for (const section of COMMUNICATIONS_SECTIONS) {
    assert.match(liftedPanels, new RegExp(section.panelExport))
    assert.equal(growthEngineCustomerSettingsHref(section.sectionId), section.route)
    const growthPagePath = `app/(growth)${section.growthRoute}/page.tsx`
    assert.ok(fs.existsSync(growthPagePath), `missing growth communications page ${growthPagePath}`)

    await assertImportSafeWithoutSupabaseEnv(`../${section.panelModule}`)
  }

  await assertImportSafeWithoutSupabaseEnv(
    "../components/settings/workspace-settings-growth-engine-lifted-panels.tsx",
  )

  console.log("growth-communications-settings-production-hotfix: ok")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
