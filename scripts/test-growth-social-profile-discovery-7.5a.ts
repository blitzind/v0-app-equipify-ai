/**
 * Phase 7.5A — Social profile discovery regression tests.
 * Run: pnpm test:growth-social-profile-discovery-7.5a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  baseConfidenceForSocialProfileSource,
  canPromoteSocialProfileDiscoveryCandidate,
  confidenceTierForSocialProfileDiscovery,
} from "../lib/growth/social-profile-discovery/social-profile-discovery-confidence"
import {
  evaluateSocialProfileDiscoveryCertification,
  GROWTH_SOCIAL_PROFILE_DISCOVERY_CERTIFICATION_QA_MARKER,
} from "../lib/growth/social-profile-discovery/social-profile-discovery-certification"
import { evaluateCanonicalProfilePromotion } from "../lib/growth/social-profile-discovery/social-profile-discovery-integrity-rules"
import { limitSocialProfileDiscoveryDraftsForVerification } from "../lib/growth/social-profile-discovery/social-profile-discovery-limits"
import {
  normalizeFacebookProfile,
  normalizeInstagramProfile,
  normalizeLinkedInCompanyProfile,
  normalizeLinkedInPersonProfile,
  normalizeTwitterProfile,
} from "../lib/growth/social-profile-discovery/social-profile-normalize"
import {
  GROWTH_SOCIAL_PROFILE_DISCOVERY_MAX_VERIFY_PER_RUN,
  GROWTH_SOCIAL_PROFILE_DISCOVERY_MIGRATION,
  GROWTH_SOCIAL_PROFILE_DISCOVERY_PROMOTION_MIN_CONFIDENCE,
  GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER,
} from "../lib/growth/social-profile-discovery/social-profile-discovery-types"
import { extractSocialProfileUrlsFromText } from "../lib/growth/social-profile-discovery/social-profile-discovery-website-extract"
import { personNameMatchesDiscoveryContact } from "../lib/growth/email-discovery/email-discovery-name-match"

const migration = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${GROWTH_SOCIAL_PROFILE_DISCOVERY_MIGRATION}`),
  "utf8",
)
assert.match(migration, /social_profile_discovery_runs/)
assert.match(migration, /social_profile_discovery_candidates/)
assert.match(migration, /social_profile_discovery_evidence/)
assert.match(migration, /company_profiles/)
assert.match(migration, /linkedin_person/)
assert.match(migration, /linkedin_company/)
assert.doesNotMatch(migration, /social_profile_discovery_jobs/)
assert.doesNotMatch(migration, /blitzpay|stripe/i)

const repoCore = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/canonical-persons/canonical-person-repository-core.ts"),
  "utf8",
)
assert.match(repoCore, /onConflict: "normalized_profile_key"/)
assert.match(repoCore, /verification_status/)

const companyCore = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/canonical-companies/canonical-company-repository-core.ts"),
  "utf8",
)
assert.match(companyCore, /upsertCanonicalCompanyProfile/)
assert.match(companyCore, /company_profiles/)

assert.ok(normalizeLinkedInPersonProfile("https://www.linkedin.com/in/Jane-Doe"))
assert.equal(normalizeLinkedInPersonProfile("https://www.linkedin.com/company/acme"), null)
assert.ok(normalizeLinkedInCompanyProfile("https://www.linkedin.com/company/acme-corp"))
assert.ok(normalizeTwitterProfile("https://x.com/example_handle"))
assert.ok(normalizeFacebookProfile("https://www.facebook.com/examplepage"))
assert.ok(normalizeInstagramProfile("https://www.instagram.com/exampleuser/"))
assert.equal(normalizeTwitterProfile("not-a-url"), null)

const extracted = extractSocialProfileUrlsFromText(
  "Follow us https://www.linkedin.com/company/acme and https://twitter.com/acme",
)
assert.ok(extracted.some((e) => e.profile_type === "linkedin_company"))
assert.ok(extracted.some((e) => e.profile_type === "twitter"))

assert.equal(
  confidenceTierForSocialProfileDiscovery({
    source: "website",
    verification_status: "unverified",
    base_confidence: 0.9,
  }),
  "direct_evidence",
)

assert.equal(canPromoteSocialProfileDiscoveryCandidate({ verification_status: "verified", confidence: 0.9 }), true)
assert.equal(
  canPromoteSocialProfileDiscoveryCandidate({
    verification_status: "verified",
    confidence: GROWTH_SOCIAL_PROFILE_DISCOVERY_PROMOTION_MIN_CONFIDENCE - 0.01,
  }),
  false,
)
assert.equal(canPromoteSocialProfileDiscoveryCandidate({ verification_status: "probable", confidence: 0.99 }), false)

assert.equal(
  personNameMatchesDiscoveryContact({
    person_normalized_name: "jane doe",
    contact_full_name: "Jane Doe",
  }),
  true,
)

assert.equal(baseConfidenceForSocialProfileSource("website"), 0.88)

const orchestrator = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/social-profile-discovery/social-profile-discovery-orchestrator.ts"),
  "utf8",
)
assert.match(orchestrator, /verifySocialProfileDiscoveryDraft/)
assert.match(orchestrator, /promoteVerifiedSocialProfileDiscoveryCandidate/)
assert.match(orchestrator, /assertSocialProfileDiscoveryPreflight/)
assert.match(orchestrator, /limitSocialProfileDiscoveryDraftsForVerification/)
assert.doesNotMatch(orchestrator, /openai|anthropic|guess|zerobounce|puppeteer|playwright/i)

const promote = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/social-profile-discovery/social-profile-discovery-promote.ts"),
  "utf8",
)
assert.match(promote, /fetchCanonicalPersonProfileByNormalizedKey/)
assert.match(promote, /fetchCanonicalCompanyProfileByNormalizedKey/)
assert.match(promote, /evaluateCanonicalProfilePromotion/)

const ownershipBlock = evaluateCanonicalProfilePromotion({
  existing: {
    owner_id: "person-a",
    normalized_profile_key: "linkedin:in:jane",
    confidence: 0.9,
    verification_status: "verified",
    metadata: {},
  },
  target_owner_id: "person-b",
  incoming_confidence: 0.95,
  incoming_verification_status: "verified",
})
assert.equal(ownershipBlock.allowed, false)

const ownershipAllow = evaluateCanonicalProfilePromotion({
  existing: null,
  target_owner_id: "person-b",
  incoming_confidence: 0.9,
  incoming_verification_status: "verified",
})
assert.equal(ownershipAllow.allowed, true)

const capped = limitSocialProfileDiscoveryDraftsForVerification(
  [
    {
      profile_type: "twitter",
      profile_url: "https://x.com/low",
      normalized_profile_key: "twitter:low",
      source: "staging_contact",
      confidence: 0.8,
      confidence_tier: "provider_evidence",
      provider_name: "x",
      discovery_source: "x",
      evidence: [],
    },
    {
      profile_type: "linkedin_person",
      profile_url: "https://www.linkedin.com/in/high",
      normalized_profile_key: "linkedin:in:high",
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

assert.equal(GROWTH_SOCIAL_PROFILE_DISCOVERY_MAX_VERIFY_PER_RUN, 15)

const cert = evaluateSocialProfileDiscoveryCertification()
assert.equal(cert.production_safe, true)
assert.equal(cert.deterministic_only, true)
assert.equal(cert.no_paid_providers, true)
assert.equal(
  GROWTH_SOCIAL_PROFILE_DISCOVERY_CERTIFICATION_QA_MARKER,
  "growth-social-profile-discovery-certification-7.5a-v1",
)

const runApi = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/social-profile-discovery/run/route.ts"),
  "utf8",
)
assert.match(runApi, /runSocialProfileDiscoveryForCanonicalPerson/)
assert.match(runApi, /runSocialProfileDiscoveryForCanonicalCompany/)
assert.doesNotMatch(runApi, /social_profile_discovery_jobs|cron/i)

const evidenceApi = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/social-profile-discovery/runs/[runId]/route.ts"),
  "utf8",
)
assert.match(evidenceApi, /loadSocialProfileDiscoveryRunDetail/)

const operatorApi = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/social-profile-discovery/operator-status/route.ts"),
  "utf8",
)
assert.match(operatorApi, /loadSocialProfileDiscoveryOperatorStatus/)
assert.doesNotMatch(operatorApi, /social_profile_discovery_jobs/)

const panel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-social-profile-discovery-panel.tsx"),
  "utf8",
)
assert.match(panel, /social-profile-discovery\/runs\//)
assert.match(panel, /person_company_roles/)
assert.match(panel, /GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER/)
assert.match(panel, /social-profile-discovery\/run/)
assert.doesNotMatch(panel, /social-profile-discovery\/jobs/)

const infra = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/infrastructure/page.tsx"),
  "utf8",
)
assert.match(infra, /GrowthSocialProfileDiscoveryPanel/)

const sources = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/social-profile-discovery/social-profile-discovery-sources.ts"),
  "utf8",
)
assert.match(sources, /lead_decision_makers/)
assert.match(sources, /full_name/)
assert.match(sources, /discoverWebsiteContacts/)
assert.match(sources, /company_profiles/)
assert.doesNotMatch(sources, /openai|guess|pdl|searchPdl/i)

const verification = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/social-profile-discovery/social-profile-discovery-verification.ts"),
  "utf8",
)
assert.match(verification, /growth_deterministic_social_profile_verify/)
assert.doesNotMatch(verification, /openai|guess/i)

assert.equal(GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER, "growth-social-profile-discovery-7.5a-v1")

console.log("growth-social-profile-discovery-7.5a: all assertions passed")
