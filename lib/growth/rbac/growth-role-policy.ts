/**
 * GS-RBAC-1A — Growth role resolution from allowlists + Growth org membership.
 * Edge-safe email allowlist helpers only; async membership resolution lives in server module.
 */

const OPERATOR_ENV = "GROWTH_ENGINE_OPERATOR_EMAILS"
const MANAGER_ENV = "GROWTH_ENGINE_MANAGER_EMAILS"

function parseEmailAllowlist(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

export function getGrowthOperatorEmails(): string[] {
  return parseEmailAllowlist(process.env[OPERATOR_ENV])
}

export function getGrowthManagerEmails(): string[] {
  return parseEmailAllowlist(process.env[MANAGER_ENV])
}

export function isGrowthOperatorEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getGrowthOperatorEmails().includes(email.trim().toLowerCase())
}

export function isGrowthManagerEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getGrowthManagerEmails().includes(email.trim().toLowerCase())
}

/** Org DB roles that map to Growth Manager when member of the configured Growth org. */
export const GROWTH_MANAGER_ORG_ROLES = new Set(["owner", "admin"])
