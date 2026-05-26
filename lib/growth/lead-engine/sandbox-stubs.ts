/**
 * Deterministic fixture JSON for Lead Engine sandbox dry-run (no LLM providers).
 */
import type { GrowthLeadEngineSandboxInput } from "@/lib/growth/lead-engine/workspace-types"
import type { GrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-types"
import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-types"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import type { GrowthLeadEngineHumanApprovalOutput } from "@/lib/growth/lead-engine/human-approval-types"
import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"
import type { GrowthLeadEngineLeadScoreOutput } from "@/lib/growth/lead-engine/lead-score-types"
import type { GrowthLeadEngineOutreachPersonalizationOutput } from "@/lib/growth/lead-engine/outreach-personalization-types"
import type { GrowthLeadEngineRevenueExecutionOutput } from "@/lib/growth/lead-engine/revenue-execution-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"

function domainFromInput(input: GrowthLeadEngineSandboxInput): string {
  const raw = input.domain.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "")
  return raw || "example.com"
}

export function buildSandboxIcpTargetingStub(input: GrowthLeadEngineSandboxInput): string {
  const industry = input.industry.trim() || "General B2B services"
  const geo = input.location.trim() || "United States"
  const notes = input.notes.trim()
  const payload = {
    icp_summary: `Sandbox ICP for ${industry} in ${geo}. ${notes || "Operator-provided context."}`,
    qualification_rules: {
      must_have: [`Industry aligns with ${industry}`, "Evidence-backed company profile"],
      nice_to_have: ["Multi-site operations", "Field service motion"],
      disqualifiers: ["No verifiable domain", "Consumer-only business"],
    },
    firmographic_filters: {
      industries: [industry],
      employee_ranges: ["11-50", "51-200"],
      revenue_ranges: ["$1M-$10M", "$10M-$50M"],
      geographies: [geo],
      business_models: ["B2B services"],
    },
    technology_filters: { required: [], preferred: [], excluded: [] },
    target_roles: {
      primary: ["Operations Director", "Owner", "General Manager"],
      secondary: ["Office Manager", "Service Manager"],
      avoid: ["Intern", "Student"],
    },
    pain_point_patterns: ["dispatch coordination", "technician utilization"],
    buying_trigger_patterns: ["hiring field staff", "service expansion"],
    search_patterns: [
      `${industry} companies ${geo}`,
      `${industry} field service providers`,
      `${industry} commercial services directory`,
    ],
    negative_search_patterns: ["retail only", "franchise consumer"],
    fit_scoring_weights: {
      industry_fit: 25,
      company_size: 15,
      technology_fit: 10,
      pain_alignment: 20,
      buying_signal_strength: 15,
      title_match: 15,
    },
    confidence_rules: {
      high_fit: "Strong industry and role alignment with evidence.",
      medium_fit: "Partial alignment; more discovery required.",
      low_fit: "Weak or missing evidence for ICP match.",
    },
  }
  return JSON.stringify(payload, null, 2)
}

export function buildSandboxCompanyDiscoveryStub(
  input: GrowthLeadEngineSandboxInput,
  icp: GrowthLeadEngineIcpTargetingOutput,
): string {
  const domain = domainFromInput(input)
  const companyName = input.companyName.trim() || "Sandbox Company"
  const industry = input.industry.trim() || "B2B services"
  const location = input.location.trim() || "United States"
  const payload = {
    company_profile: {
      company_name: companyName,
      domain,
      industry,
      sub_industry: industry,
      business_model: "B2B services",
      service_area: [location],
      headquarters: location,
      employee_estimate: null,
      revenue_estimate: null,
      phone: "",
      address: "",
      social_links: [],
    },
    fit_assessment: {
      fit_score: 78,
      fit_tier: "high",
      confidence: 0.82,
      matched_icp_rules: icp.qualification_rules.must_have.slice(0, 2),
      missing_evidence: ["Revenue estimate not evidenced"],
      disqualifiers: [],
    },
    signals: {
      positive_fit_signals: [`${companyName} matches ${industry} ICP`],
      negative_fit_signals: [],
      pain_signals: input.notes ? [input.notes.slice(0, 120)] : [],
      buying_triggers: ["Website lists commercial services"],
      technology_signals: [],
      growth_signals: [],
    },
    recommended_next_step: {
      action: "decision_maker_hypothesis",
      reason: "Company profile evidenced; proceed to committee hypothesis.",
    },
    source_evidence: [
      {
        claim: "Company name and domain",
        evidence: `${companyName} — ${domain}`,
        source: "sandbox_input",
      },
    ],
  }
  return JSON.stringify(payload, null, 2)
}

