/** FUZOR-ADOPTION-1E — Resolve GS-3 organization scope via existing Equipify authority (server-only). */

import "server-only"

import { getGrowthEngineAiOrgId } from "@/lib/growth/growth-engine-session"

/**
 * Resolve organization for Knowledge calls without relying on Fuzor process-global defaults.
 * Explicit caller IDs win; omitted IDs use Equipify env semantics at call time.
 */
export function resolveKnowledgeOrganizationId(organizationId?: string | null): string | null {
  return organizationId ?? getGrowthEngineAiOrgId()
}

/** Alias for server entry points that require a resolved default before delegation. */
export function ensureKnowledgeOrganizationBootstrap(organizationId?: string | null): string | null {
  return resolveKnowledgeOrganizationId(organizationId)
}
