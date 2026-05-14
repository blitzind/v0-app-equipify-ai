/**
 * Shared display-name resolution for technician + field-resource assignees.
 * Prefer profile fields, then optional organization_members identity columns (if present),
 * then technician roster display, then a generic fallback.
 */

export type AssigneeDisplayNameSource =
  | "profile_full_name"
  | "profile_email"
  | "profile_display_name"
  | "profile_first_last"
  | "member_full_name"
  | "member_display_name"
  | "member_email"
  | "member_first_last"
  | "technician"
  | "fallback"

export type AssigneeDisplayNameResult = {
  label: string
  source: AssigneeDisplayNameSource
}

function trimNonEmpty(v: unknown): string | null {
  if (v == null) return null
  const s = typeof v === "string" ? v.trim() : String(v).trim()
  return s.length ? s : null
}

function firstNonEmpty(...vals: unknown[]): string | null {
  for (const v of vals) {
    const t = trimNonEmpty(v)
    if (t) return t
  }
  return null
}

function composeFirstLast(record: Record<string, unknown> | null | undefined): string | null {
  if (!record) return null
  const first = firstNonEmpty(record.first_name, record.firstName)
  const last = firstNonEmpty(record.last_name, record.lastName)
  if (first && last) return `${first} ${last}`.trim()
  return first ?? last ?? null
}

function asRecord(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null
  return row as Record<string, unknown>
}

const DEFAULT_FALLBACK = "Team member"

/**
 * Priority:
 * 1. profiles.full_name
 * 2. profiles.email
 * 3. organization_members.full_name / display_name (when columns exist)
 * 4. organization_members.email (when column exists)
 * 5. technician roster display (caller-supplied)
 * 6. profiles first + last (when columns exist)
 * 7. organization_members first + last (when columns exist)
 * 8. fallback (default "Team member")
 */
export function resolveAssignableDisplayName(args: {
  profile?: Record<string, unknown> | null
  member?: Record<string, unknown> | null
  /** Pre-computed technician label (e.g. from technicians + profile merge). */
  technicianDisplayName?: string | null
  fallback?: string
}): AssigneeDisplayNameResult {
  const fallback = trimNonEmpty(args.fallback) ?? DEFAULT_FALLBACK
  const p = asRecord(args.profile)
  const m = asRecord(args.member)

  const t1 = firstNonEmpty(p?.full_name, p?.fullName)
  if (t1) return { label: t1, source: "profile_full_name" }

  const t2 = firstNonEmpty(p?.email)
  if (t2) return { label: t2, source: "profile_email" }

  const t3 = firstNonEmpty(m?.full_name, m?.fullName)
  if (t3) return { label: t3, source: "member_full_name" }

  const t4 = firstNonEmpty(m?.display_name, m?.displayName)
  if (t4) return { label: t4, source: "member_display_name" }

  const t5 = firstNonEmpty(m?.email, m?.member_email)
  if (t5) return { label: t5, source: "member_email" }

  const tech = trimNonEmpty(args.technicianDisplayName)
  if (tech) return { label: tech, source: "technician" }

  const t6 = composeFirstLast(p)
  if (t6) return { label: t6, source: "profile_first_last" }

  const t7 = composeFirstLast(m)
  if (t7) return { label: t7, source: "member_first_last" }

  return { label: fallback, source: "fallback" }
}

/** Normalize map keys for Supabase UUID / string mismatches. */
export function normalizeUserIdKey(id: string): string {
  return String(id).trim().toLowerCase()
}
