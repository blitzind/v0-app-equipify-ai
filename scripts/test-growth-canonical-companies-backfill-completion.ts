/**
 * Phase 7.2A — Backfill completion logic tests.
 * Run: pnpm test:growth-canonical-companies-backfill-completion
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildResumeCursor,
  firstSourceTableWithPending,
  resolveBackfillDoneState,
  sumPendingTotal,
} from "../lib/growth/canonical-companies/canonical-company-backfill-completion"
import { GROWTH_CANONICAL_COMPANY_SOURCE_TABLES } from "../lib/growth/canonical-companies/canonical-company-types"

const emptyPending = {
  external_company_candidates: 0,
  real_world_company_candidates: 0,
  discovery_candidates: 0,
}

const pendingRw = {
  external_company_candidates: 0,
  real_world_company_candidates: 100,
  discovery_candidates: 0,
}

assert.equal(sumPendingTotal(emptyPending), 0)
assert.equal(sumPendingTotal(pendingRw), 100)
assert.equal(firstSourceTableWithPending(pendingRw, [...GROWTH_CANONICAL_COMPANY_SOURCE_TABLES]), "real_world_company_candidates")

const resume = buildResumeCursor(pendingRw, [...GROWTH_CANONICAL_COMPANY_SOURCE_TABLES], { "acme.com": 2 })
assert.ok(resume)
assert.equal(resume?.source_table, "real_world_company_candidates")
assert.equal(resume?.after_id, null)

const passState = resolveBackfillDoneState({
  sources: [...GROWTH_CANONICAL_COMPANY_SOURCE_TABLES],
  domain_counts: {},
  error_count: 0,
  verification: { passed: true, pending_by_source: emptyPending, pending_total: 0 },
})
assert.equal(passState.done, true)
assert.equal(passState.certification, "pass")
assert.equal(passState.cursor, null)

const failPending = resolveBackfillDoneState({
  sources: [...GROWTH_CANONICAL_COMPANY_SOURCE_TABLES],
  domain_counts: {},
  error_count: 0,
  verification: { passed: false, pending_by_source: pendingRw, pending_total: 100 },
})
assert.equal(failPending.done, false)
assert.equal(failPending.certification, "fail")
assert.ok(failPending.cursor)

const conditional = resolveBackfillDoneState({
  sources: [...GROWTH_CANONICAL_COMPANY_SOURCE_TABLES],
  domain_counts: {},
  error_count: 3,
  verification: { passed: true, pending_by_source: emptyPending, pending_total: 0 },
})
assert.equal(conditional.done, true)
assert.equal(conditional.certification, "conditional_pass")

const backfillSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/canonical-companies/canonical-company-backfill.ts"),
  "utf8",
)
assert.match(backfillSource, /verifyCanonicalCompanyBackfillComplete/)
assert.match(backfillSource, /chunkStoppedOnError/)
assert.doesNotMatch(backfillSource, /catch \{\s*stats\.errors\+\+\s*\}/)
assert.match(backfillSource, /if \(!outcome\.ok\)/)
assert.match(backfillSource, /afterId = rowId/)

const panelSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-canonical-company-backfill-panel.tsx"),
  "utf8",
)
assert.match(panelSource, /isCertifiedDone/)
assert.match(panelSource, /error_rows/)
assert.match(panelSource, /pending_total/)

console.log("growth-canonical-companies-backfill-completion: ok")
