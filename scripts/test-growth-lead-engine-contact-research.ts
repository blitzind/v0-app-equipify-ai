/**
 * Regression checks for Lead Engine Contact Research Engine (Prompt 4).
 * Run: pnpm test:growth-lead-engine-contact-research
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthLeadEngineContactResearchSystemPrompt,
  buildGrowthLeadEngineContactResearchTemplateUserPrompt,
  buildGrowthLeadEngineContactResearchUserPrompt,
  GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_TEMPLATE_PLACEHOLDERS,
} from "../lib/growth/lead-engine/contact-research-prompt"
import { parseGrowthLeadEngineContactResearchOutput } from "../lib/growth/lead-engine/contact-research-parse"
import {
  GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_CONFIDENCE_TIERS,
  GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_QA_MARKER,
} from "../lib/growth/lead-engine/contact-research-types"

assert.equal(GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_QA_MARKER, "lead-engine-contact-research-v1")
assert.equal(GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_OUTPUT_JSON_KEYS.length, 3)
assert.equal(GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_CONFIDENCE_TIERS.direct, 1)

const systemPrompt = buildGrowthLeadEngineContactResearchSystemPrompt()
assert.match(systemPrompt, /Do NOT invent people/)
assert.match(systemPrompt, /Do NOT fabricate emails/)
assert.match(systemPrompt, /Do NOT fabricate phone numbers/)
assert.match(systemPrompt, /Do NOT hallucinate LinkedIn/)
assert.match(systemPrompt, /Do NOT infer or guess emails/)
assert.match(systemPrompt, /contact_candidates/)
assert.match(systemPrompt, /source_evidence/)
assert.match(systemPrompt, /committee_completion/)
assert.match(systemPrompt, /Apollo/)
assert.doesNotMatch(systemPrompt, /fabricate contacts when none exist/i)

const sampleHypothesis = {
  recommended_targeting_strategy: { primary_motion: "Ops-led", reason: "ICP fit" },
  buying_committee: {
    primary_targets: [{ role: "Operations Director", confidence: 0.88, reason: "ICP" }],
    secondary_targets: [],
    avoid_roles: [],
  },
  role_patterns: {
    owner_patterns: [],
    operations_patterns: ["Operations Director"],
    service_patterns: [],
    executive_patterns: [],
    procurement_patterns: [],
    technical_patterns: [],
  },
  committee_completeness: {
    recommended_contacts: 3,
    minimum_contacts: 2,
    critical_missing_roles: [],
  },
  escalation_path: ["Operations Director"],
  engagement_priority: ["Operations Director"],
  confidence_assessment: { score: 80, reasoning: ["ICP aligned"] },
}

const websiteText = `
Leadership Team
Maria Chen — Operations Director
Contact: maria.chen@precisionbiomed.example
Phone: (312) 555-0142
`

const userPrompt = buildGrowthLeadEngineContactResearchUserPrompt({
  icpTargeting: { icp_summary: "Biomedical service", target_roles: { primary: ["Operations Director"], secondary: [], avoid: [] } },
  companyDiscovery: {
    company_profile: { company_name: "Precision Biomedical Services", domain: "precisionbiomed.example" },
  },
  decisionMakerHypothesis: sampleHypothesis,
  domain: "precisionbiomed.example",
  websiteText,
  publicData: '{"page":"leadership"}',
})
assert.match(userPrompt, /precisionbiomed.example/)
assert.match(userPrompt, /Maria Chen/)
assert.match(userPrompt, /Return JSON only/)

const templatePrompt = buildGrowthLeadEngineContactResearchTemplateUserPrompt()
assert.ok(templatePrompt.includes(GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_TEMPLATE_PLACEHOLDERS.website_text))
assert.ok(
  templatePrompt.includes(
    GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_TEMPLATE_PLACEHOLDERS.decision_maker_hypothesis_json,
  ),
)

const validJson = JSON.stringify({
  contact_candidates: [
    {
      full_name: "Maria Chen",
      job_title: "Operations Director",
      department: "Operations",
      role_match_type: "primary",
      email: "maria.chen@precisionbiomed.example",
      email_confidence: 1,
      phone: "(312) 555-0142",
      phone_confidence: 1,
      linkedin_url: "",
      source_evidence: [
        {
          claim: "Operations Director named on leadership page",
          evidence: "Maria Chen — Operations Director",
          source: "website_text",
        },
        {
          claim: "Email listed for Maria Chen",
          evidence: "maria.chen@precisionbiomed.example",
          source: "website_text",
        },
        {
          claim: "Phone listed for Maria Chen",
          evidence: "Phone: (312) 555-0142",
          source: "website_text",
        },
      ],
      confidence: 1,
    },
  ],
  coverage: {
    primary_roles_found: ["Operations Director"],
    missing_roles: [],
    committee_completion: 100,
  },
  research_quality: {
    score: 85,
    reasoning: ["Direct leadership page evidence for primary target role"],
  },
})

const parsed = parseGrowthLeadEngineContactResearchOutput(validJson)
assert.equal(parsed.ok, true)
if (parsed.ok) {
  assert.equal(parsed.output.contact_candidates.length, 1)
  assert.equal(parsed.output.contact_candidates[0]!.confidence, 1)
  assert.equal(parsed.output.coverage.committee_completion, 100)
}

const emptyOk = parseGrowthLeadEngineContactResearchOutput(
  JSON.stringify({
    contact_candidates: [],
    coverage: { primary_roles_found: [], missing_roles: ["Operations Director"], committee_completion: 0 },
    research_quality: { score: 10, reasoning: ["No team page evidence"] },
  }),
)
assert.equal(emptyOk.ok, true)

const rejectsInvented = parseGrowthLeadEngineContactResearchOutput(
  JSON.stringify({
    contact_candidates: [
      {
        full_name: "Jane Doe",
        job_title: "CEO",
        department: "",
        role_match_type: "primary",
        email: "jane.doe@precisionbiomed.example",
        email_confidence: 0.9,
        phone: "",
        phone_confidence: 0,
        linkedin_url: "",
        source_evidence: [
          { claim: "CEO", evidence: "Jane Doe listed as CEO", source: "website_text" },
        ],
        confidence: 0.9,
      },
    ],
    coverage: { primary_roles_found: [], missing_roles: [], committee_completion: 0 },
    research_quality: { score: 0, reasoning: [] },
  }),
)
assert.equal(rejectsInvented.ok, false)

const rejectsNoEvidence = parseGrowthLeadEngineContactResearchOutput(
  JSON.stringify({
    ...JSON.parse(validJson),
    contact_candidates: [
      {
        ...JSON.parse(validJson).contact_candidates[0],
        source_evidence: [],
      },
    ],
  }),
)
assert.equal(rejectsNoEvidence.ok, false)

const promptFile = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/lead-engine/contact-research-prompt.ts"),
  "utf8",
)
assert.match(promptFile, /Contact Research Engine/)
assert.match(promptFile, /GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_TEMPLATE_PLACEHOLDERS/)

console.log("growth-lead-engine-contact-research-v1 checks passed")
