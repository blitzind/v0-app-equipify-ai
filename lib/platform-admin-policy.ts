/**
 * Platform admin access is determined solely by matching the authenticated
 * user's email (trimmed, lowercased) against `EQUIPIFY_PLATFORM_ADMIN_EMAILS`.
 * Organization membership or org role is not consulted here.
 *
 * Import from this module in **Edge middleware**. Do not import from client components.
 */

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

/** Dev-only diagnostics — no secrets, only auth email + parsed allowlist. */
export function logPlatformAdminDevDiagnostics(label: string, email: string | null | undefined): void {
  if (process.env.NODE_ENV !== "development") return
  const parsed = getPlatformAdminEmails()
  console.info(`[platform-admin] ${label}`, {
    authEmailNormalized: email?.trim().toLowerCase() ?? null,
    parsedAdminEmails: parsed,
    parsedCount: parsed.length,
    isPlatformAdmin: isPlatformAdminEmail(email),
  })
}
