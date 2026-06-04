/**
 * Phase 7.2B — Backfill completion logic tests.
 * Run: pnpm test:growth-canonical-persons-backfill-completion
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildResumeCursor,
  resolveBackfillDoneState,
  sumPendingTotal,
} from "../lib/growth/canonical-persons/canonical-person-backfill-completion"
import { GROWTH_CANONICAL_PERSON_SOURCE_TABLES } from "../lib/growth/canonical-persons/canonical-person-types"

const emptyPending = {
  contact_candidates: 0,
  company_contacts: 0,
  lead_decision_makers: 0,
}

const pendingCandidates = {
  contact_candidates: 26,
  company_contacts: 0,
  lead_decision_makers: 0,
}

assert.equal(sumPendingTotal(emptyPending), 0)
assert.equal(sumPendingTotal(pendingCandidates), 26)

const resume = buildResumeCursor(pendingCandidates, [...GROWTH_CANONICAL_PERSON_SOURCE_TABLES], {
  "jane@acme.com": 2,
})
assert.ok(resume)
assert.equal(resume?.source_table, "contact_candidates")
assert.equal(resume?.after_id, null)

const passState = resolveBackfillDoneState({
  sources: [...GROWTH_CANONICAL_PERSON_SOURCE_TABLES],
  identity_counts: {},
  error_count: 0,
  verification: { passed: true, pending_by_source: emptyPending, pending_total: 0 },
})
assert.equal(passState.done, true)
assert.equal(passState.certification, "pass")
assert.equal(passState.cursor, null)

const failPending = resolveBackfillDoneState({
  sources: [...GROWTH_CANONICAL_PERSON_SOURCE_TABLES],
  identity_counts: {},
  error_count: 0,
  verification: { passed: false, pending_by_source: pendingCandidates, pending_total: 26 },
})
assert.equal(failPending.done, false)
assert.equal(failPending.certification, "fail")
assert.ok(failPending.cursor)

const backfillSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/canonical-persons/canonical-person-backfill.ts"),
  "utf8",
)
assert.match(backfillSource, /verifyCanonicalPersonBackfillComplete/)
assert.match(backfillSource, /chunkStoppedOnError/)
assert.match(backfillSource, /if \(!outcome\.ok\)/)
assert.match(backfillSource, /afterId = rowId/)

const panelSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-canonical-person-backfill-panel.tsx"),
  "utf8",
)
assert.match(panelSource, /formatCanonicalPersonBackfillRequestError/)
assert.doesNotMatch(panelSource, /data\.message \?\? data\.reason \?\? data\.error/)
assert.match(panelSource, /isCertifiedDone/)
assert.match(panelSource, /error_rows/)

console.log("growth-canonical-persons-backfill-completion: ok")
