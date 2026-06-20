/**
 * GS-SENDR-2D — Sequence bridge certification.
 * Run: pnpm test:growth-sendr-sequence-bridge
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SENDR_PAGE_URL_MERGE_TOKEN,
  GROWTH_SENDR_SEQUENCE_BRIDGE_QA_MARKER,
  GROWTH_SENDR_LIMITS,
} from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2D Sequence Bridge Certification ===\n")

  assert.equal(GROWTH_SENDR_SEQUENCE_BRIDGE_QA_MARKER, "growth-sendr-sequence-bridge-gs-sendr-2d-v1")
  assert.equal(GROWTH_SENDR_PAGE_URL_MERGE_TOKEN, "{{sendr_page_url}}")
  assert.ok(GROWTH_SENDR_LIMITS.MAX_SENDR_PAGE_ATTACHMENTS_PER_SEQUENCE > 0)

  const migration = readSource(
    "supabase/migrations/20270901190000_growth_sendr_sequence_bridge_gs_sendr_2d.sql",
  )
  assert.match(migration, /growth_sendr_sequence_page_links/)
  assert.match(migration, /sendr_sequence_bridge_enabled/)

  assert.ok(fs.existsSync("app/api/platform/growth/sendr/sequence-links/route.ts"))

  const bridge = readSource("lib/growth/sendr/growth-sendr-sequence-bridge-service.ts")
  assert.match(bridge, /attachSendrPageToSequence/)
  assert.match(bridge, /applySendrPageUrlMergeFields/)

  const sendBuilder = readSource("lib/growth/sequences/execution/sequence-send-builder.ts")
  assert.match(sendBuilder, /resolveSendrPageUrlForSequenceStep/)
  assert.match(sendBuilder, /leadId: input\.leadId/)

  const builder = readSource("components/growth/growth-sequence-pattern-builder.tsx")
  assert.match(builder, /sendr_page_url/)

  console.log("  ✓ Sequence bridge link registry + merge token wiring")
  console.log("\nGS-SENDR-2D sequence bridge certification passed.\n")
}

main()
