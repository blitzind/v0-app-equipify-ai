/**
 * Phase 7A — bounded reporting snapshot nesting for multi-org / health-style call graphs.
 * Keeps `fetchBlitzpayOrgReportingSnapshot` from fanning out expensive enrichers when depth is exceeded.
 */

export const BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH = 3 as const

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
  const raw = Number(options?.nestingDepth ?? 0)
  const nestingDepth = Number.isFinite(raw)
    ? Math.min(BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH, Math.max(0, Math.round(raw)))
    : 0
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
