/**
 * GS-RG-2B — Audience inbox bridge lead creation certification (local static).
 * Run: pnpm test:growth-audience-lead-creation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AUDIENCE_LIMITS } from "../lib/growth/audiences/growth-audience-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-2B Audience Lead Creation Certification ===\n")

  assert.equal(GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_LEAD_CREATIONS_PER_RUN, 100)
  assert.equal(GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_LEAD_CREATIONS_PER_DAY, 500)

  const migration = readSource("supabase/migrations/20270901150000_growth_dynamic_audiences_gs_rg_2b.sql")
  assert.match(migration, /growth_audience_lead_creation_runs/)
  assert.match(migration, /audience_lead_creation_enabled/)

  const service = readSource("lib/growth/audiences/growth-audience-lead-creation-service.ts")
  assert.match(service, /startAudienceLeadCreation/)
  assert.match(service, /continueAudienceLeadCreation/)
  assert.match(service, /createLeadCandidate/)
  assert.match(service, /checkAudienceLeadCreationEnabled/)
  assert.match(service, /Operator-approved/)
  assert.doesNotMatch(service, /bulkEnroll/)

  const route = readSource("app/api/platform/growth/audiences/[audienceId]/create-leads/route.ts")
  assert.match(route, /startAudienceLeadCreation/)
  assert.match(route, /continueAudienceLeadCreation/)

  const guardrails = readSource("lib/growth/audiences/growth-audience-guardrails.ts")
  assert.match(guardrails, /consumeAudienceLeadCreationBudget/)
  assert.match(guardrails, /audience_lead_creations/)

  const detail = readSource("components/growth/audiences/growth-audience-detail.tsx")
  assert.match(detail, /create-leads/)
  assert.match(detail, /Create Leads/)

  console.log("  ✓ Operator-approved inbox bridge — chunked, budgeted")
  console.log("\nGS-RG-2B audience lead creation certification passed.\n")
}

main()
