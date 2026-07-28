/**
 * AVA-SAL-RUNTIME-CONVERGENCE-1A — Client-safe guards for the autonomous Sal/Fuzor GPT path.
 *
 * Leads on this path use @fuzor/sales directly and must not participate in legacy Growth Engine
 * admission/research/draft-factory orchestration.
 */

export const AVA_SAL_RUNTIME_CONVERGENCE_1A_QA_MARKER = "ava-sal-runtime-convergence-1a-v1" as const

export const AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER =
  "ava-simple-gpt-qualification-1a-v1" as const

export const AVA_AUTONOMOUS_DISCOVERY_GPT_QUALIFICATION_METADATA_KEY =
  "ava_autonomous_gpt_qualification_1a" as const

export type AutonomousDiscoveryGptQualificationDecision = "pursue" | "reject" | "hold"

function readMetadataRecord(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {}
  return metadata
}

export function readAutonomousGptQualificationRecord(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const raw = readMetadataRecord(metadata)
  const existing = raw.ava_gpt_qualification
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) return null
  return existing as Record<string, unknown>
}

export function isAutonomousDiscoveryGptQualificationLead(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  const raw = readMetadataRecord(metadata)
  return (
    raw[AVA_AUTONOMOUS_DISCOVERY_GPT_QUALIFICATION_METADATA_KEY] ===
    AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER
  )
}

export function hasPersistedAutonomousDiscoveryGptQualificationDecision(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  const qualification = readAutonomousGptQualificationRecord(metadata)
  return typeof qualification?.evaluated_at === "string" && qualification.evaluated_at.trim().length > 0
}

/** Legacy GE orchestration (IRE, ASL, draft factory, Growth 5F) must not touch these leads. */
export function shouldSkipLegacyGrowthEngineOrchestrationForLeadMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return (
    isAutonomousDiscoveryGptQualificationLead(metadata) ||
    hasPersistedAutonomousDiscoveryGptQualificationDecision(metadata)
  )
}

export function shouldSkipLegacyGrowthEngineOrchestrationForLead(
  lead: { metadata?: Record<string, unknown> | null },
): boolean {
  return shouldSkipLegacyGrowthEngineOrchestrationForLeadMetadata(lead.metadata)
}
