import "server-only"

/**
 * Comma-separated emails in `EQUIPIFY_PLATFORM_ADMIN_EMAILS` (case-insensitive).
 * Empty = no platform admins (secure default).
 */
export function getPlatformAdminEmails(): string[] {
  const raw = process.env.EQUIPIFY_PLATFORM_ADMIN_EMAILS?.trim()
  if (!raw) return []
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return getPlatformAdminEmails().includes(normalized)
}
