/**
 * Display label for a workspace member — matches Settings → Team (`displayName` on team page).
 * Prefer stored full name; otherwise derive a readable handle from the email local-part.
 */

export function teamEmailLocalPartDisplayName(email: string): string {
  const e = email.trim()
  const local = (e.split("@")[0] ?? "").trim()
  if (!local) return "Member"
  return local.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Same priority as `displayName()` on `app/(dashboard)/settings/team/page.tsx`. */
export function teamMemberSettingsListLabel(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const n = fullName?.trim()
  if (n) return n
  const em = email?.trim()
  if (em) return teamEmailLocalPartDisplayName(em)
  return "Member"
}
