import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { mergeSampleWorkOrderIds } from "@/lib/demo-data/merge-sample-work-order-ids"

const ID_CHUNK = 120

/** Precision biomedical inventory locations (legacy script + rich medical seed). */
const DEMO_INVENTORY_LOCATION_CODE_PREFIX_PBS = "PBS-SEED-%"
/** Generic industry demo locations from `lib/demo-seeding/industry-sample-packs.ts`. */
const DEMO_INVENTORY_LOCATION_CODE_PREFIX_EQ = "EQ-DEMO-LOC-%"

export type ResetSampleSummary = {
  organizationInvoices: number
  organizationQuotes: number
  organizationPurchaseOrders: number
  aiOpsRecommendationEvents: number
  aiOpsRecommendationLifecycle: number
  technicianSkillTags: number
  communicationEvents: number
  calibrationRecords: number
  certificateAttachments: number
  workOrderAttachments: number
  inventoryTransactions: number
  inventoryStock: number
  technicianVehicleStock: number
  demoInventoryLocations: number
  catalogItems: number
  calibrationTemplates: number
  techniciansOperational: number
  orgVendors: number
  workOrders: number
  maintenancePlans: number
  equipment: number
  prospects: number
  customers: number
  technicianCerts: number
  technicianNotes: number
  organizationMembers: number
  serviceRequests: number
}

function countDeleted(res: { error: { message: string } | null; data: unknown }): number {
  if (res.error) throw new Error(res.error.message)
  const rows = res.data
  return Array.isArray(rows) ? rows.length : 0
}

async function deleteInIdChunks(
  admin: SupabaseClient,
  table: string,
  organizationId: string,
  column: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0
  let total = 0
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const slice = ids.slice(i, i + ID_CHUNK)
    const res = await admin
      .from(table)
      .delete()
      .eq("organization_id", organizationId)
      .in(column, slice)
      .select("id")
    total += countDeleted(res)
  }
  return total
}

async function deleteCommunicationEventsByRelatedEntity(
  admin: SupabaseClient,
  organizationId: string,
  relatedEntityType: string,
  relatedIds: string[],
): Promise<number> {
  if (relatedIds.length === 0) return 0
  let total = 0
  for (let i = 0; i < relatedIds.length; i += ID_CHUNK) {
    const slice = relatedIds.slice(i, i + ID_CHUNK)
    const res = await admin
      .from("communication_events")
      .delete()
      .eq("organization_id", organizationId)
      .eq("related_entity_type", relatedEntityType)
      .in("related_entity_id", slice)
      .select("id")
    total += countDeleted(res)
  }
  return total
}

async function collectPmAutomationWorkOrderIdsForSampleReset(
  admin: SupabaseClient,
  organizationId: string,
  sampleMaintenancePlanIds: string[],
  sampleEquipmentIds: string[],
  sampleCustomerIds: string[],
): Promise<string[]> {
  const found = new Set<string>()

  async function collectByColumn(column: "maintenance_plan_id" | "equipment_id" | "customer_id", ids: string[]) {
    if (ids.length === 0) return
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const slice = ids.slice(i, i + ID_CHUNK)
      const { data, error } = await admin
        .from("work_orders")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("created_by_pm_automation", true)
        .in(column, slice)
      if (error) throw new Error(error.message)
      for (const row of data ?? []) {
        found.add((row as { id: string }).id)
      }
    }
  }

  await collectByColumn("maintenance_plan_id", sampleMaintenancePlanIds)
  await collectByColumn("equipment_id", sampleEquipmentIds)
  await collectByColumn("customer_id", sampleCustomerIds)

  return [...found]
}

/**
 * Deletes only rows clearly marked as sample/demo (`is_sample`, seed metadata, or
 * known demo inventory location codes). Scoped by `organization_id`. Ordering
 * respects inventory → catalog and composite FKs.
 */
