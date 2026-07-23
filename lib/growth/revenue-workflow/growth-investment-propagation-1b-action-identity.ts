/**
 * GE-AIOS-INVESTMENT-PROPAGATION-1B — Canonical bounded research action identity (client-safe).
 */

export const GROWTH_BOUNDED_RESEARCH_ACTION_KEYS = [
  "verify_company_identity",
  "verify_us_territory",
  "inspect_services_for_operational_fit",
  "establish_company_context",
  "identify_outreach_angle",
] as const

export type GrowthBoundedResearchActionKey = (typeof GROWTH_BOUNDED_RESEARCH_ACTION_KEYS)[number]

export const GROWTH_BOUNDED_RESEARCH_ACTION_ORDER: GrowthBoundedResearchActionKey[] = [
  "verify_company_identity",
  "verify_us_territory",
  "inspect_services_for_operational_fit",
  "establish_company_context",
  "identify_outreach_angle",
]

export type GrowthBoundedResearchActionDefinition = {
  actionKey: GrowthBoundedResearchActionKey
  displayLabel: string
  missingEvidenceTarget: string
  workflowType: "research_company"
}

export const GROWTH_BOUNDED_RESEARCH_ACTION_DEFINITIONS: Record<
  GrowthBoundedResearchActionKey,
  GrowthBoundedResearchActionDefinition
> = {
  verify_company_identity: {
    actionKey: "verify_company_identity",
    displayLabel: "Verify official company identity",
    missingEvidenceTarget: "verified_company_identity",
    workflowType: "research_company",
  },
  verify_us_territory: {
    actionKey: "verify_us_territory",
    displayLabel: "Confirm United States operating presence",
    missingEvidenceTarget: "eligible_territory",
    workflowType: "research_company",
  },
  inspect_services_for_operational_fit: {
    actionKey: "inspect_services_for_operational_fit",
    displayLabel: "Inspect services and maintenance evidence",
    missingEvidenceTarget: "operational_fit",
    workflowType: "research_company",
  },
  establish_company_context: {
    actionKey: "establish_company_context",
    displayLabel: "Establish sufficient company context",
    missingEvidenceTarget: "sufficient_company_context",
    workflowType: "research_company",
  },
  identify_outreach_angle: {
    actionKey: "identify_outreach_angle",
    displayLabel: "Identify defensible outreach angle",
    missingEvidenceTarget: "defensible_outreach_angle",
    workflowType: "research_company",
  },
}

