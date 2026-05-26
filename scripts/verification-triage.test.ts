/**
 * Regression checks for Lead Engine Verification Triage Engine (Prompt 5).
 * Run: pnpm test:growth-lead-engine-verification-triage
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthLeadEngineVerificationTriageSystemPrompt,
  buildGrowthLeadEngineVerificationTriageTemplateUserPrompt,
  buildGrowthLeadEngineVerificationTriageUserPrompt,
  GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_TEMPLATE_PLACEHOLDERS,
} from "../lib/growth/lead-engine/verification-triage-prompt"
import { parseGrowthLeadEngineVerificationTriageOutput } from "../lib/growth/lead-engine/verification-triage-parser"
import {
  GROWTH_LEAD_ENGINE_VERIFICATION_REASON_CODES,
  GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_QA_MARKER,
} from "../lib/growth/lead-engine/verification-triage-types"

assert.equal(GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_QA_MARKER, "lead-engine-verification-triage-v1")
assert.equal(GROWTH_LEAD_ENGINE_VERIFICATION_REASON_CODES.length, 16)
assert.equal(GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_OUTPUT_JSON_KEYS.length, 12)

const systemPrompt = buildGrowthLeadEngineVerificationTriageSystemPrompt()
assert.match(systemPrompt, /Do NOT invent verification/)
assert.match(systemPrompt, /Do NOT fabricate email validation/)
assert.match(systemPrompt, /validated/)
assert.match(systemPrompt, /verification_source_attribution/)
assert.match(systemPrompt, /EMAIL_CONFIRMED/)
assert.match(systemPrompt, /duplicate_detection_readiness/)

const userPrompt = buildGrowthLeadEngineVerificationTriageUserPrompt({
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
})
assert.match(userPrompt, /Precision Biomedical Services/)
assert.match(userPrompt, /Contact Research Output/)
assert.match(userPrompt, /Return JSON only/)

const templatePrompt = buildGrowthLeadEngineVerificationTriageTemplateUserPrompt()
assert.ok(templatePrompt.includes(GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_TEMPLATE_PLACEHOLDERS.contact_research_json))

const baseAttribution = [
  {
    source: "contact_research",
    channel: "email",
    signal: "email_listed",
    evidence: "maria.chen@precisionbiomed.example on team page",
    confidence: 0.95,
  },
  {
    source: "company_discovery",
    channel: "company",
    signal: "company_match",
    evidence: "Precision Biomedical Services domain precisionbiomed.example",
    confidence: 0.9,
  },
]

const channelTemplate = {
  status: "confirmed",
  confidence: 0.95,
  reason_codes: [] as string[],
  evidence: "Explicit listing in contact research",
  sources: ["contact_research"],
}

const validJson = JSON.stringify({
  disposition: "validated",
  verification_confidence: 0.91,
  verification_reason_codes: ["EMAIL_CONFIRMED", "PHONE_UNVERIFIED"],
  email_verification_signals: {
    ...channelTemplate,
    reason_codes: ["EMAIL_CONFIRMED"],
  },
  phone_verification_signals: {
    status: "unverified",
    confidence: 0,
    reason_codes: ["PHONE_UNVERIFIED"],
    evidence: "",
    sources: [],
  },
  linkedin_verification_signals: {
    status: "not_found",
    confidence: 0,
    reason_codes: [],
    evidence: "",
    sources: [],
  },
  contact_completeness: 72,
  risk_score: 28,
  duplicate_detection_readiness: {
    ready: true,
    reason: "Hash inputs available for future dedupe engine.",
    missing_inputs: [],
  },
  duplicate_hash_inputs: {
    company_name: "precision biomedical services",
    domain: "precisionbiomed.example",
    contact_email: "maria.chen@precisionbiomed.example",
    contact_phone: "",
    full_name: "maria chen",
    normalized_key: "precisionbiomed.example|maria.chen@precisionbiomed.example",
  },
  verification_source_attribution: baseAttribution,
  human_review_required: false,
})

const parsed = parseGrowthLeadEngineVerificationTriageOutput(validJson)
assert.equal(parsed.ok, true)
if (parsed.ok) {
  assert.equal(parsed.output.disposition, "validated")
  assert.equal(parsed.output.verification_confidence, 0.91)
  assert.ok(parsed.output.verification_reason_codes.includes("EMAIL_CONFIRMED"))
  assert.equal(parsed.output.verification_source_attribution.length, 2)
}

const downgradeValidated = parseGrowthLeadEngineVerificationTriageOutput(
  JSON.stringify({
    ...JSON.parse(validJson),
    verification_confidence: 0.8,
  }),
)
assert.equal(downgradeValidated.ok, true)
if (downgradeValidated.ok) {
  assert.equal(downgradeValidated.output.disposition, "risky")
  assert.ok(downgradeValidated.output.verification_reason_codes.includes("LOW_EVIDENCE"))
  assert.equal(downgradeValidated.output.human_review_required, true)
}

const rejectMismatch = parseGrowthLeadEngineVerificationTriageOutput(
  JSON.stringify({
    ...JSON.parse(validJson),
    disposition: "validated",
    verification_confidence: 0.92,
    verification_reason_codes: ["EMAIL_CONFIRMED", "COMPANY_MISMATCH"],
  }),
)
assert.equal(rejectMismatch.ok, true)
if (rejectMismatch.ok) {
  assert.equal(rejectMismatch.output.disposition, "reject")
}

const stripsFakeEmailConfirm = parseGrowthLeadEngineVerificationTriageOutput(
  JSON.stringify({
    ...JSON.parse(validJson),
    verification_reason_codes: ["EMAIL_CONFIRMED"],
    email_verification_signals: {
      status: "unverified",
      confidence: 0,
      reason_codes: [],
      evidence: "",
      sources: [],
    },
    verification_source_attribution: [
      {
        source: "contact_research",
        channel: "company",
        signal: "company_only",
        evidence: "Company page only",
        confidence: 0.5,
      },
    ],
  }),
)
assert.equal(stripsFakeEmailConfirm.ok, true)
if (stripsFakeEmailConfirm.ok) {
  assert.ok(!stripsFakeEmailConfirm.output.verification_reason_codes.includes("EMAIL_CONFIRMED"))
}

const rejectsNoAttribution = parseGrowthLeadEngineVerificationTriageOutput(
  JSON.stringify({
    ...JSON.parse(validJson),
    verification_source_attribution: [],
  }),
)
assert.equal(rejectsNoAttribution.ok, false)

const rejectsHallucinatedCode = parseGrowthLeadEngineVerificationTriageOutput(
  JSON.stringify({
    ...JSON.parse(validJson),
    verification_reason_codes: ["EMAIL_CONFIRMED", "TOTALLY_FAKE_CODE"],
  }),
)
assert.equal(rejectsHallucinatedCode.ok, true)
if (rejectsHallucinatedCode.ok) {
  assert.ok(!rejectsHallucinatedCode.output.verification_reason_codes.includes("TOTALLY_FAKE_CODE" as never))
}

const parserFile = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/lead-engine/verification-triage-parser.ts"),
  "utf8",
)
assert.match(parserFile, /enforceDisposition/)
assert.match(parserFile, /stripUnsupportedPositiveCodes/)
assert.match(parserFile, /verification_confidence < 0.85/)

const promptFile = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/lead-engine/verification-triage-prompt.ts"),
  "utf8",
)
assert.match(promptFile, /Verification Triage Engine/)

console.log("growth-lead-engine-verification-triage-v1 checks passed")
