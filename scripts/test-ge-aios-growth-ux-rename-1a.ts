/**
 * GE-AIOS-GROWTH-UX-RENAME-1A — Find Leads mental model certification.
 * Run: pnpm test:ge-aios-growth-ux-rename-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_GROWTH_UX_RENAME_1A_QA_MARKER,
  GROWTH_HOME_ADVANCED_SEARCH_TAB_LABEL,
  GROWTH_HOME_ASK_AVA_TAB_LABEL,
  GROWTH_HOME_AVA_ASK_DRAFT_LABEL,
  GROWTH_HOME_BUILD_AUDIENCE_LABEL,
  GROWTH_HOME_DISCOVERY_SOURCE_DATAMOON_LABEL,
  GROWTH_HOME_FIND_LEADS_CTA,
  GROWTH_HOME_FIND_LEADS_TITLE,
  GROWTH_HOME_IMPORT_RECOMMENDED_LABEL,
  GROWTH_HOME_IMPORT_SELECTED_LABEL,
} from "../lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"
import { GROWTH_HOME_AVA_REVIEW_DATAMOON_LABEL } from "../lib/growth/opportunity-intelligence/growth-home-opportunity-intelligence-api-contract"

const PHASE = "GE-AIOS-GROWTH-UX-RENAME-1A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Find Leads UX rename certification`)

  assert.equal(GROWTH_AIOS_GROWTH_UX_RENAME_1A_QA_MARKER, "ge-aios-growth-ux-rename-1a-v1")
  assert.equal(GROWTH_HOME_FIND_LEADS_TITLE, "Find Leads")
  assert.equal(GROWTH_HOME_FIND_LEADS_CTA, "Find Leads")
  assert.equal(GROWTH_HOME_ASK_AVA_TAB_LABEL, "Ask Ava")
  assert.equal(GROWTH_HOME_ADVANCED_SEARCH_TAB_LABEL, "Advanced Search")
  assert.equal(GROWTH_HOME_AVA_ASK_DRAFT_LABEL, "Generate Search")
  assert.equal(GROWTH_HOME_BUILD_AUDIENCE_LABEL, "Search for Leads")
  assert.equal(GROWTH_HOME_IMPORT_RECOMMENDED_LABEL, "Import Ava's Recommendations")
  assert.equal(GROWTH_HOME_IMPORT_SELECTED_LABEL, "Import Selected Leads")
  assert.equal(GROWTH_HOME_AVA_REVIEW_DATAMOON_LABEL, "Review Recent Imports")
  assert.equal(GROWTH_HOME_DISCOVERY_SOURCE_DATAMOON_LABEL, "Discovery source: Datamoon")

  const workbench = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )
  assert.match(workbench, /GROWTH_HOME_FIND_LEADS_TITLE/)
  assert.match(workbench, /GROWTH_HOME_FIND_LEADS_CTA/)
  assert.match(workbench, /GROWTH_HOME_ASK_AVA_TAB_LABEL/)
  assert.match(workbench, /GROWTH_HOME_ADVANCED_SEARCH_TAB_LABEL/)
  assert.match(workbench, /GROWTH_HOME_ADVANCED_PROVIDER_DETAILS_LABEL/)
  assert.match(workbench, /GROWTH_HOME_DISCOVERY_SOURCE_DATAMOON_LABEL/)
  assert.match(workbench, /data-qa-section="home-find-leads"/)
  assert.doesNotMatch(workbench, /Datamoon Sourcing Workbench/)
  assert.doesNotMatch(workbench, /Open Sourcing Workbench/)
  assert.doesNotMatch(workbench, />\s*Ava Draft\s*</)
  assert.doesNotMatch(workbench, />\s*Manual Search\s*</)
  assert.doesNotMatch(workbench, />\s*Build Audience\s*</)

  const draftRoute = readSource("app/api/platform/growth/ava/datamoon-sourcing/draft/route.ts")
  assert.doesNotMatch(draftRoute, /Find Leads|Sourcing Workbench/)

  const oiSection = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-opportunity-intelligence-section.tsx",
  )
  assert.match(oiSection, /GROWTH_HOME_AVA_REVIEW_DATAMOON_LABEL/)
  assert.doesNotMatch(oiSection, /Recent Datamoon imports/)

  const adminPanel = readSource("components/growth/lead-sources/growth-datamoon-audience-import-panel.tsx")
  assert.match(adminPanel, /Datamoon/)

  console.log(`[${PHASE}] PASS — Find Leads UX rename certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
