/**
 * Phase 7.4A — Phone discovery regression tests.
 * Run: pnpm test:growth-phone-discovery-7.4a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  baseConfidenceForPhoneSource,
  canPromotePhoneDiscoveryCandidate,
  confidenceTierForPhoneDiscovery,
} from "../lib/growth/phone-discovery/phone-discovery-confidence"
import {
  evaluatePhoneDiscoveryCertification,
  GROWTH_PHONE_DISCOVERY_CERTIFICATION_QA_MARKER,
} from "../lib/growth/phone-discovery/phone-discovery-certification"
import { evaluateCanonicalPersonPhonePromotion } from "../lib/growth/phone-discovery/phone-discovery-integrity-rules"
import { limitPhoneDiscoveryDraftsForVerification } from "../lib/growth/phone-discovery/phone-discovery-limits"
import {
  GROWTH_PHONE_DISCOVERY_MAX_VERIFY_PER_RUN,
  GROWTH_PHONE_DISCOVERY_MIGRATION,
  GROWTH_PHONE_DISCOVERY_PROMOTION_MIN_CONFIDENCE,
  GROWTH_PHONE_DISCOVERY_QA_MARKER,
} from "../lib/growth/phone-discovery/phone-discovery-types"
import { canonicalNormalizedPersonPhone } from "../lib/growth/canonical-persons/canonical-person-normalize"
import { personNameMatchesDiscoveryContact } from "../lib/growth/email-discovery/email-discovery-name-match"

const migration = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${GROWTH_PHONE_DISCOVERY_MIGRATION}`),
  "utf8",
)
assert.match(migration, /phone_discovery_runs/)
assert.match(migration, /phone_discovery_candidates/)
assert.match(migration, /phone_discovery_evidence/)
assert.match(migration, /person_phones_verification_status_check/)
assert.match(migration, /'verified'/)
assert.doesNotMatch(migration, /phone_discovery_jobs/)
assert.doesNotMatch(migration, /blitzpay|stripe/i)

const repoCore = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/canonical-persons/canonical-person-repository-core.ts"),
  "utf8",
)
assert.match(repoCore, /onConflict: "normalized_phone"/)
assert.match(repoCore, /from\("person_phones"\)/)

assert.equal(canonicalNormalizedPersonPhone(""), null)
assert.equal(canonicalNormalizedPersonPhone("   "), null)
assert.ok(canonicalNormalizedPersonPhone("+1 555 123 4567"))

assert.equal(
  confidenceTierForPhoneDiscovery({
    source: "website",
    verification_status: "unverified",
    base_confidence: 0.9,
  }),
  "direct_evidence",
)
assert.equal(
  confidenceTierForPhoneDiscovery({
    source: "pdl",
    verification_status: "probable",
    base_confidence: 0.8,
  }),
  "provider_evidence",
)

assert.equal(canPromotePhoneDiscoveryCandidate({ verification_status: "verified", confidence: 0.9 }), true)
assert.equal(
  canPromotePhoneDiscoveryCandidate({
    verification_status: "verified",
    confidence: GROWTH_PHONE_DISCOVERY_PROMOTION_MIN_CONFIDENCE - 0.01,
  }),
  false,
)
assert.equal(canPromotePhoneDiscoveryCandidate({ verification_status: "probable", confidence: 0.99 }), false)

assert.equal(
  personNameMatchesDiscoveryContact({
    person_normalized_name: "jane doe",
    contact_full_name: "Jane Doe",
  }),
  true,
)

assert.equal(baseConfidenceForPhoneSource("website"), 0.88)

const orchestrator = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/phone-discovery/phone-discovery-orchestrator.ts"),
  "utf8",
)
assert.match(orchestrator, /verifyPhoneDiscoveryDraft/)
assert.match(orchestrator, /promoteVerifiedPhoneDiscoveryCandidate/)
assert.match(orchestrator, /assertPersonCompanyRoleForDiscovery/)
assert.match(orchestrator, /limitPhoneDiscoveryDraftsForVerification/)
assert.doesNotMatch(orchestrator, /openai|anthropic|guess|zerobounce/i)

const promote = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/phone-discovery/phone-discovery-promote.ts"),
  "utf8",
)
assert.match(promote, /fetchCanonicalPersonPhoneByNormalized/)
assert.match(promote, /clearPrimaryPhoneFlagsForPersonExcept/)
assert.match(promote, /evaluateCanonicalPersonPhonePromotion/)

const ownershipBlock = evaluateCanonicalPersonPhonePromotion({
  existing: {
    person_id: "person-a",
    normalized_phone: "+15551234567",
    confidence: 0.9,
    verification_status: "verified",
    metadata: {},
  },
  target_person_id: "person-b",
  incoming_confidence: 0.95,
  incoming_verification_status: "verified",
})
assert.equal(ownershipBlock.allowed, false)

const ownershipAllow = evaluateCanonicalPersonPhonePromotion({
  existing: null,
  target_person_id: "person-b",
  incoming_confidence: 0.9,
  incoming_verification_status: "verified",
})
assert.equal(ownershipAllow.allowed, true)

const capped = limitPhoneDiscoveryDraftsForVerification(
  [
    {
      phone: "+15551111111",
      normalized_phone: "+15551111111",
      phone_type: "unknown",
      source: "pdl",
      confidence: 0.8,
      confidence_tier: "provider_evidence",
      provider_name: "x",
      discovery_source: "x",
      evidence: [],
    },
    {
      phone: "+15552222222",
      normalized_phone: "+15552222222",
      phone_type: "unknown",
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

assert.equal(GROWTH_PHONE_DISCOVERY_MAX_VERIFY_PER_RUN, 20)

const cert = evaluatePhoneDiscoveryCertification()
assert.equal(cert.production_safe, true)
assert.equal(cert.deterministic_verification, true)
assert.equal(GROWTH_PHONE_DISCOVERY_CERTIFICATION_QA_MARKER, "growth-phone-discovery-certification-7.4a-v1")

const runApi = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/phone-discovery/run/route.ts"),
  "utf8",
)
assert.match(runApi, /runPhoneDiscoveryForCanonicalPerson/)
assert.doesNotMatch(runApi, /phone-discovery\/jobs/)

const evidenceApi = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/phone-discovery/runs/[runId]/route.ts"),
  "utf8",
)
assert.match(evidenceApi, /loadPhoneDiscoveryRunDetail/)

const operatorApi = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/phone-discovery/operator-status/route.ts"),
  "utf8",
)
assert.match(operatorApi, /loadPhoneDiscoveryOperatorStatus/)

const panel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-phone-discovery-panel.tsx"),
  "utf8",
)
assert.match(panel, /phone-discovery\/runs\//)
assert.match(panel, /person_company_roles/)
assert.match(panel, /GROWTH_PHONE_DISCOVERY_QA_MARKER/)
assert.match(panel, /GrowthEmailDiscoveryRolePicker/)
assert.match(panel, /email-discovery\/role-pairs/)
assert.match(panel, /phone-discovery\/run/)
assert.doesNotMatch(panel, /phone-discovery\/jobs/)

const operatorCard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-phone-discovery-operator-card.tsx"),
  "utf8",
)
assert.match(operatorCard, /Discover Phone/)
assert.match(operatorCard, /View Evidence/)

const infra = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/infrastructure/page.tsx"),
  "utf8",
)
assert.match(infra, /GrowthPhoneDiscoveryPanel/)
assert.match(infra, /GrowthSectionLayout[\s\S]*GrowthPhoneDiscoveryPanel/)

const sources = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/phone-discovery/phone-discovery-sources.ts"),
  "utf8",
)
assert.match(sources, /lead_decision_makers/)
assert.match(sources, /full_name/)
assert.match(sources, /discoverWebsiteContacts/)
assert.match(sources, /collectPdlPhoneDiscoveryCandidates/)
assert.doesNotMatch(sources, /openai|guess/i)

const verification = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/phone-discovery/phone-discovery-verification.ts"),
  "utf8",
)
assert.match(verification, /verifyPhoneNumber/)
assert.match(verification, /growth_deterministic_phone_verify/)

assert.equal(GROWTH_PHONE_DISCOVERY_QA_MARKER, "growth-phone-discovery-7.4a-v1")

console.log("growth-phone-discovery-7.4a: all assertions passed")
