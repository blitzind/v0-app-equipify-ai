"use client"

import { isGrowthFeatureApiEnabled } from "@/lib/growth/runtime/growth-feature-helpers"
import {
  recordGrowthColdStoragePollerDisabled,
  recordGrowthColdStorageSubscriptionDisabled,
} from "@/lib/growth/runtime/growth-cold-storage-runtime"

export { isGrowthFeatureApiEnabled }

export function isGrowthRealtimeEventBusRuntimeActive(): boolean {
  return isGrowthFeatureApiEnabled("realtimeEventBus")
}

export function recordGrowthColdStoragePollerSuppressed(id: string): void {
  recordGrowthColdStoragePollerDisabled(id)
}

export function recordGrowthColdStorageSubscriptionSuppressed(id: string): void {
  recordGrowthColdStorageSubscriptionDisabled(id)
}
