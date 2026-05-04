import type { MaintenancePlan } from "@/lib/mock-data"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { rowToMaintenancePlan, type MaintenancePlanRow } from "@/lib/maintenance-plans/db-map"

export async function loadMaintenancePlansForOrg(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ plans: MaintenancePlan[]; error: string | null }> {
  const { data: rows, error } = await supabase
    .from("maintenance_plans")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })

  if (error) {
    return { plans: [], error: error.message }
  }

  const list = (rows ?? []) as MaintenancePlanRow[]
  if (list.length === 0) {
    return { plans: [], error: null }
  }

  const customerIds = [...new Set(list.map((r) => r.customer_id))]
  const equipmentIds = [
    ...new Set(list.map((r) => r.equipment_id).filter((id): id is string => Boolean(id))),
  ]
  const techIds = [...new Set(list.map((r) => r.assigned_user_id).filter((id): id is string => Boolean(id)))]

  const customerMap = new Map<string, string>()
  if (customerIds.length > 0) {
    const { data: custRows } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .in("id", customerIds)

    ;((custRows as Array<{ id: string; company_name: string }> | null) ?? []).forEach((c) => {
      customerMap.set(c.id, c.company_name)
    })
  }

  const equipmentMap = new Map<
    string,
    { name: string; category: string; location: string; equipment_code: string | null; serial_number: string | null }
  >()
  if (equipmentIds.length > 0) {
    const { data: eqRows } = await supabase
      .from("equipment")
      .select("id, name, category, location_label, equipment_code, serial_number")
      .eq("organization_id", organizationId)
      .in("id", equipmentIds)

    ;(
      (eqRows as Array<{
        id: string
        name: string
        category: string | null
        location_label: string | null
        equipment_code: string | null
        serial_number: string | null
      }> | null) ?? []
    ).forEach((e) => {
      equipmentMap.set(e.id, {
        name: e.name,
        category: e.category ?? "",
        location: e.location_label ?? "",
        equipment_code: e.equipment_code,
        serial_number: e.serial_number,
      })
    })
  }

  const profileMap = new Map<string, string>()
  if (techIds.length > 0) {
    const { data: profRows } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", techIds)

    ;(
      (profRows as Array<{ id: string; full_name: string | null; email: string | null }> | null) ?? []
    ).forEach((p) => {
      const label =
        (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || "Team member"
      profileMap.set(p.id, label)
    })
  }

  const plans: MaintenancePlan[] = list.map((row) => {
    const eq = row.equipment_id ? equipmentMap.get(row.equipment_id) : undefined
    const customerNameResolved = customerMap.get(row.customer_id) ?? "Unknown customer"
    return rowToMaintenancePlan(row, {
      customerName: customerNameResolved,
      equipmentName: eq
        ? getEquipmentDisplayPrimary({
            id: row.equipment_id!,
            name: eq.name,
            equipment_code: eq.equipment_code,
            serial_number: eq.serial_number,
            category: eq.category,
          })
        : "Equipment",
      equipmentCategory: eq?.category ?? "",
      location: eq?.location ?? "",
      technicianName: row.assigned_user_id ? profileMap.get(row.assigned_user_id) ?? "—" : "—",
    })
  })

  return { plans, error: null }
}
