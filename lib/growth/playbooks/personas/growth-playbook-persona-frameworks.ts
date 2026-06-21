/** GS-AI-PLAYBOOK-2E — Static persona framework archetypes (client-safe). */

import type {
  GrowthPersonaArchetype,
  GrowthPersonaCtaType,
  GrowthPersonaMessagingFramework,
  GrowthPersonaProofType,
} from "@/lib/growth/playbooks/personas/growth-playbook-persona-types"
import type { GrowthIndustryPlaybookBuyerPersona } from "@/lib/growth/playbooks/industry-playbook-types"

const ARCHETYPE_PATTERNS: Array<{ archetype: GrowthPersonaArchetype; pattern: RegExp }> = [
  { archetype: "owner", pattern: /\b(owner|president|ceo|founder|principal|proprietor)\b/i },
  { archetype: "htm_director", pattern: /\b(htm|clinical engineering|biomed shop|biomedical director)\b/i },
  { archetype: "compliance_manager", pattern: /\b(compliance|quality manager|regulatory)\b/i },
  { archetype: "operations_director", pattern: /\b(operations director|general manager|vp operations|ops director)\b/i },
  { archetype: "dispatcher", pattern: /\b(dispatch|scheduler|service coordinator)\b/i },
  { archetype: "service_manager", pattern: /\b(service manager|field service manager|field supervisor|service director)\b/i },
]

const BASE_FRAMEWORKS: Record<
  GrowthPersonaArchetype,
  Omit<GrowthPersonaMessagingFramework, "persona" | "buyingTriggers">
