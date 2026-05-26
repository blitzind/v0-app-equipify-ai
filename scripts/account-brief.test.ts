/**
 * Regression checks for Lead Engine Account Brief Engine (Prompt 6).
 * Run: pnpm test:growth-lead-engine-account-brief
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthLeadEngineAccountBriefSystemPrompt,
  buildGrowthLeadEngineAccountBriefTemplateUserPrompt,
  buildGrowthLeadEngineAccountBriefUserPrompt,
  GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_TEMPLATE_PLACEHOLDERS,
} from "../lib/growth/lead-engine/account-brief-prompt"
import {
  parseGrowthLeadEngineAccountBriefFromUpstream,
  parseGrowthLeadEngineAccountBriefOutput,
} from "../lib/growth/lead-engine/account-brief-parser"
import {
  GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_QA_MARKER,
} from "../lib/growth/lead-engine/account-brief-types"

assert.equal(GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_QA_MARKER, "lead-engine-account-brief-v1")
assert.equal(GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_OUTPUT_JSON_KEYS.length, 19)

const systemPrompt = buildGrowthLeadEngineAccountBriefSystemPrompt()
assert.match(systemPrompt, /Do NOT fabricate company facts/)
assert.match(systemPrompt, /Do NOT fabricate pain points/)
assert.match(systemPrompt, /Do NOT create outreach copy/)
assert.match(systemPrompt, /source_attribution/)
assert.match(systemPrompt, /competitive_context/)

const userPrompt = buildGrowthLeadEngineAccountBriefUserPrompt({
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
  verificationTriage: {
    disposition: "validated",
    verification_confidence: 0.9,
    verification_reason_codes: ["EMAIL_CONFIRMED"],
    email_verification_signals: {
      status: "confirmed",
      confidence: 0.9,
      reason_codes: ["EMAIL_CONFIRMED"],
      evidence: "team page email",
      sources: ["website_text"],
    },
    phone_verification_signals: {
      status: "unverified",
      confidence: 0,
      reason_codes: [],
      evidence: "",
      sources: [],
    },
    linkedin_verification_signals: {
      status: "unverified",
      confidence: 0,
      reason_codes: [],
      evidence: "",
      sources: [],
    },
    contact_completeness: 0.8,
    risk_score: 10,
    duplicate_detection_readiness: { ready: true, reason: "ok", missing_inputs: [] },
    duplicate_hash_inputs: {
      company_name: "Precision Biomedical Services",
      domain: "precisionbiomed.example",
      contact_email: "maria.chen@precisionbiomed.example",
      contact_phone: "",
      full_name: "Maria Chen",
      normalized_key: "precision|maria",
    },
    verification_source_attribution: [
      {
        source: "contact_research",
        channel: "email",
        signal: "email_listed",
        evidence: "maria.chen@precisionbiomed.example on team page",
        confidence: 0.9,
      },
    ],
    human_review_required: false,
  },
})
assert.match(userPrompt, /Precision Biomedical Services/)
assert.match(userPrompt, /Verification Triage Output/)
assert.match(userPrompt, /Return JSON only/)

const templatePrompt = buildGrowthLeadEngineAccountBriefTemplateUserPrompt()
assert.ok(templatePrompt.includes(GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_TEMPLATE_PLACEHOLDERS.verification_triage_json))

const attribution = [
  {
    source: "company_discovery",
    section: "company_summary",
    signal: "company_profile",
    evidence: "Precision Biomedical Services — biomedical field service",
    confidence: 0.9,
  },
  {
    source: "icp_targeting",
    section: "fit_summary",
    signal: "icp_match",
    evidence: "Biomedical service ICP segment match",
    confidence: 0.85,
  },
]

const validBrief = {
  company_summary:
    "Precision Biomedical Services is a biomedical field service company per company discovery.",
  why_this_account: "Matches biomedical service ICP with strong company profile evidence.",
  fit_summary: "ICP segment fit with operational service profile.",
  pain_points: [
    {
      claim: "Dispatch coordination complexity",
      evidence: "Website mentions multi-site dispatch coordination",
      source: "company_discovery",
      confidence: 0.72,
    },
  ],
  growth_signals: [
    {
      claim: "Hiring field technicians",
      evidence: "Careers page lists field technician openings",
      source: "company_discovery",
      confidence: 0.68,
    },
  ],
  buying_signals: [
    {
      claim: "Operations leadership contact verified",
      evidence: "Maria Chen Operations Director email on team page",
      source: "contact_research",
      confidence: 0.88,
    },
  ],
  technology_summary: "No additional technologies evidenced beyond company discovery profile.",
  buying_committee_summary: "Operations Director primary target per decision maker hypothesis.",
  verified_contacts_summary: "One validated email contact with team page evidence.",
  risk_summary: "Low risk; email confirmed via verification triage.",
  competitive_context: [],
  recommended_angle: "Lead with dispatch workflow efficiency aligned to biomedical service ICP.",
  recommended_value_props: [
    "Reduce dispatch coordination overhead for multi-site biomedical teams",
    "Improve technician utilization visibility",
  ],
  recommended_cta: "Confirm dispatch pain and technician scheduling gaps on next discovery call.",
  research_confidence: 0.82,
  brief_completeness: 78,
  human_review_required: false,
  evidence_summary: "Strong company and contact evidence; limited competitive signals.",
  source_attribution: attribution,
}

const parsed = parseGrowthLeadEngineAccountBriefOutput(JSON.stringify(validBrief))
assert.equal(parsed.ok, true)
if (parsed.ok) {
  assert.equal(parsed.output.pain_points.length, 1)
  assert.equal(parsed.output.growth_signals.length, 1)
  assert.equal(parsed.output.competitive_context.length, 0)
  assert.ok(parsed.output.research_confidence > 0)
  assert.ok(parsed.output.brief_completeness >= 60)
}

const rejectDisposition = parseGrowthLeadEngineAccountBriefFromUpstream(
  JSON.stringify({ ...validBrief, human_review_required: false, research_confidence: 0.9 }),
  {
    disposition: "reject",
    verification_confidence: 0.3,
    verification_reason_codes: ["COMPANY_MISMATCH"],
    email_verification_signals: {
      status: "invalid",
      confidence: 0.2,
      reason_codes: ["COMPANY_MISMATCH"],
      evidence: "domain mismatch",
      sources: [],
    },
    phone_verification_signals: {
      status: "unverified",
      confidence: 0,
      reason_codes: [],
      evidence: "",
      sources: [],
    },
    linkedin_verification_signals: {
      status: "unverified",
      confidence: 0,
      reason_codes: [],
      evidence: "",
      sources: [],
    },
    contact_completeness: 0.2,
    risk_score: 90,
    duplicate_detection_readiness: { ready: false, reason: "mismatch", missing_inputs: ["domain"] },
    duplicate_hash_inputs: {
      company_name: "Precision Biomedical Services",
      domain: "wrong.example",
      contact_email: "",
      contact_phone: "",
      full_name: "",
      normalized_key: "wrong",
    },
    verification_source_attribution: [],
    human_review_required: true,
  },
)
assert.equal(rejectDisposition.ok, true)
if (rejectDisposition.ok) {
  assert.equal(rejectDisposition.output.human_review_required, true)
  assert.ok(rejectDisposition.output.research_confidence <= 0.49)
}

const noAttribution = parseGrowthLeadEngineAccountBriefOutput(
  JSON.stringify({ ...validBrief, source_attribution: [] }),
)
assert.equal(noAttribution.ok, false)

const fabricatedPain = parseGrowthLeadEngineAccountBriefOutput(
  JSON.stringify({
    ...validBrief,
    pain_points: [
      {
        claim: "ERP migration failure",
        evidence: "",
        source: "guess",
        confidence: 0.9,
      },
    ],
  }),
)
assert.equal(fabricatedPain.ok, true)
if (fabricatedPain.ok) {
  assert.equal(fabricatedPain.output.pain_points.length, 0)
}

const outreachCta = parseGrowthLeadEngineAccountBriefOutput(
  JSON.stringify({
    ...validBrief,
    recommended_cta: "Hi Maria, I wanted to reach out about your dispatch challenges. Book a demo today!",
  }),
)
assert.equal(outreachCta.ok, true)
if (outreachCta.ok) {
  assert.match(outreachCta.output.recommended_cta, /Review upstream evidence/)
  assert.equal(outreachCta.output.human_review_required, true)
}

const hallucinatedCompetitor = parseGrowthLeadEngineAccountBriefOutput(
  JSON.stringify({
    ...validBrief,
    competitive_context: [
      {
        claim: "Competes with AcmeFakeCorp",
        evidence: "Assumed market overlap",
        source: "invented",
        confidence: 0.95,
      },
    ],
  }),
)
assert.equal(hallucinatedCompetitor.ok, true)
if (hallucinatedCompetitor.ok) {
  assert.equal(hallucinatedCompetitor.output.competitive_context.length, 0)
}

const typesPath = path.join(process.cwd(), "lib/growth/lead-engine/account-brief-types.ts")
const typesSource = fs.readFileSync(typesPath, "utf8")
assert.match(typesSource, /lead-engine-account-brief-v1/)

console.log("account-brief.test.ts: all checks passed")
