import type { SupabaseClient } from "@supabase/supabase-js"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function validateLocationForCustomer(
  supabase: SupabaseClient,
  organizationId: string,
  customerId: string,
  locationId: string | null | undefined,
): Promise<string | null> {
  if (!locationId || !UUID_RE.test(locationId)) return null
  const { data } = await supabase
    .from("customer_locations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .eq("id", locationId)
    .is("archived_at", null)
    .maybeSingle()
  return data ? locationId : null
}

/**
 * Picks a service site for a new work order: explicit override, equipment site,
 * request snapshot, then customer default / first active location.
 */
export async function resolveCustomerLocationIdForWorkOrder(
  supabase: SupabaseClient,
  organizationId: string,
  customerId: string,
  opts: {
    explicit?: string | null
    equipmentId?: string | null
    fallbackFromRequest?: string | null
  },
): Promise<string | null> {
  const fromExplicit = await validateLocationForCustomer(
    supabase,
    organizationId,
    customerId,
    opts.explicit ?? null,
  )
  if (fromExplicit) return fromExplicit

  if (opts.equipmentId && UUID_RE.test(opts.equipmentId)) {
    const { data: eq } = await supabase
      .from("equipment")
      .select("customer_location_id, customer_id")
      .eq("organization_id", organizationId)
      .eq("id", opts.equipmentId)
      .maybeSingle()
    const row = eq as { customer_location_id: string | null; customer_id: string } | null
    if (row && row.customer_id === customerId) {
      const v = await validateLocationForCustomer(
        supabase,
        organizationId,
        customerId,
        row.customer_location_id,
      )
      if (v) return v
    }
  }

  const fromReq = await validateLocationForCustomer(
    supabase,
    organizationId,
    customerId,
    opts.fallbackFromRequest ?? null,
  )
  if (fromReq) return fromReq

  const { data: def } = await supabase
    .from("customer_locations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .eq("is_default", true)
    .is("archived_at", null)
    .maybeSingle()

  if (def) return (def as { id: string }).id

  const { data: anyLoc } = await supabase
    .from("customer_locations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .is("archived_at", null)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle()

  return (anyLoc as { id: string } | null)?.id ?? null
}
