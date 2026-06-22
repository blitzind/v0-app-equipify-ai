/**
 * Operator-facing Sendr cleanup certification — canonical routes + legacy redirects.
 * Run: pnpm test:growth-operator-facing-sendr-cleanup
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_LEGACY_SENDR_PAGE_URL_MERGE_TOKEN,
  GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH,
  GROWTH_PERSONALIZED_VIDEOS_LEGACY_WORKSPACE_PREFIX,
  GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL,
  GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH,
  GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN,
  buildGrowthPersonalizedVideosPageDetailPath,
  buildGrowthPersonalizedVideosWorkspaceHref,
} from "../lib/growth/sendr/growth-sendr-branding"
import {
  GROWTH_PERSONALIZATION_LEGACY_ADMIN_PATH,
  GROWTH_PERSONALIZATION_WORKSPACE_PATH,
} from "../lib/growth/personalization/personalization-generation-ux"
import { applySendrPageUrlMergeFields } from "../lib/growth/sendr/growth-sendr-page-url-merge"
import { buildSendrPagePublicLink } from "../lib/growth/sendr/growth-sendr-slug-runtime"
import { buildSendrPageDetailPath } from "../lib/growth/sendr/growth-sendr-video-return-flow"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoOperatorFacingSendrCopy(relativePath: string): void {
  const source = readSource(relativePath)
  assert.doesNotMatch(source, /\bSENDR\b/, `${relativePath} must not contain SENDR`)
  assert.doesNotMatch(source, /\{\{sendr_page_url\}\}/, `${relativePath} must not show legacy merge token in UI`)
  assert.doesNotMatch(source, /href=["'`]\/growth\/sendr/, `${relativePath} must not link to legacy /growth/sendr routes`)
  const withoutImports = source.replace(/^import .+$/gm, "")
  assert.doesNotMatch(
    withoutImports,
    /(?:title|description|label|placeholder)=["'`][^"'`]*Sendr/,
    `${relativePath} must not contain Sendr in operator-visible labels`,
  )
}

function main(): void {
  console.log("\n=== Operator-Facing Sendr Cleanup Certification ===\n")

  assert.equal(GROWTH_PERSONALIZATION_WORKSPACE_PATH, "/growth/personalization")
  assert.equal(GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH, "/growth/videos/personalized")
  assert.equal(GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH, "/growth/activity")
  assert.equal(buildGrowthPersonalizedVideosPageDetailPath("abc"), "/growth/videos/personalized/abc")
  assert.equal(buildGrowthPersonalizedVideosWorkspaceHref("launch"), "/growth/videos/personalized/launch")
  assert.equal(buildSendrPageDetailPath("abc"), "/growth/videos/personalized/abc")

  assert.ok(fs.existsSync("app/(growth)/growth/personalization/page.tsx"))
  assert.ok(fs.existsSync("app/(growth)/growth/videos/personalized/page.tsx"))
  assert.ok(fs.existsSync("app/(growth)/growth/activity/page.tsx"))

  const personalizationPage = readSource("app/(growth)/growth/personalization/page.tsx")
  assert.match(personalizationPage, /GrowthPersonalizationPageClient/)

  const adminPersonalization = readSource("app/(admin)/admin/growth/copilot/personalization/page.tsx")
  assert.match(adminPersonalization, /redirect/)
  assert.match(adminPersonalization, /GROWTH_PERSONALIZATION_WORKSPACE_PATH/)
  console.log("  ✓ /growth/personalization route + admin redirect")

  const legacyRoot = readSource("app/(growth)/growth/sendr/page.tsx")
  assert.match(legacyRoot, /redirect\(/)
  assert.match(legacyRoot, /GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH/)
  assert.match(legacyRoot, /searchParams/)

  const legacyActivity = readSource("app/(growth)/growth/sendr/activity/page.tsx")
  assert.match(legacyActivity, /GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH/)

  const legacyDetail = readSource("app/(growth)/growth/sendr/[pageId]/page.tsx")
  assert.match(legacyDetail, /buildGrowthPersonalizedVideosPageDetailPath/)
  console.log("  ✓ legacy /growth/sendr/* redirects preserve query params")

  const shellNav = readSource("lib/growth/navigation/growth-workspace-shell-navigation.ts")
  assert.match(shellNav, /Personalized Videos/)
  assert.match(shellNav, /videos\/personalized/)
  assert.doesNotMatch(shellNav, /label: "Sendr"/)

  const catalog = readSource("lib/growth/navigation/growth-route-catalog-data.ts")
  assert.match(catalog, /videos\/personalized/)
  assert.match(catalog, /"activity", "Activity"/)
  console.log("  ✓ sidebar + route catalog use Personalized Videos canonical paths")

  const activityPage = readSource("app/(growth)/growth/activity/page.tsx")
  assert.doesNotMatch(activityPage, /href=["'`]\/growth\/sendr/)
  assert.doesNotMatch(activityPage, /\/growth\/sendr\/activity/)
  console.log("  ✓ /growth/activity route does not expose sendr path")

  const operatorUiFiles = [
    "components/growth/sendr/growth-sendr-workspace-home.tsx",
    "components/growth/sendr/growth-sendr-activity-dashboard.tsx",
    "components/growth/sendr/growth-sendr-analytics-dashboard.tsx",
    "components/growth/sendr/growth-sendr-launch-complete-step.tsx",
    "components/growth/sendr/builder/growth-sendr-builder-header.tsx",
    "app/(growth)/growth/videos/personalized/page.tsx",
    "app/(growth)/growth/activity/page.tsx",
  ]
  for (const file of operatorUiFiles) {
    assertNoOperatorFacingSendrCopy(file)
  }

  const workspaceHome = readSource("components/growth/sendr/growth-sendr-workspace-home.tsx")
  assert.match(workspaceHome, /Create Video Page/)
  assert.match(workspaceHome, /Create personalized video pages, attach media and booking, publish manually\./)
  assert.doesNotMatch(workspaceHome, /href=["'`]\/growth\/sendr/)
  console.log("  ✓ operator-visible copy cleaned up")

  assert.equal(GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN, "{{video_page_url}}")
  assert.equal(GROWTH_LEGACY_SENDR_PAGE_URL_MERGE_TOKEN, "{{sendr_page_url}}")
  const resolved = applySendrPageUrlMergeFields(
    `Hi {{first_name}}, ${GROWTH_LEGACY_SENDR_PAGE_URL_MERGE_TOKEN}`,
    buildSendrPagePublicLink("demo-page"),
  )
  assert.match(resolved, /\/videos\/demo-page/)
  console.log("  ✓ video_page_url preferred; sendr_page_url resolves internally")

  assert.ok(fs.existsSync("app/videos/[slug]/page.tsx"))
  const legacyPublic = readSource("app/sendr/[slug]/page.tsx")
  assert.match(legacyPublic, /redirect\(/)
  console.log("  ✓ public /videos/[slug] unchanged; legacy /sendr/[slug] redirect preserved")

  const generateRoute = readSource("app/api/platform/growth/personalization/generate/route.ts")
  assert.match(generateRoute, /generatePersonalizationDraft/)
  assert.doesNotMatch(generateRoute, /runAiTask\(/)
  console.log("  ✓ no generation/prompt/scoring/approval/provider changes in scope")

  console.log(`\nLegacy admin personalization preserved: ${GROWTH_PERSONALIZATION_LEGACY_ADMIN_PATH}`)
  console.log(`Legacy workspace prefix preserved: ${GROWTH_PERSONALIZED_VIDEOS_LEGACY_WORKSPACE_PREFIX}`)
  console.log(`Product label: ${GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL}`)
  console.log("\nOperator-facing Sendr cleanup certification passed.\n")
}

main()
