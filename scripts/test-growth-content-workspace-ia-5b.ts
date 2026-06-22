/**
 * GS-AI-PLAYBOOK-5B — Content workspace IA certification.
 * Run: pnpm test:growth-content-workspace-ia-5b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_CONTENT_WORKSPACE_IA_QA_MARKER } from "../lib/growth/activity/growth-activity-workspace-constants"
import {
  GROWTH_PERSONALIZATION_WORKSPACE_PATH,
} from "../lib/growth/personalization/personalization-generation-ux"
import {
  GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH,
  GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH,
} from "../lib/growth/sendr/growth-sendr-branding"
import { GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS } from "../lib/growth/navigation/growth-workspace-sidebar-ia"
import {
  buildGrowthWorkspaceShellNavGroups,
  isGrowthShellNavItemActive,
  listGrowthWorkspaceShellNavHrefs,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoOperatorFacingSendr(relativePath: string): void {
  const source = readSource(relativePath)
  assert.doesNotMatch(source, /href=["'`]\/growth\/sendr/, `${relativePath} must not link legacy /growth/sendr`)
  const withoutImports = source.replace(/^import .+$/gm, "")
  assert.doesNotMatch(
    withoutImports,
    /(?:title|description|label|placeholder)=["'`][^"'`]*Sendr/i,
    `${relativePath} must not contain Sendr in operator-visible labels`,
  )
}

function main(): void {
  console.log("\n=== GS-AI-PLAYBOOK-5B Content Workspace IA Certification ===\n")
  assert.ok(GROWTH_CONTENT_WORKSPACE_IA_QA_MARKER)

  assert.equal(GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH, "/growth/videos/personalized")
  assert.equal(GROWTH_PERSONALIZATION_WORKSPACE_PATH, "/growth/personalization")
  assert.equal(GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH, "/growth/activity")

  assert.ok(fs.existsSync("app/(growth)/growth/activity/page.tsx"))
  assert.ok(fs.existsSync("app/(growth)/growth/personalization/page.tsx"))
  assert.ok(fs.existsSync("app/(growth)/growth/videos/personalized/page.tsx"))
  console.log("  ✓ canonical routes exist")

  const catalog = readSource("lib/growth/navigation/growth-route-catalog-data.ts")
  assert.match(catalog, /workspaceDual\("workspace-activity", "activity", "Activity", "intelligence"/)
  assert.match(catalog, /workspaceDual\("workspace-personalization"/)
  assert.match(catalog, /workspaceDual\("workspace-personalized-videos"/)
  console.log("  ✓ route catalog — Activity under Intelligence, Personalization under Content")

  const shellNav = readSource("lib/growth/navigation/growth-workspace-shell-navigation.ts")
  const contentBlock = shellNav.slice(
    shellNav.indexOf('id: "content"'),
    shellNav.indexOf('id: "automation"'),
  )
  assert.match(contentBlock, /share-pages/)
  assert.match(contentBlock, /personalized-videos/)
  assert.match(contentBlock, /personalization/)
  assert.match(contentBlock, /videos/)
  assert.match(contentBlock, /media-assets/)
  assert.doesNotMatch(contentBlock, /activity/)

  const intelligenceBlock = shellNav.slice(
    shellNav.indexOf('id: "intelligence"'),
    shellNav.indexOf("export const GROWTH_WORKSPACE_SHELL_OPERATOR_NAV_IDS"),
  )
  assert.match(intelligenceBlock, /opportunities/)
  assert.match(intelligenceBlock, /activity/)
  console.log("  ✓ sidebar IA — Content vs Intelligence groups")

  const navIds = [...GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS]
  const contentIndex = navIds.indexOf("share-pages")
  const personalizationIndex = navIds.indexOf("personalization")
  const activityIndex = navIds.indexOf("activity")
  const opportunitiesIndex = navIds.indexOf("opportunities")
  assert.ok(contentIndex >= 0 && personalizationIndex > contentIndex)
  assert.ok(activityIndex > opportunitiesIndex)
  console.log("  ✓ operator nav id ordering")

  const intelligenceGroup = buildGrowthWorkspaceShellNavGroups().find((group) => group.id === "intelligence")
  assert.ok(intelligenceGroup, "Intelligence sidebar group missing")
  const activityNav = intelligenceGroup.items.find((item) => item.id === "activity")
  assert.ok(activityNav, "Activity nav item missing from Intelligence group")
  assert.equal(activityNav.href, "/growth/activity")
  assert.equal(
    isGrowthShellNavItemActive("/growth/activity", activityNav),
    true,
    "Activity nav should be active on /growth/activity",
  )
  assert.equal(
    isGrowthShellNavItemActive("/growth/activity?filter=high-intent", activityNav),
    true,
    "Activity nav should stay active with query params",
  )
  for (const href of listGrowthWorkspaceShellNavHrefs()) {
    assert.doesNotMatch(href, /\/growth\/sendr\/activity/, "Sidebar must not link to legacy sendr activity")
  }
  console.log("  ✓ Activity nav — Intelligence group, canonical href, active state, no sendr href")

  const adminPersonalization = readSource("app/(admin)/admin/growth/copilot/personalization/page.tsx")
  assert.match(adminPersonalization, /redirect/)
  assert.match(adminPersonalization, /GROWTH_PERSONALIZATION_WORKSPACE_PATH/)
  console.log("  ✓ legacy /admin/growth/copilot/personalization redirects only")

  const legacySendr = readSource("app/(growth)/growth/sendr/page.tsx")
  assert.match(legacySendr, /redirect\(/)
  assert.match(legacySendr, /GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH/)

  const legacyActivity = readSource("app/(growth)/growth/sendr/activity/page.tsx")
  assert.match(legacyActivity, /GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH/)
  console.log("  ✓ legacy /growth/sendr/* redirects only")

  const operatorSurfaces = [
    "components/growth/activity/growth-activity-workspace.tsx",
    "components/growth/personalization/growth-personalization-page-client.tsx",
    "components/growth/sendr/growth-sendr-workspace-home.tsx",
    "app/(growth)/growth/activity/page.tsx",
    "app/(growth)/growth/personalization/page.tsx",
    "app/(growth)/growth/videos/personalized/page.tsx",
  ]
  for (const surface of operatorSurfaces) {
    assertNoOperatorFacingSendr(surface)
  }
  console.log("  ✓ no operator-facing sendr or copilot/personalization routes")

  console.log("\nContent workspace IA 5B certification passed.\n")
}

main()
