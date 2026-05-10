import type {
  EquipmentWarrantyRow,
  WarrantyCoverageLabel,
  WarrantyEvaluationResult,
} from "@/lib/equipment-warranties/types"

const MS_DAY = 86_400_000

export const DEFAULT_WARRANTY_EXPIRING_SOON_DAYS = 90

export function utcTodayYmd(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function daysBetweenYmd(fromYmd: string, toYmd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) return null
  const a = new Date(`${fromYmd}T12:00:00.000Z`).getTime()
  const b = new Date(`${toYmd}T12:00:00.000Z`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / MS_DAY)
}

/**
 * Row is in effect for `asOf` when status is active, dates bracket `asOf`,
 * and end has not passed (even if status was not flipped to expired).
 */
export function warrantyRecordEffectiveOn(row: EquipmentWarrantyRow, asOf: Date): boolean {
  if (row.status === "void" || row.status === "expired") return false
  const day = utcTodayYmd(asOf)
  const end = row.end_date.slice(0, 10)
  const start = row.start_date?.trim() ? row.start_date.slice(0, 10) : null
  if (end < day) return false
  if (start && start > day) return false
  return true
}

export function pickBestWarrantyRecord(
  rows: EquipmentWarrantyRow[],
  asOf: Date,
): EquipmentWarrantyRow | null {
  const effective = rows.filter((r) => warrantyRecordEffectiveOn(r, asOf))
  if (effective.length === 0) return null
  effective.sort((a, b) => {
    const end = b.end_date.localeCompare(a.end_date)
    if (end !== 0) return end
    return a.id.localeCompare(b.id)
  })
  return effective[0] ?? null
}

function labelFromEndDate(
  endYmd: string,
  asOf: Date,
  expiringSoonDays: number,
): { label: WarrantyCoverageLabel; daysRemaining: number } {
  const today = utcTodayYmd(asOf)
  const daysRemaining = daysBetweenYmd(today, endYmd) ?? 0
  if (daysRemaining < 0) return { label: "warranty_expired", daysRemaining }
  if (daysRemaining <= expiringSoonDays) return { label: "expiring_soon", daysRemaining }
  return { label: "under_warranty", daysRemaining }
}

export type EquipmentWarrantyFallback = {
  start: string | null
  end: string | null
  manufacturerLabel?: string | null
}

/**
 * Prefer structured warranty records; fall back to equipment-level warranty dates.
 */
export function evaluateWarrantyCoverage(args: {
  records: EquipmentWarrantyRow[]
  equipmentFallback?: EquipmentWarrantyFallback | null
  asOf?: Date
  expiringSoonDays?: number
}): WarrantyEvaluationResult {
  const asOf = args.asOf ?? new Date()
  const expiringSoonDays = args.expiringSoonDays ?? DEFAULT_WARRANTY_EXPIRING_SOON_DAYS
  const best = pickBestWarrantyRecord(args.records, asOf)
  if (best) {
    const end = best.end_date.slice(0, 10)
    const { label, daysRemaining } = labelFromEndDate(end, asOf, expiringSoonDays)
    return {
      label,
      endDate: end,
      provider: best.warranty_provider.trim() || null,
      daysRemaining,
      source: "record",
      referenceNumber: best.reference_number?.trim() || null,
    }
  }

  const fb = args.equipmentFallback
  const endRaw = fb?.end?.trim()
  if (endRaw && /^\d{4}-\d{2}-\d{2}/.test(endRaw)) {
    const end = endRaw.slice(0, 10)
    const start = fb?.start?.trim() ? fb.start.slice(0, 10) : null
    const day = utcTodayYmd(asOf)
    if (end >= day && (!start || start <= day)) {
      const { label, daysRemaining } = labelFromEndDate(end, asOf, expiringSoonDays)
      const provider =
        (fb.manufacturerLabel && fb.manufacturerLabel.trim()) || "Manufacturer (asset dates)"
      return {
        label,
        endDate: end,
        provider,
        daysRemaining,
        source: "equipment",
        referenceNumber: null,
      }
    }
    if (end < day) {
      return {
        label: "warranty_expired",
        endDate: end,
        provider:
          (fb.manufacturerLabel && fb.manufacturerLabel.trim()) || "Manufacturer (asset dates)",
        daysRemaining: daysBetweenYmd(day, end) ?? null,
        source: "equipment",
        referenceNumber: null,
      }
    }
  }

  return {
    label: "no_warranty",
    endDate: null,
    provider: null,
    daysRemaining: null,
    source: "none",
    referenceNumber: null,
  }
}

export function formatWarrantyCoverageLabel(label: WarrantyCoverageLabel): string {
  switch (label) {
    case "under_warranty":
      return "Under warranty"
    case "expiring_soon":
      return "Expiring soon"
    case "warranty_expired":
      return "Warranty expired"
    case "no_warranty":
      return "No warranty"
    default:
      return label
  }
}

export function warrantyCoverageBadgeClass(label: WarrantyCoverageLabel): string {
  switch (label) {
    case "under_warranty":
      return "border-[color:var(--status-success)]/45 bg-[color:var(--status-success)]/10 text-emerald-950 dark:text-emerald-100"
    case "expiring_soon":
      return "border-[color:var(--status-warning)]/45 bg-[color:var(--status-warning)]/10 text-amber-950 dark:text-amber-100"
    case "warranty_expired":
      return "border-border bg-muted text-muted-foreground"
    case "no_warranty":
      return "border-border bg-card text-muted-foreground"
    default:
      return "border-border bg-card"
  }
}
