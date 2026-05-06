import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

/** Active extraction work for this import (queued or processing). */
export async function getActiveCatalogJobForImport(
  svc: SupabaseClient,
  organizationId: string,
  importId: string,
): Promise<string | null> {
  const { data } = await svc
    .from("ai_jobs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("source_type", "price_list_import")
    .eq("source_id", importId)
    .eq("task", "catalog_extraction")
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return typeof data?.id === "string" ? data.id : null
}