> = {
  owner: {
    archetype: "owner",
    priorities: ["profitability", "efficiency", "growth", "margins", "cash flow"],
    fears: ["margin erosion", "uncontrolled labor cost", "growth stalling without systems", "owner dependency"],
    desiredOutcomes: [
      "Predictable service profitability",
      "Scalable operations without adding overhead",
      "Clear visibility into contract performance",
    ],
    languageStyle: "executive",
    messageLengthPreference: "concise",
    preferredProofTypes: ["revenue_growth", "profitability", "labor_savings"],
    preferredCtaTypes: ["strategic_review", "roi_discussion"],
    avoidTopics: ["feature lists", "technician UI minutiae", "implementation jargon without business outcome"],
    openingStrategies: [
      "Lead with business outcome and margin impact before product mechanics.",
      "Frame operational improvements as owner-level leverage, not tool replacement.",
    ],
    recommendedMetrics: ["gross margin", "contract renewal rate", "cost-to-serve", "revenue per technician"],
    urgencyDrivers: ["renewal season", "margin compression", "multi-location expansion", "owner succession planning"],
  },
  service_manager: {
    archetype: "service_manager",
    priorities: ["dispatch", "technician productivity", "backlog", "visibility", "first-time fix"],
    fears: ["dispatch chaos", "technician burnout", "missed SLAs", "repeat truck rolls"],
    desiredOutcomes: [
      "Balanced emergency and PM workload",
      "Technicians arrive with asset history",
      "Same-day closeout and billing readiness",
    ],
    languageStyle: "operational",
    messageLengthPreference: "moderate",
    preferredProofTypes: ["technician_productivity", "reduced_callbacks", "faster_scheduling"],
    preferredCtaTypes: ["operational_review", "dispatch_demonstration"],
    avoidTopics: ["executive buzzwords without dispatch context", "unverified SLA claims"],
    openingStrategies: [
      "Acknowledge daily dispatch tradeoffs before proposing workflow changes.",
      "Reference technician utilization and backlog patterns in consultative language.",
    ],
    recommendedMetrics: ["first-time fix rate", "technician utilization", "overdue PM count", "average response time"],
    urgencyDrivers: ["seasonal volume spike", "dispatcher turnover", "SLA penalties", "PM backlog surge"],
  },
  htm_director: {
    archetype: "htm_director",
    priorities: ["compliance", "PM completion", "audits", "recalls", "device history"],
    fears: ["survey findings", "recall traceability gaps", "PM overdue on critical devices", "documentation rework"],
    desiredOutcomes: [
      "Audit-ready PM and recall documentation",
      "Unified asset register across campuses",
      "Technicians equipped with modality context on mobile",
    ],
    languageStyle: "technical",
    messageLengthPreference: "moderate",
    preferredProofTypes: ["compliance", "audit_readiness", "pm_completion"],
    preferredCtaTypes: ["workflow_walkthrough", "compliance_review"],
    avoidTopics: ["generic home-services language", "unverified regulatory claims", "fear-based selling"],
    openingStrategies: [
      "Use HTM and compliance vocabulary with process precision.",
      "Frame improvements around survey readiness and recall traceability.",
    ],
    recommendedMetrics: ["PM compliance %", "overdue PM by risk tier", "recall closeout time", "audit finding count"],
    urgencyDrivers: ["Joint Commission survey window", "recall surge", "new tower onboarding", "staffing shortage on units"],
  },
  operations_director: {
    archetype: "operations_director",
    priorities: ["scaling", "standardization", "multi-location management", "cross-site visibility"],
    fears: ["inconsistent execution across sites", "hidden backlog", "inability to scale without chaos"],
    desiredOutcomes: [
      "Standard workflows across branches",
      "Leadership dashboards without manual roll-ups",
      "Predictable capacity planning",
    ],
    languageStyle: "strategic",
    messageLengthPreference: "moderate",
    preferredProofTypes: ["scalability", "visibility", "standardization"],
    preferredCtaTypes: ["scalability_assessment", "strategic_review"],
    avoidTopics: ["single-site anecdotes without multi-location relevance", "tactical dispatch-only framing"],
    openingStrategies: [
      "Lead with systems thinking and standardization across locations.",
      "Connect operational visibility to scaling decisions.",
    ],
    recommendedMetrics: ["on-time PM across sites", "branch variance in SLA", "technician capacity vs demand", "standard work adoption"],
    urgencyDrivers: ["new branch acquisition", "contract portfolio expansion", "leadership reporting pressure"],
  },
  dispatcher: {
    archetype: "dispatcher",
    priorities: ["scheduling", "communication", "technician coordination", "route efficiency"],
    fears: ["board overload", "technician skill mismatch", "customer status calls", "overtime spikes"],
    desiredOutcomes: [
      "Single queue for contract and T&M work",
      "Clear technician status without phone tag",
      "Fewer emergency reroutes",
    ],
    languageStyle: "tactical",
    messageLengthPreference: "concise",
    preferredProofTypes: ["faster_scheduling", "technician_productivity", "visibility"],
    preferredCtaTypes: ["scheduling_walkthrough", "dispatch_demonstration"],
    avoidTopics: ["executive ROI lectures", "long strategic narratives", "unverified dispatch metrics"],
    openingStrategies: [
      "Speak to daily coordination pain in plain operational language.",
      "Keep proof tied to scheduling clarity and technician communication.",
    ],
    recommendedMetrics: ["emergency response time", "route completion rate", "overtime hours", "dispatch board rework"],
    urgencyDrivers: ["peak season", "new contract tier", "dispatcher staffing gap", "missed SLA on key account"],
  },
  compliance_manager: {
    archetype: "compliance_manager",
    priorities: ["audit readiness", "documentation", "regulatory alignment", "inspection workflows"],
    fears: ["failed audits", "incomplete traceability", "manual record gathering"],
    desiredOutcomes: ["Exportable compliance history", "Linked recall and corrective actions", "Role-based audit logs"],
    languageStyle: "technical",
    messageLengthPreference: "moderate",
    preferredProofTypes: ["compliance", "audit_readiness", "pm_completion"],
    preferredCtaTypes: ["compliance_review", "workflow_walkthrough"],
    avoidTopics: ["sales hype", "unverified certification claims"],
    openingStrategies: ["Lead with documentation traceability and audit preparation burden."],
    recommendedMetrics: ["documentation completeness", "audit prep hours", "open corrective actions"],
    urgencyDrivers: ["surveillance audit scheduled", "regulatory change", "documentation backlog"],
  },
  general: {
    archetype: "general",
    priorities: ["operational clarity", "service reliability", "customer satisfaction"],
    fears: ["workflow chaos", "tool fatigue", "change without ROI"],
    desiredOutcomes: ["Better visibility", "Less manual coordination", "Consistent service delivery"],
    languageStyle: "consultative",
    messageLengthPreference: "moderate",
    preferredProofTypes: ["visibility", "technician_productivity", "standardization"],
    preferredCtaTypes: ["consultative_discovery", "workflow_walkthrough"],
    avoidTopics: ["unverified company pain", "aggressive closing language"],
    openingStrategies: ["Use consultative discovery before asserting industry patterns."],
    recommendedMetrics: ["service response time", "repeat visit rate", "customer satisfaction"],
    urgencyDrivers: ["growth pressure", "staffing constraints", "customer escalation"],
  },
}

