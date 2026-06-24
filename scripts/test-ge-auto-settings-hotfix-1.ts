/**
 * GE-AUTO-SETTINGS-HOTFIX-1 — Growth Autonomy settings route/access/rendering hotfix cert.
 * Run: pnpm test:ge-auto-settings-hotfix-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_COMMUNICATIONS_WARMUP_PATH } from "../lib/growth/navigation/growth-communications-settings-navigation"
import {
  GROWTH_WORKSPACE_SETTINGS_PATH_PREFIX,
  isGrowthWorkspaceSettingsPathname,
} from "../lib/growth/navigation/growth-workspace-settings-paths"

export const GE_AUTO_SETTINGS_HOTFIX_1_QA_MARKER = "ge-auto-settings-hotfix-1-v1" as const

const AUTONOMY_SETTINGS_PATH = `${GROWTH_WORKSPACE_SETTINGS_PATH_PREFIX}/autonomy` as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertClientPage(relativePath: string): void {
  const source = readSource(relativePath)
  assert.match(
    source,
    /^"use client"/m,
    `${relativePath} must be a client page so Lucide icons are not passed from a server parent`,
  )
}

function main(): void {
  console.log("\n=== GE-AUTO-SETTINGS-HOTFIX-1 ===\n")
  assert.equal(GE_AUTO_SETTINGS_HOTFIX_1_QA_MARKER, "ge-auto-settings-hotfix-1-v1")
  console.log("  ✓ QA marker")

  const autonomyPagePath = "app/(growth)/growth/settings/autonomy/page.tsx"
  assert.ok(fs.existsSync(autonomyPagePath), "autonomy settings route exists")
  assertClientPage(autonomyPagePath)
  console.log("  ✓ Autonomy page is client-rendered (no server→client icon props)")

  const growthLayout = readSource("app/(growth)/layout.tsx")
  assert.match(growthLayout, /isGrowthWorkspaceSettingsPathname/)
  assert.match(growthLayout, /resolveGrowthWorkspaceSettingsPageAccess/)
  assert.doesNotMatch(growthLayout, /isGrowthCommunicationsSettingsPath/)
  assert.match(growthLayout, /loadPlatformAdminIdentity\(\)/)
  console.log("  ✓ Growth layout uses workspace settings pathname gate")

  assert.equal(isGrowthWorkspaceSettingsPathname(AUTONOMY_SETTINGS_PATH), true)
  assert.equal(isGrowthWorkspaceSettingsPathname(GROWTH_COMMUNICATIONS_WARMUP_PATH), true)
  assert.equal(isGrowthWorkspaceSettingsPathname("/growth/settings/communications"), true)
  assert.equal(isGrowthWorkspaceSettingsPathname("/growth/inbox"), false)
  assert.equal(isGrowthWorkspaceSettingsPathname("/growth/opportunities"), false)
  console.log("  ✓ Workspace settings path helper includes autonomy + communications; excludes non-settings routes")

  assertClientPage("app/(growth)/growth/settings/communications/warmup/page.tsx")
  console.log("  ✓ Warmup settings route remains client-rendered")

  const outboundPanel = readSource("components/growth/autonomy/growth-autonomy-outbound-dashboard-panel.tsx")
  assert.match(outboundPanel, /Outbound dashboard is available to platform admins/)
  assert.match(outboundPanel, /response\.status === 403/)
  console.log("  ✓ Outbound dashboard degrades gracefully on 403")

  const outboundRoute = readSource("app/api/platform/growth/autonomy/outbound-dashboard/route.ts")
  assert.match(outboundRoute, /requireGrowthEnginePlatformAccess/)
  console.log("  ✓ Outbound dashboard API remains platform-admin gated")

  const settingsApi = readSource("app/api/growth/workspace/settings/autonomy/route.ts")
  assert.match(settingsApi, /requireGrowthWorkspaceSettingsAccess/)
  console.log("  ✓ Autonomy settings API uses workspace settings access")

  console.log("\nGE-AUTO-SETTINGS-HOTFIX-1 passed.\n")
}

main()
