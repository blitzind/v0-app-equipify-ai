/**
 * AVA-CROSSWALK-E2E-AUTONOMY-1A — Certification.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AVA_CROSSWALK_E2E_AUTONOMY_1A_ADMISSION_INTAKE_SOURCE_QA_MARKER,
  buildGrowthLeadAdmissionIntakeFromLead,
  resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import { isExternalDiscoveryLeadIntakeSource } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"

const QA_MARKER = "ava-crosswalk-e2e-autonomy-1a-v1" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

async function main() {
  console.log(`[${QA_MARKER}] certification\n`)

  const admissionInputSource = readSource("lib/growth/revenue-workflow/growth-lead-admission-lead-input.ts")
  assert.match(admissionInputSource, new RegExp(AVA_CROSSWALK_E2E_AUTONOMY_1A_ADMISSION_INTAKE_SOURCE_QA_MARKER))
  assert.match(admissionInputSource, /resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata/)
  console.log("  ✓ Architecture guard — admission intake source resolver present")

  assert.equal(
    resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata({
      unified_intake_source: "datamoon",
    }),
    "datamoon",
  )
  assert.equal(
    resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata({
      normalized_source: "datamoon",
      admission_reasons: ["profile_aligned", "pending_operational_keyword_validation"],
    }),
    "datamoon",
  )
  assert.equal(
    resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata({
      source_lineage: { intake_source: "datamoon" },
    }),
    "datamoon",
  )
  assert.equal(
    resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata({
      intake_site_key: "prospect_search_external_discovery",
    }),
    "datamoon",
  )
  assert.equal(
    resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata({
      prospect_search: { source_type: "external_discovered" },
    }),
    "datamoon",
  )
  assert.equal(resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata({}), "manual")
  console.log("  ✓ resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata — canonical fallbacks")

  const crosswalkLikeLead = {
    id: "2421803b-8245-4a34-9958-aa96319f4e15",
    company_name: "crosswalk technologies",
    website: "https://crosswalktechnologies.com",
    metadata: {
      normalized_source: "datamoon",
      intake_site_key: "prospect_search_external_discovery",
      source_lineage: { intake_source: "datamoon" },
      admission_state: "review",
      admission_reasons: ["profile_aligned", "pending_operational_keyword_validation"],
    },
  }
  const intake = buildGrowthLeadAdmissionIntakeFromLead(crosswalkLikeLead)
  assert.equal(intake.source, "datamoon")
  assert.equal(isExternalDiscoveryLeadIntakeSource(intake.source), true)
  console.log("  ✓ Crosswalk-like persisted lead rehydrates as external discovery")

  const outcomeSource = readSource(
    "lib/growth/ava-home/recommendations/growth-home-ava-recommendation-outcome-next-1d.ts",
  )
  assert.doesNotMatch(outcomeSource, /One buying signal remains before I can prepare outreach/)
  console.log("  ✓ Home progress narrative — buying signal pseudo-gates removed")

  const reconcileSource = readSource(
    "lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a.ts",
  )
  assert.match(reconcileSource, /buildGrowthLeadAdmissionIntakeFromLead/)
  assert.match(reconcileSource, /isExternalDiscoveryLeadIntakeSource\(intake\.source\)/)
  console.log("  ✓ Post-research reconcile uses admission intake source resolver")

  console.log(`\nPASS — ${QA_MARKER}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
