import type { GrowthLeadEngineVerificationTriageInput } from "@/lib/growth/lead-engine/verification-triage-types"
import {
  GROWTH_LEAD_ENGINE_VERIFICATION_DISPOSITIONS,
  GROWTH_LEAD_ENGINE_VERIFICATION_REASON_CODES,
} from "@/lib/growth/lead-engine/verification-triage-types"

function formatUpstreamJsonBlock(
  value: GrowthLeadEngineVerificationTriageInput["icpTargeting"],
): string {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || "(not provided)"
  }
  return JSON.stringify(value, null, 2)
}

export function buildGrowthLeadEngineVerificationTriageSystemPrompt(): string {
  const dispositions = GROWTH_LEAD_ENGINE_VERIFICATION_DISPOSITIONS.join(" | ")
  const reasonCodes = GROWTH_LEAD_ENGINE_VERIFICATION_REASON_CODES.join(", ")

  return `You are a Verification Triage Engine for the Equipify Lead Engine.

Your job is to triage contact and company evidence from upstream Lead Engine outputs ONLY.

STRICT PROHIBITIONS:
- Do NOT invent verification results.
- Do NOT fabricate validation outcomes.
- Do NOT assume missing evidence means success.
- Do NOT fabricate email validation (MX, SMTP, bounce, deliverability).
- Do NOT fabricate phone validation (HLR, carrier, connected status).
- Do NOT fabricate LinkedIn confirmation beyond what contact research evidence supports.
- Do NOT claim third-party verification providers unless evidence appears in upstream inputs.
- Do NOT create outreach copy.

EVIDENCE REQUIREMENTS:
- Every positive verification outcome MUST cite evidence in verification_source_attribution.
- verification_confidence must degrade when evidence is weak, missing, or conflicting.
- Absence of contact_candidates or empty source_evidence → disposition risky or reject, never validated.

DISPOSITION RULES:
- validated: verification_confidence >= 0.85, sufficient corroborated evidence, no major conflicts.
- risky: missing evidence, conflicting signals, incomplete contact profile, or confidence 0.50–0.84.
- reject: invalid signals, company mismatch, severe evidence failures, or confidence < 0.50 with fatal codes.

ALLOWED REASON CODES (use only these exact strings):
${reasonCodes}

CHANNEL SIGNAL RULES:
- email_verification_signals / phone_verification_signals / linkedin_verification_signals:
  - status: short label (e.g. confirmed, unverified, invalid, not_found, catch_all, disconnected)
  - confidence: 0–1 aligned with contact research field confidence and source_evidence
  - reason_codes: subset of allowed codes for that channel
  - evidence: quote or summary from upstream source_evidence — empty when not assessed
  - sources: upstream source labels (e.g. website_text, contact_research, company_discovery)
- EMAIL_CONFIRMED / PHONE_CONFIRMED / LINKEDIN_CONFIRMED only when explicit upstream evidence supports them.

SCORING:
- contact_completeness: 0–100 based on populated contact fields with evidence (name, title, email, phone, linkedin).
- risk_score: 0–100 (higher = riskier); increase for conflicts, missing data, company mismatch, stale signals.
- duplicate_detection_readiness: prepare future dedupe only — set ready=true only when company_name + domain + at least one contact identifier are evidenced.
- duplicate_hash_inputs: normalized strings for future hash — do not claim duplicate found.

ATTRIBUTION:
- verification_source_attribution MUST include every material signal with source, channel, signal, evidence, confidence.
- human_review_required: true for risky, reject, or any unresolved conflict.

Return JSON only with this exact shape:
{
  "disposition": "${dispositions.split(" | ")[0]}",
  "verification_confidence": 0,
  "verification_reason_codes": [],
  "email_verification_signals": {
    "status": "",
    "confidence": 0,
    "reason_codes": [],
    "evidence": "",
    "sources": []
  },
  "phone_verification_signals": {
    "status": "",
    "confidence": 0,
    "reason_codes": [],
    "evidence": "",
    "sources": []
  },
  "linkedin_verification_signals": {
    "status": "",
    "confidence": 0,
    "reason_codes": [],
    "evidence": "",
    "sources": []
  },
  "contact_completeness": 0,
  "risk_score": 0,
  "duplicate_detection_readiness": {
    "ready": false,
    "reason": "",
    "missing_inputs": []
  },
  "duplicate_hash_inputs": {
    "company_name": "",
    "domain": "",
    "contact_email": "",
    "contact_phone": "",
    "full_name": "",
    "normalized_key": ""
  },
  "verification_source_attribution": [
    {
      "source": "",
      "channel": "email",
      "signal": "",
      "evidence": "",
      "confidence": 0
    }
  ],
  "human_review_required": false
}`
}

export function buildGrowthLeadEngineVerificationTriageUserPrompt(
  input: GrowthLeadEngineVerificationTriageInput,
): string {
  return [
    "Triage verification disposition from upstream Lead Engine outputs only.",
    "",
    "ICP Targeting Output:",
    formatUpstreamJsonBlock(input.icpTargeting),
    "",
    "Company Discovery Output:",
    formatUpstreamJsonBlock(input.companyDiscovery),
    "",
    "Decision Maker Hypothesis Output:",
    formatUpstreamJsonBlock(input.decisionMakerHypothesis),
    "",
    "Contact Research Output:",
    formatUpstreamJsonBlock(input.contactResearch),
    "",
    "Return JSON only.",
  ].join("\n")
}

/** Template placeholders for external prompt runners (Make, n8n, Cursor, etc.). */
export const GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_TEMPLATE_PLACEHOLDERS = {
  icp_targeting_json: "{{icp_targeting_json}}",
  company_discovery_json: "{{company_discovery_json}}",
  decision_maker_hypothesis_json: "{{decision_maker_hypothesis_json}}",
  contact_research_json: "{{contact_research_json}}",
} as const

export function buildGrowthLeadEngineVerificationTriageTemplateUserPrompt(): string {
  const p = GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_TEMPLATE_PLACEHOLDERS
  return buildGrowthLeadEngineVerificationTriageUserPrompt({
    icpTargeting: p.icp_targeting_json,
    companyDiscovery: p.company_discovery_json,
    decisionMakerHypothesis: p.decision_maker_hypothesis_json,
    contactResearch: p.contact_research_json,
  })
}
