/** Shared Call Workspace layout tokens + display helpers (UI only). */

export const GROWTH_CALL_WORKSPACE_PANEL =
  "rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/70"

export const GROWTH_CALL_WORKSPACE_GLASS_DOCK =
  "rounded-2xl border border-border/60 bg-background/70 p-2 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60"

export function leadInitials(name: string | null | undefined, company: string | null | undefined): string {
  const source = name?.trim() || company?.trim() || "?"
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function formatDisplayPhone(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—"
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw
}

export function executionReadinessLabel(score: number | null): string {
  if (score == null) return "—"
  if (score >= 70) return "High"
  if (score >= 40) return "Medium"
  return "Low"
}

export function meetingOutcomeLabel(score: number | null): string {
  if (score == null) return "—"
  if (score >= 70) return "Positive"
  if (score >= 40) return "Needs Follow-Up"
  return "At Risk"
}

export function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Strip formatting so keypad/backspace operate on stable digits. */
export function normalizeDialPhoneDigits(value: string): string {
  return value.replace(/\D/g, "")
}

export function appendDialPhoneKey(current: string, key: string): string {
  const digits = normalizeDialPhoneDigits(current)
  if (key === "*" || key === "#") return `${digits}${key}`
  return `${digits}${key}`
}

export function backspaceDialPhone(current: string): string {
  const raw = current.replace(/[^\d+*#]/g, "")
  return raw.slice(0, -1)
}

/** Minimum digits for start API (matches zod min(3) on phoneNumber). */
export function hasDialablePhone(value: string): boolean {
  return normalizeDialPhoneDigits(value).length >= 3
}

export function normalizeDialPhoneForApi(value: string): string {
  const digits = normalizeDialPhoneDigits(value)
  if (digits.length < 3) return ""
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return digits
}

export function optionalUuid(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return UUID_RE.test(value.trim()) ? value.trim() : null
}