export async function resetSampleDataForOrganization(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ summary: ResetSampleSummary }> {
  const summary: ResetSampleSummary = {
    organizationInvoices: 0,
    organizationQuotes: 0,
    organizationPurchaseOrders: 0,
    aiOpsRecommendationEvents: 0,
    aiOpsRecommendationLifecycle: 0,
    technicianSkillTags: 0,
    communicationEvents: 0,
    calibrationRecords: 0,
    certificateAttachments: 0,
    workOrderAttachments: 0,
    inventoryTransactions: 0,
    inventoryStock: 0,
    technicianVehicleStock: 0,
    demoInventoryLocations: 0,
    catalogItems: 0,
    calibrationTemplates: 0,
    techniciansOperational: 0,
    orgVendors: 0,
    workOrders: 0,
    maintenancePlans: 0,
    equipment: 0,
    prospects: 0,
    customers: 0,
    technicianCerts: 0,
    technicianNotes: 0,
    organizationMembers: 0,
    serviceRequests: 0,
  }

  const [
    { data: sampleMembers },
    { data: customerRows },
    { data: woRows },
    { data: equipmentRows },
    { data: catalogRows },
    { data: techRows },
    { data: prospectRows },
    { data: quoteRows },
    { data: invoiceRows },
    { data: mpRows },
    { data: demoLocRowsPbs },
    { data: demoLocRowsEq },
    { data: serviceRequestRows },
  ] = await Promise.all([
    admin.from("organization_members").select("user_id").eq("organization_id", organizationId).eq("is_sample", true),
    admin.from("customers").select("id").eq("organization_id", organizationId).eq("is_sample", true),
    admin.from("work_orders").select("id").eq("organization_id", organizationId).eq("is_sample", true),
    admin.from("equipment").select("id").eq("organization_id", organizationId).eq("is_sample", true),
    admin.from("catalog_items").select("id").eq("organization_id", organizationId).eq("is_sample", true),
    admin.from("technicians").select("id").eq("organization_id", organizationId).eq("is_sample", true),
    admin.from("prospects").select("id").eq("organization_id", organizationId).eq("is_sample", true),
    admin.from("org_quotes").select("id").eq("organization_id", organizationId).eq("is_sample", true),
    admin.from("org_invoices").select("id").eq("organization_id", organizationId).eq("is_sample", true),
    admin.from("maintenance_plans").select("id").eq("organization_id", organizationId).eq("is_sample", true),
    admin
      .from("inventory_locations")
      .select("id")
      .eq("organization_id", organizationId)
      .like("code", DEMO_INVENTORY_LOCATION_CODE_PREFIX_PBS),
    admin
      .from("inventory_locations")
      .select("id")
      .eq("organization_id", organizationId)
      .like("code", DEMO_INVENTORY_LOCATION_CODE_PREFIX_EQ),
    admin.from("org_service_requests").select("id").eq("organization_id", organizationId).eq("is_sample", true),
  ])

  const sampleUserIds = [...new Set((sampleMembers ?? []).map((r) => (r as { user_id: string }).user_id))]
  const sampleCustomerIds = (customerRows ?? []).map((r) => (r as { id: string }).id)
  const sampleWoIds = (woRows ?? []).map((r) => (r as { id: string }).id)
  const sampleEquipmentIds = (equipmentRows ?? []).map((r) => (r as { id: string }).id)
  const sampleCatalogIds = (catalogRows ?? []).map((r) => (r as { id: string }).id)
  const sampleTechIds = (techRows ?? []).map((r) => (r as { id: string }).id)
  const sampleProspectIds = (prospectRows ?? []).map((r) => (r as { id: string }).id)
  const sampleQuoteIds = (quoteRows ?? []).map((r) => (r as { id: string }).id)
  const sampleInvoiceIds = (invoiceRows ?? []).map((r) => (r as { id: string }).id)
  const sampleMpIds = (mpRows ?? []).map((r) => (r as { id: string }).id)
  const demoLocationIds = [
    ...new Set(
      [...(demoLocRowsPbs ?? []), ...(demoLocRowsEq ?? [])].map((r) => (r as { id: string }).id),
    ),
  ]
  const sampleServiceRequestIds = (serviceRequestRows ?? []).map((r) => (r as { id: string }).id)

  const pmAutomationWoIds = await collectPmAutomationWorkOrderIdsForSampleReset(
    admin,
    organizationId,
    sampleMpIds,
    sampleEquipmentIds,
    sampleCustomerIds,
  )
  const workOrderIdsToDelete = mergeSampleWorkOrderIds(sampleWoIds, pmAutomationWoIds)

  if (sampleUserIds.length > 0) {
    const tcRes = await admin
      .from("technician_certifications")
      .delete()
      .eq("organization_id", organizationId)
      .in("technician_user_id", sampleUserIds)
      .select("id")
    summary.technicianCerts = countDeleted(tcRes)

    const tnRes = await admin
      .from("technician_notes")
      .delete()
      .eq("organization_id", organizationId)
      .in("technician_user_id", sampleUserIds)
      .select("id")
    summary.technicianNotes = countDeleted(tnRes)
  }

  const commDeletes = await Promise.all([
    admin
      .from("communication_events")
      .delete()
      .eq("organization_id", organizationId)
      .contains("metadata", { pbs_demo_seed: true })
      .select("id"),
    admin
      .from("communication_events")
      .delete()
      .eq("organization_id", organizationId)
      .contains("metadata", { equipify_demo_seed: true })
      .select("id"),
  ])
  summary.communicationEvents += commDeletes.reduce((a, r) => a + countDeleted(r), 0)

  summary.communicationEvents += await deleteInIdChunks(
    admin,
    "communication_events",
    organizationId,
    "recipient_customer_id",
    sampleCustomerIds,
  )

  const relatedTotal = await Promise.all([
    deleteCommunicationEventsByRelatedEntity(admin, organizationId, "work_order", workOrderIdsToDelete),
    deleteCommunicationEventsByRelatedEntity(admin, organizationId, "customer", sampleCustomerIds),
    deleteCommunicationEventsByRelatedEntity(admin, organizationId, "equipment", sampleEquipmentIds),
    deleteCommunicationEventsByRelatedEntity(admin, organizationId, "quote", sampleQuoteIds),
    deleteCommunicationEventsByRelatedEntity(admin, organizationId, "invoice", sampleInvoiceIds),
    deleteCommunicationEventsByRelatedEntity(admin, organizationId, "maintenance_plan", sampleMpIds),
    deleteCommunicationEventsByRelatedEntity(admin, organizationId, "prospect", sampleProspectIds),
  ])
  summary.communicationEvents += relatedTotal.reduce((a, n) => a + n, 0)

  summary.communicationEvents += await deleteCommunicationEventsByRelatedEntity(
    admin,
    organizationId,
    "service_request",
    sampleServiceRequestIds,
  )

  const delAiOpsEv = await admin
    .from("ai_ops_recommendation_events")
    .delete()
    .eq("organization_id", organizationId)
    .like("recommendation_key", "demo_seed%")
    .select("id")
  summary.aiOpsRecommendationEvents = countDeleted(delAiOpsEv)

  const delAiOpsLc = await admin
    .from("ai_ops_recommendation_lifecycle")
    .delete()
    .eq("organization_id", organizationId)
    .like("recommendation_key", "demo_seed%")
    .select("id")
  summary.aiOpsRecommendationLifecycle = countDeleted(delAiOpsLc)

  const delSkillTags = await admin
    .from("technician_skill_tags")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.technicianSkillTags = countDeleted(delSkillTags)

  const delServiceRequests = await admin
    .from("org_service_requests")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.serviceRequests = countDeleted(delServiceRequests)

  const calRecRes = await admin
    .from("calibration_records")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.calibrationRecords = countDeleted(calRecRes)

  summary.certificateAttachments = await deleteInIdChunks(
    admin,
    "certificate_attachments",
    organizationId,
    "work_order_id",
    workOrderIdsToDelete,
  )

  summary.workOrderAttachments = await deleteInIdChunks(
    admin,
    "work_order_attachments",
    organizationId,
    "work_order_id",
    workOrderIdsToDelete,
  )

  const delInv = await admin
    .from("org_invoices")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.organizationInvoices = countDeleted(delInv)

  const delQt = await admin
    .from("org_quotes")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.organizationQuotes = countDeleted(delQt)

  const delPo = await admin
    .from("org_purchase_orders")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.organizationPurchaseOrders = countDeleted(delPo)

  if (sampleCatalogIds.length > 0) {
    summary.inventoryTransactions += await deleteInIdChunks(
      admin,
      "inventory_transactions",
      organizationId,
      "catalog_item_id",
      sampleCatalogIds,
    )
    summary.inventoryStock += await deleteInIdChunks(admin, "inventory_stock", organizationId, "catalog_item_id", sampleCatalogIds)
  }

  if (demoLocationIds.length > 0) {
    summary.inventoryTransactions += await deleteInIdChunks(
      admin,
      "inventory_transactions",
      organizationId,
      "location_id",
      demoLocationIds,
    )
    summary.inventoryTransactions += await deleteInIdChunks(
      admin,
      "inventory_transactions",
      organizationId,
      "counterparty_location_id",
      demoLocationIds,
    )
    summary.inventoryStock += await deleteInIdChunks(admin, "inventory_stock", organizationId, "location_id", demoLocationIds)
  }

  if (workOrderIdsToDelete.length > 0) {
    for (let i = 0; i < workOrderIdsToDelete.length; i += ID_CHUNK) {
      const slice = workOrderIdsToDelete.slice(i, i + ID_CHUNK)
      const r = await admin
        .from("inventory_transactions")
        .delete()
        .eq("organization_id", organizationId)
        .in("work_order_id", slice)
        .select("id")
      summary.inventoryTransactions += countDeleted(r)
    }
  }

  if (sampleTechIds.length > 0) {
    summary.technicianVehicleStock += await deleteInIdChunks(
      admin,
      "technician_vehicle_stock",
      organizationId,
      "technician_id",
      sampleTechIds,
    )
  }
  if (demoLocationIds.length > 0) {
    summary.technicianVehicleStock += await deleteInIdChunks(
      admin,
      "technician_vehicle_stock",
      organizationId,
      "inventory_location_id",
      demoLocationIds,
    )
  }

  summary.demoInventoryLocations = await deleteInIdChunks(
    admin,
    "inventory_locations",
    organizationId,
    "id",
    demoLocationIds,
  )

  const delCat = await admin
    .from("catalog_items")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.catalogItems = countDeleted(delCat)

  const delVend = await admin
    .from("org_vendors")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.orgVendors = countDeleted(delVend)

  summary.workOrders = await deleteInIdChunks(
    admin,
    "work_orders",
    organizationId,
    "id",
    workOrderIdsToDelete,
  )

  const delMp = await admin
    .from("maintenance_plans")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.maintenancePlans = countDeleted(delMp)

  const delTpl = await admin
    .from("calibration_templates")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.calibrationTemplates = countDeleted(delTpl)

  const delEq = await admin
    .from("equipment")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.equipment = countDeleted(delEq)

  const delProspects = await admin
    .from("prospects")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.prospects = countDeleted(delProspects)

  const delCust = await admin
    .from("customers")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.customers = countDeleted(delCust)

  const delOm = await admin
    .from("organization_members")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("user_id")
  summary.organizationMembers = countDeleted(delOm)

  const delTechOp = await admin
    .from("technicians")
    .delete()
    .eq("organization_id", organizationId)
    .eq("is_sample", true)
    .select("id")
  summary.techniciansOperational = countDeleted(delTechOp)

  const { error: orgErr } = await admin
    .from("organizations")
    .update({
      demo_seed_industry: null,
      demo_seed_error: null,
      demo_seed_status: "pending",
      demo_seed_started_at: null,
      demo_seed_completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId)
  if (orgErr) throw new Error(orgErr.message)

  return { summary }
}
