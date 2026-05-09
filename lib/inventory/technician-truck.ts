import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type InventorySvc = SupabaseClient

/**
 * Resolve `technicians.id` for an active org member login (auth user id).
 */
export async function resolveTechnicianDbIdForUser(
  svc: InventorySvc,
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const { data: mem } = await svc
    .from("organization_members")
    .select("membership_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  const membershipId = (mem as { membership_id?: string | null } | null)?.membership_id ?? null
  if (!membershipId) return null

  const { data: tech } = await svc
    .from("technicians")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("membership_id", membershipId)
    .maybeSingle()

  return (tech as { id?: string } | null)?.id ?? null
}

/** Primary vehicle/van stock location for a technician (`technicians.id`). */
export async function resolveVehicleLocationIdForTechnician(
  svc: InventorySvc,
  organizationId: string,
  technicianDbId: string,
): Promise<string | null> {
  const { data: row } = await svc
    .from("technician_vehicle_stock")
    .select("inventory_location_id")
    .eq("organization_id", organizationId)
    .eq("technician_id", technicianDbId)
    .maybeSingle()

  return (row as { inventory_location_id?: string } | null)?.inventory_location_id ?? null
}

export async function resolveVehicleLocationIdForUser(
  svc: InventorySvc,
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const techId = await resolveTechnicianDbIdForUser(svc, organizationId, userId)
  if (!techId) return null
  return resolveVehicleLocationIdForTechnician(svc, organizationId, techId)
}

/**
 * Resolve `technicians.id` from profile user id (same id as TechnicianDrawer `techId`).
 */
export async function resolveTechnicianDbIdForProfileUser(
  svc: InventorySvc,
  organizationId: string,
  profileUserId: string,
): Promise<string | null> {
  return resolveTechnicianDbIdForUser(svc, organizationId, profileUserId)
}
