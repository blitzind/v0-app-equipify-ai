/**
 * GS-GROWTH-OPS-6C — Inbox operator handoff certification.
 * Run: pnpm test:growth-inbox-handoff-6c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_OPS_HANDOFF_6C_QA_MARKER } from "../lib/growth/navigation/growth-workspace-operator-links"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-6C Inbox Handoff Certification ===\n")
  assert.ok(GROWTH_OPS_HANDOFF_6C_QA_MARKER)

  const conversationColumn = readSource("components/growth/inbox/growth-inbox-conversation-column.tsx")
  assert.match(conversationColumn, /GrowthInboxConversationIntelligenceContextStrip/)
  console.log("  ✓ context strip mounted in conversation column")

  const contextStrip = readSource("components/growth/inbox/growth-inbox-conversation-intelligence-context-strip.tsx")
  assert.match(contextStrip, /buildGrowthLeadHref/)
  assert.match(contextStrip, /buildGrowthCallWorkspaceHref/)
  assert.match(contextStrip, /buildGrowthPersonalizationHref/)
  assert.match(contextStrip, /buildGrowthActivityHref/)
  assert.match(contextStrip, /GROWTH_OPS_HANDOFF_6C_QA_MARKER/)
  console.log("  ✓ context strip exposes canonical handoff links")

  const sidebar = readSource("components/growth/inbox/growth-inbox-intelligence-sidebar.tsx")
  assert.doesNotMatch(sidebar, /GrowthInboxNextBestActionLinks/)
  assert.match(sidebar, /Primary handoff actions live in the conversation header/)
  console.log("  ✓ sidebar deduped duplicate Reply/Call/Open Lead grid")

  const header = readSource("components/growth/inbox/growth-inbox-conversation-header.tsx")
  assert.match(header, /Reply/)
  assert.match(header, /buildGrowthCallWorkspaceHref/)
  console.log("  ✓ header retains primary reply workflow")

  console.log("\nGS-GROWTH-OPS-6C inbox handoff certification passed.\n")
}

main()
