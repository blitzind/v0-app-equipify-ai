/** Apollo Full Pipeline Certification actor — client-safe UUID + metadata separation. */

import {
  isGrowthActorUserIdUuid,
  normalizeGrowthActorUserIdForDb,
} from "@/lib/growth/actor-user-id"

export const APOLLO_FULL_PIPELINE_CERTIFICATION_SOURCE =
  "apollo-full-pipeline-certification" as const

export const APOLLO_FULL_PIPELINE_CERTIFICATION_ACTOR_EMAIL =
  "apollo-full-pipeline-cert@equipify.internal" as const

export function resolveApolloFullPipelineCertificationActor(input?: {
  actor_user_id?: string | null
  actor_email?: string | null
}): {
  actorUserId: string | null
  actorEmail: string
  certificationSource: typeof APOLLO_FULL_PIPELINE_CERTIFICATION_SOURCE
  auditReason: string
} {
  return {
    actorUserId: normalizeGrowthActorUserIdForDb(input?.actor_user_id),
    actorEmail: input?.actor_email?.trim() || APOLLO_FULL_PIPELINE_CERTIFICATION_ACTOR_EMAIL,
    certificationSource: APOLLO_FULL_PIPELINE_CERTIFICATION_SOURCE,
    auditReason: `full-pipeline-cert:${APOLLO_FULL_PIPELINE_CERTIFICATION_SOURCE}`,
  }
}

export function assertGrowthUuidActorForDb(
  value: unknown,
  field: string,
): string | null {
  const normalized = normalizeGrowthActorUserIdForDb(value)
  if (value != null && typeof value === "string" && value.trim() && !normalized) {
    throw new Error(
      `${field} must be a valid UUID or null — certification source strings belong in metadata, not uuid columns.`,
    )
  }
  return normalized
}

export function isCertificationSourceString(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim() === APOLLO_FULL_PIPELINE_CERTIFICATION_SOURCE
  )
}

export function certificationActorUserIdForTests(value: string | null | undefined): string | null {
  return isGrowthActorUserIdUuid(value) ? value.trim() : null
}
