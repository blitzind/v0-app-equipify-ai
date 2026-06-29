/**
 * PROD-HOTFIX — Communications settings production page load certification.
 * Run: pnpm test:growth-communications-settings-production-hotfix
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { growthEngineCustomerSettingsHref } from "../lib/growth/navigation/growth-workspace-settings-canonical"
import {
  createWorkspaceSettingsGrowthEnginePanelFallback,
  resolveWorkspaceSettingsGrowthEngineDynamicExport,
  WORKSPACE_SETTINGS_GROWTH_ENGINE_DYNAMIC_PANEL_QA_MARKER,
} from "../lib/settings/workspace-settings-growth-engine-dynamic-panel"

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

async function assertDynamicExportResolvable(
  sectionId: string,
  panelModule: string,
  exportName: string,
): Promise<void> {
  const module = await import(`../${panelModule}`)
  const resolved = resolveWorkspaceSettingsGrowthEngineDynamicExport(sectionId, exportName, module)
  assert.equal(typeof resolved, "function", `expected function export for ${sectionId} (${exportName})`)
}

async function main(): Promise<void> {
  assert.equal(
    GROWTH_COMMUNICATIONS_SETTINGS_PRODUCTION_HOTFIX_QA_MARKER,
    "growth-communications-settings-production-hotfix-v1",
  )
  assert.equal(
    WORKSPACE_SETTINGS_GROWTH_ENGINE_DYNAMIC_PANEL_QA_MARKER,
    "workspace-settings-growth-engine-dynamic-panel-v2",
  )

  const liftedPanels = readSource("components/settings/workspace-settings-growth-engine-lifted-panels.tsx")
  const sectionPage = readSource("components/settings/workspace-settings-growth-engine-section-page.tsx")
  const panelHost = readSource("components/settings/workspace-settings-growth-engine-lifted-panel-host.tsx")
  const dynamicPanel = readSource("lib/settings/workspace-settings-growth-engine-dynamic-panel.tsx")

  assert.match(liftedPanels, /loadLiftedPanel\(/)
  assert.match(liftedPanels, /WORKSPACE_SETTINGS_GROWTH_ENGINE_DYNAMIC_PANEL_QA_MARKER/)
  assert.match(liftedPanels, /resolveWorkspaceSettingsGrowthEngineDynamicExport/)
  assert.match(liftedPanels, /createWorkspaceSettingsGrowthEnginePanelFallback/)
  assert.doesNotMatch(liftedPanels, /^import \{ GrowthDeliverabilityDashboard \}/m)
  assert.doesNotMatch(liftedPanels, /^import \{ GrowthConnectedMailboxesDashboard \}/m)

  if (sectionPage.includes("growth-engine-settings-hard-isolation-v1")) {
    assert.match(sectionPage, /SECTION PAGE RENDERED/)
    assert.match(sectionPage, /data-growth-engine-settings-hard-isolation="v1"/)
    assert.match(sectionPage, /WorkspaceSettingsGrowthEngineConnectedMailboxesSection/)
    assert.match(
      readSource("components/settings/workspace-settings-growth-engine-connected-mailboxes-section.tsx"),
      /GrowthConnectedMailboxesDashboard/,
    )
    assert.match(
      readSource("components/settings/workspace-settings-growth-engine-sending-domains-section.tsx"),
      /GrowthSenderInfrastructureDashboard/,
    )
    assert.match(
      readSource("components/settings/workspace-settings-growth-engine-dns-verification-section.tsx"),
      /GrowthDeliverabilityDashboard/,
    )
  } else {
    assert.match(sectionPage, /WorkspaceSettingsGrowthEngineLiftedPanelHost/)
    assert.match(sectionPage, /workspace-settings-growth-engine-lifted-panel-host/)
    assert.doesNotMatch(sectionPage, /workspace-settings-growth-engine-lifted-panels/)
  }

  assert.match(panelHost, /GrowthAdminWidgetErrorBoundary/)
  assert.match(panelHost, /getWorkspaceSettingsGrowthEngineLiftedPanel/)

  assert.match(dynamicPanel, /resolveWorkspaceSettingsGrowthEngineDynamicExport/)
  assert.match(dynamicPanel, /createWorkspaceSettingsGrowthEnginePanelFallback/)

  const reputationShim = readSource("components/growth/growth-reputation-protection-dashboard.tsx")
  assert.match(reputationShim, /^"use client"/m)

  const deliverabilityDashboard = readSource("components/growth/growth-deliverability-dashboard.tsx")
  assert.match(deliverabilityDashboard, /hasActionableDnsSetupStatus/)
  assert.match(deliverabilityDashboard, /operator-attention-utils/)

  const supabaseClient = readSource("lib/supabase/client.ts")
  assert.doesNotMatch(supabaseClient, /^if \(!supabaseAnonKey\)/m)
  assert.match(supabaseClient, /export function createBrowserSupabaseClient/)

  const invalidFallback = createWorkspaceSettingsGrowthEnginePanelFallback("Test panel", "connected-mailboxes")
  assert.equal(typeof invalidFallback, "function")
  assert.equal(resolveWorkspaceSettingsGrowthEngineDynamicExport("warmup", "Missing", {}), null)

  for (const section of COMMUNICATIONS_SECTIONS) {
    assert.match(liftedPanels, new RegExp(section.panelExport))
    assert.equal(growthEngineCustomerSettingsHref(section.sectionId), section.route)
    const growthPagePath = `app/(growth)${section.growthRoute}/page.tsx`
    assert.ok(fs.existsSync(growthPagePath), `missing growth communications page ${growthPagePath}`)

    const panelSource = readSource(section.panelModule)
    assert.match(panelSource, new RegExp(`export default ${section.panelExportName}`))

    await assertImportSafeWithoutSupabaseEnv(`../${section.panelModule}`)
    await assertDynamicExportResolvable(section.sectionId, section.panelModule, section.panelExportName)
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
