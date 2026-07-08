/** Pre-run stage previews — what each stage does before execution. Client-safe. */

import type { GrowthLeadEnginePipelineStageId } from "@/lib/growth/lead-engine/workspace-types"

export type LeadIntelligenceStageEmptyPreview = {
  purpose: string
  expectedOutputs: string[]
  whyItMatters: string
  executionTrigger: string
}

export const LEAD_INTELLIGENCE_STAGE_EMPTY_PREVIEWS: Record<
  GrowthLeadEnginePipelineStageId,
  LeadIntelligenceStageEmptyPreview
> = {
  icp_targeting: {
    purpose:
      "Evaluates how closely the account matches your ICP using industry, service footprint, operational complexity, and historical customer similarity.",
    expectedOutputs: [
      "ICP match rationale and qualification rules",
      "Target role patterns and pain-point hypotheses",
      "Fit scoring weights and confidence rules",
    ],
    whyItMatters: "Sets the targeting lens for every downstream stage — without inventing company facts.",
    executionTrigger: "Runs first when you execute the Lead Engine pipeline with account input.",
  },
  company_discovery: {
    purpose:
      "Builds an evidence-backed company profile from domain, website signals, and operator context — no fabricated enrichment.",
    expectedOutputs: [
      "Company summary, industry, and service area",
      "Fit tier and ICP alignment score",
      "Growth, pain, and technology signals with sources",
    ],
    whyItMatters: "Grounds outreach in verifiable account intelligence before contact research.",
    executionTrigger: "Runs after ICP targeting using your company name, domain, and notes.",
  },
  decision_maker_hypothesis: {
    purpose:
      "Infers likely buyer roles and committee structure from ICP rules and company profile — roles only, never invented names.",
    expectedOutputs: [
      "Primary and secondary buyer role hypotheses",
      "Economic vs operational influencer mapping",
      "Committee completeness and escalation path",
    ],
    whyItMatters: "Tells operators who to look for before contact discovery begins.",
    executionTrigger: "Runs after company discovery produces a fit assessment.",
  },
  contact_research: {
    purpose:
      "Surfaces contact candidates supported by website and public evidence — verification status included.",
    expectedOutputs: [
      "Discovered contacts with enrichment confidence",
      "Role coverage vs buying committee",
      "Duplicate and conflict warnings",
    ],
    whyItMatters: "Connects role hypotheses to reachable people without auto-outreach.",
    executionTrigger: "Runs after decision-maker hypothesis with domain and company context.",
  },
  verification_triage: {
    purpose:
      "Risk and trustworthiness evaluation — stale data, unverifiable contacts, duplicate risk, and outreach blockers.",
    expectedOutputs: [
      "Validation disposition and confidence penalties",
      "Channel verification signals (email, phone, LinkedIn)",
      "Blocked outreach reasons and review flags",
    ],
    whyItMatters: "Prevents low-trust outreach before messaging and scoring.",
    executionTrigger: "Runs after contact research produces candidates to validate.",
  },
  account_brief: {
    purpose:
      "Synthesizes upstream stages into a sales-ready account summary — pain points, angles, and timing indicators.",
    expectedOutputs: [
      "Executive account summary and operational overview",
      "Likely pain points and opportunity angles",
      "Messaging suggestions and recommended positioning",
    ],
    whyItMatters: "Gives operators a briefing before first contact — evidence-backed, not fabricated.",
    executionTrigger: "Runs after verification triage validates contact quality.",
  },
  outreach_personalization: {
    purpose:
      "Drafts email angles, openers, and pain-point hooks from the account brief — operator review required.",
    expectedOutputs: [
      "Email angle and opener suggestions",
      "Operational messaging and value positioning",
      "Vertical-specific recommendations and channel priority",
    ],
    whyItMatters: "Accelerates personalized outreach prep without auto-send.",
    executionTrigger: "Runs after account brief; outputs are drafts only.",
  },
  lead_score: {
    purpose:
      "Combines fit, urgency, readiness, verification, and evidence quality into an explainable lead score.",
    expectedOutputs: [
      "Component scores with positive and negative contributors",
      "Risk penalties and missing signal flags",
      "Recommended routing action (review, enrich, verify, deprioritize)",
    ],
    whyItMatters: "Prioritizes operator attention with transparent scoring — not a black box.",
    executionTrigger: "Runs after personalization using all upstream stage outputs.",
  },
  human_approval: {
    purpose:
      "Final operational review checkpoint — outreach readiness, unresolved risks, and compliance warnings.",
    expectedOutputs: [
      "Approval recommendation with reason codes",
      "Required review areas and operator checklist",
      "Blockers, escalation flags, and compliance notes",
    ],
    whyItMatters: "Human gate before any revenue execution — no autonomous approval.",
    executionTrigger: "Runs after lead score; operator must approve, hold, or reject in Revenue Queue.",
  },
  revenue_execution: {
    purpose:
      "Revenue execution readiness — sequence, channel, call/meeting readiness, and follow-up strategy.",
    expectedOutputs: [
      "Recommended execution path and channel mix",
      "Sequence steps and meeting/call readiness",
      "Follow-up strategy and attribution hooks",
    ],
    whyItMatters: "Connects intelligence to Growth Engine motions without auto-launching outreach.",
    executionTrigger: "Runs last after human approval routing is computed.",
  },
}
