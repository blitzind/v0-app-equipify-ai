import { isPlatformAdminEmail } from "@/lib/platform-admin"
import type { GrowthGovernanceAction } from "@/lib/growth/governance/governance-types"

export function isGovernanceActorAllowed(actorEmail: string): boolean {
  return isPlatformAdminEmail(actorEmail)
}

export function roleAllowsAction(input: {
  action: GrowthGovernanceAction
  actorEmail: string
  allowedRoles?: string[]
}): boolean {
  if (!isGovernanceActorAllowed(input.actorEmail)) return false
  if (!input.allowedRoles?.length) return true
  const normalized = input.actorEmail.trim().toLowerCase()
  return input.allowedRoles.some((role) => normalized.includes(role.trim().toLowerCase()))
}

export function evaluateRoleCanSend(actorEmail: string, config: Record<string, unknown>): boolean {
  const allowedRoles = Array.isArray(config.allowed_roles)
    ? (config.allowed_roles as string[])
    : ["platform_admin"]
  return roleAllowsAction({ action: "provider_send", actorEmail, allowedRoles })
}

export function evaluateRoleCanApprove(actorEmail: string, config: Record<string, unknown>): boolean {
  const allowedRoles = Array.isArray(config.allowed_roles)
    ? (config.allowed_roles as string[])
    : ["platform_admin"]
  return roleAllowsAction({ action: "sequence_job_approve", actorEmail, allowedRoles })
}

export function evaluateRoleCanExport(actorEmail: string, config: Record<string, unknown>): boolean {
  const allowedRoles = Array.isArray(config.allowed_roles)
    ? (config.allowed_roles as string[])
    : ["platform_admin"]
  return roleAllowsAction({ action: "export_generate", actorEmail, allowedRoles })
}
