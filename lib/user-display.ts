/** Visible name: profile full name when set, otherwise email (or neutral fallback). */
export function displayNameFromProfile(
  fullName: string | null | undefined,
  fallbackEmail: string | null | undefined,
): string {
  const n = fullName?.trim()
  if (n) return n
  const e = fallbackEmail?.trim()
  if (e) return e
  return "User"
}

/** Two-letter initials for avatars from a display name or email-style label. */
export function initialsFromDisplayLabel(label: string): string {
  const t = label.trim()
  if (!t) return "?"
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0]?.[0]
    const b = parts[parts.length - 1]?.[0]
    if (a && b) return (a + b).toUpperCase()
  }
  const single = parts[0] ?? t
  if (single.includes("@")) {
    const local = single.split("@")[0] ?? single
    return local.slice(0, 2).toUpperCase() || "?"
  }
  return single.slice(0, 2).toUpperCase() || "?"
}
