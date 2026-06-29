/**
 * Growth Communications settings certification — canonical Growth workspace routes.
 * Run: pnpm test:growth-communications-settings-production-hotfix
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { growthEngineCustomerSettingsHref } from "../lib/growth/navigation/growth-workspace-settings-canonical"

export const GROWTH_COMMUNICATIONS_SETTINGS_PRODUCTION_HOTFIX_QA_MARKER =
  "growth-communications-settings-production-hotfix-v2" as const

const COMMUNICATIONS_SECTIONS = [
  {
    sectionId: "connected-mailboxes",
    panelModule: "components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx",
    panelExportName: "GrowthConnectedMailboxesDashboard",
    route: "/growth/settings/communications/connected-mailboxes",
    legacyRoute: "/growth/settings/communications/mailboxes",
    page: "app/(growth)/growth/settings/communications/connected-mailboxes/page.tsx",
  },
  {
    sectionId: "sending-domains",
    panelModule: "components/growth/growth-sender-infrastructure-dashboard.tsx",
    panelExportName: "GrowthSenderInfrastructureDashboard",
    route: "/growth/settings/communications/sending-domains",
    page: "app/(growth)/growth/settings/communications/sending-domains/page.tsx",
  },
  {
    sectionId: "dns-verification",
    panelModule: "components/growth/growth-deliverability-dashboard.tsx",
    panelExportName: "GrowthDeliverabilityDashboard",
    route: "/growth/settings/communications/dns-verification",
    legacyRoute: "/growth/settings/communications/deliverability",
    page: "app/(growth)/growth/settings/communications/dns-verification/page.tsx",
  },
  {
    sectionId: "warmup",
    panelModule: "components/growth/growth-warmup-dashboard.tsx",
    panelExportName: "GrowthWarmupDashboardPanel",
    route: "/growth/settings/communications/warmup",
    page: "app/(growth)/growth/settings/communications/warmup/page.tsx",
  },
  {
    sectionId: "sender-pools",
    panelModule: "components/growth/growth-sender-pools-dashboard.tsx",
    panelExportName: "GrowthSenderPoolsDashboardView",
    route: "/growth/settings/communications/sender-pools",
    page: "app/(growth)/growth/settings/communications/sender-pools/page.tsx",
  },
  {
    sectionId: "sending-limits",
    panelModule: "components/growth/growth-reputation-protection-dashboard.tsx",
    panelExportName: "GrowthReputationProtectionDashboardView",
    route: "/growth/settings/communications/sending-limits",
    legacyRoute: "/growth/settings/communications/reputation",
    page: "app/(growth)/growth/settings/communications/sending-limits/page.tsx",
    panelExportPattern: /GrowthReputationProtectionDashboardView/,
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
    "growth-communications-settings-production-hotfix-v2",
  )

  const growthEngineRedirectPage = readSource("app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx")
  assert.match(growthEngineRedirectPage, /redirect\(/)
  assert.match(growthEngineRedirectPage, /growthEngineCustomerSettingsHref/)
  assert.doesNotMatch(growthEngineRedirectPage, /WorkspaceSettingsGrowthEngineSectionPage/)

  const deliverabilityDashboard = readSource("components/growth/growth-deliverability-dashboard.tsx")
  assert.match(deliverabilityDashboard, /hasActionableDnsSetupStatus/)
  assert.match(deliverabilityDashboard, /operator-attention-utils/)

  for (const section of COMMUNICATIONS_SECTIONS) {
    assert.equal(growthEngineCustomerSettingsHref(section.sectionId), section.route)
    assert.ok(fs.existsSync(section.page), `missing canonical page ${section.page}`)

    const pageSource = readSource(section.page)
    assert.match(pageSource, /GrowthCommunicationsSettingsSection/)
    assert.match(pageSource, new RegExp(section.panelExportName))

    const panelSource = readSource(section.panelModule)
    const exportPattern =
      "panelExportPattern" in section && section.panelExportPattern
        ? section.panelExportPattern
        : new RegExp(`export default ${section.panelExportName}`)
    assert.match(panelSource, exportPattern)

    await assertImportSafeWithoutSupabaseEnv(`../${section.panelModule}`)

    if ("legacyRoute" in section && section.legacyRoute) {
      const legacyPagePath = `app/(growth)${section.legacyRoute}/page.tsx`
      assert.ok(fs.existsSync(legacyPagePath), `missing legacy redirect page ${legacyPagePath}`)
      assert.match(readSource(legacyPagePath), /redirect\(/)
    }
  }

  console.log("growth-communications-settings-production-hotfix: ok")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
