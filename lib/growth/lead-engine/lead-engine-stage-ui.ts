/** Lead Engine pipeline stage metadata for UI — client-safe (no orchestrator/parsers). */

import type { GrowthLeadEnginePipelineStageId } from "@/lib/growth/lead-engine/workspace-types"

export const GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER = "lead-engine-workspace-v1" as const

export type LeadEngineStageUiDefinition = {
  stageKey: GrowthLeadEnginePipelineStageId
  label: string
  shortLabel: string
  description: string
  qaMarker: string
  displayOrder: number
}

export const LEAD_ENGINE_STAGE_UI: LeadEngineStageUiDefinition[] = [
  {
    stageKey: "icp_targeting",
    label: "ICP Targeting",
    shortLabel: "ICP",
    description: "Ideal customer profile fit and targeting rationale.",
    qaMarker: "lead-engine-icp-targeting-v1",
    displayOrder: 1,
  },
  {
    stageKey: "company_discovery",
    label: "Company Discovery",
    shortLabel: "Discovery",
    description: "Account research and firmographic signals.",
    qaMarker: "lead-engine-company-discovery-v1",
    displayOrder: 2,
  },
  {
    stageKey: "decision_maker_hypothesis",
    label: "Decision Maker Hypothesis",
    shortLabel: "Decision Maker",
    description: "Buying committee and role targeting hypotheses.",
    qaMarker: "lead-engine-decision-maker-hypothesis-v1",
    displayOrder: 3,
  },
  {
    stageKey: "contact_research",
    label: "Contact Research",
    shortLabel: "Contacts",
    description: "Contact candidates and channel research.",
    qaMarker: "lead-engine-contact-research-v1",
    displayOrder: 4,
  },
  {
    stageKey: "verification_triage",
    label: "Verification Triage",
    shortLabel: "Verification",
    description: "Evidence validation and risk disposition.",
    qaMarker: "lead-engine-verification-triage-v1",
    displayOrder: 5,
  },
  {
    stageKey: "account_brief",
    label: "Account Brief",
    shortLabel: "Brief",
    description: "Operator-ready account summary and signals.",
    qaMarker: "lead-engine-account-brief-v1",
    displayOrder: 6,
  },
  {
    stageKey: "outreach_personalization",
    label: "Outreach Personalization",
    shortLabel: "Personalization",
    description: "Messaging angles — guidance only, no autonomous send.",
    qaMarker: "lead-engine-outreach-personalization-v1",
    displayOrder: 7,
  },
  {
    stageKey: "lead_score",
    label: "Lead Score",
    shortLabel: "Score",
    description: "Weighted lead score from upstream stage outputs.",
    qaMarker: "lead-engine-lead-score-v1",
    displayOrder: 8,
  },
  {
    stageKey: "human_approval",
    label: "Human Approval",
    shortLabel: "Approval",
    description: "Human-in-the-loop approval gate before execution.",
    qaMarker: "lead-engine-human-approval-v1",
    displayOrder: 9,
  },
  {
    stageKey: "revenue_execution",
    label: "Revenue Execution",
    shortLabel: "Execution",
    description: "Recommended motion and channels — no outbound execution.",
    qaMarker: "lead-engine-revenue-execution-v1",
    displayOrder: 10,
  },
]
