"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { normalizeIndustryKey } from "@/lib/demo-seeding/profiles"
import { buildEquipmentTypeSeedRowsForIndustry } from "@/lib/equipment/organization-equipment-type-seeds"

const MANAGER_ROLES = new Set(["owner", "admin", "manager"])

async function assertManagerPlus(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  if (error || !data?.role) {
    return { ok: false, message: "You do not have access to this organization." }
  }
  if (!MANAGER_ROLES.has(data.role)) {
    return { ok: false, message: "You do not have permission to manage equipment types." }
  }
  return { ok: true }
}

/**
 * When an org has no active equipment types, insert industry-aware seed rows (idempotent per org).
 */
export async function ensureOrganizationEquipmentTypesIfEmptyAction(
  organizationId: string,
): Promise<{ ok: boolean; message?: string; seeded?: boolean }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Not authenticated." }

  const gate = await assertManagerPlus(supabase, organizationId, user.id)
  if (!gate.ok) return gate

  const { data: existing, error: exErr } = await supabase
    .from("organization_equipment_types")
    .select("id")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle()

  if (exErr) return { ok: false, message: exErr.message }
  if (existing) return { ok: true, seeded: false }

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("industry")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr || !org) return { ok: false, message: orgErr?.message ?? "Organization not found." }

  const industryKey = normalizeIndustryKey((org as { industry?: string | null }).industry)
  const seeds = buildEquipmentTypeSeedRowsForIndustry(industryKey)
  const rows = seeds.map((s) => ({
    organization_id: organizationId,
    name: s.name,
    description: s.description,
    color: s.color,
    icon: s.icon,
    sort_order: s.sort_order,
    is_seed: true,
    seed_key: s.seed_key,
  }))

  const { error: insErr } = await supabase.from("organization_equipment_types").insert(rows)
  if (insErr) {
    if (insErr.code === "23505") {
      return { ok: true, seeded: false }
    }
    return { ok: false, message: insErr.message }
  }
  return { ok: true, seeded: true }
}

/**
 * Archives active seed rows and inserts a fresh industry template set. Custom types are untouched.
 */
export async function resetOrganizationEquipmentTypeSeedsAction(
  organizationId: string,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Not authenticated." }

  const gate = await assertManagerPlus(supabase, organizationId, user.id)
  if (!gate.ok) return gate

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("industry")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr || !org) return { ok: false, message: orgErr?.message ?? "Organization not found." }

  const industryKey = normalizeIndustryKey((org as { industry?: string | null }).industry)
  const seeds = buildEquipmentTypeSeedRowsForIndustry(industryKey)

  const { error: archErr } = await supabase
    .from("organization_equipment_types")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("is_seed", true)
    .is("archived_at", null)

  if (archErr) return { ok: false, message: archErr.message }

  const rows = seeds.map((s) => ({
    organization_id: organizationId,
    name: s.name,
    description: s.description,
    color: s.color,
    icon: s.icon,
    sort_order: s.sort_order,
    is_seed: true,
    seed_key: s.seed_key,
  }))

  const { error: insErr } = await supabase.from("organization_equipment_types").insert(rows)
  if (insErr) return { ok: false, message: insErr.message }
  return { ok: true }
}
