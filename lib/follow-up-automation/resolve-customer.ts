import type { SupabaseClient } from "@supabase/supabase-js"
import type { FollowUpEntityType } from "@/lib/follow-up-automation/types"

export async function resolveRecipientCustomerIdForTask(
  supabase: SupabaseClient,
  organizationId: string,
  entityType: FollowUpEntityType,
  entityId: string,
): Promise<string | null> {
  if (entityType === "customer") return entityId

  if (entityType === "invoice") {
    const { data } = await supabase
      .from("org_invoices")
      .select("customer_id")
      .eq("organization_id", organizationId)
      .eq("id", entityId)
      .maybeSingle()
    return (data as { customer_id?: string } | null)?.customer_id ?? null
  }

  if (entityType === "work_order") {
    const { data } = await supabase
      .from("work_orders")
      .select("customer_id")
      .eq("organization_id", organizationId)
      .eq("id", entityId)
      .maybeSingle()
    return (data as { customer_id?: string } | null)?.customer_id ?? null
  }

  if (entityType === "equipment") {
    const { data } = await supabase
      .from("equipment")
      .select("customer_id")
      .eq("organization_id", organizationId)
      .eq("id", entityId)
      .maybeSingle()
    return (data as { customer_id?: string } | null)?.customer_id ?? null
  }

  if (entityType === "prospect") {
    const { data } = await supabase
      .from("prospects")
      .select("converted_customer_id")
      .eq("organization_id", organizationId)
      .eq("id", entityId)
      .maybeSingle()
    return (data as { converted_customer_id?: string | null } | null)?.converted_customer_id ?? null
  }

  return null
}
