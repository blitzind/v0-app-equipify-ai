/**
 * GE-AIOS-EXECUTION-AUTHORITY-CLOSURE-1A — Definitive autonomous action policy (client-safe).
 */

export const GROWTH_CANONICAL_EXECUTION_AUTHORITY_ACTION_POLICY_1A_QA_MARKER =
  "ge-aios-execution-authority-closure-1a-action-policy-v1" as const

/** Top-level action classes for execution authority. */
export type GrowthCanonicalExecutionActionClass =
  | "read_only"
  | "safe_research"
  | "internal_mutation"
  | "customer_facing"
  | "terminal_propagation"

/** Finer-grained action kinds routed through the policy. */
export type GrowthCanonicalExecutionActionKind =
  | "read_only_projection"
  | "passive_research_read"
  | "persisted_research_run"
  | "qualification_mutation"
  | "contact_discovery"
  | "contact_verification"
  | "package_preparation"
  | "customer_facing_dispatch"
  | "terminal_propagation"
  | "contact_terminal_propagation"

export type GrowthCanonicalExecutionActionPolicy = {
  actionClass: GrowthCanonicalExecutionActionClass
  requiresDecision1AResolution: boolean
  requires1CEnforcement: boolean
  requiresApproval: boolean
  allowedDuringProspectWait: boolean
  allowedDuringOperatorPause: boolean
  allowedAfterHardTerminal: boolean
  informationOnly: boolean
}

function policyRow(
  actionClass: GrowthCanonicalExecutionActionClass,
  overrides: Partial<GrowthCanonicalExecutionActionPolicy> = {},
): GrowthCanonicalExecutionActionPolicy {
  const defaults: GrowthCanonicalExecutionActionPolicy = {
    actionClass,
    requiresDecision1AResolution: false,
    requires1CEnforcement: false,
    requiresApproval: false,
    allowedDuringProspectWait: false,
    allowedDuringOperatorPause: false,
    allowedAfterHardTerminal: false,
    informationOnly: false,
  }
  return { ...defaults, ...overrides }
}

const ACTION_KIND_POLICY: Record<GrowthCanonicalExecutionActionKind, GrowthCanonicalExecutionActionPolicy> = {
  read_only_projection: policyRow("read_only", {
    allowedDuringProspectWait: true,
    allowedDuringOperatorPause: true,
    allowedAfterHardTerminal: true,
    informationOnly: true,
  }),
  passive_research_read: policyRow("safe_research", {
    allowedDuringProspectWait: true,
    allowedDuringOperatorPause: true,
    informationOnly: true,
  }),
  persisted_research_run: policyRow("safe_research", {
    requiresDecision1AResolution: true,
    requires1CEnforcement: true,
    allowedDuringProspectWait: true,
  }),
  qualification_mutation: policyRow("internal_mutation", {
    requiresDecision1AResolution: true,
    requires1CEnforcement: true,
  }),
  contact_discovery: policyRow("safe_research", {
    requiresDecision1AResolution: true,
    requires1CEnforcement: true,
    allowedDuringProspectWait: true,
  }),
  contact_verification: policyRow("safe_research", {
    requiresDecision1AResolution: true,
    requires1CEnforcement: true,
    allowedDuringProspectWait: true,
  }),
  package_preparation: policyRow("internal_mutation", {
    requiresDecision1AResolution: true,
    requires1CEnforcement: true,
    requiresApproval: true,
  }),
  customer_facing_dispatch: policyRow("customer_facing", {
    requiresDecision1AResolution: true,
    requires1CEnforcement: true,
    requiresApproval: true,
  }),
  terminal_propagation: policyRow("terminal_propagation", {
    allowedDuringProspectWait: true,
    allowedDuringOperatorPause: true,
    allowedAfterHardTerminal: true,
  }),
  contact_terminal_propagation: policyRow("terminal_propagation", {
    allowedDuringProspectWait: true,
    allowedDuringOperatorPause: true,
    allowedAfterHardTerminal: true,
  }),
}

export function resolveExecutionActionPolicy(
  actionKind: GrowthCanonicalExecutionActionKind,
): GrowthCanonicalExecutionActionPolicy {
  return ACTION_KIND_POLICY[actionKind]
}

export function resolveExecutionActionClass(
  actionKind: GrowthCanonicalExecutionActionKind,
): GrowthCanonicalExecutionActionClass {
  return resolveExecutionActionPolicy(actionKind).actionClass
}

/** Definitive policy matrix for certification reporting. */
export const GROWTH_CANONICAL_EXECUTION_ACTION_POLICY_MATRIX: Record<
  GrowthCanonicalExecutionActionClass,
  {
    prospectWait: "allowed" | "policy_limited" | "blocked"
    operatorPause: "allowed" | "policy_limited" | "blocked"
    hardTerminal: "allowed" | "policy_limited" | "blocked"
  }
> = {
  read_only: {
    prospectWait: "allowed",
    operatorPause: "allowed",
    hardTerminal: "allowed",
  },
  safe_research: {
    prospectWait: "policy_limited",
    operatorPause: "policy_limited",
    hardTerminal: "blocked",
  },
  internal_mutation: {
    prospectWait: "blocked",
    operatorPause: "blocked",
    hardTerminal: "blocked",
  },
  customer_facing: {
    prospectWait: "blocked",
    operatorPause: "blocked",
    hardTerminal: "blocked",
  },
  terminal_propagation: {
    prospectWait: "allowed",
    operatorPause: "allowed",
    hardTerminal: "allowed",
  },
}

export function mapAslWorkflowAgentToActionKind(
  workflowAgent: "research_agent" | "qualification_agent" | "outreach_agent" | "meeting_agent",
): GrowthCanonicalExecutionActionKind {
  switch (workflowAgent) {
    case "research_agent":
      return "persisted_research_run"
    case "qualification_agent":
      return "qualification_mutation"
    case "outreach_agent":
      return "package_preparation"
    case "meeting_agent":
      return "package_preparation"
    default:
      return "internal_mutation" as GrowthCanonicalExecutionActionKind
  }
}
