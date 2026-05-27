import type { HiringVelocityMetrics } from "@/lib/growth/signals/hiring-velocity"
import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"
import { classifyHiringIntensity } from "@/lib/growth/signals/job-signal-classification"

export function readHiringVelocityFromMetadata(
  metadata: Record<string, unknown> | undefined,
): HiringVelocityMetrics | null {
  const raw = metadata?.hiring_velocity
  if (!raw || typeof raw !== "object") return null
  const metrics = raw as Record<string, unknown>
  return {
    open_role_count: typeof metrics.open_role_count === "number" ? metrics.open_role_count : 0,
    hiring_velocity_7d: typeof metrics.hiring_velocity_7d === "number" ? metrics.hiring_velocity_7d : 0,
    hiring_velocity_30d: typeof metrics.hiring_velocity_30d === "number" ? metrics.hiring_velocity_30d : 0,
    hiring_spike: metrics.hiring_spike === true,
    hiring_intensity:
      typeof metrics.hiring_intensity === "string"
        ? (metrics.hiring_intensity as HiringVelocityMetrics["hiring_intensity"])
        : "low",
    department_distribution:
      metrics.department_distribution && typeof metrics.department_distribution === "object"
        ? (metrics.department_distribution as Record<string, number>)
        : {},
    geographies: Array.isArray(metrics.geographies)
      ? metrics.geographies.filter((entry): entry is string => typeof entry === "string")
      : [],
  }
}

export function buildCompanyHiringIntensityMap(signals: GrowthSignalRow[]): Map<string, ReturnType<typeof classifyHiringIntensity>> {
  const counts = new Map<string, number>()
  for (const signal of signals) {
    if (signal.signal_type !== "job_posting") continue
    const key = signal.domain?.trim().toLowerCase() || signal.company_name?.trim().toLowerCase() || signal.id
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const intensities = new Map<string, ReturnType<typeof classifyHiringIntensity>>()
  for (const [key, count] of counts) {
    intensities.set(key, classifyHiringIntensity(count))
  }
  return intensities
}

export function resolveCompanyIntensityKey(signal: GrowthSignalRow): string {
  return signal.domain?.trim().toLowerCase() || signal.company_name?.trim().toLowerCase() || signal.id
}

export { formatDepartmentDistribution } from "@/lib/growth/signals/hiring-velocity"
