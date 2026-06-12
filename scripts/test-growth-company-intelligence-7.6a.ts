/**
 * Phase 7.6A — Company intelligence foundation regression tests.
 * Run: pnpm test:growth-company-intelligence-7.6a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import {
  baseConfidenceForCompanyIntelligenceSource,
  canPromoteCompanyIntelligenceFinding,
  confidenceTierForCompanyIntelligence,
} from "../lib/growth/company-intelligence/company-intelligence-confidence"
import {
  evaluateCompanyIntelligenceCertification,
  GROWTH_COMPANY_INTELLIGENCE_CERTIFICATION_QA_MARKER,
} from "../lib/growth/company-intelligence/company-intelligence-certification"
import { evaluateCompanyIntelligenceSnapshotPromotion } from "../lib/growth/company-intelligence/company-intelligence-integrity-rules"
import { limitCompanyIntelligenceDraftsForVerification } from "../lib/growth/company-intelligence/company-intelligence-limits"
import {
  buildNormalizedIntelligenceKey,
  normalizeTechnologyIntelligenceKey,
} from "../lib/growth/company-intelligence/company-intelligence-normalize"
import {
  extractMetaDescriptionFromHtml,
  extractSchemaOrgOrganizationsFromHtml,
} from "../lib/growth/company-intelligence/company-intelligence-schema-org"
import {
  GROWTH_COMPANY_INTELLIGENCE_MAX_VERIFY_PER_RUN,
  GROWTH_COMPANY_INTELLIGENCE_MIGRATION,
  GROWTH_COMPANY_INTELLIGENCE_PROMOTION_MIN_CONFIDENCE,
  GROWTH_COMPANY_INTELLIGENCE_QA_MARKER,
} from "../lib/growth/company-intelligence/company-intelligence-types"
import { verifyCompanyIntelligenceDraft } from "../lib/growth/company-intelligence/company-intelligence-verification"

const migration = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${GROWTH_COMPANY_INTELLIGENCE_MIGRATION}`),
  "utf8",
)
assert.match(migration, /company_intelligence_runs/)
assert.match(migration, /company_intelligence_evidence/)
assert.match(migration, /company_intelligence_snapshots/)
assert.match(migration, /company_intelligence_snapshots_company_normalized_key_unique/)
assert.match(migration, /\(company_id, normalized_intelligence_key\)/)
assert.doesNotMatch(
  migration,
  /company_intelligence_snapshots_normalized_key_unique[\s\S]*?\(normalized_intelligence_key\)/,
)
assert.doesNotMatch(migration, /company_intelligence_jobs/)
assert.doesNotMatch(migration, /openai|anthropic|gpt-/i)

const orchestrator = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/company-intelligence/company-intelligence-orchestrator.ts"),
  "utf8",
)
assert.match(orchestrator, /collectAllCompanyIntelligenceFindings/)
assert.doesNotMatch(orchestrator, /company_intelligence_jobs/)
assert.doesNotMatch(orchestrator, /cron/)

const sources = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/company-intelligence/company-intelligence-sources.ts"),
  "utf8",
)
assert.match(sources, /detectWebsiteTechnologies/)
assert.match(sources, /detectCareersPageEvidence/)
assert.match(sources, /company_source_lineage/)
assert.doesNotMatch(sources, /openai|pdl|apollo|people_data_labs/i)

assert.equal(
  buildNormalizedIntelligenceKey({
    intelligence_category: "technology",
    intelligence_key: normalizeTechnologyIntelligenceKey("HubSpot"),
  }),
  "technology:tech_hubspot",
)

const schemaHtml = `<html><script type="application/ld+json">{"@type":"Organization","name":"Acme HVAC","description":"We service commercial HVAC.","industry":"HVAC","numberOfEmployees":"51"}</script><meta name="description" content="Acme provides commercial HVAC maintenance across Texas."></html>`
const orgs = extractSchemaOrgOrganizationsFromHtml(schemaHtml)
assert.equal(orgs[0]?.name, "Acme HVAC")
assert.equal(orgs[0]?.industry, "HVAC")
assert.ok(extractMetaDescriptionFromHtml(schemaHtml)?.includes("commercial HVAC"))

assert.equal(baseConfidenceForCompanyIntelligenceSource("website"), 0.88)
assert.equal(
  confidenceTierForCompanyIntelligence({
    source: "website",
    verification_status: "verified",
    base_confidence: 0.9,
  }),
  "direct_evidence",
)

assert.equal(
  canPromoteCompanyIntelligenceFinding({ verification_status: "verified", confidence: 0.9 }),
  true,
)
assert.equal(
  canPromoteCompanyIntelligenceFinding({
    verification_status: "verified",
    confidence: GROWTH_COMPANY_INTELLIGENCE_PROMOTION_MIN_CONFIDENCE - 0.01,
  }),
  false,
)

const verifiedDraft = {
  finding_ref: randomUUID(),
  intelligence_category: "industry" as const,
  intelligence_key: "industry",
  normalized_intelligence_key: "industry:industry",
  value_text: "HVAC Services",
  value_json: null,
  source: "website" as const,
  confidence: 0.9,
  confidence_tier: "direct_evidence" as const,
  provider_name: "public_website",
  discovery_source: "schema_org",
  evidence: [
    {
      evidence_type: "schema_org" as const,
      source_url: "https://example.com",
      evidence_text: "HVAC Services",
      confidence: 0.9,
    },
  ],
}
const v = verifyCompanyIntelligenceDraft(verifiedDraft)
assert.equal(v.verification_status, "verified")

const invalidDraft = { ...verifiedDraft, evidence: [] }
assert.equal(verifyCompanyIntelligenceDraft(invalidDraft).verification_status, "invalid")

const weakBooleanSignal = {
  ...verifiedDraft,
  finding_ref: randomUUID(),
  intelligence_category: "website_signal" as const,
  intelligence_key: "signal_has_chat_widget",
  normalized_intelligence_key: "website_signal:signal_has_chat_widget",
  value_text: "true",
  source: "website" as const,
  evidence: [
    {
      evidence_type: "website_page" as const,
      evidence_text: "unrelated page content without signal keywords",
      confidence: 0.9,
    },
  ],
}
assert.equal(verifyCompanyIntelligenceDraft(weakBooleanSignal).verification_status, "invalid")

const strongHiringSignal = {
  ...verifiedDraft,
  finding_ref: randomUUID(),
  intelligence_category: "hiring" as const,
  intelligence_key: "careers_page",
  normalized_intelligence_key: "hiring:careers_page",
  value_text: "present",
  source: "website" as const,
  evidence: [
    {
      evidence_type: "website_page" as const,
      evidence_text: "Careers page with open positions for HVAC technicians",
      confidence: 0.9,
    },
  ],
}
assert.equal(verifyCompanyIntelligenceDraft(strongHiringSignal).verification_status, "verified")

const promoteSrc = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/company-intelligence/company-intelligence-promote.ts"),
  "utf8",
)
assert.match(promoteSrc, /fetchCompanyIntelligenceSnapshotByKey\(admin, \{/)
assert.doesNotMatch(promoteSrc, /onConflict:\s*"company_id,normalized_intelligence_key"/)
assert.match(promoteSrc, /\.insert\(snapshotRow\)/)
assert.match(promoteSrc, /\.update\(snapshotRow\)/)

const block = evaluateCompanyIntelligenceSnapshotPromotion({
  existing: {
    company_id: "company-a",
    confidence: 0.95,
    verification_status: "verified",
  },
  target_company_id: "company-b",
  incoming_confidence: 0.99,
  incoming_verification_status: "verified",
})
assert.equal(block.allowed, false)

const capped = limitCompanyIntelligenceDraftsForVerification(
  [
    { ...verifiedDraft, source: "canonical_company" as const, confidence: 0.8 },
    { ...verifiedDraft, source: "website" as const, confidence: 0.9 },
  ],
  1,
)
assert.equal(capped.drafts.length, 1)
assert.equal(capped.drafts[0]?.source, "website")

assert.equal(GROWTH_COMPANY_INTELLIGENCE_MAX_VERIFY_PER_RUN, 40)

const cert = evaluateCompanyIntelligenceCertification()
assert.equal(cert.no_ai_generated_facts, true)
assert.equal(cert.no_runtime_jobs_in_7_6a, true)
assert.equal(GROWTH_COMPANY_INTELLIGENCE_CERTIFICATION_QA_MARKER, "growth-company-intelligence-certification-7.6a-v1")

const runApi = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/company-intelligence/run/route.ts"),
  "utf8",
)
assert.match(runApi, /runCompanyIntelligenceForCanonicalCompany/)
assert.doesNotMatch(runApi, /company-intelligence\/jobs/)

const panel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-company-intelligence-panel.tsx"),
  "utf8",
)
assert.match(panel, /company-intelligence\/jobs/)
assert.match(panel, /company-intelligence\/run/)
assert.match(panel, /company-intelligence\/runs\//)
assert.match(panel, /GROWTH_COMPANY_INTELLIGENCE_QA_MARKER/)

const infra = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/infrastructure/page.tsx"),
  "utf8",
)
assert.match(infra, /GrowthCompanyIntelligencePanel/)

const repromoteSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/company-intelligence/company-intelligence-repromote.ts"),
  "utf8",
)
assert.match(repromoteSource, /repromoteVerifiedCompanyIntelligenceRunFindings/)

const scoringContextSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-qualification-scoring-context.ts"),
  "utf8",
)
assert.match(scoringContextSource, /verified_count\) > 0 \|\| Number\(row\.promoted_count\) > 0/)

assert.equal(GROWTH_COMPANY_INTELLIGENCE_QA_MARKER, "growth-company-intelligence-7.6a-v1")

console.log("growth-company-intelligence-7.6a: PASS")
