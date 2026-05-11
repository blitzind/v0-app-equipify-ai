import "server-only"

/**
 * Best-effort mapping of low-level errors raised during signup/provisioning
 * into polished user-facing messages. The original error is always logged
 * server-side so we never lose debugging context.
 */
export type ProvisioningErrorCode =
  | "trial_bootstrap_failed"
  | "organization_create_failed"
  | "profile_failed"
  | "seed_failed"
  | "service_unavailable"
  | "internal_error"

const KNOWN_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /created_by cannot be set without an authenticated user|created_by cannot be determined/i,
    message: "We couldn't finish your workspace setup. Please try again — if this keeps happening, contact support.",
  },
  {
    pattern: /duplicate key value violates unique constraint/i,
    message: "Some workspace records already exist. We'll continue with what's already there.",
  },
  {
    pattern: /violates row-level security policy|permission denied for|insufficient_privilege/i,
    message: "Workspace permissions are still warming up. Please wait a moment and try again.",
  },
  {
    pattern: /Sample rows are still present/i,
    message: "Existing sample data was detected. We've cleaned it up — please retry.",
  },
  {
    pattern: /Server is not configured|Missing SUPABASE_SERVICE_ROLE_KEY|Missing NEXT_PUBLIC_SUPABASE_URL/i,
    message: "Workspace setup is temporarily unavailable. Please try again shortly.",
  },
]

export function sanitizeProvisioningError(rawMessage: string | null | undefined, fallback: string): string {
  const trimmed = (rawMessage ?? "").trim()
  if (!trimmed) return fallback
  for (const candidate of KNOWN_PATTERNS) {
    if (candidate.pattern.test(trimmed)) return candidate.message
  }

  // If the error looks like raw DB / SQL / Postgres internals, hide it.
  if (/\b(?:relation|column|trigger|function|constraint|sql|postgres|supabase)\b/i.test(trimmed)) {
    return fallback
  }
  return trimmed
}

export function describeProvisioningPhaseFailure(code: ProvisioningErrorCode): string {
  switch (code) {
    case "trial_bootstrap_failed":
      return "We couldn't activate your trial subscription. Please try again."
    case "organization_create_failed":
      return "We couldn't create your workspace. Please try again."
    case "profile_failed":
      return "We couldn't finalize your profile. Please try again or sign in to retry."
    case "seed_failed":
      return "We couldn't load your sample data. Please try again — your account is otherwise ready."
    case "service_unavailable":
      return "Workspace setup is temporarily unavailable. Please try again shortly."
    case "internal_error":
    default:
      return "We couldn't finish setting up your workspace. Please try again."
  }
}
