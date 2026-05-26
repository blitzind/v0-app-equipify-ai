/**
 * Regression checks for Native Dialer call workspace lead search.
 * Run: pnpm test:growth-native-dialer-lead-search
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { normalizeCompanyName } from "../lib/growth/import/normalize"
import { GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER } from "../lib/growth/native-dialer/call-workspace-lead-search-types"

assert.equal(GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER, "native-dialer-lead-search-v1")

const searchModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/call-workspace-lead-search.ts"),
  "utf8",
)
assert.match(searchModule, /\.or\(/)
assert.match(searchModule, /company_name\.ilike/)
assert.match(searchModule, /contact_email\.ilike/)
assert.match(searchModule, /website\.ilike/)
assert.match(searchModule, /lead_decision_makers/)
assert.match(searchModule, /outbound_contacts/)
assert.match(searchModule, /from\("prospects"\)/)
assert.match(searchModule, /relationship_summary/)
assert.match(searchModule, /native_dialer_lead_search/)
assert.match(searchModule, /pickAutoSelectLeadId/)
assert.doesNotMatch(searchModule, /\.limit\(80\)/)

const route = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/workspace/leads/search/route.ts"),
  "utf8",
)
assert.match(route, /GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER/)
assert.match(route, /diagnostics/)

const rail = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-intelligence-rail.tsx"),
  "utf8",
)
assert.match(rail, /GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER/)
assert.match(rail, /No matching lead found/)
assert.match(rail, /Create Prospect/)
assert.match(rail, /call-workspace-lead-search-input/)
assert.match(rail, /autoSelectedLeadId/)
assert.match(rail, /native-dialer-lead-search/)
assert.doesNotMatch(rail, /limit\(80\)/)

assert.equal(
  normalizeCompanyName("Precision Biomedical Services LLC"),
  normalizeCompanyName("precision biomedical services"),
)

console.log("growth-native-dialer-lead-search-v1 checks passed")
