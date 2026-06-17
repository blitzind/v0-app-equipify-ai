/**
 * Growth inbox ↔ calls convergence audit (Phase 7K — local only).
 *
 * Usage: pnpm test:growth-inbox-calls-convergence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_INBOX_CALL_COMMUNICATION_KINDS,
  GROWTH_INBOX_CALL_QUEUE_VIEWS,
  adaptNativeDialerQueueItem,
  filterCallCommunicationsByQueueView,
  growthWorkspaceCallWorkspaceHref,
} from "../lib/growth/inbox/inbox-call-communication-read-model"
import {
  GROWTH_INBOX_CALL_OUTCOME_INVENTORY,
  GROWTH_INBOX_CALL_COMMUNICATION_INVENTORY_QA_MARKER,
  GROWTH_INBOX_CALL_NOTIFICATION_ROUTING_AUDIT,
} from "../lib/growth/inbox/inbox-call-communication-inventory"
import {
  GROWTH_INBOX_CALLS_CONVERGENCE_MATRIX,
  GROWTH_INBOX_CALLS_CONVERGENCE_QA_MARKER,
  GROWTH_INBOX_CALLS_PRESERVED_ROUTES,
} from "../lib/growth/navigation/growth-inbox-calls-convergence-architecture"
import {
  GROWTH_INBOX_QUEUE_VIEWS,
  isGrowthInboxCallQueueView,
} from "../lib/growth/inbox/inbox-thread-queue-filters"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import { findGrowthRouteMetadataByPathname } from "../lib/growth/navigation/growth-route-metadata"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleDialerQueueItem() {
  return {
    id: "queue-1",
    leadId: "00000000-0000-4000-8000-000000000001",
    ownerUserId: null,
    queueMode: "callback" as const,
    status: "open",
    priorityScore: 80,
    callbackDueAt: new Date().toISOString(),
    phoneNumber: "+15551234567",
    contactName: "Alex",
    companyName: "Acme",
    reason: "Callback requested",
    ctaHref: "/admin/growth/calls/workspace?leadId=1",
  }
}

function runAudit(): void {
  console.log(`\n=== Growth inbox calls convergence audit (${GROWTH_INBOX_CALLS_CONVERGENCE_QA_MARKER}) ===\n`)

  assert.ok(GROWTH_INBOX_CALL_OUTCOME_INVENTORY.length >= 5)
  assert.ok(GROWTH_INBOX_CALL_NOTIFICATION_ROUTING_AUDIT.length >= 4)
  console.log("  ✓ call outcome inventory and notification routing audit documented")

  for (const view of GROWTH_INBOX_CALL_QUEUE_VIEWS) {
    assert.ok(GROWTH_INBOX_QUEUE_VIEWS.includes(view), `call queue view missing from union: ${view}`)
    assert.ok(isGrowthInboxCallQueueView(view))
  }
  assert.equal(GROWTH_INBOX_CALL_COMMUNICATION_KINDS.length, 4)
  console.log("  ✓ call queue views are filters only (no new routes)")

  for (const route of GROWTH_INBOX_CALLS_PRESERVED_ROUTES) {
    assert.ok(findGrowthRouteMetadataByPathname(route) || route.endsWith("/calls/workspace"))
  }
  console.log("  ✓ inbox and calls routes remain registered")

  const adapted = adaptNativeDialerQueueItem(sampleDialerQueueItem())
  assert.equal(adapted.kind, "callback_requested")
  assert.match(adapted.ctaHref, /^\/growth\/calls\/workspace/)
  const voicemailItem = adaptNativeDialerQueueItem({
    ...sampleDialerQueueItem(),
    id: "queue-2",
    queueMode: "priority",
    reason: "Review voicemail follow-up",
  })
  assert.equal(voicemailItem.kind, "voicemail")
  const filtered = filterCallCommunicationsByQueueView([adapted, voicemailItem], "callback_requested")
  assert.equal(filtered.length, 1)
  console.log("  ✓ call communication read model adapters derive kinds without persistence")

  const href = growthWorkspaceCallWorkspaceHref({ leadId: "lead-1", dialMode: "callback" })
  assert.match(href, /^\/growth\/calls\/workspace\?/)
  assert.doesNotMatch(href, /\/growth\/replies/)
  console.log("  ✓ workspace call CTAs resolve to /growth/calls/workspace")

  const queueFilters = readSource("lib/growth/inbox/inbox-thread-queue-filters.ts")
  assert.doesNotMatch(queueFilters, /\.from\(/)
  assert.doesNotMatch(queueFilters, /insert\(/)
  console.log("  ✓ queue filters contain no persistence writes")

  const hookSource = readSource("components/growth/inbox/use-growth-inbox-call-communications.ts")
  assert.match(hookSource, /\/api\/platform\/growth\/calls\/queue/)
  assert.match(hookSource, /\/api\/platform\/growth\/calls\/dashboard/)
  assert.doesNotMatch(hookSource, /\/api\/platform\/growth\/calls\/execute/)
  console.log("  ✓ call communications hook uses existing read APIs only")

  const actionCenter = readSource("components/growth/inbox/growth-inbox-action-center-column.tsx")
  assert.match(actionCenter, /GrowthInboxCallActionLinks/)
  const threadQueue = readSource("components/growth/inbox/growth-inbox-thread-queue-column.tsx")
  assert.match(threadQueue, /visibleCallItems/)
  assert.match(threadQueue, /isGrowthInboxCallQueueView/)
  console.log("  ✓ inbox surfaces wire call queue views and action links")

  assert.ok(GROWTH_INBOX_CALLS_CONVERGENCE_MATRIX.some((row) => row.status === "available"))
  assert.ok(GROWTH_INBOX_CALLS_CONVERGENCE_MATRIX.some((row) => row.status === "deferred"))
  console.log("  ✓ convergence matrix documents available and deferred surfaces")

  const forbiddenOrphan = `${GROWTH_WORKSPACE_BASE_PATH}/replies`
  assert.doesNotMatch(queueFilters, new RegExp(forbiddenOrphan.replace(/\//g, "\\/")))
  console.log("  ✓ no /growth/replies introduced")

  console.log("\n=== Growth inbox calls convergence audit passed ===\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        inventory_qa_marker: GROWTH_INBOX_CALL_COMMUNICATION_INVENTORY_QA_MARKER,
        convergence_qa_marker: GROWTH_INBOX_CALLS_CONVERGENCE_QA_MARKER,
        call_queue_views: GROWTH_INBOX_CALL_QUEUE_VIEWS.length,
        total_queue_views: GROWTH_INBOX_QUEUE_VIEWS.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
