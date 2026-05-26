/**
 * Regression checks for Native Dialer call workspace lead search.
 * Run: pnpm test:growth-native-dialer-lead-search
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { normalizeCompanyName } from "../lib/growth/import/normalize"
import { GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER } from "../lib/growth/native-dialer/call-workspace-lead-search-types"

assert.equal(GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER, "native-dialer-lead-search-v2")

const searchModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/call-workspace-lead-search.ts"),
  "utf8",
)
assert.match(searchModule, /\.ilike\(field, pattern\)/)
assert.match(searchModule, /buildHit/)
assert.match(searchModule, /resultMergeKey/)
assert.match(searchModule, /searchAccounts/)
assert.match(searchModule, /searchCustomerContacts/)
assert.match(searchModule, /public\.customers/)
assert.match(searchModule, /public\.customer_contacts/)
assert.match(searchModule, /from\("prospects"\)/)
assert.match(searchModule, /attachLeadId: null/)
assert.match(searchModule, /native_dialer_lead_search/)
assert.doesNotMatch(searchModule, /\.or\(orFilters\.join/)

const typesModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/call-workspace-lead-search-types.ts"),
  "utf8",
)
assert.match(typesModule, /displayName/)
assert.match(typesModule, /attachLeadId/)
assert.match(typesModule, /resolveCallWorkspaceAttachLeadId/)

const route = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/workspace/leads/search/route.ts"),
  "utf8",
)
assert.match(route, /entities: results/)
assert.match(route, /contacts: 0/)
assert.match(route, /accounts: 0/)

const dialer = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-native-dialer.tsx"),
  "utf8",
)
assert.match(dialer, /useCallWorkspaceLeadSearch/)
assert.match(dialer, /CallWorkspaceLeadSearchResultsPanel/)
assert.doesNotMatch(dialer, /select a lead from queue/)

const hook = fs.readFileSync(
  path.join(process.cwd(), "components/growth/use-call-workspace-lead-search.ts"),
  "utf8",
)
assert.match(hook, /data\.results \?\? data\.leads \?\? data\.entities/)
assert.match(hook, /autoAttachDelayMs = 700/)

const rail = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-intelligence-rail.tsx"),
  "utf8",
)
assert.match(rail, /GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER/)
assert.match(rail, /useCallWorkspaceLeadSearch/)

assert.equal(
  normalizeCompanyName("Blitz Industries LLC"),
  normalizeCompanyName("blitz industries"),
)

console.log("growth-native-dialer-lead-search-v2 checks passed")
