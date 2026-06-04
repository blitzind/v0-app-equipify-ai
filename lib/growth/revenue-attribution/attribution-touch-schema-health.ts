import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_ATTRIBUTION_TOUCH_LEDGER_MIGRATION } from "@/lib/growth/revenue-attribution/attribution-touch-types"

export { GROWTH_ATTRIBUTION_TOUCH_LEDGER_MIGRATION }

export async function isGrowthAttributionTouchLedgerSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error: touchErr } = await admin.schema("growth").from("attribution_touches").select("id").limit(1)
  const { error: pathErr } = await admin.schema("growth").from("attribution_paths").select("id").limit(1)
  return !touchErr && !pathErr
}
