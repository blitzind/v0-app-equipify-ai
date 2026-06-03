import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchLeadMemoryProfileView } from "@/lib/growth/lead-memory/dashboard"
import type { GrowthLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-types"
import { projectLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-projection"

export {
  mergeMemoryObjectionSummaries,
  memoryInfluencePromptBlock,
  projectLeadMemoryInfluenceContext,
} from "@/lib/growth/lead-memory/memory-influence-projection"

export async function buildLeadMemoryInfluenceContext(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLeadMemoryInfluenceContext> {
  const view = await fetchLeadMemoryProfileView(admin, leadId).catch(() => null)
  return projectLeadMemoryInfluenceContext(view)
}
