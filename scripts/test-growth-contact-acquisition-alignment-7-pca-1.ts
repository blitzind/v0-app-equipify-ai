/**
 * Phase 7.PCA-1 — Contact acquisition layer alignment regression checks.
 * Run: pnpm test:growth-contact-acquisition-alignment-7-pca-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_CONTACT_ACQUISITION_PROVIDER_ADAPTER_QA_MARKER,
  buildContactAcquisitionProviderDiagnostics,
} from "../lib/growth/contact-discovery/contact-acquisition-provider-adapter-types"
import { CONTACT_DISCOVERY_PROVIDER_MUST_NOT_WRITE_COMPANY_CONTACTS } from "../lib/growth/contact-discovery/contact-discovery-provider-contract"
import {
  buildContactDedupeHash,
  dedupeNormalizedContacts,
  normalizeContactCandidate,
} from "../lib/growth/contact-discovery/contact-normalizer"
import { GROWTH_LEAD_ENGINE_CONTACT_DISCOVERY_BOUNDARY_DECISION } from "../lib/growth/contact-discovery/lead-engine-provider-boundary"
import { companyContactDedupeHash } from "../lib/growth/contact-discovery/website-contact-discovery"
import {
  classifyContactIdentity,
  shouldMaterializeCanonicalPerson,
} from "../lib/growth/human-identity-evidence/contact-identity-classification"
import { computeProspectSearchContactOutreachReadiness } from "../lib/growth/prospect-search/prospect-search-contact-readiness"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("Phase 7.PCA-1 contact acquisition alignment tests\n")

// --- Provider write contract ---
assert.equal(CONTACT_DISCOVERY_PROVIDER_MUST_NOT_WRITE_COMPANY_CONTACTS, true)
const pdlProviderSource = readSource("lib/growth/contact-discovery/providers/people-data-labs-provider.ts")
assert.ok(
  !pdlProviderSource.includes("upsertProviderCompanyContacts"),
  "PDL provider must not direct-write company_contacts",
)
assert.ok(
  !pdlProviderSource.includes("persistProviderContactsAndSync"),
  "PDL provider must not sync — orchestrator owns persistence",
)

// --- Identity classification at normalization ---
const named = normalizeContactCandidate(
  {
    full_name: "Jane Smith",
    job_title: "VP Operations",
    email: "jane@acme.com",
    pii_observed: true,
    evidence: [],
    source_attribution: [],
  },
  "people_data_labs",
  "future_people_data_labs",
  "candidate-uuid-1",
)
assert.ok(named)
assert.equal(named.identity_classification, "named_person")
assert.equal(named.eligible_for_canonical_person, true)
assert.equal(named.metadata.identity_classification, "named_person")

const generic = normalizeContactCandidate(
  {
    full_name: "Customer Service",
    email: "support@acme.com",
    pii_observed: true,
    evidence: [],
    source_attribution: [],
  },
  "website_public_extract",
  "website_public_extract",
  "candidate-uuid-1",
)
assert.ok(generic)
assert.equal(generic.identity_classification, "company_channel")
assert.equal(generic.eligible_for_canonical_person, false)

// --- Dedupe: contact_candidates (name+title) vs company_contacts (includes email) ---
const companyId = "canonical-co-1"
const candidateId = "staging-co-1"
const baseName = "John Doe"
const title = "Director"

const hashA = buildContactDedupeHash({
  company_candidate_id: candidateId,
  full_name: baseName,
  job_title: title,
})
const hashB = buildContactDedupeHash({
  company_candidate_id: candidateId,
  full_name: baseName,
  job_title: title,
})
assert.equal(hashA, hashB, "contact_candidates dedupe ignores email")

const ccHashEmailA = companyContactDedupeHash({
  company_id: companyId,
  full_name: baseName,
  title,
  email: "john@acme.com",
})
const ccHashEmailB = companyContactDedupeHash({
  company_id: companyId,
  full_name: baseName,
  title,
  email: "john.doe@acme.com",
})
assert.notEqual(ccHashEmailA, ccHashEmailB, "company_contacts dedupe distinguishes emails")

const normA = normalizeContactCandidate(
  {
    full_name: baseName,
    job_title: title,
    email: "john@acme.com",
    pii_observed: true,
    evidence: [],
    source_attribution: [],
  },
  "pdl",
  "future_people_data_labs",
  candidateId,
)!
const normB = normalizeContactCandidate(
  {
    full_name: baseName,
    job_title: title,
    email: "john.doe@acme.com",
    pii_observed: true,
    evidence: [],
    source_attribution: [],
  },
  "apollo",
  "future_apollo",
  candidateId,
)!
assert.equal(normA.dedupe_hash, normB.dedupe_hash, "same person different email collapses at candidate layer")
const deduped = dedupeNormalizedContacts([normA, normB])
assert.equal(deduped.length, 1)

// --- Identity guards (canonical backfill uses shouldMaterializeCanonicalPerson) ---
assert.equal(
  classifyContactIdentity({ full_name: "Jane Doe", title: "CEO" }).classification,
  "named_person",
)

const channel = classifyContactIdentity({
  full_name: "Support",
  email: "help@acme.com",
})
assert.equal(channel.classification, "company_channel")
assert.equal(shouldMaterializeCanonicalPerson({ full_name: "Support", email: "help@acme.com" }), false)

assert.equal(shouldMaterializeCanonicalPerson({ full_name: "Jane Smith", title: "CEO" }), true)

// --- Outreach readiness unchanged ---
const ready = computeProspectSearchContactOutreachReadiness({
  email: "jane@acme.com",
  verification_status: "email_verified",
  confidence: 0.7,
})
assert.equal(ready.outreach_ready, true)
assert.equal(ready.readiness_label, "Email outreach ready")

const notReady = computeProspectSearchContactOutreachReadiness({
  email: "jane@acme.com",
  verification_status: "unverified",
  confidence: 0.7,
})
assert.equal(notReady.outreach_ready, false)

// --- Lead Engine boundary ---
assert.equal(GROWTH_LEAD_ENGINE_CONTACT_DISCOVERY_BOUNDARY_DECISION, "keep_separate_document_boundary")

// --- Adapter diagnostics shape ---
const diagnostics = buildContactAcquisitionProviderDiagnostics(
  {
    provider_name: "future_apollo",
    provider_type: "future_apollo",
    isConfigured: () => false,
  },
  {
    provider_name: "future_apollo",
    provider_type: "future_apollo",
    status: "skipped",
    message: "not configured",
    contacts: [],
  },
  { duration_ms: 12 },
)
assert.equal(diagnostics.qa_marker, GROWTH_CONTACT_ACQUISITION_PROVIDER_ADAPTER_QA_MARKER)
assert.equal(diagnostics.contacts_returned, 0)
assert.equal(diagnostics.skipped_reason, "not configured")

// --- Benchmark still references pipeline helper ---
const benchmarkSource = readSource(
  "lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-acquisition.ts",
)
assert.ok(
  benchmarkSource.includes("persistProviderContactsAndSync"),
  "benchmark must use standard pipeline sync",
)
assert.ok(
  !benchmarkSource.includes("upsertProviderCompanyContacts"),
  "benchmark must not use deprecated direct upsert with candidate id",
)

console.log("All Phase 7.PCA-1 contact acquisition alignment checks passed.")
