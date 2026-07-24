/**
 * AVA-PERSISTED-OPERATOR-VALIDATION-1A — Focused certification (no GPT).
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const AVA_PERSISTED_OPERATOR_VALIDATION_1A_QA_MARKER =
  "ava-persisted-operator-validation-1a-v1" as const

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${AVA_PERSISTED_OPERATOR_VALIDATION_1A_QA_MARKER}] focused certification`)

  const cutover = readSource("lib/growth/ava-reasoning/equipify-supervised-cutover-service.ts")
  assert.match(cutover, /persistSendableAvaSupervisedDraft/)
  assert.match(cutover, /persistSupervisedDraftIfSendable/)
  assert.doesNotMatch(cutover, /Ava decision:/)

  const persistence = readSource("lib/growth/ava-reasoning/equipify-supervised-draft-persistence.ts")
  assert.match(persistence, /isSendableAvaSupervisedDraft/)
  assert.match(persistence, /findExistingAvaSupervisedSendableDraft/)
  assert.match(persistence, /duplicate_reused/)

  console.log(`[${AVA_PERSISTED_OPERATOR_VALIDATION_1A_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