export function buildSandboxDecisionMakerStub(
  company: GrowthLeadEngineCompanyDiscoveryOutput,
): string {
  const payload = {
    recommended_targeting_strategy: {
      primary_motion: "operations_led",
      reason: "ICP primary roles emphasize operations leadership.",
    },
    buying_committee: {
      primary_targets: [
        { role: "Operations Director", confidence: 0.88, reason: "ICP primary target role" },
        { role: "Owner", confidence: 0.75, reason: "Common decision authority in SMB services" },
      ],
      secondary_targets: [
        { role: "Service Manager", confidence: 0.62, reason: "Influencer on field workflows" },
      ],
      avoid_roles: [{ role: "Intern", reason: "No buying authority" }],
    },
    role_patterns: {
      owner_patterns: ["Owner", "President"],
      operations_patterns: ["Operations Director", "Ops Manager"],
      service_patterns: ["Service Manager", "Field Supervisor"],
      executive_patterns: ["CEO", "Managing Director"],
      procurement_patterns: ["Procurement", "Purchasing"],
      technical_patterns: ["IT Manager", "Systems Admin"],
    },
    committee_completeness: {
      recommended_contacts: 3,
      minimum_contacts: 2,
      critical_missing_roles: [],
    },
    escalation_path: ["Owner", "Operations Director"],
    engagement_priority: ["Operations Director", "Owner"],
    confidence_assessment: { score: 80, reasoning: ["Role hypotheses align to ICP and company profile"] },
  }
  void company
  return JSON.stringify(payload, null, 2)
}

export function buildSandboxContactResearchStub(
  input: GrowthLeadEngineSandboxInput,
  company: GrowthLeadEngineCompanyDiscoveryOutput,
): string {
  const domain = company.company_profile.domain || domainFromInput(input)
  const email = `ops@${domain}`
  const payload = {
    contact_candidates: [
      {
        full_name: "Alex Operations",
        job_title: "Operations Director",
        department: "Operations",
        role_match_type: "primary",
        email,
        email_confidence: 1,
        phone: "",
        phone_confidence: 0,
        linkedin_url: "",
        source_evidence: [
          {
            claim: "Team page listing",
            evidence: `Alex Operations listed as Operations Director; email ${email} on company website`,
            source: "website_text",
          },
        ],
        confidence: 0.85,
      },
    ],
    coverage: {
      primary_roles_found: ["Operations Director"],
      missing_roles: ["Owner"],
      committee_completion: 65,
    },
    research_quality: { score: 72, reasoning: ["One evidenced contact; owner role not found"] },
  }
  return JSON.stringify(payload, null, 2)
}

