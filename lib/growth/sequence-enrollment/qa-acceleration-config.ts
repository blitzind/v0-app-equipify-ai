import "server-only"

import { isGrowthProductionRuntime } from "@/lib/growth/runtime/runtime-guards"

/** QA acceleration is allowed in non-production runtimes or when explicitly enabled. */
export function isGrowthQaAccelerationEnabled(): boolean {
  if (process.env.GROWTH_ENABLE_QA_ACCELERATION?.trim() === "true") return true
  return !isGrowthProductionRuntime()
}
