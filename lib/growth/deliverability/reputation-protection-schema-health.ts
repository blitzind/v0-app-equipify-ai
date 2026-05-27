/** Schema health for deliverability reputation protection v1. */

import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_MIGRATION =
  "20270531130000_growth_deliverability_reputation_protection.sql" as const

export const GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_SETUP_MESSAGE =
  "Deliverability reputation protection schema is not applied. Run supabase db push."

export async function isGrowthDeliverabilityReputationProtectionSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const tables = [
    "mailbox_reputation_snapshots",
    "mailbox_send_policies",
    "deliverability_governance_events",
  ] as const

  for (const table of tables) {
    const { error } = await admin.schema("growth").from(table).select("id").limit(1)
    if (error) return false
  }
  return true
}
