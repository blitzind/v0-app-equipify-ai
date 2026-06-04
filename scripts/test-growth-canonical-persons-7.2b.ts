/**
 * Phase 7.2B — Canonical person layer regression tests.
 * Run: pnpm test:growth-canonical-persons-7.2b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  canonicalNameCompanyKey,
  canonicalNormalizedPersonEmail,
  canonicalNormalizedPersonLinkedIn,
  canonicalNormalizedPersonName,
  canonicalNormalizedPersonPhone,
} from "../lib/growth/canonical-persons/canonical-person-normalize"
import {
  createEmptyCanonicalPersonResolverIndexes,
  registerNewCanonicalPersonFromCandidate,
  resolveCanonicalPerson,
} from "../lib/growth/canonical-persons/canonical-person-resolver"
import { simulateCanonicalPersonBackfill } from "../lib/growth/canonical-persons/canonical-person-simulate"
import {
  buildCanonicalPersonBackfillApiResponse,
  buildCanonicalPersonBackfillWarnings,
  canonicalPersonBackfillResponseExcludesSecrets,
  GROWTH_CANONICAL_PERSON_APPLY_CONFIRM,
  GROWTH_CANONICAL_PERSON_BACKFILL_API_QA_MARKER,
  mergeCanonicalPersonBackfillStats,
  parseCanonicalPersonBackfillRequest,
  resolveCanonicalPersonRuntimeContext,
} from "../lib/growth/canonical-persons/canonical-person-backfill-api"
import {
  buildResumeCursor,
  resolveBackfillDoneState,
  sumPendingTotal,
} from "../lib/growth/canonical-persons/canonical-person-backfill-completion"
import {
  GROWTH_CANONICAL_PERSON_BACKFILL_DEFAULT_BATCH_SIZE,
  GROWTH_CANONICAL_PERSON_MIGRATION,
  GROWTH_CANONICAL_PERSON_QA_MARKER,
  GROWTH_CANONICAL_PERSON_SOURCE_TABLES,
  type GrowthCanonicalPersonBackfillStats,
  type GrowthCanonicalPersonCandidateInput,
} from "../lib/growth/canonical-persons/canonical-person-types"

function candidate(
  partial: Partial<GrowthCanonicalPersonCandidateInput> &
    Pick<GrowthCanonicalPersonCandidateInput, "source_id" | "full_name">,
): GrowthCanonicalPersonCandidateInput {
  return {
    source_table: "contact_candidates",
    run_id: "run-1",
    provider_name: "internal_growth",
    provider_type: "internal_growth",
    discovery_source: "contact_discovery",
    ...partial,
  }
}

async function main(): Promise<void> {
  assert.equal(GROWTH_CANONICAL_PERSON_QA_MARKER, "growth-canonical-person-7.2b-v1")

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_CANONICAL_PERSON_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.persons/)
  assert.match(migration, /growth\.person_emails/)
  assert.match(migration, /growth\.person_phones/)
  assert.match(migration, /growth\.person_profiles/)
  assert.match(migration, /growth\.person_company_roles/)
  assert.match(migration, /growth\.person_source_lineage/)
  assert.match(migration, /canonical_person_id/)
  assert.doesNotMatch(migration, /blitzpay|stripe|organization_subscriptions/i)

  const resolverSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/canonical-persons/canonical-person-resolver.ts"),
    "utf8",
  )
  assert.doesNotMatch(resolverSource, /\bopenai\b|\banthropic\b|\blevenshtein\b|\bembeddings?\b/i)

  assert.equal(canonicalNormalizedPersonEmail("  Jane@ACME.com "), "jane@acme.com")
  assert.equal(canonicalNormalizedPersonPhone("+1 (555) 123-4567"), "5551234567")
  assert.equal(canonicalNormalizedPersonLinkedIn("https://www.linkedin.com/in/jane-doe/"), "linkedin:in:jane-doe")
  assert.equal(canonicalNormalizedPersonName("Jane  Doe"), "jane doe")
  assert.equal(canonicalNameCompanyKey("company-1", "Jane Doe"), "company-1|jane doe")

  const indexes = createEmptyCanonicalPersonResolverIndexes()
  const emailResolution = resolveCanonicalPerson(
    candidate({ source_id: "e1", full_name: "Jane Doe", email: "jane@acme.com" }),
    indexes,
  )
  assert.equal(emailResolution.resolution_method, "new")
  registerNewCanonicalPersonFromCandidate(
    indexes,
    "person-1",
    candidate({ source_id: "e1", full_name: "Jane Doe", email: "jane@acme.com" }),
    emailResolution,
  )

  const byEmail = resolveCanonicalPerson(
    candidate({ source_id: "e2", full_name: "J. Doe", email: "jane@acme.com" }),
    indexes,
  )
  assert.equal(byEmail.resolution_method, "normalized_email")
  assert.equal(byEmail.person_id, "person-1")
  assert.equal(byEmail.would_create_new, false)

  const indexesLinkedIn = createEmptyCanonicalPersonResolverIndexes()
  const liRes = resolveCanonicalPerson(
    candidate({
      source_id: "l1",
      full_name: "Bob Smith",
      linkedin_url: "https://linkedin.com/in/bobsmith",
    }),
    indexesLinkedIn,
  )
  registerNewCanonicalPersonFromCandidate(
    indexesLinkedIn,
    "person-li",
    candidate({
      source_id: "l1",
      full_name: "Bob Smith",
      linkedin_url: "https://linkedin.com/in/bobsmith",
    }),
    liRes,
  )
  const byLinkedIn = resolveCanonicalPerson(
    candidate({
      source_id: "l2",
      full_name: "Robert Smith",
      linkedin_url: "https://www.linkedin.com/in/bobsmith/",
    }),
    indexesLinkedIn,
  )
  assert.equal(byLinkedIn.resolution_method, "normalized_linkedin")
  assert.equal(byLinkedIn.person_id, "person-li")

  const indexesPhone = createEmptyCanonicalPersonResolverIndexes()
  const phRes = resolveCanonicalPerson(
    candidate({ source_id: "p1", full_name: "Pat Lee", phone: "555-987-6543" }),
    indexesPhone,
  )
  registerNewCanonicalPersonFromCandidate(
    indexesPhone,
    "person-ph",
    candidate({ source_id: "p1", full_name: "Pat Lee", phone: "555-987-6543" }),
    phRes,
  )
  const byPhone = resolveCanonicalPerson(
    candidate({ source_id: "p2", full_name: "P. Lee", phone: "(555) 987-6543" }),
    indexesPhone,
  )
  assert.equal(byPhone.resolution_method, "normalized_phone")

  const indexesNc = createEmptyCanonicalPersonResolverIndexes()
  registerNewCanonicalPersonFromCandidate(
    indexesNc,
    "person-nc",
    candidate({
      source_id: "nc1",
      full_name: "Alex Morgan",
      canonical_company_id: "company-a",
    }),
    resolveCanonicalPerson(
      candidate({
        source_id: "nc1",
        full_name: "Alex Morgan",
        canonical_company_id: "company-a",
      }),
      indexesNc,
    ),
  )
  const byNameCompany = resolveCanonicalPerson(
    candidate({
      source_id: "nc2",
      full_name: "Alex Morgan",
      canonical_company_id: "company-a",
    }),
    indexesNc,
  )
  assert.equal(byNameCompany.resolution_method, "name_company")
  assert.equal(byNameCompany.person_id, "person-nc")

  const noNameOnlyMerge = resolveCanonicalPerson(
    candidate({ source_id: "n1", full_name: "Alex Morgan", canonical_company_id: "company-b" }),
    indexesNc,
  )
  assert.equal(noNameOnlyMerge.resolution_method, "new")
  assert.equal(noNameOnlyMerge.person_id, null)

  const noCrossCompany = resolveCanonicalPerson(
    candidate({
      source_id: "n2",
      full_name: "Alex Morgan",
      canonical_company_id: "company-b",
      email: null,
      phone: null,
      linkedin_url: null,
    }),
    indexesNc,
  )
  assert.equal(noCrossCompany.resolution_method, "new")
  assert.notEqual(noCrossCompany.person_id, "person-nc")

  const { person_ids_by_source } = simulateCanonicalPersonBackfill([
    candidate({ source_id: "s1", full_name: "Sam", email: "sam@gamma.com" }),
    candidate({ source_id: "s2", full_name: "Samuel", email: "sam@gamma.com" }),
    candidate({ source_id: "s3", full_name: "Sam", email: "sam@delta.com" }),
  ])
  assert.equal(
    person_ids_by_source.get("contact_candidates:s1"),
    person_ids_by_source.get("contact_candidates:s2"),
  )
  assert.notEqual(
    person_ids_by_source.get("contact_candidates:s1"),
    person_ids_by_source.get("contact_candidates:s3"),
  )

  const emptyPending = {
    contact_candidates: 0,
    company_contacts: 0,
    lead_decision_makers: 0,
  }
  const pendingCandidates = {
    contact_candidates: 50,
    company_contacts: 0,
    lead_decision_makers: 0,
  }
  assert.equal(sumPendingTotal(emptyPending), 0)
  assert.equal(sumPendingTotal(pendingCandidates), 50)
  const resume = buildResumeCursor(pendingCandidates, [...GROWTH_CANONICAL_PERSON_SOURCE_TABLES], {})
  assert.ok(resume)
  assert.equal(resume?.source_table, "contact_candidates")

  const passState = resolveBackfillDoneState({
    sources: [...GROWTH_CANONICAL_PERSON_SOURCE_TABLES],
    identity_counts: {},
    error_count: 0,
    verification: { passed: true, pending_by_source: emptyPending, pending_total: 0 },
  })
  assert.equal(passState.done, true)
  assert.equal(passState.certification, "pass")

  const failPending = resolveBackfillDoneState({
    sources: [...GROWTH_CANONICAL_PERSON_SOURCE_TABLES],
    identity_counts: {},
    error_count: 0,
    verification: { passed: false, pending_by_source: pendingCandidates, pending_total: 50 },
  })
  assert.equal(failPending.done, false)
  assert.equal(failPending.certification, "fail")

  const backfillSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/canonical-persons/canonical-person-backfill.ts"),
    "utf8",
  )
  assert.match(backfillSource, /verifyCanonicalPersonBackfillComplete/)
  assert.match(backfillSource, /chunkStoppedOnError/)
  assert.match(backfillSource, /if \(!outcome\.ok\)/)
  assert.match(backfillSource, /afterId = rowId/)
  assert.doesNotMatch(backfillSource, /server-only/)

  const repoServer = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/canonical-persons/canonical-person-repository.ts"),
    "utf8",
  )
  assert.match(repoServer, /server-only/)
  assert.match(repoServer, /canonical-person-repository-core/)

  assert.equal(GROWTH_CANONICAL_PERSON_APPLY_CONFIRM, "APPLY_GROWTH_CANONICAL_PERSONS_7_2B")

  const routeSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/canonical-persons/backfill/route.ts"),
    "utf8",
  )
  assert.match(routeSource, /requireGrowthEnginePlatformAccess/)
  assert.match(routeSource, /runCanonicalPersonBackfill/)

  const panelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-canonical-person-backfill-panel.tsx"),
    "utf8",
  )
  assert.match(panelSource, /canonical-persons\/backfill/)
  assert.match(panelSource, /isCertifiedDone/)

  const infraPage = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/infrastructure/page.tsx"),
    "utf8",
  )
  assert.match(infraPage, /GrowthCanonicalPersonBackfillPanel/)

  const mockStats: GrowthCanonicalPersonBackfillStats = {
    qa_marker: GROWTH_CANONICAL_PERSON_QA_MARKER,
    mode: "dry_run",
    sources: {
      contact_candidates: {
        rows_processed: 2,
        already_linked: 0,
        resolved_normalized_email: 2,
        resolved_normalized_linkedin: 0,
        resolved_normalized_phone: 0,
        resolved_name_company: 0,
        would_create_new: 0,
        errors: 0,
      },
      company_contacts: {
        rows_processed: 0,
        already_linked: 0,
        resolved_normalized_email: 0,
        resolved_normalized_linkedin: 0,
        resolved_normalized_phone: 0,
        resolved_name_company: 0,
        would_create_new: 0,
        errors: 0,
      },
      lead_decision_makers: {
        rows_processed: 0,
        already_linked: 0,
        resolved_normalized_email: 0,
        resolved_normalized_linkedin: 0,
        resolved_normalized_phone: 0,
        resolved_name_company: 0,
        would_create_new: 0,
        errors: 0,
      },
    },
    canonical_persons_existing: 0,
    canonical_persons_after: 1,
    unique_normalized_emails: 1,
    merge_groups_by_email: 1,
  }
  const warnings = buildCanonicalPersonBackfillWarnings(mockStats)
  assert.ok(warnings.some((w) => w.includes("email group")))

  const apiPayload = buildCanonicalPersonBackfillApiResponse({
    mode: "dry_run",
    result: {
      stats: mockStats,
      done: true,
      cursor: null,
      progress: { batch_size: 40, processed_in_chunk: 2, current_source_table: "contact_candidates" },
      pending_by_source: emptyPending,
      pending_total: 0,
      error_rows: [],
      verification: { passed: true, pending_by_source: emptyPending, pending_total: 0 },
      certification: "pass",
    },
    duration_ms: 12,
  })
  assert.equal(apiPayload.certification, "pass")
  assert.equal(apiPayload.api_qa_marker, GROWTH_CANONICAL_PERSON_BACKFILL_API_QA_MARKER)
  assert.ok(canonicalPersonBackfillResponseExcludesSecrets(apiPayload))

  const dryParsed = parseCanonicalPersonBackfillRequest({ mode: "dry_run" })
  assert.equal(dryParsed.ok, true)
  if (dryParsed.ok) {
    assert.equal(dryParsed.batchSize, GROWTH_CANONICAL_PERSON_BACKFILL_DEFAULT_BATCH_SIZE)
  }

  const ctx = resolveCanonicalPersonRuntimeContext()
  assert.equal(ctx.target_schema, "growth")

  console.log("growth-canonical-persons-7.2b: ok")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
