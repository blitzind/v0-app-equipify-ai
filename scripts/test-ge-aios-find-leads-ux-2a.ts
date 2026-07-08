/**
 * GE-AIOS-FIND-LEADS-UX-2A — Guided Ava Find Leads drawer certification.
 * Run: pnpm test:ge-aios-find-leads-ux-2a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_FIND_LEADS_UX_2A_QA_MARKER,
  GROWTH_HOME_FIND_LEADS_APPROVAL_COPY,
  GROWTH_HOME_FIND_LEADS_CARD_APPROVED_COPY,
  GROWTH_HOME_FIND_LEADS_CARD_CONTINUE_MANUAL_LABEL,
  GROWTH_HOME_FIND_LEADS_CARD_MISSING_COPY,
  GROWTH_HOME_FIND_LEADS_EDIT_SEARCH_LABEL,
  GROWTH_HOME_FIND_LEADS_HERO_TITLE,
  GROWTH_HOME_FIND_LEADS_LOOKS_GOOD_LABEL,
  GROWTH_HOME_FIND_LEADS_PLAN_TITLE,
  GROWTH_HOME_FIND_LEADS_RESULTS_AVA_RECOMMENDS_TITLE,
  GROWTH_HOME_FIND_LEADS_REVIEW_ALL_LABEL,
  GROWTH_HOME_GENERATE_SEARCH_LABEL,
} from "../lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"

const PHASE = "GE-AIOS-FIND-LEADS-UX-2A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Guided Find Leads UX certification`)

  assert.equal(GROWTH_AIOS_FIND_LEADS_UX_2A_QA_MARKER, "ge-aios-find-leads-ux-2a-v1")
  assert.equal(GROWTH_HOME_FIND_LEADS_HERO_TITLE, "Who would you like me to find?")
  assert.equal(GROWTH_HOME_GENERATE_SEARCH_LABEL, "Generate Search")
  assert.equal(GROWTH_HOME_FIND_LEADS_PLAN_TITLE, "Here's the search I prepared")
  assert.equal(GROWTH_HOME_FIND_LEADS_LOOKS_GOOD_LABEL, "Looks Good")
  assert.equal(GROWTH_HOME_FIND_LEADS_EDIT_SEARCH_LABEL, "Edit Search")
  assert.equal(
    GROWTH_HOME_FIND_LEADS_APPROVAL_COPY,
    "I have reviewed this search and approve building this audience.",
  )
  assert.equal(GROWTH_HOME_FIND_LEADS_RESULTS_AVA_RECOMMENDS_TITLE, "Ava recommends")
  assert.equal(GROWTH_HOME_FIND_LEADS_REVIEW_ALL_LABEL, "Review All Leads")
  assert.equal(
    GROWTH_HOME_FIND_LEADS_CARD_MISSING_COPY,
    "Ava can automatically find companies that match your ideal customer once she understands your business.",
  )
  assert.equal(
    GROWTH_HOME_FIND_LEADS_CARD_APPROVED_COPY,
    "Your Growth Profile is ready. Tell Ava who you'd like to find—or let her recommend the best opportunities.",
  )
  assert.equal(GROWTH_HOME_FIND_LEADS_CARD_CONTINUE_MANUAL_LABEL, "Continue with Manual Search")

  const workbench = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )
  assert.match(workbench, /GROWTH_AIOS_FIND_LEADS_UX_2A_QA_MARKER/)
  assert.match(workbench, /GROWTH_HOME_FIND_LEADS_HERO_TITLE/)
  assert.match(workbench, /GROWTH_HOME_FIND_LEADS_PLAN_TITLE/)
  assert.match(workbench, /GROWTH_HOME_FIND_LEADS_LOOKS_GOOD_LABEL/)
  assert.match(workbench, /GROWTH_HOME_FIND_LEADS_EDIT_SEARCH_LABEL/)
  assert.match(workbench, /GROWTH_HOME_FIND_LEADS_APPROVAL_COPY/)
  assert.match(workbench, /GROWTH_HOME_FIND_LEADS_RESULTS_AVA_RECOMMENDS_TITLE/)
  assert.match(workbench, /GROWTH_HOME_FIND_LEADS_CARD_APPROVED_COPY/)
  assert.match(workbench, /GROWTH_HOME_FIND_LEADS_CARD_MISSING_COPY/)
  assert.match(workbench, /GROWTH_HOME_START_LEAD_SEARCH_LABEL/)
  assert.match(workbench, /GROWTH_HOME_AVA_LED_SEARCH_EXPLAIN_TITLE/)
  assert.match(workbench, /GROWTH_AIOS_FIND_LEADS_7C_QA_MARKER/)
  assert.match(workbench, /workflowStep/)
  assert.match(workbench, /!buildConfirmed/)
  assert.match(workbench, /GROWTH_HOME_ADVANCED_PROVIDER_DETAILS_LABEL/)
  assert.match(workbench, /GROWTH_HOME_PROVIDER_MODE_LABEL/)
  assert.doesNotMatch(workbench, /import_all_previewed:\s*true[^}]*handleBuildAudience/)

  const form = readSource("components/growth/lead-sources/datamoon/datamoon-sourcing-workbench-form.tsx")
  assert.match(form, /CardTitle/)
  assert.match(form, /Audience/)
  assert.match(form, /Contact Requirements/)
  assert.doesNotMatch(form, /Provider mode/)

  const draftRoute = readSource("app/api/platform/growth/ava/datamoon-sourcing/draft/route.ts")
  assert.doesNotMatch(draftRoute, /GE-AIOS-FIND-LEADS-UX-2A|workflowStep|Generate Search/)

  console.log(`[${PHASE}] PASS — Guided Find Leads UX certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
