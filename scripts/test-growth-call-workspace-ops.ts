/**
 * CALLS-OPS-1 — Calls operator workflow orchestration regression audit.
 *
 * Usage: pnpm test:growth-call-workspace-ops
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  DEFAULT_CALL_WORKSPACE_POWER_DIAL_SETTINGS,
  GROWTH_CALL_WORKSPACE_OPS_QA_MARKER,
  type QueuePreviewState,
} from "../lib/growth/native-dialer/call-workspace-operator-types"
import { queueItemToPreviewState } from "../lib/growth/native-dialer/call-workspace-queue-preview-utils"
import type { NativeDialerQueueItemPublicView } from "../lib/growth/native-dialer/native-dialer-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function sampleQueueItem(): NativeDialerQueueItemPublicView {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    leadId: "00000000-0000-4000-8000-000000000002",
    phoneNumber: "+14155550199",
    contactName: "Alex Operator",
    companyName: "Acme Rentals",
    queueMode: "power",
    status: "pending",
    priorityScore: 80,
    reason: "priority_call_ready",
    callbackDueAt: null,
    ownerUserId: null,
    createdAt: "2026-06-18T12:00:00.000Z",
    updatedAt: "2026-06-18T12:00:00.000Z",
  }
}

function runAudit(): void {
  console.log(`\n=== Growth call workspace ops audit (${GROWTH_CALL_WORKSPACE_OPS_QA_MARKER}) ===\n`)

  assert.equal(DEFAULT_CALL_WORKSPACE_POWER_DIAL_SETTINGS.powerDialAutoAdvance, true)
  assert.equal(DEFAULT_CALL_WORKSPACE_POWER_DIAL_SETTINGS.powerDialAutoDialDelayMs, 3000)
  console.log("  ✓ power dial settings defaults")

  const preview = queueItemToPreviewState(sampleQueueItem())
  const expected: QueuePreviewState = {
    queueItemId: sampleQueueItem().id,
    leadId: sampleQueueItem().leadId,
    company: "Acme Rentals",
    contact: "Alex Operator",
    phone: "+14155550199",
    queueMode: "power",
    reason: "priority_call_ready",
  }
  assert.deepEqual(preview, expected)
  console.log("  ✓ queue preview mapper")

  const workspace = readSource("components/growth/growth-call-workspace.tsx")
  assert.match(workspace, /data-growth-call-workspace-ops-marker=\{GROWTH_CALL_WORKSPACE_OPS_QA_MARKER\}/)
  assert.match(workspace, /onPreviewItem=\{\(item\) => void applyQueuePreview\(item\)\}/)
  assert.match(workspace, /onFollowUpComplete=\{\(\) => void handleFollowUpComplete\(\)\}/)
  assert.match(workspace, /useCallWorkspaceNotesAutosave/)
  assert.doesNotMatch(workspace, /runQueueAction\(item, "preview"\)/)
  console.log("  ✓ workspace wiring + preview recursion guard")

  const queueCard = readSource("components/growth/growth-call-workspace-queue-card.tsx")
  assert.match(queueCard, /onPreviewItem/)
  assert.match(queueCard, /onSkipItem/)
  assert.match(queueCard, /onSnoozeItem/)
  assert.match(queueCard, /call-workspace-power-dial-settings/)
  assert.match(queueCard, /onPowerDialSettingsChange/)
  assert.match(queueCard, /data-growth-call-workspace-ops-marker/)
  console.log("  ✓ queue inspect row actions + power dial settings")

  const followUpPanel = readSource("components/growth/growth-call-workspace-follow-up-panel.tsx")
  assert.match(followUpPanel, /call-workspace-skip-follow-up/)
  console.log("  ✓ skip follow-up control")

  const centerPanel = readSource("components/growth/growth-call-workspace-center-panel.tsx")
  assert.match(centerPanel, /GrowthCallWorkspaceQueuePreviewPanel/)
  assert.match(centerPanel, /GrowthCallWorkspaceFollowUpPanel/)
  assert.match(centerPanel, /onToggleKeypadDrawer/)
  assert.match(centerPanel, /onToggleNotesPanel/)
  console.log("  ✓ center panel preview, follow-up, keypad, notes")

  const intelligenceRail = readSource("components/growth/growth-call-workspace-intelligence-rail.tsx")
  assert.match(intelligenceRail, /GrowthCallWorkspaceSequencePanel/)
  console.log("  ✓ sequence intelligence rail")

  for (const route of [
    "app/api/platform/growth/calls/sessions/[sessionId]/notes/route.ts",
    "app/api/platform/growth/calls/queue/[queueItemId]/route.ts",
    "app/api/platform/growth/calls/queue/next/route.ts",
    "app/api/platform/growth/calls/workspace/follow-up/route.ts",
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), route)), `missing route: ${route}`)
  }
  console.log("  ✓ operator API routes present")

  const notesHook = readSource("hooks/growth/use-call-workspace-notes-autosave.ts")
  assert.match(notesHook, /1000/)
  assert.match(notesHook, /\/api\/platform\/growth\/calls\/sessions\//)
  console.log("  ✓ notes autosave debounce + PATCH path")

  console.log("\nGrowth call workspace ops audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_CALL_WORKSPACE_OPS_QA_MARKER,
        defaults: DEFAULT_CALL_WORKSPACE_POWER_DIAL_SETTINGS,
      },
      null,
      2,
    ),
  )
}

runAudit()
