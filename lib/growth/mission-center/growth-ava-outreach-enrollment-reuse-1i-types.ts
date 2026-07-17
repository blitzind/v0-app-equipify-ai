/** GE-AIOS-SUPERVISED-ENROLLMENT-REUSE-1I — Client-safe conflict types. */

export const GE_AIOS_SUPERVISED_ENROLLMENT_REUSE_1I_QA_MARKER =
  "ge-aios-supervised-enrollment-reuse-1i-v1" as const

export const SUPERVISED_ENROLLMENT_REUSE_CONFLICT_PREFIX = "supervised_enrollment_conflict:" as const

export type SupervisedEnrollmentReuseConflict = {
  qaMarker: typeof GE_AIOS_SUPERVISED_ENROLLMENT_REUSE_1I_QA_MARKER
  enrollmentId: string | null
  requestedPatternId: string | null
  existingPatternId: string | null
  resumabilityStatus: string
  blockingReason: string
}

export function parseSupervisedEnrollmentReuseConflict(
  fulfillmentError: string | null | undefined,
): SupervisedEnrollmentReuseConflict | null {
  if (!fulfillmentError?.startsWith(SUPERVISED_ENROLLMENT_REUSE_CONFLICT_PREFIX)) return null
  try {
    return JSON.parse(
      fulfillmentError.slice(SUPERVISED_ENROLLMENT_REUSE_CONFLICT_PREFIX.length),
    ) as SupervisedEnrollmentReuseConflict
  } catch {
    return null
  }
}

export function formatSupervisedEnrollmentReuseConflict(
  conflict: SupervisedEnrollmentReuseConflict,
): string {
  return `${SUPERVISED_ENROLLMENT_REUSE_CONFLICT_PREFIX}${JSON.stringify(conflict)}`
}
