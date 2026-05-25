/** Dev-only session context logging — never log tokens or secrets. */
export type SessionContextDiagnostics = {
  label: string
  authUserId?: string | null
  profileUserId?: string | null
  profileEmail?: string | null
  activeOrganizationId?: string | null
  orgMemberRole?: string | null
  platformAdmin?: boolean
}

function shouldLogSessionContext(): boolean {
  return process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEBUG_NAV === "true"
}

function redactOrgId(orgId: string | null | undefined): string | null | undefined {
  if (!orgId || process.env.NODE_ENV !== "production") return orgId
  if (orgId.length <= 8) return orgId
  return `…${orgId.slice(-6)}`
}

export function logSessionContextDiagnostics(details: SessionContextDiagnostics): void {
  if (!shouldLogSessionContext()) return
  console.info(`[equipify:session-context] ${details.label}`, {
    authUserId: details.authUserId ?? null,
    profileUserId: details.profileUserId ?? null,
    profileEmail: details.profileEmail?.trim().toLowerCase() ?? null,
    activeOrganizationId: redactOrgId(details.activeOrganizationId),
    orgMemberRole: details.orgMemberRole ?? null,
    platformAdmin: details.platformAdmin ?? null,
  })
}