export function buildSandboxVerificationTriageStub(
  input: GrowthLeadEngineSandboxInput,
  contact: GrowthLeadEngineContactResearchOutput,
): string {
  const domain = domainFromInput(input)
  const email = contact.contact_candidates[0]?.email ?? `ops@${domain}`
  const payload = {
    disposition: "validated",
    verification_confidence: 0.88,
    verification_reason_codes: ["EMAIL_CONFIRMED"],
    email_verification_signals: {
      status: "confirmed",
      confidence: 0.88,
      reason_codes: ["EMAIL_CONFIRMED"],
      evidence: `${email} listed on website team page`,
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
    contact_completeness: 0.75,
    risk_score: 12,
    duplicate_detection_readiness: { ready: true, reason: "ok", missing_inputs: [] },
    duplicate_hash_inputs: {
      company_name: input.companyName.trim() || "Sandbox Company",
      domain,
      contact_email: email,
      contact_phone: "",
      full_name: "Alex Operations",
      normalized_key: `${domain}|sandbox`,
    },
    verification_source_attribution: [
      {
        source: "contact_research",
        channel: "email",
        signal: "email_listed",
        evidence: `${email} on team page`,
        confidence: 0.88,
      },
    ],
    human_review_required: false,
  }
  return JSON.stringify(payload, null, 2)
}

export function buildSandboxAccountBriefStub(
  input: GrowthLeadEngineSandboxInput,
  company: GrowthLeadEngineCompanyDiscoveryOutput,
): string {
  const companyName = company.company_profile.company_name || input.companyName
  const payload = {
    company_summary: `${companyName} is a ${company.company_profile.industry} company per sandbox discovery.`,
    why_this_account: "Sandbox ICP and company discovery indicate segment fit.",
    fit_summary: "High fit tier with evidenced company profile.",
    pain_points: [
      {
        claim: "Dispatch coordination",
        evidence: input.notes || "Operator notes reference operational coordination",
        source: "sandbox_input",
        confidence: 0.7,
      },
    ],
    growth_signals: [],
    buying_signals: [
      {
        claim: "Operations contact evidenced",
        evidence: "Contact research found Operations Director on website",
        source: "contact_research",
        confidence: 0.85,
      },
    ],
    technology_summary: "No additional technologies evidenced in sandbox mode.",
    buying_committee_summary: "Operations Director primary; Owner secondary hypothesis.",
    verified_contacts_summary: "One email contact with website evidence.",
    risk_summary: "Low verification risk in sandbox fixture.",
    competitive_context: [],
    recommended_angle: "Validate operational workflow pain aligned to ICP.",
    recommended_value_props: ["Improve dispatch coordination", "Technician utilization visibility"],
    recommended_cta: "Confirm dispatch pain on next discovery call.",
    research_confidence: 0.8,
    brief_completeness: 76,
    human_review_required: false,
    evidence_summary: "Sandbox fixture — evidence from operator input and discovery stubs.",
    source_attribution: [
      {
        source: "company_discovery",
        section: "company_summary",
        signal: "company_profile",
        evidence: `${companyName} company profile`,
        confidence: 0.85,
      },
      {
        source: "icp_targeting",
        section: "fit_summary",
        signal: "icp_match",
        evidence: "ICP segment alignment",
        confidence: 0.8,
      },
    ],
  }
  return JSON.stringify(payload, null, 2)
}

export function buildSandboxOutreachPersonalizationStub(
  brief: GrowthLeadEngineAccountBriefOutput,
): string {
  const payload = {
    personalization_summary: "Personalize around evidenced operational pain and validated contact.",
    contact_context: brief.verified_contacts_summary,
    company_context: brief.company_summary,
    recommended_talking_points: [
      {
        claim: "Dispatch coordination pain",
        evidence: brief.pain_points[0]?.evidence ?? "Account brief pain point",
        source: "account_brief",
        confidence: 0.72,
      },
    ],
    recommended_problem_alignment: [
      {
        claim: "Operational workflow alignment",
        evidence: brief.fit_summary,
        source: "account_brief",
        confidence: 0.7,
      },
    ],
    recommended_business_outcomes: brief.recommended_value_props,
    recommended_social_proof_types: ["INDUSTRY_PEER", "USE_CASE_MATCH"],
    recommended_case_study_types: ["DISPATCH_OPTIMIZATION"],
    recommended_objection_categories: [],
    recommended_cta_strategy: "PAIN_VALIDATION — confirm dispatch pain before any outreach.",
    urgency_signals: [],
    timing_signals: [],
    recommended_channel_priority: ["EMAIL", "PHONE"],
    recommended_sequence_priority: "EMAIL_BEFORE_PHONE",
    personalization_confidence: 0.78,
    personalization_completeness: 74,
    human_review_required: false,
    evidence_summary: "Sandbox personalization from account brief evidence.",
    source_attribution: [
      {
        source: "account_brief",
        section: "personalization_summary",
        signal: "company_summary",
        evidence: brief.company_summary,
        confidence: 0.8,
      },
      {
        source: "account_brief",
        section: "contact_context",
        signal: "verified_contacts",
        evidence: brief.verified_contacts_summary,
        confidence: 0.85,
      },
    ],
  }
  return JSON.stringify(payload, null, 2)
}

export function buildSandboxLeadScoreStub(): string {
  const payload = {
    lead_score: 87,
    lead_grade: "A",
    fit_score: 92,
    intent_score: 80,
    contactability_score: 88,
    verification_score: 90,
    account_quality_score: 86,
    personalization_score: 82,
    risk_score: 12,
    priority_level: "high",
    recommended_next_action: "approve_for_human_review",
    disqualification_reasons: [],
    score_breakdown: {
      components: [],
      raw_weighted_score: 87,
      risk_penalties: [],
      total_risk_penalty: 0,
      computed_lead_score: 87,
    },
    score_explanation: "Sandbox deterministic score from fixture components.",
    human_review_required: false,
    source_attribution: [
      {
        source: "account_brief",
        section: "fit_score",
        signal: "icp_fit",
        evidence: "High fit from discovery and brief",
        confidence: 0.88,
      },
      {
        source: "verification_triage",
        section: "verification_score",
        signal: "email_confirmed",
        evidence: "Validated email contact",
        confidence: 0.9,
      },
    ],
  }
  return JSON.stringify(payload, null, 2)
}

export function buildSandboxHumanApprovalStub(): string {
  const payload = {
    approval_status: "approved",
    approval_reason_codes: ["READY_FOR_HUMAN_APPROVAL", "LEAD_SCORE_STRONG"],
    approval_confidence: 0.86,
    approval_priority: "normal",
    human_review_required: true,
    required_review_areas: ["scoring"],
    recommended_human_actions: ["approve", "request_review"],
    approval_blockers: [],
    approval_summary: "Sandbox approval routing — human rep must execute; no autonomous outbound.",
    review_notes_required: false,
    escalation_required: false,
    escalation_reason: "",
    evidence_summary: "Approved for human reviewer per sandbox fixtures.",
    source_attribution: [
      {
        source: "lead_score",
        section: "approval_status",
        signal: "lead_score",
        evidence: "Lead score 87 with validated verification",
        confidence: 0.9,
      },
      {
        source: "human_approval",
        section: "approval_summary",
        signal: "policy",
        evidence: "Human execution required by policy",
        confidence: 1,
      },
    ],
  }
  return JSON.stringify(payload, null, 2)
}

export function buildSandboxRevenueExecutionStub(): string {
  const payload = {
    execution_status: "ready",
    execution_readiness: 85,
    execution_priority: "normal",
    recommended_execution_path: "call_sequence",
    recommended_channels: ["EMAIL", "PHONE"],
    recommended_sequence: "EMAIL_THEN_PHONE",
    recommended_sequence_steps: [
      {
        step_order: 1,
        channel: "EMAIL",
        action_category: "fit_validation",
        evidence: "Validated email from verification triage",
      },
      {
        step_order: 2,
        channel: "PHONE",
        action_category: "discovery_call",
        evidence: "Phone channel in personalization priority",
      },
    ],
    recommended_timing: "business_hours_local",
    recommended_owner_type: "account_executive",
    recommended_handoff: "assign_owner",
    recommended_followup_strategy: "Human rep executes sequence — no auto-send in sandbox.",
    recommended_touch_frequency: "immediate",
    execution_blockers: [],
    execution_dependencies: [],
    execution_confidence: 0.82,
    human_execution_required: true,
    evidence_summary: "Sandbox execution ready for human operator.",
    source_attribution: [
      {
        source: "human_approval",
        section: "execution_status",
        signal: "approval_approved",
        evidence: "Human approval status approved",
        confidence: 0.9,
      },
      {
        source: "lead_score",
        section: "execution_readiness",
        signal: "lead_score",
        evidence: "Lead score supports execution readiness",
        confidence: 0.85,
      },
    ],
  }
  return JSON.stringify(payload, null, 2)
}
