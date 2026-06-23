/** GE-AUTO-2C — Resolve organization context for objective event fan-in (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"

export async function resolveGrowthObjectiveOrganizationId(
  admin: SupabaseClient,
  input: { organizationId?: string | null; leadId?: string | null },
): Promise<string | null> {
  if (input.organizationId?.trim()) return input.organizationId.trim()
  if (!input.leadId?.trim()) return null

  const lead = await fetchGrowthLeadById(admin, input.leadId.trim())
  return lead?.promotedOrganizationId?.trim() ?? null
}
