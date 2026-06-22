/**
 * GS-GROWTH-OPS-7A.2 — Personalization send handoff certification.
 * Run: pnpm test:growth-send-handoff-7a2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER,
  GROWTH_SEQUENCE_SEND_REVIEW_CONTROL_PLANE_LABELS,
  GROWTH_SEQUENCE_SEND_REVIEW_HREF,
  GROWTH_SEQUENCE_SEND_REVIEW_LABEL,
} from "../lib/growth/operator-ux/growth-operator-primary-actions-7a2"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-7A.2 Personalization Send Handoff Certification ===\n")
  assert.ok(GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER)

  const editor = readSource("components/growth/personalization/growth-personalization-draft-editor.tsx")
  assert.match(editor, /GROWTH_SEQUENCE_SEND_REVIEW_LABEL/)
  assert.match(editor, /GROWTH_SEQUENCE_SEND_REVIEW_HREF/)
  assert.match(editor, /GROWTH_SEQUENCE_SEND_REVIEW_CONTROL_PLANE_LABELS/)
  assert.match(editor, /never auto-sent/)
  assert.doesNotMatch(editor, /auto-send|autonomous send/i)
  console.log("  ✓ approved personalization shows Queue for Send Review control-plane handoff")

  assert.equal(GROWTH_SEQUENCE_SEND_REVIEW_LABEL, "Queue for Send Review")
  assert.equal(GROWTH_SEQUENCE_SEND_REVIEW_HREF, "/admin/growth/sequences/execution")
  assert.ok(GROWTH_SEQUENCE_SEND_REVIEW_CONTROL_PLANE_LABELS.includes("Admin approval queue"))
  console.log("  ✓ send review constants route to admin sequence execution queue")

  console.log("\nGS-GROWTH-OPS-7A.2 personalization send handoff certification passed.\n")
}

main()
