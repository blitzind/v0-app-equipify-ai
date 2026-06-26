/** GE-AIOS-2D — Canonical decision key registry (client-safe). Constitutional §13.1. */

export type AiDecisionRegistryEntry = {
  decisionKey: string
  ownerAgent: string
  description: string
}

/** Initial constitutional catalog — extensible via amendment. */
export const AI_DECISION_REGISTRY: readonly AiDecisionRegistryEntry[] = [
  { decisionKey: "target_company", ownerAgent: "qualification", description: "Target or reject company" },
  { decisionKey: "verify_email", ownerAgent: "qualification", description: "Verify contact email" },
  { decisionKey: "select_primary_contact", ownerAgent: "qualification", description: "Select primary contact" },
  { decisionKey: "enrich_company", ownerAgent: "research", description: "Enrich company data" },
  { decisionKey: "build_buying_committee", ownerAgent: "research", description: "Build buying committee" },
  { decisionKey: "send_email", ownerAgent: "strategy", description: "Send email channel decision" },
  { decisionKey: "pause_outreach", ownerAgent: "strategy", description: "Pause outreach" },
  { decisionKey: "launch_sequence", ownerAgent: "strategy", description: "Launch sequence" },
  { decisionKey: "change_messaging", ownerAgent: "personalization", description: "Change messaging" },
  { decisionKey: "send_outbound", ownerAgent: "outreach", description: "Execute outbound send" },
  { decisionKey: "schedule_meeting", ownerAgent: "meeting", description: "Schedule meeting" },
  { decisionKey: "create_opportunity", ownerAgent: "opportunity", description: "Create opportunity" },
  { decisionKey: "spend_apollo_credits", ownerAgent: "budget", description: "Spend provider credits" },
  { decisionKey: "pause_mission", ownerAgent: "executive_brain", description: "Pause mission" },
  { decisionKey: "compliance_veto", ownerAgent: "compliance", description: "Compliance veto" },
  { decisionKey: "work_order_execute", ownerAgent: "research", description: "Generic work order execution decision (infrastructure)" },
  { decisionKey: "insufficient_evidence", ownerAgent: "research", description: "Documented insufficiency per invariant 13" },
] as const

const REGISTRY_INDEX = new Map(AI_DECISION_REGISTRY.map((entry) => [entry.decisionKey, entry]))

export function lookupAiDecisionRegistryEntry(decisionKey: string): AiDecisionRegistryEntry | null {
  return REGISTRY_INDEX.get(decisionKey) ?? null
}

export function isRegisteredAiDecisionKey(decisionKey: string): boolean {
  return REGISTRY_INDEX.has(decisionKey)
}

export function aiDecisionRegistryCatalog() {
  return {
    entries: [...AI_DECISION_REGISTRY],
    count: AI_DECISION_REGISTRY.length,
  }
}
