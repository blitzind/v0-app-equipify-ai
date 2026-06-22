/**
 * GS-GROWTH-SETTINGS-HOTFIX-8I — Core settings bridge pages (superseded by 8K lifted panels).
 * Run: pnpm test:growth-settings-bridge-8i
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE,
  GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER,
  growthEngineCustomerSettingsHref,
} from "../lib/growth/navigation/growth-workspace-settings-canonical"
import { resolveGrowthEngineSectionLiftKind } from "../lib/settings/workspace-settings-growth-engine-lift"

export const GROWTH_SETTINGS_BRIDGE_8I_QA_MARKER = "growth-settings-bridge-8i-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_SETTINGS_BRIDGE_8I_QA_MARKER, "growth-settings-bridge-8i-v1")
  assert.equal(GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER, "growth-workspace-settings-canonical-8k-v1")

  const growthEnginePage = readSource("app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx")
  assert.doesNotMatch(growthEnginePage, /redirect\(/)
  assert.match(growthEnginePage, /WorkspaceSettingsGrowthEngineSectionPage/)

  const sectionPage = readSource("components/settings/workspace-settings-growth-engine-section-page.tsx")
  assert.match(sectionPage, /liftKind === "lifted"/)
  assert.doesNotMatch(sectionPage, /WorkspaceSettingsGrowthEngineBridgePanel/)

  assert.equal(GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE, "/settings/growth-engine")
  assert.equal(resolveGrowthEngineSectionLiftKind("connected-mailboxes"), "lifted")
  assert.equal(
    growthEngineCustomerSettingsHref("connected-mailboxes"),
    "/settings/growth-engine/connected-mailboxes",
  )

  const deliveryRedirect = readSource("app/(growth)/growth/settings/delivery/page.tsx")
  assert.match(deliveryRedirect, /redirect/)

  console.log("growth-settings-bridge-8i: ok")
}

main()
