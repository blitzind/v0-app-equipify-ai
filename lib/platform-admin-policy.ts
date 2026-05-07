/**
 * Platform admin access is determined solely by matching the authenticated
 * user's email (trimmed, lowercased) against the `EQUIPIFY_PLATFORM_ADMIN_EMAILS`
 * allowlist. Organization membership or org role is **not** consulted here.
 *
 * Import from this module in **Edge middleware**. Do not import from client components.
 */

/**
 * Canonical env var. Comma-separated, case-insensitive. Empty = no platform
 * admins (secure default — production must opt-in explicitly).
 */
const PRIMARY_ENV = "EQUIPIFY_PLATFORM_ADMIN_EMAILS"

/**
 * Backward-compatible fallbacks. These are accepted as aliases for the
 * canonical name to avoid silent misconfiguration on local/dev environments
 * where developers may write the obvious-but-wrong `PLATFORM_ADMIN_EMAILS`.
 * The fallbacks are checked **only when the canonical name is unset**, so
 * production deployments that already set `EQUIPIFY_PLATFORM_ADMIN_EMAILS`
 * are unaffected.
 */
const ALIAS_ENVS = ["PLATFORM_ADMIN_EMAILS", "PLATFORM_ADMIN_EMAIL"] as const

/** Resolve the raw env value plus the env name actually used (for diagnostics). */
function resolvePlatformAdminEnv(): { raw: string; source: string } | null {
  const primary = process.env[PRIMARY_ENV]?.trim()
  if (primary) return { raw: primary, source: PRIMARY_ENV }
  for (const name of ALIAS_ENVS) {
    const v = process.env[name]?.trim()
    if (v) return { raw: v, source: name }
  }
  return null
}

export function getPlatformAdminEmails(): string[] {
  const resolved = resolvePlatformAdminEnv()
  if (!resolved) return []
  return resolved.raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return getPlatformAdminEmails().includes(normalized)
}

/** Dev-only diagnostics — no secrets, only auth email + parsed allowlist + env source. */
export function logPlatformAdminDevDiagnostics(label: string, email: string | null | undefined): void {
  if (process.env.NODE_ENV !== "development") return
  const resolved = resolvePlatformAdminEnv()
  const parsed = getPlatformAdminEmails()
  const usingAlias = resolved && resolved.source !== PRIMARY_ENV

  console.info(`[platform-admin] ${label}`, {
    authEmailNormalized: email?.trim().toLowerCase() ?? null,
    parsedAdminEmails: parsed,
    parsedCount: parsed.length,
    envSource: resolved?.source ?? null,
    isPlatformAdmin: isPlatformAdminEmail(email),
  })

  if (usingAlias) {
    console.warn(
      `[platform-admin] using alias env var "${resolved.source}". Rename to "${PRIMARY_ENV}" to match production.`,
    )
  }

  if (!resolved) {
    console.warn(
      `[platform-admin] no allowlist configured. Set "${PRIMARY_ENV}=you@example.com" in .env.local to enable Platform Admin locally.`,
    )
  }
}
