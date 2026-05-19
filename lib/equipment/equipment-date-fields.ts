/** Shared date parsing / calibration due helpers for equipment forms (local calendar dates, YYYY-MM-DD). */

export const EQUIPMENT_DATE_PLACEHOLDER = "YYYY-MM-DD"

export function formatLocalDateYmd(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const da = String(d.getDate()).padStart(2, "0")
  return `${y}-${mo}-${da}`
}

export function todayLocalDateYmd(): string {
  return formatLocalDateYmd(new Date())
}

/** Normalize optional date fields for Postgres `date` columns (expects `YYYY-MM-DD`). */
export function normalizeOptionalEquipmentDateInput(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const ymd = iso[0]
    return isValidCalendarYmd(ymd) ? ymd : null
  }

  const slash = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (slash) {
    const ymd = `${slash[3]}-${String(parseInt(slash[1], 10)).padStart(2, "0")}-${String(parseInt(slash[2], 10)).padStart(2, "0")}`
    return isValidCalendarYmd(ymd) ? ymd : null
  }

  const t = Date.parse(s)
  if (!Number.isNaN(t)) {
    return formatLocalDateYmd(new Date(t))
  }

  return null
}

function isValidCalendarYmd(ymd: string): boolean {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const d = parseInt(m[3], 10)
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, mo - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
}

/** Non-empty text that is not a valid calendar date (for field-level errors). */
export function optionalEquipmentDateFieldError(raw: string): string | undefined {
  const s = raw.trim()
  if (!s) return undefined
  return normalizeOptionalEquipmentDateInput(s) === null
    ? "Use a valid date (YYYY-MM-DD)."
    : undefined
}

export function parseCalibrationIntervalMonths(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Add whole months on the local calendar (clamps day to month end; avoids UTC off-by-one). */
export function addMonthsToDateYmd(ymd: string, months: number): string | null {
  const normalized = normalizeOptionalEquipmentDateInput(ymd)
  if (!normalized || months < 1) return null
  const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10) - 1
  const d = parseInt(m[3], 10)
  const targetMonthIndex = mo + months
  const targetYear = y + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
  const day = Math.min(d, lastDay)
  return formatLocalDateYmd(new Date(targetYear, targetMonth, day))
}

export function resolveCalibrationDueAnchorYmd(installDate: string): string {
  return normalizeOptionalEquipmentDateInput(installDate) ?? todayLocalDateYmd()
}

/**
 * Compute next calibration due from an anchor date and interval.
 * Defaults to 12 months when interval is blank/invalid.
 */
export function computeNextCalibrationDueYmd(args: {
  anchorYmd: string | null | undefined
  intervalMonths: number | null | undefined
  defaultIntervalMonths?: number
}): string | null {
  const fallback = args.defaultIntervalMonths ?? 12
  const interval =
    args.intervalMonths != null && args.intervalMonths > 0 ? args.intervalMonths : fallback
  const anchor =
    args.anchorYmd?.trim() ?
      normalizeOptionalEquipmentDateInput(args.anchorYmd)
    : todayLocalDateYmd()
  if (!anchor) return null
  return addMonthsToDateYmd(anchor, interval)
}

export type CalibrationDueAutoForm = {
  installDate: string
  calibrationIntervalMonths: string
  nextCalibrationDue: string
}

/** Auto-fill next calibration due from install date (or today) + interval when not manually set. */
export function applyNextCalibrationDueAutoFill<T extends CalibrationDueAutoForm>(
  form: T,
  touched: boolean,
): T {
  if (touched) return form
  const months = parseCalibrationIntervalMonths(form.calibrationIntervalMonths)
  if (months == null && !form.calibrationIntervalMonths.trim()) return form
  const anchor = resolveCalibrationDueAnchorYmd(form.installDate)
  const due = computeNextCalibrationDueYmd({ anchorYmd: anchor, intervalMonths: months })
  if (!due) return form
  return { ...form, nextCalibrationDue: due }
}
