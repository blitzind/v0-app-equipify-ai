/**
 * GS-AI-PLAYBOOK-5B — Personalized Videos dashboard UX certification.
 * Run: pnpm test:growth-personalized-videos-dashboard-5b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_PERSONALIZED_VIDEOS_DASHBOARD_UX_QA_MARKER } from "../lib/growth/activity/growth-activity-workspace-constants"
import {
  GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH,
  GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH,
} from "../lib/growth/sendr/growth-sendr-branding"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-AI-PLAYBOOK-5B Personalized Videos Dashboard Certification ===\n")
  assert.equal(GROWTH_PERSONALIZED_VIDEOS_DASHBOARD_UX_QA_MARKER, "growth-personalized-videos-dashboard-ux-gs-ai-playbook-5b-v1")

  const dashboard = readSource("components/growth/sendr/growth-sendr-workspace-home.tsx")
  assert.match(dashboard, /GROWTH_PERSONALIZED_VIDEOS_DASHBOARD_UX_QA_MARKER/)
  assert.match(dashboard, /Published Pages/)
  assert.match(dashboard, /Active Campaigns/)
  assert.match(dashboard, /Views Today/)
  assert.match(dashboard, /CTA Clicks/)
  assert.match(dashboard, /Meetings Booked/)
  assert.match(dashboard, /Average Completion/)
  console.log("  ✓ metrics cards render")

  assert.match(dashboard, /No personalized video pages yet/)
  assert.match(dashboard, /Create your first personalized video experience/)
  assert.match(dashboard, /No engaged prospects yet/)
  assert.match(dashboard, /Activity will appear as prospects interact with pages/)
  assert.match(dashboard, /Everything looks healthy/)
  console.log("  ✓ empty states")

  assert.match(dashboard, /Top Pages/)
  assert.match(dashboard, /views/)
  assert.match(dashboard, /CTA/)
  assert.match(dashboard, /meetings/)
  assert.match(dashboard, /GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH/)
  console.log("  ✓ top pages cards + activity deep link")

  const page = readSource("app/(growth)/growth/videos/personalized/page.tsx")
  assert.match(page, /GrowthSendrWorkspaceHome/)
  assert.match(page, /GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL/)
  assert.doesNotMatch(page.replace(/^import .+$/gm, ""), /title=["'`]Sendr/)

  assert.equal(GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH, "/growth/videos/personalized")
  assert.equal(GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH, "/growth/activity")
  console.log("  ✓ canonical personalized videos route")

  console.log("\nPersonalized Videos dashboard 5B certification passed.\n")
}

main()
