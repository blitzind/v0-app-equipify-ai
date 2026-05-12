/**
 * Phase 7A — bounded reporting snapshot nesting for multi-org / health-style call graphs.
 * Keeps `fetchBlitzpayOrgReportingSnapshot` from fanning out expensive enrichers when depth is exceeded.
 */

export const BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH = 3 as const

/** Hard clamp so nested callers cannot bypass max depth with an out-of-range number. */
export function clampBlitzpayReportingNestingDepth(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.min(BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH, Math.max(0, Math.round(n)))
}

export type BlitzpayReportingSnapshotNestedSkipInput = {
  skipMultiEntity?: boolean
  skipSupplierNetwork?: boolean
  skipClaimsWarranty?: boolean
  skipMobilePhase6a?: boolean
  skipObservabilityPhase6b?: boolean
  nestingDepth?: number
}

export function resolveBlitzpayReportingSnapshotNestedSkipState(
  options?: BlitzpayReportingSnapshotNestedSkipInput,
): {
  nestingDepth: number
  atDepthCap: boolean
  skipMultiEntity: boolean
  skipSupplierNetwork: boolean
  skipClaimsWarranty: boolean
  skipMobilePhase6a: boolean
  skipObservabilityPhase6b: boolean
} {
  const nestingDepth = clampBlitzpayReportingNestingDepth(options?.nestingDepth ?? 0)
  const atDepthCap = nestingDepth >= BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH
  return {
    nestingDepth,
    atDepthCap,
    skipMultiEntity: Boolean(options?.skipMultiEntity || atDepthCap),
    skipSupplierNetwork: Boolean(options?.skipSupplierNetwork || atDepthCap),
    skipClaimsWarranty: Boolean(options?.skipClaimsWarranty || atDepthCap),
    skipMobilePhase6a: Boolean(options?.skipMobilePhase6a || atDepthCap),
    skipObservabilityPhase6b: Boolean(options?.skipObservabilityPhase6b || atDepthCap),
  }
}
