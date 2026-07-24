/**
 * FUZOR-PLATFORM-LIFT-1A — Focused certification (architecture, no GPT).
 * Run: pnpm test:fuzor-platform-lift-1a
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  FUZOR_COMPANY_INTELLIGENCE_OWNER_ORG_MIGRATION,
  FUZOR_PLATFORM_LIFT_1A_QA_MARKER,
} from "../lib/fuzor/company-intelligence"
import { ensureCompanyIntelligence } from "../lib/fuzor/company-intelligence"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${FUZOR_PLATFORM_LIFT_1A_QA_MARKER}] focused certification`)

  // Restricted surfaces untouched.
  for (const file of [
    "lib/growth/home/growth-home-workspace-summary-service.ts",
    "lib/growth/ava-direct-outreach/ava-direct-outreach-service.ts",
  ]) {
    assert.doesNotMatch(
      readSource(file),
      /FUZOR_PLATFORM_LIFT_1A|ownerOrganizationId/,
    )
  }

  const migration = readSource(
    "supabase/migrations/20270902120000_fuzor_company_intelligence_owner_org_lift_1a.sql",
  )
  assert.match(migration, /owner_organization_id/)
  assert.match(migration, /ai_deployment_id/)
  assert.equal(
    FUZOR_COMPANY_INTELLIGENCE_OWNER_ORG_MIGRATION,
    "20270902120000_fuzor_company_intelligence_owner_org_lift_1a",
  )

  // Platform package entry exists.
  const pkg = readSource("lib/fuzor/company-intelligence/index.ts")
  assert.match(pkg, /ensureCompanyIntelligence/)
  assert.match(pkg, /ensureCompanyIntelligenceForGrowthLead/)

  // Platform API rejects missing owner without Growth default.
  const missingOwner = await ensureCompanyIntelligence({
    admin: {} as never,
    ownerOrganizationId: "",
    leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3",
  })
  assert.equal(missingOwner.ok, false)
  if (!missingOwner.ok) {
    assert.equal(missingOwner.code, "owner_organization_required")
  }

  // Growth adapter holds Equipify default; platform core does not.
  const adapter = readSource(
    "lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-growth-lead-adapter.ts",
  )
  assert.match(adapter, /getGrowthEngineAiOrgId/)
  const platform = readSource(
    "lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-platform.ts",
  )
  assert.doesNotMatch(
    platform,
    /organizationId = input\.organizationId \?\? getGrowthEngineAiOrgId\(\)/,
  )
  assert.match(platform, /evidence_adapter_required/)
  assert.match(platform, /forbidden_cross_tenant/)

  // Repository persists ownership.
  const repo = readSource(
    "lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-repository.ts",
  )
  assert.match(repo, /owner_organization_id: input\.ownerOrganizationId/)
  assert.match(repo, /\.eq\("owner_organization_id", ownerOrganizationId\)/)

  console.log(`[${FUZOR_PLATFORM_LIFT_1A_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
