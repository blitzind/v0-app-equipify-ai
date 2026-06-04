/**
 * Phase 7.3A — Email discovery regression tests.
 * Run: pnpm test:growth-email-discovery-7.3a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { generateWorkEmailPatterns } from "../lib/growth/email-discovery/email-discovery-patterns"
import {
  baseConfidenceForSource,
  canPromoteEmailDiscoveryCandidate,
  confidenceTierForEmailDiscovery,
} from "../lib/growth/email-discovery/email-discovery-confidence"
import { personNameMatchesDiscoveryContact } from "../lib/growth/email-discovery/email-discovery-name-match"
import {
  evaluateEmailDiscoveryVerificationCertification,
  GROWTH_EMAIL_DISCOVERY_CERTIFICATION_QA_MARKER,
} from "../lib/growth/email-discovery/email-discovery-certification"
import { evaluateCanonicalPersonEmailPromotion } from "../lib/growth/email-discovery/email-discovery-integrity-rules"
import { limitEmailDiscoveryDraftsForVerification } from "../lib/growth/email-discovery/email-discovery-limits"
import {
  GROWTH_EMAIL_DISCOVERY_MAX_VERIFY_PER_RUN,
  GROWTH_EMAIL_DISCOVERY_MIGRATION,
  GROWTH_EMAIL_DISCOVERY_PROMOTION_MIN_CONFIDENCE,
  GROWTH_EMAIL_DISCOVERY_QA_MARKER,
} from "../lib/growth/email-discovery/email-discovery-types"
import { canonicalNormalizedPersonEmail } from "../lib/growth/canonical-persons/canonical-person-normalize"

const migration = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${GROWTH_EMAIL_DISCOVERY_MIGRATION}`),
  "utf8",
)
assert.match(migration, /email_discovery_runs/)
assert.match(migration, /email_discovery_candidates/)
assert.match(migration, /email_discovery_evidence/)
assert.match(migration, /'verified'/)
assert.doesNotMatch(migration, /blitzpay|stripe/i)

const repoCore = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/canonical-persons/canonical-person-repository-core.ts"),
  "utf8",
)
assert.match(repoCore, /onConflict: "normalized_email"/)

const persist = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/canonical-persons/canonical-person-repository-core.ts"),
  "utf8",
)
assert.match(persist, /if \(email && input\.email\)/)

const patterns = generateWorkEmailPatterns({
  first_name: "John",
  last_name: "Smith",
  domain: "acme.com",
})
assert.ok(patterns.includes("john@acme.com"))
assert.ok(patterns.includes("john.smith@acme.com"))
assert.ok(patterns.includes("jsmith@acme.com"))
assert.equal(generateWorkEmailPatterns({ first_name: "J", domain: "acme.com" }).length, 0)

assert.equal(canonicalNormalizedPersonEmail(""), null)
assert.equal(canonicalNormalizedPersonEmail("   "), null)

assert.equal(
  confidenceTierForEmailDiscovery({
    source: "website",
    verification_status: "unverified",
    base_confidence: 0.9,
  }),
  "direct_evidence",
)
assert.equal(
  confidenceTierForEmailDiscovery({
    source: "pattern",
    verification_status: "verified",
    base_confidence: 0.8,
  }),
  "pattern_verified",
)
assert.equal(
  confidenceTierForEmailDiscovery({
    source: "pattern",
    verification_status: "unverified",
    base_confidence: 0.3,
  }),
  "pattern_unverified",
)

assert.equal(canPromoteEmailDiscoveryCandidate({ verification_status: "verified", confidence: 0.9 }), true)
assert.equal(
  canPromoteEmailDiscoveryCandidate({
    verification_status: "verified",
    confidence: GROWTH_EMAIL_DISCOVERY_PROMOTION_MIN_CONFIDENCE - 0.01,
  }),
  false,
)
assert.equal(canPromoteEmailDiscoveryCandidate({ verification_status: "unverified", confidence: 0.99 }), false)

assert.equal(personNameMatchesDiscoveryContact({
  person_normalized_name: "jane doe",
  contact_full_name: "Jane Doe",
}), true)
assert.equal(personNameMatchesDiscoveryContact({
  person_normalized_name: "jane doe",
  contact_full_name: "Bob Smith",
}), false)

assert.equal(baseConfidenceForSource("pattern"), 0.35)

const orchestrator = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/email-discovery/email-discovery-orchestrator.ts"),
  "utf8",
)
assert.match(orchestrator, /verifyEmailWithProvider|verifyEmailDiscoveryDraft/)
assert.match(orchestrator, /promoteVerifiedEmailDiscoveryCandidate/)
assert.match(orchestrator, /assertPersonCompanyRoleForDiscovery/)
assert.match(orchestrator, /limitEmailDiscoveryDraftsForVerification/)
assert.doesNotMatch(orchestrator, /openai|anthropic|guess/i)

const promote = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/email-discovery/email-discovery-promote.ts"),
  "utf8",
)
assert.match(promote, /fetchCanonicalPersonEmailByNormalized/)
assert.match(promote, /clearPrimaryFlagsForPersonExcept/)
assert.match(promote, /evaluateCanonicalPersonEmailPromotion/)

const ownershipBlock = evaluateCanonicalPersonEmailPromotion({
  existing: {
    person_id: "person-a",
    normalized_email: "jane@acme.com",
    confidence: 0.9,
    verification_status: "verified",
    metadata: {},
  },
  target_person_id: "person-b",
  incoming_confidence: 0.95,
  incoming_verification_status: "verified",
})
assert.equal(ownershipBlock.allowed, false)

const ownershipAllow = evaluateCanonicalPersonEmailPromotion({
  existing: null,
  target_person_id: "person-b",
  incoming_confidence: 0.9,
  incoming_verification_status: "verified",
})
assert.equal(ownershipAllow.allowed, true)

const capped = limitEmailDiscoveryDraftsForVerification(
  [
    {
      email: "a@x.com",
      normalized_email: "a@x.com",
      source: "pattern",
      confidence: 0.3,
      confidence_tier: "pattern_unverified",
      provider_name: "x",
      discovery_source: "x",
      evidence: [],
    },
    {
      email: "b@x.com",
      normalized_email: "b@x.com",
      source: "website",
      confidence: 0.9,
      confidence_tier: "direct_evidence",
      provider_name: "x",
      discovery_source: "x",
      evidence: [],
    },
  ],
  1,
)
assert.equal(capped.drafts.length, 1)
assert.equal(capped.drafts[0]?.source, "website")

assert.equal(GROWTH_EMAIL_DISCOVERY_MAX_VERIFY_PER_RUN, 12)

const cert = evaluateEmailDiscoveryVerificationCertification()
assert.equal(typeof cert.production_safe, "boolean")
assert.equal(GROWTH_EMAIL_DISCOVERY_CERTIFICATION_QA_MARKER, "growth-email-discovery-certification-7.3a-v1")

const runApi = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/email-discovery/run/route.ts"),
  "utf8",
)
assert.match(runApi, /verification_certification/)
assert.match(runApi, /require_production_safe_verification/)

const evidenceApi = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/email-discovery/runs/[runId]/route.ts"),
  "utf8",
)
assert.match(evidenceApi, /loadEmailDiscoveryRunDetail/)

const panel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-email-discovery-panel.tsx"),
  "utf8",
)
assert.match(panel, /email-discovery\/runs\//)
assert.match(panel, /person_company_roles/)
assert.match(panel, /formatCanonicalPersonBackfillRequestError/)
assert.match(panel, /evidence_count/)

const infra = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/infrastructure/page.tsx"),
  "utf8",
)
assert.match(infra, /GrowthEmailDiscoveryPanel/)

assert.equal(GROWTH_EMAIL_DISCOVERY_QA_MARKER, "growth-email-discovery-7.3a-v1")
console.log("growth-email-discovery-7.3a: ok")
