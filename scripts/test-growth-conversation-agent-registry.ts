/**
 * GS-SENDR-2A — Conversation agent registry certification.
 * Run: pnpm test:growth-conversation-agent-registry
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_SENDR_SCHEMA_MIGRATION } from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2A Conversation Agent Registry Certification ===\n")
  const migration = readSource(`supabase/migrations/${GROWTH_SENDR_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth_conversation_agents/)
  assert.match(migration, /growth_conversation_agent_versions/)
  assert.match(migration, /agent_tracking_enabled/)

  const repo = readSource("lib/growth/sendr/growth-sendr-conversation-agent-repository.ts")
  assert.match(repo, /registerGrowthSendrConversationAgent/)
  assert.match(repo, /Registry metadata only/)
  assert.doesNotMatch(repo, /retell\.ai/)
  assert.doesNotMatch(repo, /fetch\(/)

  console.log("  ✓ Conversation agent registry — no live agents")
  console.log("\nGS-SENDR-2A conversation agent registry certification passed.\n")
}

main()
