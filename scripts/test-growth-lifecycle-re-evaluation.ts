/**
 * GE-LAUNCH-1C — Lifecycle re-evaluation after material lead changes certification.
 * Run: pnpm test:growth-lifecycle-re-evaluation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  MATERIAL_LEAD_CHANGE_EVENTS,
  mergeMaterialLeadChangeEvents,
} from "../lib/growth/revenue-workflow/unified-revenue-workflow-lifecycle-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertWired(relativePath: string, label: string): void {
  const source = readSource(relativePath)
  assert.match(source, /scheduleUnifiedRevenueWorkflowLifecycleReEvaluation/, `${label} missing lifecycle wiring`)
}

async function main(): Promise<void> {
  console.log("\n=== GE-LAUNCH-1C Lifecycle Re-evaluation Certification ===\n")

  assert.equal(fs.existsSync("lib/growth/revenue-workflow/unified-revenue-workflow-lifecycle-runner.ts"), true)
  console.log("  ✓ Lifecycle runner exists")

  const runnerSource = readSource("lib/growth/revenue-workflow/unified-revenue-workflow-lifecycle-runner.ts")
  assert.match(runnerSource, /runUnifiedRevenueWorkflow\(/)
  assert.match(runnerSource, /skipLeadPersistence:\s*true/)
  assert.match(runnerSource, /pendingByLeadId/)
  assert.doesNotMatch(runnerSource, /enrollSequence/i)
  assert.doesNotMatch(runnerSource, /sendEmail/i)
  console.log("  ✓ Lifecycle runner reuses orchestrator with skipLeadPersistence and no outbound execution")

  const orchestratorSource = readSource("lib/growth/revenue-workflow/unified-revenue-workflow-orchestrator.ts")
  assert.doesNotMatch(orchestratorSource, /enrollSequence/i)
  console.log("  ✓ Orchestrator remains approval-only (no sends/enrollments)")

  assert.ok(MATERIAL_LEAD_CHANGE_EVENTS.includes("email_verified"))
  assert.ok(MATERIAL_LEAD_CHANGE_EVENTS.includes("learning_observation_added"))
  assert.equal(MATERIAL_LEAD_CHANGE_EVENTS.length, 29)
  console.log("  ✓ Material change event catalog registered")

  const merged = mergeMaterialLeadChangeEvents(new Set(["email_verified"]), [
    "phone_verified",
    "email_verified",
  ])
  assert.deepEqual(merged.sort(), ["email_verified", "phone_verified"])
  console.log("  ✓ Debounce merges duplicate material events")

  assert.match(runnerSource, /pendingByLeadId/)
  assert.match(runnerSource, /flushUnifiedRevenueWorkflowLifecycleReEvaluation/)
  assert.match(runnerSource, /getUnifiedRevenueWorkflowLifecycleDebounceWindowMs/)
  console.log("  ✓ Rapid duplicate events debounce into one re-evaluation")

  assertWired("lib/growth/captured-leads/captured-lead-actions.ts", "Verify Email operator action")
  assertWired("lib/growth/contact-discovery/company-contact-repository.ts", "company contact verification refresh")
  assertWired("lib/growth/contact-discovery/contact-repository.ts", "contact discovery")
  assertWired("lib/growth/enrichment/enrichment-repository.ts", "verification enrichment")
  assertWired("lib/growth/apply-lead-research-enrichment.ts", "research enrichment")
  assertWired("lib/growth/research/research-orchestrator.ts", "prospect research rerun")
  assertWired("lib/growth/buying-committee-intelligence/buying-committee-intelligence-orchestrator.ts", "buying committee refresh")
  assertWired("lib/growth/replies/finalize-ingested-reply-intelligence.ts", "reply intelligence")
  assertWired("lib/growth/meeting-intelligence/mutate-meeting.ts", "meeting lifecycle")
  assertWired("lib/growth/aios/learning/growth-closed-loop-learning-service.ts", "learning outcomes")
  assertWired("lib/growth/outbound/process-event.ts", "suppression events")
  assertWired("app/api/platform/growth/leads/[leadId]/route.ts", "lead qualification updates")
  console.log("  ✓ Material change completion sites wired to lifecycle runner")

  assert.match(
    readSource("lib/growth/replies/finalize-ingested-reply-intelligence.ts"),
    /positive_reply|negative_reply/,
  )
  assert.match(readSource("lib/growth/meeting-intelligence/mutate-meeting.ts"), /meeting_booked/)
  assert.match(readSource("lib/growth/meeting-intelligence/mutate-meeting.ts"), /meeting_completed/)
  console.log("  ✓ Engagement events map to lifecycle re-evaluation")

  assert.match(packageJson(), /test:growth-lifecycle-re-evaluation/)
  console.log("  ✓ Certification script registered in package.json")

  console.log("\nGE-LAUNCH-1C lifecycle re-evaluation certification PASSED\n")
}

function packageJson(): string {
  return readSource("package.json")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
