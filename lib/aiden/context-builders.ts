import type { SupabaseClient } from "@supabase/supabase-js"
import type { AidenAnswerAction } from "@/lib/aiden/aiden-response-rules"
import { allowedModuleActions, moduleFromPath } from "@/lib/aiden/module-context"
import type { OrgPermissions } from "@/lib/permissions/model"

export type AidenSelectedEntityIds = {
  customerId?: string | null
  equipmentId?: string | null
  workOrderId?: string | null
  invoiceId?: string | null
  quoteId?: string | null
  maintenancePlanId?: string | null
}

export type AidenClientPageContext = {
  currentPath?: string | null
  currentModule?: string | null
  visibleTitle?: string | null
  organizationId?: string | null
  selectedEntityIds?: AidenSelectedEntityIds
  currentRecord?: AidenCurrentRecord | null
  pageState?: Record<string, string | number | boolean | null>
}

export type AidenCurrentRecord = {
  type: string
  id?: string | null
  label?: string | null
  number?: string | null
  status?: string | null
  customer?: string | null
  equipment?: string | null
  assignedTech?: string | null
  serial?: string | null
}

export type AidenNormalizedContext = {
  module: string
  moduleId: string
  path: string | null
  visibleTitle: string | null
  organization: {
    id: string
    name: string | null
  }
  currentRecord: AidenCurrentRecord | null
  selectedEntityIds: AidenSelectedEntityIds
  pageState: Record<string, string | number | boolean | null>
  allowedActions: AidenAnswerAction[]
  limitations: string[]
  permissionSummary: string[]
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function cleanString(value: unknown, max = 160): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function cleanId(value: unknown): string | null {
  const s = cleanString(value, 80)
  return s && UUID_RE.test(s) ? s : null
}

function cleanIds(ids?: AidenSelectedEntityIds | null): AidenSelectedEntityIds {
  return {
    customerId: cleanId(ids?.customerId),
    equipmentId: cleanId(ids?.equipmentId),
    workOrderId: cleanId(ids?.workOrderId),
    invoiceId: cleanId(ids?.invoiceId),
    quoteId: cleanId(ids?.quoteId),
    maintenancePlanId: cleanId(ids?.maintenancePlanId),
  }
}

export function inferSelectedEntityIdsFromLocation(pathname: string, search: string): AidenSelectedEntityIds {
  const params = new URLSearchParams(search)
  const ids: AidenSelectedEntityIds = {
    customerId: params.get("customerId"),
    equipmentId: params.get("equipmentId"),
    workOrderId: params.get("workOrderId") || params.get("open"),
    invoiceId: params.get("invoiceId") || params.get("open"),
    quoteId: params.get("quoteId") || params.get("open"),
    maintenancePlanId: params.get("maintenancePlanId") || params.get("planId") || params.get("open"),
  }
  const parts = pathname.split("/").filter(Boolean)
  if (parts[0] === "customers" && parts[1]) ids.customerId = parts[1]
  if (parts[0] === "equipment" && parts[1]) ids.equipmentId = parts[1]
  if (parts[0] === "work-orders" && parts[1]) ids.workOrderId = parts[1]
  return cleanIds(ids)
}

export function buildClientAidenContext(args: {
  pathname: string
  search: string
  organizationId: string | null
  organizationName: string | null
  permissions: OrgPermissions
}): AidenClientPageContext {
  const mod = moduleFromPath(args.pathname)
  const params = new URLSearchParams(args.search)
  return {
    currentPath: args.pathname,
    currentModule: mod.label,
    visibleTitle: typeof document !== "undefined" ? document.title.replace(/\s*\|\s*Equipify.*$/i, "").trim() || mod.label : mod.label,
    organizationId: args.organizationId,
    selectedEntityIds: inferSelectedEntityIdsFromLocation(args.pathname, args.search),
    pageState: {
      search: cleanString(params.get("search") || params.get("q"), 80),
      status: cleanString(params.get("status"), 80),
      action: cleanString(params.get("action"), 80),
      tab: cleanString(params.get("tab"), 80),
      technicianWorkspace: args.permissions.canUseTechnicianWorkspace,
      assignedOnly: args.permissions.canViewAssignedWorkOrdersOnly && !args.permissions.canViewAllWorkOrders,
      organizationName: args.organizationName,
    },
  }
}

function permissionSummary(permissions: OrgPermissions): string[] {
  const out: string[] = []
  if (permissions.canUseTechnicianWorkspace) out.push("Technician-focused workspace")
  if (permissions.canViewAssignedWorkOrdersOnly && !permissions.canViewAllWorkOrders) out.push("Assigned work only")
  if (permissions.canManageDispatch) out.push("Can dispatch and assign technicians")
  if (permissions.canEditWorkOrders) out.push("Can update work orders")
  if (permissions.canEditInvoices) out.push("Can edit/send invoices")
  if (permissions.canViewFinancials) out.push("Can view financial amounts")
  if (permissions.canManageWorkspaceSettings) out.push("Can manage workspace/team settings")
  if (permissions.canReleaseCertificatesToPortal) out.push("Can release certificates to portal")
  if (permissions.canUploadCertificateAttachments) out.push("Can upload certificate attachments")
  return out.length ? out : ["Limited workspace access"]
}

async function loadWorkOrderRecord(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<AidenCurrentRecord | null> {
  const { data } = await supabase
    .from("work_orders")
    .select("id, work_order_number, title, status, customer_id, equipment_id, assigned_user_id")
    .eq("organization_id", organizationId)
    .eq("id", workOrderId)
    .maybeSingle()
  if (!data) return null
  const row = data as {
    id: string
    work_order_number?: number | null
    title?: string | null
    status?: string | null
    customer_id?: string | null
    equipment_id?: string | null
    assigned_user_id?: string | null
  }
  const [{ data: customer }, { data: equipment }, { data: profile }] = await Promise.all([
    row.customer_id
      ? supabase.from("customers").select("company_name").eq("organization_id", organizationId).eq("id", row.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.equipment_id
      ? supabase.from("equipment").select("name, serial_number").eq("organization_id", organizationId).eq("id", row.equipment_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.assigned_user_id
      ? supabase.from("profiles").select("full_name, email").eq("id", row.assigned_user_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return {
    type: "Work Order",
    id: row.id,
    label: row.title ?? null,
    number: row.work_order_number != null ? `WO-${row.work_order_number}` : null,
    status: row.status ?? null,
    customer: (customer as { company_name?: string | null } | null)?.company_name ?? null,
    equipment: (equipment as { name?: string | null } | null)?.name ?? null,
    serial: (equipment as { serial_number?: string | null } | null)?.serial_number ?? null,
    assignedTech:
      (profile as { full_name?: string | null; email?: string | null } | null)?.full_name ??
      (profile as { email?: string | null } | null)?.email ??
      null,
  }
}

async function loadEquipmentRecord(
  supabase: SupabaseClient,
  organizationId: string,
  equipmentId: string,
): Promise<AidenCurrentRecord | null> {
  const { data } = await supabase
    .from("equipment")
    .select("id, name, serial_number, customer_id")
    .eq("organization_id", organizationId)
    .eq("id", equipmentId)
    .maybeSingle()
  if (!data) return null
  const row = data as { id: string; name?: string | null; serial_number?: string | null; customer_id?: string | null }
  const { data: customer } = row.customer_id
    ? await supabase.from("customers").select("company_name").eq("organization_id", organizationId).eq("id", row.customer_id).maybeSingle()
    : { data: null }
  return {
    type: "Equipment",
    id: row.id,
    label: row.name ?? null,
    serial: row.serial_number ?? null,
    customer: (customer as { company_name?: string | null } | null)?.company_name ?? null,
  }
}

async function loadCustomerRecord(
  supabase: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<AidenCurrentRecord | null> {
  const { data } = await supabase
    .from("customers")
    .select("id, company_name, status")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle()
  if (!data) return null
  const row = data as { id: string; company_name?: string | null; status?: string | null }
  return {
    type: "Customer",
    id: row.id,
    label: row.company_name ?? null,
    status: row.status ?? null,
  }
}

export async function buildServerAidenContext(args: {
  supabase: SupabaseClient
  organizationId: string
  organizationName: string | null
  permissions: OrgPermissions
  clientContext: AidenClientPageContext
}): Promise<AidenNormalizedContext> {
  const path = cleanString(args.clientContext.currentPath, 300)
  const mod = moduleFromPath(path)
  const ids = cleanIds(args.clientContext.selectedEntityIds)
  let currentRecord = args.clientContext.currentRecord ?? null
  if (ids.workOrderId) currentRecord = await loadWorkOrderRecord(args.supabase, args.organizationId, ids.workOrderId)
  else if (ids.equipmentId) currentRecord = await loadEquipmentRecord(args.supabase, args.organizationId, ids.equipmentId)
  else if (ids.customerId) currentRecord = await loadCustomerRecord(args.supabase, args.organizationId, ids.customerId)

  return {
    module: cleanString(args.clientContext.currentModule, 120) ?? mod.label,
    moduleId: mod.id,
    path,
    visibleTitle: cleanString(args.clientContext.visibleTitle, 160),
    organization: {
      id: args.organizationId,
      name: args.organizationName,
    },
    currentRecord,
    selectedEntityIds: ids,
    pageState: args.clientContext.pageState ?? {},
    allowedActions: allowedModuleActions(mod, args.permissions),
    limitations: mod.limitations ?? [],
    permissionSummary: permissionSummary(args.permissions),
  }
}

export function formatAidenContextForPrompt(context: AidenNormalizedContext): string {
  return `AIDEN_CONTEXT_JSON:\n${JSON.stringify(context, null, 2)}`
}
