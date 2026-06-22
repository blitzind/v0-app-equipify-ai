/**
 * GS-GROWTH-OPS-7A.2 — Inbox action cleanup certification.
 * Run: pnpm test:growth-inbox-action-cleanup-7a2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER } from "../lib/growth/operator-ux/growth-operator-primary-actions-7a2"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-7A.2 Inbox Action Cleanup Certification ===\n")
  assert.ok(GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER)

  const header = readSource("components/growth/inbox/growth-inbox-conversation-header.tsx")
  assert.match(header, /Reply/)
  assert.doesNotMatch(header, /Book Meeting/)
  assert.doesNotMatch(header, /Open Lead/)
  assert.doesNotMatch(header, /buildGrowthCallWorkspaceHref/)
  console.log("  ✓ inbox header keeps Reply as sole primary action")

  const contextStrip = readSource("components/growth/inbox/growth-inbox-conversation-intelligence-context-strip.tsx")
  const stripBody =
    contextStrip.match(/export function GrowthInboxConversationIntelligenceContextStrip\([\s\S]*?\n\}/)?.[0] ?? ""
  assert.ok(stripBody.length > 0, "GrowthInboxConversationIntelligenceContextStrip not found")
  assert.match(stripBody, /Open Lead/)
  assert.match(stripBody, /Call/)
  assert.match(stripBody, /Personalization/)
  assert.match(stripBody, /Activity/)
  assert.match(stripBody, /Book Meeting/)
  assert.doesNotMatch(stripBody, /View Conversation/)
  assert.doesNotMatch(stripBody, /View Timeline/)
  console.log("  ✓ context strip owns handoff actions without duplicate deep links")

  console.log("\nGS-GROWTH-OPS-7A.2 inbox action cleanup certification passed.\n")
}

main()
