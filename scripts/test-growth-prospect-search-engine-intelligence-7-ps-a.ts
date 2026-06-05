/**
 * Phase 7.PS-A — Prospect Search Growth Engine intelligence integration regression tests.
 * Run: pnpm test:growth-prospect-search-engine-intelligence-7-ps-a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER,
} from "../lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import { mergeBuyingCommitteeIntelligenceRoles } from "../lib/growth/prospect-search/prospect-search-engine-intelligence-merge"

const loader = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-contact-intelligence-loader.ts"),
  "utf8",
)
assert.match(loader, /loadProspectSearchEngineIntelligenceBatch/)
assert.match(loader, /mergeEngineIntelligenceIntoContactIntelligence/)
assert.match(loader, /resolveProspectSearchPersonLinkageBatch/)
assert.match(loader, /resolveProspectSearchCompanyCoverageBatch/)
assert.match(loader, /probeProspectSearchIntelligenceSchema/)
assert.doesNotMatch(loader, /openai|anthropic|zoominfo/i)

const engineLoader = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-engine-intelligence-loader.ts"),
  "utf8",
)
assert.match(engineLoader, /company_intelligence_snapshots/)
assert.match(engineLoader, /buying_committee_intelligence_members/)
assert.match(engineLoader, /person_emails/)
assert.match(engineLoader, /person_phones/)
assert.match(engineLoader, /person_profiles/)
assert.doesNotMatch(engineLoader, /cron|orchestrator|promote/i)

const resolution = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-coverage-resolution.ts"),
  "utf8",
)
assert.match(resolution, /resolveProspectSearchCompanyCoverage/)
assert.match(resolution, /loadProspectSearchDomainResolutionIndex/)
assert.match(resolution, /person_source_lineage/)
assert.match(resolution, /contact_candidates/)

const schemaHealth = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-intelligence-schema-health.ts"),
  "utf8",
)
assert.match(schemaHealth, /probeProspectSearchEngineIntelligenceSchema/)

assert.equal(GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER, "growth-prospect-search-engine-intelligence-7-ps-a-v1")

const engineSchemaHealth = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-engine-intelligence-schema-health.ts"),
  "utf8",
)
assert.match(engineSchemaHealth, /company_intelligence_snapshots/)
assert.match(engineSchemaHealth, /buying_committee_intelligence_members/)
assert.match(engineSchemaHealth, /person_emails/)

const merged = mergeBuyingCommitteeIntelligenceRoles(
  [{ role: "Economic Buyer", role_type: "economic_buyer", confidence: 0.5, recommended_order: 1, has_named_contact: false }],
  [
    {
      person_id: "p1",
      full_name: "Alex Owner",
      job_title: "Owner",
      committee_role: "economic_buyer",
      confidence: 0.92,
    },
  ],
)
assert.equal(merged[0]?.has_named_contact, true)
assert.equal(merged[0]?.contact_name, "Alex Owner")

const prospectSearchDir = path.join(process.cwd(), "lib/growth/prospect-search")
const forbiddenNewProviders = ["apollo", "zoominfo", "people_data_labs", "new_discovery_provider"]
for (const file of fs.readdirSync(prospectSearchDir)) {
  if (!file.endsWith(".ts")) continue
  if (
    !file.includes("engine-intelligence") &&
    !file.includes("canonical-resolution") &&
    !file.includes("coverage-resolution")
  ) {
    continue
  }
  const body = fs.readFileSync(path.join(prospectSearchDir, file), "utf8")
  for (const term of forbiddenNewProviders) {
    assert.doesNotMatch(body, new RegExp(term, "i"), `${file} must not add provider ${term}`)
  }
}

console.log("growth-prospect-search-engine-intelligence-7-ps-a: PASS")
