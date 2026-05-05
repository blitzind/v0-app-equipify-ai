import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type ResetSampleSummary = {
  organizationInvoices: number
  organizationQuotes: number
  workOrders: number
  maintenancePlans: number
  equipment: number
  customers: number
  technicianCerts: number
  technicianNotes: number
  organizationMembers: number
}

/**
 * Deletes only rows marked `is_sample = true`. Safe ordering respects composite FKs.
 */
export async function resetSampleDataForOrganization(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ summary: ResetSampleSummary }> {
  const summary: ResetSampleSummary = {
    organizationInvoices: 0,
    organizationQuotes: 0,
    workOrders: 0,
    maintenancePlans: 0,
    equipment: 0,
    customers: 0,
    technicianCerts: 0,
    technicianNotes: 0,
    organizationMembers: 0,
  }

  const { data: sampleMembers } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("is_sample", true)

  const sampleUserIds = [...new Set((sampleMembers ?? []).map((r) => (r as { user_id: string }).user_id))]

  if (sampleUserIds.length > 0) {
    const tcRes = await admin
      .from("technician_certifications")
      .delete()
      .eq("organization_id", organizationId)
      .in("technician_user_id", sampleUserIds)
      .select("id")
    if (tcRes.error) throw new Error(tcRes.error.message)
    summary.technicianCerts = tcRes.data?.length ?? 0

    const tnRes = await admin
      .from("technician_notes")
      .delete()
      .eq("organization_id", organizationId)
      .in("technician_user_id", sampleUserIds)
      .select("id")
    if (tnRes.error) throw new Error(tnRes.error.message)
    summary.technicianNotes = tnRes.data?.length ?? 0
  }

  const delInv = await admin
    .from("org_invoices")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  if (delInv.error) throw new Error(delInv.error.message)
  summary.organizationInvoices = delInv.data?.length ?? 0

  const delQt = await admin
    .from("org_quotes")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  if (delQt.error) throw new Error(delQt.error.message)
  summary.organizationQuotes = delQt.data?.length ?? 0

  const delWo = await admin
    .from("work_orders")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  if (delWo.error) throw new Error(delWo.error.message)
  summary.workOrders = delWo.data?.length ?? 0

  const delMp = await admin
    .from("maintenance_plans")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  if (delMp.error) throw new Error(delMp.error.message)
  summary.maintenancePlans = delMp.data?.length ?? 0

  const delEq = await admin
    .from("equipment")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  if (delEq.error) throw new Error(delEq.error.message)
  summary.equipment = delEq.data?.length ?? 0

  const delCust = await admin
    .from("customers")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  if (delCust.error) throw new Error(delCust.error.message)
  summary.customers = delCust.data?.length ?? 0

  const delOm = await admin
    .from("organization_members")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("user_id")
  if (delOm.error) throw new Error(delOm.error.message)
  summary.organizationMembers = delOm.data?.length ?? 0

  const { error: clearIndustryErr } = await admin
    .from("organizations")
    .update({ demo_seed_industry: null, updated_at: new Date().toISOString() })
    .eq("id", organizationId)
  if (clearIndustryErr) throw new Error(clearIndustryErr.message)

  return { summary }
}
