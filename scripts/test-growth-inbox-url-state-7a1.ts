/**
 * GS-GROWTH-OPS-7A.1 — Inbox URL state persistence certification.
 * Run: pnpm test:growth-inbox-url-state-7a1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthInboxThreadHref,
  GROWTH_INBOX_THREAD_URL_PARAM,
  GROWTH_OPS_URL_STATE_7A1_QA_MARKER,
} from "../lib/growth/navigation/growth-workspace-url-state-7a1"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-7A.1 Inbox URL State Certification ===\n")
  assert.ok(GROWTH_OPS_URL_STATE_7A1_QA_MARKER)

  const threadSync = readSource("components/growth/inbox/growth-inbox-thread-url-sync.tsx")
  assert.match(threadSync, /resolveGrowthInboxThreadIdFromSearchParams/)
  assert.match(threadSync, /buildGrowthInboxThreadHref/)
  assert.match(threadSync, /router\.replace/)
  assert.match(threadSync, /loadThreadDetail/)
  console.log("  ✓ inbox thread URL sync hydrates and pushes thread selection")

  const workspacePanel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
  assert.match(workspacePanel, /GrowthInboxThreadUrlSync/)
  console.log("  ✓ inbox workspace mounts thread URL sync")

  const href = buildGrowthInboxThreadHref({ threadId: "thread-1", leadId: "lead-1" })
  assert.match(href, /\/growth\/inbox\?/)
  assert.match(href, new RegExp(`${GROWTH_INBOX_THREAD_URL_PARAM}=thread-1`))
  assert.match(href, /leadId=lead-1/)
  console.log("  ✓ inbox thread href builder uses /growth/inbox?threadId=")

  console.log("\nGS-GROWTH-OPS-7A.1 inbox URL state certification passed.\n")
}

main()
