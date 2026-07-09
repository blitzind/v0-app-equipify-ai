/** GE-AIOS-17C — Organization knowledge schema probe (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_ORGANIZATION_KNOWLEDGE_TABLE } from "@/lib/growth/memory/knowledge/organization-knowledge-types"

export async function isOrganizationKnowledgeSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from(GROWTH_ORGANIZATION_KNOWLEDGE_TABLE).select("knowledge_id").limit(1)
  return !error
}