const PROOF_LABELS: Record<GrowthPersonaProofType, string> = {
  revenue_growth: "Revenue growth and contract expansion proof",
  profitability: "Profitability and margin improvement proof",
  labor_savings: "Labor efficiency and unbilled time reduction proof",
  compliance: "Compliance and regulatory alignment proof",
  audit_readiness: "Audit readiness and documentation traceability proof",
  pm_completion: "PM completion and overdue reduction proof",
  technician_productivity: "Technician productivity and utilization proof",
  reduced_callbacks: "Reduced callbacks and repeat truck rolls proof",
  faster_scheduling: "Faster scheduling and dispatch clarity proof",
  scalability: "Scalability across teams and locations proof",
  visibility: "Operational visibility and reporting proof",
  standardization: "Standardized workflows across sites proof",
}

const CTA_LABELS: Record<GrowthPersonaCtaType, string> = {
  strategic_review: "Would a brief strategic review of service operations be useful?",
  roi_discussion: "Open to a short ROI discussion on labor and contract performance?",
  workflow_walkthrough: "Worth a workflow walkthrough tailored to your team's process?",
  compliance_review: "Would it help to compare compliance and PM documentation workflows?",
  operational_review: "Would an operational review of dispatch and backlog be useful?",
  dispatch_demonstration: "Worth reviewing how your dispatch board handles contract tiers?",
  scalability_assessment: "Would a scalability assessment across locations be helpful?",
  scheduling_walkthrough: "Open to a quick scheduling walkthrough for your coordinators?",
  consultative_discovery: "Worth a short discovery conversation on current workflow priorities?",
}

export function resolvePersonaArchetype(
  personaTitle: string,
  decisionMakerTitle?: string | null,
): { archetype: GrowthPersonaArchetype; matchReason: string | null; confidence: "high" | "medium" | "low" } {
  const haystack = `${personaTitle} ${decisionMakerTitle ?? ""}`.trim()
  for (const entry of ARCHETYPE_PATTERNS) {
    if (entry.pattern.test(haystack)) {
      return {
        archetype: entry.archetype,
        matchReason: `Matched persona archetype from title: ${personaTitle}`,
        confidence: personaTitle.trim() ? "high" : "medium",
      }
    }
  }
  return { archetype: "general", matchReason: "Default general operator persona framework", confidence: "low" }
}

export function getPersonaProofLabel(type: GrowthPersonaProofType): string {
  return PROOF_LABELS[type]
}

export function getPersonaCtaLabel(type: GrowthPersonaCtaType): string {
  return CTA_LABELS[type]
}

export function buildPersonaFrameworkFromArchetype(
  persona: GrowthIndustryPlaybookBuyerPersona,
  archetype: GrowthPersonaArchetype,
): GrowthPersonaMessagingFramework {
  const base = BASE_FRAMEWORKS[archetype]
  return {
    persona,
    archetype: base.archetype,
    priorities: uniqueMerge(base.priorities, persona.goals.slice(0, 3)),
    fears: uniqueMerge(base.fears, persona.frustrations.slice(0, 3)),
    desiredOutcomes: uniqueMerge(base.desiredOutcomes, persona.successMetrics.slice(0, 3)),
    buyingTriggers: persona.buyingTriggers.length ? persona.buyingTriggers : base.urgencyDrivers.slice(0, 3),
    languageStyle: base.languageStyle,
    messageLengthPreference: base.messageLengthPreference,
    preferredProofTypes: base.preferredProofTypes,
    preferredCtaTypes: base.preferredCtaTypes,
    avoidTopics: uniqueMerge(base.avoidTopics, persona.commonObjections.slice(0, 2)),
    openingStrategies: base.openingStrategies,
    recommendedMetrics: uniqueMerge(base.recommendedMetrics, persona.kpis.slice(0, 4)),
    urgencyDrivers: uniqueMerge(base.urgencyDrivers, persona.buyingTriggers.slice(0, 3)),
  }
}

function uniqueMerge(primary: string[], secondary: string[]): string[] {
  return [...new Set([...primary, ...secondary].map((entry) => entry.trim()).filter(Boolean))]
}
