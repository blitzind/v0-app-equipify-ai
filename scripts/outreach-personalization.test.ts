/**
 * Regression checks for Lead Engine Outreach Personalization Engine (Prompt 7).
 * Run: pnpm test:growth-lead-engine-outreach-personalization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthLeadEngineOutreachPersonalizationSystemPrompt,
  buildGrowthLeadEngineOutreachPersonalizationTemplateUserPrompt,
  buildGrowthLeadEngineOutreachPersonalizationUserPrompt,
  GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_TEMPLATE_PLACEHOLDERS,
} from "../lib/growth/lead-engine/outreach-personalization-prompt"
import {
  parseGrowthLeadEngineOutreachPersonalizationFromUpstream,
  parseGrowthLeadEngineOutreachPersonalizationOutput,
} from "../lib/growth/lead-engine/outreach-personalization-parser"
import {
  GROWTH_LEAD_ENGINE_OUTREACH_CHANNEL_PRIORITIES,
  GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_QA_MARKER,
  GROWTH_LEAD_ENGINE_OUTREACH_SOCIAL_PROOF_TYPES,
} from "../lib/growth/lead-engine/outreach-personalization-types"

assert.equal(
  GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_QA_MARKER,
  "lead-engine-outreach-personalization-v1",
)
assert.equal(GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_OUTPUT_JSON_KEYS.length, 19)
assert.equal(GROWTH_LEAD_ENGINE_OUTREACH_CHANNEL_PRIORITIES.length, 4)
assert.ok(GROWTH_LEAD_ENGINE_OUTREACH_SOCIAL_PROOF_TYPES.length >= 4)

const systemPrompt = buildGrowthLeadEngineOutreachPersonalizationSystemPrompt()
assert.match(systemPrompt, /Do NOT generate email copy/)
assert.match(systemPrompt, /Do NOT fabricate business issues/)
assert.match(systemPrompt, /source_attribution/)
assert.match(systemPrompt, /EMAIL/)
assert.match(systemPrompt, /MULTI_TOUCH/)
assert.match(systemPrompt, /INDUSTRY_PEER/)

const userPrompt = buildGrowthLeadEngineOutreachPersonalizationUserPrompt({
  icpTargeting: { icp_summary: "Biomedical service ICP" },
  companyDiscovery: {
    company_profile: { company_name: "Precision Biomedical Services", domain: "precisionbiomed.example" },
  },
  decisionMakerHypothesis: {
    buying_committee: { primary_targets: [{ role: "Operations Director", confidence: 0.88, reason: "ICP" }] },
  },
  contactResearch: {
    contact_candidates: [
      {
        full_name: "Maria Chen",
        job_title: "Operations Director",
        email: "maria.chen@precisionbiomed.example",
        email_confidence: 1,
        source_evidence: [{ claim: "Listed on team page", evidence: "Maria Chen", source: "website_text" }],
      },
    ],
  },
  verificationTriage: { disposition: "validated", verification_confidence: 0.9, human_review_required: false },
  accountBrief: {
    company_summary: "Precision Biomedical Services — biomedical field service.",
    why_this_account: "ICP fit.",
    fit_summary: "Strong segment match.",
    pain_points: [],
    growth_signals: [],
    buying_signals: [],
    technology_summary: "None evidenced.",
    buying_committee_summary: "Operations Director primary.",
    verified_contacts_summary: "One validated email.",
    risk_summary: "Low risk.",
    competitive_context: [],
    recommended_angle: "Dispatch efficiency angle.",
    recommended_value_props: ["Dispatch coordination"],
    recommended_cta: "Validate dispatch pain on discovery call.",
    research_confidence: 0.82,
    brief_completeness: 78,
    human_review_required: false,
    evidence_summary: "Solid evidence.",
    source_attribution: [
      {
        source: "company_discovery",
        section: "company_summary",
        signal: "company_profile",
        evidence: "Precision Biomedical Services biomedical field service",
        confidence: 0.9,
      },
    ],
  },
})
assert.match(userPrompt, /Precision Biomedical Services/)
assert.match(userPrompt, /Account Brief Output/)
assert.match(userPrompt, /Return JSON only/)

const templatePrompt = buildGrowthLeadEngineOutreachPersonalizationTemplateUserPrompt()
assert.ok(
  templatePrompt.includes(
    GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_TEMPLATE_PLACEHOLDERS.account_brief_json,
  ),
)

const attribution = [
  {
    source: "account_brief",
    section: "personalization_summary",
    signal: "company_summary",
    evidence: "Precision Biomedical Services biomedical field service",
    confidence: 0.88,
  },
  {
    source: "contact_research",
    section: "contact_context",
    signal: "verified_contact",
    evidence: "Maria Chen Operations Director email on team page",
    confidence: 0.9,
  },
]

const validPersonalization = {
  personalization_summary:
    "Personalize around evidenced dispatch coordination pain and validated Operations Director contact.",
  contact_context: "Maria Chen — Operations Director with validated email per verification triage.",
  company_context: "Precision Biomedical Services biomedical field service per account brief.",
  recommended_talking_points: [
    {
      claim: "Multi-site dispatch coordination mentioned on website",
      evidence: "Website references multi-site dispatch coordination",
      source: "account_brief",
      confidence: 0.75,
    },
  ],
  recommended_problem_alignment: [
    {
      claim: "Dispatch workflow complexity",
      evidence: "Account brief pain point with website evidence",
      source: "account_brief",
      confidence: 0.72,
    },
  ],
  recommended_business_outcomes: [
    "Improve dispatch coordination for multi-site biomedical teams",
    "Increase technician utilization visibility",
  ],
  recommended_social_proof_types: ["INDUSTRY_PEER", "USE_CASE_MATCH"],
  recommended_case_study_types: ["DISPATCH_OPTIMIZATION", "FIELD_SERVICE_EFFICIENCY"],
  recommended_objection_categories: [
    {
      claim: "PROOF_REQUEST",
      evidence: "Limited competitive context in account brief",
      source: "account_brief",
      confidence: 0.55,
    },
  ],
  recommended_cta_strategy: "PAIN_VALIDATION — confirm dispatch pain before channel outreach.",
  urgency_signals: [],
  timing_signals: [
    {
      claim: "Careers page hiring field technicians",
      evidence: "Account brief growth signal from careers page",
      source: "account_brief",
      confidence: 0.65,
    },
  ],
  recommended_channel_priority: ["EMAIL", "PHONE"],
  recommended_sequence_priority: "EMAIL_BEFORE_PHONE",
  personalization_confidence: 0.8,
  personalization_completeness: 76,
  human_review_required: false,
  evidence_summary: "Strong contact and company evidence; no fabricated urgency.",
  source_attribution: attribution,
}

const parsed = parseGrowthLeadEngineOutreachPersonalizationOutput(JSON.stringify(validPersonalization))
assert.equal(parsed.ok, true)
if (parsed.ok) {
  assert.equal(parsed.output.recommended_talking_points.length, 1)
  assert.equal(parsed.output.recommended_social_proof_types.length, 2)
  assert.deepEqual(parsed.output.recommended_channel_priority, ["EMAIL", "PHONE"])
  assert.equal(parsed.output.recommended_sequence_priority, "EMAIL_BEFORE_PHONE")
  assert.ok(parsed.output.personalization_confidence > 0)
}

const upstreamReject = parseGrowthLeadEngineOutreachPersonalizationFromUpstream(
  JSON.stringify({ ...validPersonalization, personalization_confidence: 0.9 }),
  {
    verificationTriage: { disposition: "reject", human_review_required: true } as never,
    accountBrief: { human_review_required: true } as never,
  },
)
assert.equal(upstreamReject.ok, true)
if (upstreamReject.ok) {
  assert.equal(upstreamReject.output.human_review_required, true)
  assert.ok(upstreamReject.output.personalization_confidence <= 0.49)
}

const noAttribution = parseGrowthLeadEngineOutreachPersonalizationOutput(
  JSON.stringify({ ...validPersonalization, source_attribution: [] }),
)
assert.equal(noAttribution.ok, false)

const fabricatedTalkingPoint = parseGrowthLeadEngineOutreachPersonalizationOutput(
  JSON.stringify({
    ...validPersonalization,
    recommended_talking_points: [
      {
        claim: "ERP migration crisis",
        evidence: "Assumed from market",
        source: "guess",
        confidence: 0.95,
      },
    ],
  }),
)
assert.equal(fabricatedTalkingPoint.ok, true)
if (fabricatedTalkingPoint.ok) {
  assert.equal(fabricatedTalkingPoint.output.recommended_talking_points.length, 0)
}

const emailCopy = parseGrowthLeadEngineOutreachPersonalizationOutput(
  JSON.stringify({
    ...validPersonalization,
    recommended_cta_strategy:
      "Hi Maria, I wanted to reach out about your dispatch challenges. Best regards, Alex. Book a demo today!",
  }),
)
assert.equal(emailCopy.ok, true)
if (emailCopy.ok) {
  assert.match(emailCopy.output.recommended_cta_strategy, /DISCOVERY_VALIDATION/)
  assert.equal(emailCopy.output.human_review_required, true)
}

const fakeSocialProof = parseGrowthLeadEngineOutreachPersonalizationOutput(
  JSON.stringify({
    ...validPersonalization,
    recommended_social_proof_types: ["ACME_CUSTOMER_LOGO", "INDUSTRY_PEER"],
  }),
)
assert.equal(fakeSocialProof.ok, true)
if (fakeSocialProof.ok) {
  assert.deepEqual(fakeSocialProof.output.recommended_social_proof_types, ["INDUSTRY_PEER"])
}

const fabricatedUrgency = parseGrowthLeadEngineOutreachPersonalizationOutput(
  JSON.stringify({
    ...validPersonalization,
    urgency_signals: [
      {
        claim: "Urgent budget deadline this week",
        evidence: "Speculated timing pressure",
        source: "invented",
        confidence: 0.9,
      },
    ],
  }),
)
assert.equal(fabricatedUrgency.ok, true)
if (fabricatedUrgency.ok) {
  assert.equal(fabricatedUrgency.output.urgency_signals.length, 0)
}

const typesPath = path.join(process.cwd(), "lib/growth/lead-engine/outreach-personalization-types.ts")
const typesSource = fs.readFileSync(typesPath, "utf8")
assert.match(typesSource, /lead-engine-outreach-personalization-v1/)

console.log("outreach-personalization.test.ts: all checks passed")
