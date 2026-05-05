import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Before setting a row as default, clear `is_default` on other active locations
 * for this customer so the partial unique index
 * (is_default && archived_at is null) is satisfied.
 */
export async function clearOtherDefaultCustomerLocations(
  supabase: SupabaseClient,
  args: { organizationId: string; customerId: string; exceptLocationId?: string },
) {
  let q = supabase
    .from("customer_locations")
    .update({ is_default: false })
    .eq("organization_id", args.organizationId)
    .eq("customer_id", args.customerId)
    .is("archived_at", null)

  if (args.exceptLocationId) {
    q = q.neq("id", args.exceptLocationId)
  }

  return q
}
