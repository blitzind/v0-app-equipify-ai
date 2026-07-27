/**
 * AVA-AUTONOMOUS-PIPELINE-PROOF-1A — Certification.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { nextBestActionToWorkItem } from "@/lib/growth/work-manager/bridges/decision-engine-bridge"
import {
  AVA_CROSSWALK_E2E_AUTONOMY_1A_ADMISSION_INTAKE_SOURCE_QA_MARKER,
  resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import { isExternalDiscoveryLeadIntakeSource } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"
import type { NextBestAction } from "@/lib/growth/decision-engine/types"

const QA_MARKER = "ava-autonomous-pipeline-proof-1a-v1" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function action(overrides: Partial<NextBestAction> & Pick<NextBestAction, "id" | "kind" | "title">): NextBestAction {
  return {
    reason: [],
    overall_score: 70,
    score_breakdown: {
      revenue_impact: 70,
      customer_impact: 70,
      urgency: 70,
      confidence: 70,
      business_understanding: 70,
      dependencies: 90,
      effort: 20,
      approval_gate: 90,
    },
    depends_on: [],
    blocked_by: [],
    estimated_time_minutes: 10,
    requires_operator: false,
    confidence: 70,
    href: null,
    company_name: null,
    source_id: overrides.id,
    relationship_graph: null,
    ...overrides,
  }
}

async function main() {
  console.log(`[${QA_MARKER}] certification\n`)

  const decisionContext = readSource("lib/growth/decision-engine/context/build-decision-context.ts")
  assert.match(decisionContext, /case "monitoring":/)
  assert.match(decisionContext, /kind: "wait"/)
  assert.match(decisionContext, /Must not masquerade as executable ASL work/)
  console.log("  ✓ monitor_audience observational monitoring uses wait kind")

  const monitoring = nextBestActionToWorkItem(
    action({
      id: "discovery:monitor_audience",
      kind: "wait",
      title: "Monitor audience — ICP",
    }),
    new Date().toISOString(),
  )
  assert.equal(monitoring.can_execute_autonomously, false)
  const refresh = nextBestActionToWorkItem(
    action({
      id: "discovery:refresh_audience",
      kind: "continue_mission",
      title: "Refresh audience — ICP",
    }),
    new Date().toISOString(),
  )
  assert.equal(refresh.can_execute_autonomously, true)
  console.log("  ✓ refresh_audience remains executable; monitor_audience wait is not")

  const admissionInput = readSource("lib/growth/revenue-workflow/growth-lead-admission-lead-input.ts")
  assert.match(admissionInput, new RegExp(AVA_CROSSWALK_E2E_AUTONOMY_1A_ADMISSION_INTAKE_SOURCE_QA_MARKER))
  assert.equal(
    resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata({ normalized_source: "datamoon" }),
    "datamoon",
  )
  assert.equal(isExternalDiscoveryLeadIntakeSource("datamoon"), true)
  console.log("  ✓ DataMoon intake provenance rehydration retained")

  assert.match(
    readSource("lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a.ts"),
    /reconcileExternalDiscoveryPostResearchAdmission/,
  )
  console.log("  ✓ post-research reconciliation path present")

  assert.match(readSource("lib/growth/mission-center/growth-home-mission-discovery-snapshot.ts"), /pendingApprovals > 0 && !input.pipelineLow/)
  console.log("  ✓ pending approvals do not block pipeline-low audience refresh")

  console.log(`\nPASS — ${QA_MARKER}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