const EVIDENCE_TO_ACTION_KEY: Record<string, GrowthBoundedResearchActionKey> = {
  verified_company_identity: "verify_company_identity",
  company_identity: "verify_company_identity",
  eligible_territory: "verify_us_territory",
  territory: "verify_us_territory",
  operational_fit: "inspect_services_for_operational_fit",
  defensible_outreach_angle: "identify_outreach_angle",
  outreach_angle: "identify_outreach_angle",
  sufficient_company_context: "establish_company_context",
  company_context: "establish_company_context",
  confidence_or_fit_threshold: "inspect_services_for_operational_fit",
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

export function isGrowthBoundedResearchActionKey(value: string): value is GrowthBoundedResearchActionKey {
  return (GROWTH_BOUNDED_RESEARCH_ACTION_KEYS as readonly string[]).includes(value)
}

export function resolveBoundedResearchActionKeyFromEvidence(
  missingEvidence: string,
): GrowthBoundedResearchActionKey | null {
  const normalized = missingEvidence.trim()
  if (!normalized) return null
  if (EVIDENCE_TO_ACTION_KEY[normalized]) return EVIDENCE_TO_ACTION_KEY[normalized]
  const withoutVerified = normalized.replace(/^verified_/, "")
  if (EVIDENCE_TO_ACTION_KEY[withoutVerified]) return EVIDENCE_TO_ACTION_KEY[withoutVerified]
  for (const [gap, actionKey] of Object.entries(EVIDENCE_TO_ACTION_KEY)) {
    if (normalized.includes(gap) || gap.includes(normalized)) return actionKey
  }
  return null
}

const AUTHORIZED_LABEL_TO_ACTION_KEY: Record<string, GrowthBoundedResearchActionKey> = {
  "inspect official about page": "verify_company_identity",
  "verify official domain": "verify_company_identity",
  "confirm legal business identity": "verify_company_identity",
  "inspect authoritative business listing": "verify_company_identity",
  "inspect official locations page": "verify_us_territory",
  "inspect service-area page": "verify_us_territory",
  "confirm united states operating presence": "verify_us_territory",
  "check authoritative registration or business listing": "verify_us_territory",
  "inspect services page": "inspect_services_for_operational_fit",
  "inspect maintenance offerings": "inspect_services_for_operational_fit",
  "inspect repair/installation pages": "inspect_services_for_operational_fit",
  "inspect case studies": "inspect_services_for_operational_fit",
  "inspect industries served": "inspect_services_for_operational_fit",
  "inspect careers for technician or field-service roles": "inspect_services_for_operational_fit",
  "inspect about page": "establish_company_context",
  "identify company scale indicators": "establish_company_context",
  "identify service geography": "establish_company_context",
  "identify customer type": "establish_company_context",
  "identify operational model": "establish_company_context",
  "identify recurring maintenance pain": "identify_outreach_angle",
  "identify compliance or inspection obligations": "identify_outreach_angle",
  "identify service-contract model": "identify_outreach_angle",
  "identify dispatch, asset, warranty, or documentation workflow": "identify_outreach_angle",
  "identify relevant equipify value proposition": "identify_outreach_angle",
}

export function resolveBoundedResearchActionKeyFromLabel(label: string): GrowthBoundedResearchActionKey | null {
  const normalized = label.trim().toLowerCase()
  if (!normalized) return null
  if (AUTHORIZED_LABEL_TO_ACTION_KEY[normalized]) return AUTHORIZED_LABEL_TO_ACTION_KEY[normalized]
  for (const definition of Object.values(GROWTH_BOUNDED_RESEARCH_ACTION_DEFINITIONS)) {
    if (definition.displayLabel.toLowerCase() === normalized) return definition.actionKey
  }
  for (const definition of Object.values(GROWTH_BOUNDED_RESEARCH_ACTION_DEFINITIONS)) {
    if (normalized.includes(definition.actionKey.replaceAll("_", " "))) return definition.actionKey
  }
  return null
}

export function readCompletedBoundedResearchActionKeys(
  metadata: Record<string, unknown> | null | undefined,
): GrowthBoundedResearchActionKey[] {
  const raw = asRecord(metadata) ?? {}
  return readStringArray(raw.admission_bounded_actions_completed).filter(isGrowthBoundedResearchActionKey)
}

export function readConsumedBoundedResearchRunIds(metadata: Record<string, unknown> | null | undefined): string[] {
  const raw = asRecord(metadata) ?? {}
  return readStringArray(raw.admission_bounded_research_runs_consumed)
}

export function readBoundedResearchActionInProgress(
  metadata: Record<string, unknown> | null | undefined,
): GrowthBoundedResearchActionKey | null {
  const raw = asRecord(metadata) ?? {}
  const inProgress = raw.admission_bounded_action_in_progress
  if (typeof inProgress === "string" && isGrowthBoundedResearchActionKey(inProgress)) return inProgress
  if (inProgress && typeof inProgress === "object" && !Array.isArray(inProgress)) {
    const actionKey = (inProgress as Record<string, unknown>).actionKey
    if (typeof actionKey === "string" && isGrowthBoundedResearchActionKey(actionKey)) return actionKey
  }
  return null
}

export function resolveBoundedResearchActionKeyFromRun(
  run:
    | {
        id?: string | null
        status?: string | null
        signals?: Record<string, unknown> | null
      }
    | null
    | undefined,
  metadata: Record<string, unknown> | null | undefined,
): GrowthBoundedResearchActionKey | null {
  const signals = run?.signals ?? {}
  const fromSignal = signals.boundedResearchActionKey_1b
  if (typeof fromSignal === "string" && isGrowthBoundedResearchActionKey(fromSignal)) return fromSignal
  return readBoundedResearchActionInProgress(metadata)
}
