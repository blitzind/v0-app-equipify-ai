/**
 * Apollo-Primary-2 operator review & approval workflow certification — no live DB/Apollo HTTP in CI.
 * Run: pnpm test:apollo-primary-contact-acquisition-2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER,
  type ApolloPrimaryContactOperatorReviewSnapshot,
} from "../lib/growth/apollo/apollo-primary-contact-operator-review-types"
import {
  buildApolloPrimaryContactOperatorReviewSnapshot,
  buildApolloOperatorReviewMetadataPatch,
  isApolloSourcedCompanyContactRow,
  mergeApolloOperatorReviewRows,
  readApolloOperatorReviewStatus,
} from "../lib/growth/apollo/apollo-primary-contact-operator-review-evidence"

const ROUTE_ROOT = "app/api/platform/growth/apollo-primary-contact-acquisition/operator-review"
const REVIEW_ROUTE_PATH = `${ROUTE_ROOT}/route.ts`
const ACTIONS_ROUTE_PATH = `${ROUTE_ROOT}/actions/route.ts`
const PANEL_PATH = "components/growth/prospect-search/apollo-primary-contact-operator-review-panel.tsx"
const SERVER_PATH = "lib/growth/apollo/apollo-primary-contact-operator-review.ts"
const MIGRATION_PATH =
  "supabase/migrations/20270810120000_growth_engine_apollo_primary_contact_operator_reviews.sql"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-primary-contact-operator-review-types.ts",
  "lib/growth/apollo/apollo-primary-contact-operator-review-evidence.ts",
  SERVER_PATH,
  REVIEW_ROUTE_PATH,
  ACTIONS_ROUTE_PATH,
  PANEL_PATH,
  MIGRATION_PATH,
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "sequence-enrollment",
  "sequence_enrollment",
  "outreach-queue",
  "sendEmail",
  "sendSms",
  "voice-drop",
  "enrollLead",
  "executeSequence",
]

function assertRouteExportsHttpMethod(source: string, method: "GET" | "POST"): void {
  assert.match(
    source,
    new RegExp(`export\\s+async\\s+function\\s+${method}\\b`),
    `Route must export async function ${method}`,
  )
}

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const reviewRoute = fs.readFileSync(path.join(process.cwd(), REVIEW_ROUTE_PATH), "utf8")
const actionsRoute = fs.readFileSync(path.join(process.cwd(), ACTIONS_ROUTE_PATH), "utf8")
const serverSource = fs.readFileSync(path.join(process.cwd(), SERVER_PATH), "utf8")
const panelSource = fs.readFileSync(path.join(process.cwd(), PANEL_PATH), "utf8")
const migrationSource = fs.readFileSync(path.join(process.cwd(), MIGRATION_PATH), "utf8")

assertRouteExportsHttpMethod(reviewRoute, "GET")
assertRouteExportsHttpMethod(actionsRoute, "POST")
assert.doesNotMatch(reviewRoute, /export\s+async\s+function\s+POST\b/)
assert.doesNotMatch(actionsRoute, /export\s+async\s+function\s+GET\b/)
console.log("  ✓ route exports — GET review snapshot, POST review actions")

assert.match(reviewRoute, /requireGrowthEnginePlatformAccess/)
assert.match(actionsRoute, /requireGrowthEnginePlatformAccess/)
assert.match(actionsRoute, /logGrowthEngine/)
assert.match(actionsRoute, /auto_enrollment:\s*false/)
assert.match(actionsRoute, /outreach_sent:\s*false/)
console.log("  ✓ routes — platform admin + structured logging with safety flags")

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(serverSource, new RegExp(forbidden, "i"), `Server must not import ${forbidden}`)
  assert.doesNotMatch(actionsRoute, new RegExp(forbidden, "i"), `Actions route must not import ${forbidden}`)
}
console.log("  ✓ no enrollment/outreach side-effect imports in server or actions route")

assert.match(serverSource, /auto_enrollment_attempted:\s*false/)
assert.match(serverSource, /outreach_sent:\s*false/)
assert.match(serverSource, /enrolled_count:\s*0/)
assert.match(serverSource, /outreach_count:\s*0/)
console.log("  ✓ server hard-codes no auto-enrollment/outreach counters")

assert.match(migrationSource, /apollo_primary_contact_operator_reviews/)
assert.match(migrationSource, /auto_enrollment_attempted boolean not null default false/)
assert.match(migrationSource, /outreach_sent boolean not null default false/)
console.log("  ✓ migration — audit table with safety defaults")

assert.match(panelSource, /APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER/)
assert.match(panelSource, /Bulk approve sequence-ready/)
assert.match(panelSource, /Reject \/ suppress/)
assert.match(panelSource, /No auto-enrollment|no auto-enrollment/i)
console.log("  ✓ UI panel — review actions and no-side-effects copy")

assert.equal(
  APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER,
  "apollo-primary-contact-operator-review-v2",
)
console.log("  ✓ Apollo-Primary-2 QA marker")

const apolloContact = {
  id: "contact-1",
  contact_candidate_id: "candidate-1",
  full_name: "Carrie King",
  title: "Chief Operating Officer",
  email: "carrie.king@example.com",
  email_status: "discovered",
  phone: null,
  phone_status: "unknown",
  linkedin_url: "https://www.linkedin.com/in/carrie-king",
  canonical_person_id: "person-1",
  contact_status: "candidate",
  source_type: "public_record",
  metadata: {
    apollo_person_id: "apollo-1",
    apollo_enriched_at: "2026-06-01T00:00:00.000Z",
    identity_classification: "named_individual",
    eligible_for_canonical_person: true,
  },
}

assert.equal(isApolloSourcedCompanyContactRow(apolloContact), true)
assert.equal(readApolloOperatorReviewStatus(apolloContact.metadata), "pending")

const snapshot = buildApolloPrimaryContactOperatorReviewSnapshot({
  company_candidate_id: "company-1",
  company_name: "Henry Schein",
  canonical_company_id: "canonical-1",
  company_contacts: [apolloContact],
  contact_candidates: [],
}) satisfies ApolloPrimaryContactOperatorReviewSnapshot

assert.equal(snapshot.qa_marker, APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER)
assert.equal(snapshot.contacts.length, 1)
assert.equal(snapshot.contacts[0]?.source, "Apollo")
assert.equal(snapshot.contacts[0]?.contactable, true)
assert.equal(snapshot.auto_enrollment, false)
assert.equal(snapshot.outreach_sent, false)
console.log("  ✓ snapshot builder — Apollo contact fields and safety flags")

const merged = mergeApolloOperatorReviewRows({
  company_contacts: [apolloContact],
  contact_candidates: [
    {
      id: "candidate-2",
      full_name: "Alex Operator",
      job_title: "VP Sales",
      provider_type: "future_apollo",
      email: "alex@example.com",
      metadata: { apollo_person_id: "apollo-2" },
    },
  ],
  company_name: "Henry Schein",
})
assert.equal(merged.length, 2)
console.log("  ✓ merge — company contacts + unpromoted Apollo candidates")

const approvedPatch = buildApolloOperatorReviewMetadataPatch({
  status: "approved",
  reviewed_at: "2026-06-09T00:00:00.000Z",
  reviewed_by: "operator-1",
  outreach_ready: true,
})
assert.equal(
  readApolloOperatorReviewStatus(approvedPatch as Record<string, unknown>),
  "approved",
)
console.log("  ✓ metadata patch — approval state only")

const manifestPath = path.join(process.cwd(), ".next/app-path-routes-manifest.json")
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, string>
  const reviewKey = "/api/platform/growth/apollo-primary-contact-acquisition/operator-review/route"
  const actionsKey =
    "/api/platform/growth/apollo-primary-contact-acquisition/operator-review/actions/route"
  assert.ok(Object.prototype.hasOwnProperty.call(manifest, reviewKey), `Build manifest missing ${reviewKey}`)
  assert.ok(Object.prototype.hasOwnProperty.call(manifest, actionsKey), `Build manifest missing ${actionsKey}`)
  console.log("  ✓ build manifest — operator-review routes registered")
} else {
  console.log("  · build manifest — skipped (.next/app-path-routes-manifest.json not found; run pnpm build)")
}

console.log("\nApollo-Primary-2 operator review certification passed.")
