/**
 * Apollo-Primary-2 operator review deep link certification — no live DB/Apollo HTTP in CI.
 * Run: pnpm test:apollo-primary-contact-acquisition-2-deep-link
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_DEEP_LINK_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-company-candidate-deep-link-types"
import { buildProspectSearchCompanyCandidateDeepLinkResult } from "../lib/growth/prospect-search/prospect-search-company-candidate-deep-link-build"
import {
  resolveProspectSearchCanonicalCompanyIdParam,
  resolveProspectSearchCompanyCandidateIdParam,
} from "../lib/growth/prospect-search/prospect-search-runtime"
import { GROWTH_PROSPECT_SEARCH_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-types"

const ROUTE_PATH = "app/api/platform/growth/prospect-search/company-candidate/route.ts"
const LOADER_PATH = "lib/growth/prospect-search/prospect-search-company-candidate-deep-link.ts"
const SHELL_PATH = "components/growth/prospect-search/prospect-search-shell.tsx"
const RUNTIME_PATH = "lib/growth/prospect-search/prospect-search-runtime.ts"

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "apollo-primary-contact-acquisition.ts",
  "runApolloPrimaryContactAcquisition",
  "runContactDiscoveryForCompany",
  "sequence-enrollment",
  "sequence_enrollment",
  "outreach-queue",
  "sendEmail",
  "sendSms",
  "voice-drop",
  "enrollLead",
  "executeSequence",
]

const HENRY_SCHEIN_COMPANY_CANDIDATE_ID = "d2e669d5-e912-4fb7-992a-b4f9a92ff56a"
const HENRY_SCHEIN_CANONICAL_COMPANY_ID = "dd2b44c6-8383-4737-951a-6054200f45b5"

for (const relativePath of [ROUTE_PATH, LOADER_PATH, SHELL_PATH, RUNTIME_PATH]) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const routeSource = fs.readFileSync(path.join(process.cwd(), ROUTE_PATH), "utf8")
const loaderSource = fs.readFileSync(path.join(process.cwd(), LOADER_PATH), "utf8")
const shellSource = fs.readFileSync(path.join(process.cwd(), SHELL_PATH), "utf8")
const runtimeSource = fs.readFileSync(path.join(process.cwd(), RUNTIME_PATH), "utf8")

assert.match(routeSource, /requireGrowthEnginePlatformAccess/)
assert.match(routeSource, /loadProspectSearchCompanyCandidateForOperatorReview/)
assert.match(routeSource, /auto_enrollment:\s*false/)
assert.match(routeSource, /outreach_sent:\s*false/)
assert.doesNotMatch(routeSource, /export\s+async\s+function\s+POST\b/)
console.log("  ✓ route — platform admin GET only with safety flags")

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(loaderSource, new RegExp(forbidden, "i"), `Loader must not reference ${forbidden}`)
  assert.doesNotMatch(routeSource, new RegExp(forbidden, "i"), `Route must not reference ${forbidden}`)
}
console.log("  ✓ loader/route — no Apollo acquisition, discovery, enrollment, or outreach imports")

assert.match(loaderSource, /loadStagingCompanyCandidateRow/)
assert.match(loaderSource, /refreshProspectSearchCompanyAfterHumanAcquisition/)
assert.match(loaderSource, /source_type:\s*"external_discovered"/)
assert.doesNotMatch(loaderSource, /runApolloPrimaryContactAcquisition/)
assert.doesNotMatch(loaderSource, /runContactDiscoveryForCompany/)
console.log("  ✓ loader — staging hydration only, external_discovered mapping")

assert.equal(
  GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_DEEP_LINK_QA_MARKER,
  "growth-prospect-search-company-candidate-deep-link-v1",
)
console.log("  ✓ QA marker — deep link v1")

assert.equal(
  resolveProspectSearchCompanyCandidateIdParam(HENRY_SCHEIN_COMPANY_CANDIDATE_ID),
  HENRY_SCHEIN_COMPANY_CANDIDATE_ID,
)
assert.equal(resolveProspectSearchCompanyCandidateIdParam("not-a-uuid"), null)
assert.equal(
  resolveProspectSearchCanonicalCompanyIdParam(HENRY_SCHEIN_CANONICAL_COMPANY_ID),
  HENRY_SCHEIN_CANONICAL_COMPANY_ID,
)
console.log("  ✓ runtime — UUID param validation")

const deepLinkCompany = {
  id: HENRY_SCHEIN_COMPANY_CANDIDATE_ID,
  source_type: "external_discovered" as const,
  company_name: "Henry Schein",
  website: "https://www.henryschein.com",
  industry: "healthcare_distribution",
  subindustry: null,
  city: null,
  state: null,
  country: null,
  employees: null,
  revenue_range: null,
  location: null,
  intent_score: null,
  buying_stage: null,
  lead_score: null,
  confidence: 90,
  company_match_confidence: null,
  decision_maker_coverage: null,
  verification_status: "external_unverified",
  signals: ["Operator-linked staging company for Apollo acquisition review."],
  search_intent_category: null,
  growth_lead_id: null,
  prospect_id: null,
  customer_id: null,
  rank_score: 1,
  match_reasoning: ["Opened via operator company-candidate deep link."],
  canonical_company_id: HENRY_SCHEIN_CANONICAL_COMPANY_ID,
}

const deepLinkResult = buildProspectSearchCompanyCandidateDeepLinkResult(deepLinkCompany, {
  company_candidate_id: HENRY_SCHEIN_COMPANY_CANDIDATE_ID,
  source_table: "discovery_candidates",
})

assert.equal(deepLinkResult.qa_marker, GROWTH_PROSPECT_SEARCH_QA_MARKER)
assert.equal(deepLinkResult.discovery_mode, "discover_external")
assert.equal(deepLinkResult.companies.length, 1)
assert.equal(deepLinkResult.companies[0]?.id, HENRY_SCHEIN_COMPANY_CANDIDATE_ID)
assert.equal(deepLinkResult.companies[0]?.source_type, "external_discovered")
assert.equal(deepLinkResult.result_mode, "companies")
assert.equal(deepLinkResult.source_counts.external_discovered, 1)
console.log("  ✓ deep link result builder — single external_discovered company")

assert.match(shellSource, /companyCandidateId/)
assert.match(shellSource, /GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_DEEP_LINK_QA_MARKER/)
assert.match(shellSource, /\/api\/platform\/growth\/prospect-search\/company-candidate/)
assert.match(shellSource, /Apollo operator review deep link/)
assert.match(shellSource, /operatorDeepLinkActive/)
console.log("  ✓ shell — deep link fetch, auto-select, and operator banner")

const companyCardSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/company-result-card.tsx"),
  "utf8",
)
assert.match(companyCardSource, /ApolloPrimaryContactOperatorReviewPanel/)
assert.match(companyCardSource, /external_discovered/)
console.log("  ✓ panel mount — still gated to external_discovered selected card")

const manifestPath = path.join(process.cwd(), ".next/app-path-routes-manifest.json")
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, string>
  const key = "/api/platform/growth/prospect-search/company-candidate/route"
  if (Object.prototype.hasOwnProperty.call(manifest, key)) {
    console.log("  ✓ build manifest — company-candidate route registered")
  } else {
    console.log(`  · build manifest — ${key} not registered yet (run pnpm build)`)
  }
} else {
  console.log("  · build manifest — skipped (.next/app-path-routes-manifest.json not found; run pnpm build)")
}

const productionUrl =
  `https://app.equipify.com/admin/growth/search?mode=discover&companyCandidateId=${HENRY_SCHEIN_COMPANY_CANDIDATE_ID}&canonicalCompanyId=${HENRY_SCHEIN_CANONICAL_COMPANY_ID}`

console.log("\n  · Henry Schein production test URL:")
console.log(`    ${productionUrl}`)

console.log("\nApollo-Primary-2 deep link certification passed.")
