/**
 * Phase 7.7A — Buying committee intelligence foundation regression tests.
 * Run: pnpm test:growth-buying-committee-intelligence-7.7a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import {
  baseConfidenceForBuyingCommitteeSource,
  canPromoteBuyingCommitteeAssignment,
} from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-confidence"
import {
  evaluateBuyingCommitteeIntelligenceCertification,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_CERTIFICATION_QA_MARKER,
} from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-certification"
import { analyzeBuyingCommitteeCoverage } from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-coverage"
import { evaluateBuyingCommitteeMemberPromotion } from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-integrity-rules"
import { limitBuyingCommitteeDraftsForVerification } from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-limits"
import {
  buildNormalizedAssignmentKey,
  classifyCommitteeRoleFromJobTitle,
  mapCanonicalEmploymentRoleToCommitteeRole,
} from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-role-classification"
import {
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MAX_VERIFY_PER_RUN,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MEMBERS_TABLE,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_PROMOTION_MIN_CONFIDENCE,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES,
} from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import {
  evidenceSupportsRole,
  verifyBuyingCommitteeIntelligenceDraft,
} from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-verification"

const migration = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION}`),
  "utf8",
)
assert.match(migration, /buying_committee_runs/)
assert.match(migration, /buying_committee_evidence/)
assert.match(migration, /buying_committee_intelligence_members/)
assert.match(migration, /blocker_risk_stakeholder/)
assert.match(migration, /executive_sponsor/)
assert.doesNotMatch(migration, /buying_committee_jobs/)
assert.doesNotMatch(migration, /openai|anthropic|gpt-/i)

const orchestrator = fs.readFileSync(
  path.join(
    process.cwd(),
    "lib/growth/buying-committee-intelligence/buying-committee-intelligence-orchestrator.ts",
  ),
  "utf8",
)
assert.match(orchestrator, /collectAllBuyingCommitteeIntelligenceAssignments/)
assert.doesNotMatch(orchestrator, /buying_committee_jobs/)
assert.doesNotMatch(orchestrator, /cron/)

const sources = fs.readFileSync(
  path.join(
    process.cwd(),
    "lib/growth/buying-committee-intelligence/buying-committee-intelligence-sources.ts",
  ),
  "utf8",
)
assert.match(sources, /person_company_roles/)
assert.match(sources, /company_contacts/)
assert.match(sources, /lead_decision_makers/)
assert.match(sources, /collectWebsiteAndTeamPageEvidenceAssignments/)
assert.doesNotMatch(sources, /inferCommitteeRole|openai|guess|pdl|apollo/i)

const roleClass = fs.readFileSync(
  path.join(
    process.cwd(),
    "lib/growth/buying-committee-intelligence/buying-committee-intelligence-role-classification.ts",
  ),
  "utf8",
)
assert.doesNotMatch(roleClass, /return "operator"/)

assert.equal(GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES.length, 8)
assert.equal(
  mapCanonicalEmploymentRoleToCommitteeRole("owner"),
  "executive_sponsor",
)
assert.equal(
  mapCanonicalEmploymentRoleToCommitteeRole("unknown"),
  null,
)

const cfoMatch = classifyCommitteeRoleFromJobTitle({ job_title: "Chief Financial Officer" })
assert.equal(cfoMatch?.committee_role, "economic_buyer")
assert.ok(cfoMatch?.evidence_text.includes("economic_buyer_title"))

const biomedicalMatch = classifyCommitteeRoleFromJobTitle({
  job_title: "Biomedical Equipment Manager",
})
assert.equal(biomedicalMatch?.committee_role, "end_user")
assert.ok(biomedicalMatch?.evidence_text.includes("biomedical_manager_title"))

const vague = classifyCommitteeRoleFromJobTitle({ job_title: "Team Member" })
assert.equal(vague, null)

assert.equal(
  buildNormalizedAssignmentKey({
    company_id: "c1",
    person_id: "p1",
    committee_role: "champion",
  }),
  "c1:p1:champion",
)

const coverage = analyzeBuyingCommitteeCoverage({
  verified_roles: ["economic_buyer", "technical_buyer"],
  verified_person_ids: ["p1", "p2"],
})
assert.equal(coverage.coverage_score, 0.25)
assert.equal(coverage.roles_missing.length, 6)
assert.equal(coverage.single_thread_risk, false)

assert.equal(baseConfidenceForBuyingCommitteeSource("canonical_role"), 0.9)
assert.equal(
  canPromoteBuyingCommitteeAssignment({
    verification_status: "verified",
    confidence: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_PROMOTION_MIN_CONFIDENCE,
  }),
  true,
)

const personId = randomUUID()
const draft = {
  assignment_ref: randomUUID(),
  person_id: personId,
  full_name: "Pat CFO",
  job_title: "Chief Financial Officer",
  committee_role: "economic_buyer" as const,
  normalized_assignment_key: `co:${personId}:economic_buyer`,
  source: "title_pattern" as const,
  confidence: 0.88,
  confidence_tier: "direct_evidence" as const,
  provider_name: "test",
  discovery_source: "test",
  evidence: [
    {
      evidence_type: "title_pattern" as const,
      evidence_text:
        'Title pattern economic_buyer_title matched "Chief Financial" in job title: Chief Financial Officer',
      confidence: 0.88,
    },
  ],
}
const verified = verifyBuyingCommitteeIntelligenceDraft(draft)
assert.equal(verified.verification_status, "verified")

assert.equal(
  evidenceSupportsRole({
    ...draft,
    evidence: [
      {
        evidence_type: "title_pattern",
        evidence_text: "Unrelated note about the company website.",
        extraction_method: "other",
      },
    ],
  }),
  false,
)

const metadataDraft = {
  ...draft,
  committee_role: "economic_buyer" as const,
  source: "metadata_declared" as const,
  confidence: 0.87,
  staging_trusted: false,
  evidence: [
    {
      evidence_type: "metadata_declared" as const,
      evidence_text: "Staging metadata declares committee_role=economic_buyer.",
    },
  ],
}
assert.notEqual(verifyBuyingCommitteeIntelligenceDraft(metadataDraft).verification_status, "verified")

const metadataTrusted = verifyBuyingCommitteeIntelligenceDraft({
  ...metadataDraft,
  staging_trusted: true,
})
assert.equal(metadataTrusted.verification_status, "verified")

const noEvidence = verifyBuyingCommitteeIntelligenceDraft({
  ...draft,
  evidence: [],
})
assert.equal(noEvidence.verification_status, "invalid")

assert.equal(
  evaluateBuyingCommitteeMemberPromotion({
    existing: null,
    target_company_id: "c1",
    target_person_id: personId,
    incoming_confidence: 0.9,
    incoming_verification_status: "verified",
  }).allowed,
  true,
)

const capped = limitBuyingCommitteeDraftsForVerification(
  Array.from({ length: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MAX_VERIFY_PER_RUN + 5 }, (_, i) => ({
    ...draft,
    assignment_ref: randomUUID(),
    confidence: 0.5 + i * 0.01,
  })),
)
assert.equal(capped.drafts.length, GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MAX_VERIFY_PER_RUN)

const cert = evaluateBuyingCommitteeIntelligenceCertification()
assert.equal(cert.no_ai_generated_people, true)
assert.equal(cert.no_blind_title_guessing, true)
assert.equal(cert.title_pattern_classification_only, true)
assert.equal(cert.metadata_requires_trusted_staging, true)
assert.equal(cert.no_runtime_jobs_in_7_7a, true)

const operatorStatus = fs.readFileSync(
  path.join(
    process.cwd(),
    "lib/growth/buying-committee-intelligence/buying-committee-intelligence-operator-status.ts",
  ),
  "utf8",
)
assert.match(operatorStatus, /verified_person_ids:\s*counts\.verified_person_ids/)
assert.doesNotMatch(operatorStatus, /verified_person_ids:\s*\[\]/)

const verification = fs.readFileSync(
  path.join(
    process.cwd(),
    "lib/growth/buying-committee-intelligence/buying-committee-intelligence-verification.ts",
  ),
  "utf8",
)
assert.match(verification, /metadata_declared.*stagingTrusted/s)
assert.match(verification, /stagingTrusted &&\s*\n\s*confidence >= 0\.85/)

const promote = fs.readFileSync(
  path.join(
    process.cwd(),
    "lib/growth/buying-committee-intelligence/buying-committee-intelligence-promote.ts",
  ),
  "utf8",
)
assert.match(promote, /personHasVerifiedCompanyEmploymentLink/)

const repository = fs.readFileSync(
  path.join(
    process.cwd(),
    "lib/growth/buying-committee-intelligence/buying-committee-intelligence-repository.ts",
  ),
  "utf8",
)
assert.match(repository, /verified_person_ids/)
assert.equal(
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_CERTIFICATION_QA_MARKER,
  "growth-buying-committee-intelligence-certification-7.7a-v1",
)

const runApi = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/buying-committee-intelligence/run/route.ts"),
  "utf8",
)
assert.match(runApi, /runBuyingCommitteeIntelligenceForCanonicalCompany/)
assert.doesNotMatch(runApi, /buying-committee-intelligence\/jobs/)

const panel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-buying-committee-intelligence-panel.tsx"),
  "utf8",
)
assert.match(panel, /buying-committee-intelligence\/run/)
assert.match(panel, /buying-committee-intelligence\/runs\//)
assert.match(panel, /GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER/)

const infra = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/infrastructure/page.tsx"),
  "utf8",
)
assert.match(infra, /GrowthBuyingCommitteeIntelligencePanel/)

assert.equal(GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MEMBERS_TABLE, "buying_committee_intelligence_members")
assert.equal(GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER, "growth-buying-committee-intelligence-7.7a-v1")

console.log("growth-buying-committee-intelligence-7.7a: PASS")
