import type { SupabaseClient } from "@supabase/supabase-js"
import { parseUuid } from "@/lib/email/route-auth"
import type { OrgPermissions } from "@/lib/permissions/model"
import { isAssignedWorkOnly, loadAssignedWorkScope, type AssignedWorkScope } from "@/lib/permissions/technician-scope"
import { formatWorkOrderDisplay, parseWorkOrderNumberQuery } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"

export type GlobalSearchResultItem = {
  kind: string
  title: string
  subtitle: string | null
  href: string
}

export type GlobalSearchGroup = {
  id: string
  label: string
  results: GlobalSearchResultItem[]
}

const MAX_PER_SECTION = 5
const MAX_QUERY_LEN = 80

/** Strip ilike metacharacters from user input (keep search simple and safe). */
export function sanitizeGlobalSearchQuery(raw: string): string | null {
  /** Commas break PostgREST `or()` argument parsing. */
  const t = raw
    .trim()
    .slice(0, MAX_QUERY_LEN)
    .replace(/%/g, "")
    .replace(/\\/g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (t.length < 2) return null
  return t
}

async function customerNameMap(
  supabase: SupabaseClient,
  organizationId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return out
  const { data } = await supabase
    .from("customers")
    .select("id, company_name")
    .eq("organization_id", organizationId)
    .in("id", uniq)
  for (const row of (data as Array<{ id: string; company_name: string }> | null) ?? []) {
    out.set(row.id, row.company_name?.trim() || "Customer")
  }
  return out
}

function maintenanceRowVisibleForAssigned(
  row: {
    customer_id: string
    equipment_id: string | null
    assigned_user_id: string | null
    assigned_technician_id?: string | null
  },
  args: { assignedOnly: boolean; userId: string; scope: AssignedWorkScope | null },
): boolean {
  if (!args.assignedOnly) return true
  const scope = args.scope
  if (!scope) return false
  const { customerIds, equipmentIds, technicianIds } = scope
  if (customerIds.includes(row.customer_id)) return true
  if (row.equipment_id && equipmentIds.includes(row.equipment_id)) return true
  const techKey = (row.assigned_technician_id ?? row.assigned_user_id ?? "").trim()
  if (techKey && techKey === args.userId) return true
  if (techKey && technicianIds.includes(techKey)) return true
  return false
}

export async function runOrgGlobalSearch(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    userId: string
    queryRaw: string
    permissions: OrgPermissions
  },
): Promise<GlobalSearchGroup[]> {
  const pattern = sanitizeGlobalSearchQuery(args.queryRaw)
  if (!pattern) return []

  const { organizationId, userId, permissions } = args
  const ilike = `%${pattern}%`
  const assignedOnly = isAssignedWorkOnly(permissions)
  const scope = assignedOnly
    ? await loadAssignedWorkScope(supabase, { organizationId, userId })
    : null

  const groups: GlobalSearchGroup[] = []

  const canSearchCustomerNames =
    permissions.canViewAllWorkOrders ||
    permissions.canViewBilling ||
    permissions.canManageProspects ||
    permissions.canViewAssignedWorkOrdersOnly

  const canSearchEquipment =
    permissions.canViewAllWorkOrders ||
    permissions.canViewAssignedWorkOrdersOnly ||
    permissions.canEditWorkOrders

  // ── Customers ─────────────────────────────────────────────────────────────
  const customerResults: GlobalSearchResultItem[] = []
  if (
    canSearchCustomerNames &&
    (!assignedOnly || (scope?.customerIds?.length ?? 0) > 0)
  ) {
    let cq = supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("company_name", ilike)
      .order("company_name", { ascending: true })
      .limit(MAX_PER_SECTION)
    if (assignedOnly && scope) cq = cq.in("id", scope.customerIds)
    const { data: custRows } = await cq
    for (const row of (custRows as Array<{ id: string; company_name: string }> | null) ?? []) {
      customerResults.push({
        kind: "customer",
        title: row.company_name?.trim() || "Customer",
        subtitle: "Customer",
        href: `/customers/${encodeURIComponent(row.id)}`,
      })
    }
  }
  if (customerResults.length > 0) {
    groups.push({ id: "customers", label: "Customers", results: customerResults })
  }

  // ── Equipment ─────────────────────────────────────────────────────────────
  const equipmentResults: GlobalSearchResultItem[] = []
  if (
    canSearchEquipment &&
    (!assignedOnly || (scope?.equipmentIds?.length ?? 0) > 0)
  ) {
    let eqQ = supabase
      .from("equipment")
      .select("id, name, equipment_code, serial_number, customer_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .or(`name.ilike.${ilike},equipment_code.ilike.${ilike},serial_number.ilike.${ilike}`)
      .order("name", { ascending: true })
      .limit(MAX_PER_SECTION)
    if (assignedOnly && scope) eqQ = eqQ.in("id", scope.equipmentIds)
    const { data: eqRows, error: eqErr } = await eqQ
    if (!eqErr) {
      const rows = (eqRows as Array<{
        id: string
        name: string | null
        equipment_code: string | null
        serial_number: string | null
        customer_id: string
      }> | null) ?? []
      const custMap = await customerNameMap(
        supabase,
        organizationId,
        rows.map((r) => r.customer_id),
      )
      for (const row of rows) {
        const bits = [
          row.equipment_code?.trim() || null,
          row.serial_number?.trim() ? `SN ${row.serial_number.trim()}` : null,
        ].filter(Boolean)
        equipmentResults.push({
          kind: "equipment",
          title: row.name?.trim() || "Equipment",
          subtitle: [custMap.get(row.customer_id) ?? "Customer", bits.join(" · ") || null]
            .filter(Boolean)
            .join(" · "),
          href: `/equipment/${encodeURIComponent(row.id)}`,
        })
      }
    }
  }
  if (equipmentResults.length > 0) {
    groups.push({ id: "equipment", label: "Equipment", results: equipmentResults })
  }

  // ── Work orders ───────────────────────────────────────────────────────────
  const woResults: GlobalSearchResultItem[] = []
  const canSearchWo =
    permissions.canViewAllWorkOrders || permissions.canViewAssignedWorkOrdersOnly
  if (canSearchWo) {
    const woNum = parseWorkOrderNumberQuery(pattern)
    const idMatch = parseUuid(pattern)

    async function tryWoSelect(select: string, includeWorkOrderNumber: boolean) {
      let q = supabase
        .from("work_orders")
        .select(select)
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .limit(MAX_PER_SECTION)

      if (assignedOnly && scope) {
        const ids = scope.workOrderIds
        if (ids.length === 0) return { data: [] as unknown[], error: null }
        q = q.in("id", ids)
      }

      const orParts: string[] = [`title.ilike.${ilike}`]
      if (includeWorkOrderNumber && woNum != null) orParts.push(`work_order_number.eq.${woNum}`)
      if (idMatch) orParts.push(`id.eq.${idMatch}`)
      q = q.or(orParts.join(","))

      return q
    }

    let woRes = await tryWoSelect("id, title, work_order_number, customer_id", true)
    if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
      woRes = await tryWoSelect("id, title, customer_id", false)
    }

    if (!woRes.error) {
      const woRows = (woRes.data as Array<{
        id: string
        title: string | null
        work_order_number?: number | null
        customer_id: string
      }> | null) ?? []
      const custMap = await customerNameMap(
        supabase,
        organizationId,
        woRows.map((r) => r.customer_id),
      )
      for (const row of woRows) {
        const label = formatWorkOrderDisplay(row.work_order_number, row.id)
        woResults.push({
          kind: "work_order",
          title: label,
          subtitle: [row.title?.trim() || "Work order", custMap.get(row.customer_id) ?? null]
            .filter(Boolean)
            .join(" · "),
          href: `/work-orders?open=${encodeURIComponent(row.id)}`,
        })
      }
    }
  }
  if (woResults.length > 0) {
    groups.push({ id: "work_orders", label: "Work orders", results: woResults })
  }

  // ── Invoices (matches /invoices page gate) ────────────────────────────────
  if (permissions.canViewFinancials) {
    const { data: invRows, error: invErr } = await supabase
      .from("org_invoices")
      .select("id, invoice_number, title, customer_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .or(`invoice_number.ilike.${ilike},title.ilike.${ilike}`)
      .order("issued_at", { ascending: false })
      .limit(MAX_PER_SECTION)

    if (!invErr && invRows?.length) {
      const rows = invRows as Array<{
        id: string
        invoice_number: string | null
        title: string | null
        customer_id: string
      }>
      const custMap = await customerNameMap(
        supabase,
        organizationId,
        rows.map((r) => r.customer_id),
      )
      const invoiceResults: GlobalSearchResultItem[] = rows.map((row) => ({
        kind: "invoice",
        title: row.invoice_number?.trim() || "Invoice",
        subtitle: [row.title?.trim() || null, custMap.get(row.customer_id) ?? null]
          .filter(Boolean)
          .join(" · "),
        href: `/invoices?open=${encodeURIComponent(row.id)}`,
      }))
      groups.push({ id: "invoices", label: "Invoices", results: invoiceResults })
    }
  }

  // ── Quotes ────────────────────────────────────────────────────────────────
  if (permissions.canViewQuotes) {
    const { data: quoteRows, error: quoteErr } = await supabase
      .from("org_quotes")
      .select("id, quote_number, title, customer_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .or(`quote_number.ilike.${ilike},title.ilike.${ilike}`)
      .order("created_at", { ascending: false })
      .limit(MAX_PER_SECTION)

    if (!quoteErr && quoteRows?.length) {
      const rows = quoteRows as Array<{
        id: string
        quote_number: string | null
        title: string | null
        customer_id: string
      }>
      const custMap = await customerNameMap(
        supabase,
        organizationId,
        rows.map((r) => r.customer_id),
      )
      const quoteResults: GlobalSearchResultItem[] = rows.map((row) => ({
        kind: "quote",
        title: row.quote_number?.trim() || "Quote",
        subtitle: [row.title?.trim() || null, custMap.get(row.customer_id) ?? null]
          .filter(Boolean)
          .join(" · "),
        href: `/quotes?open=${encodeURIComponent(row.id)}`,
      }))
      groups.push({ id: "quotes", label: "Quotes", results: quoteResults })
    }
  }

  // ── Maintenance plans (dispatch-capable roles) ───────────────────────────
  if (permissions.canManageDispatch) {
    const { data: planRows, error: planErr } = await supabase
      .from("maintenance_plans")
      .select(
        "id, name, customer_id, equipment_id, assigned_user_id, assigned_technician_id, archived_at",
      )
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("name", ilike)
      .order("name", { ascending: true })
      .limit(MAX_PER_SECTION * 2)

    if (!planErr && planRows?.length) {
      const filtered = (planRows as Array<{
        id: string
        name: string
        customer_id: string
        equipment_id: string | null
        assigned_user_id: string | null
        assigned_technician_id?: string | null
      }>).filter((row) =>
        maintenanceRowVisibleForAssigned(row, { assignedOnly, userId, scope }),
      )
      const trimmed = filtered.slice(0, MAX_PER_SECTION)
      if (trimmed.length > 0) {
        const custMap = await customerNameMap(
          supabase,
          organizationId,
          trimmed.map((r) => r.customer_id),
        )
        const planResults: GlobalSearchResultItem[] = trimmed.map((row) => ({
          kind: "maintenance_plan",
          title: row.name?.trim() || "Maintenance plan",
          subtitle: custMap.get(row.customer_id) ?? "Customer",
          href: `/maintenance-plans?open=${encodeURIComponent(row.id)}`,
        }))
        groups.push({ id: "maintenance_plans", label: "Maintenance plans", results: planResults })
      }
    }
  }

  // ── Technicians (roster uses profile user ids — same as `/technicians?open=`) ──
  if (permissions.canViewTechnicians || permissions.canManageTechnicians) {
    const rosterRoles = ["owner", "admin", "manager", "tech"]
    const { data: memRows, error: memErr } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .in("status", ["active", "invited"])
      .in("role", rosterRoles)

    const userIds = [
      ...new Set(
        ((memRows as Array<{ user_id: string }> | null) ?? []).map((m) => m.user_id).filter(Boolean),
      ),
    ]

    if (!memErr && userIds.length > 0) {
      const { data: profRows, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
        .or(`full_name.ilike.${ilike},email.ilike.${ilike}`)
        .order("full_name", { ascending: true })
        .limit(MAX_PER_SECTION)

      if (!profErr && profRows?.length) {
        const techResults: GlobalSearchResultItem[] = (profRows as Array<{
          id: string
          full_name: string | null
          email: string | null
        }>).map((row) => ({
          kind: "technician",
          title: row.full_name?.trim() || "Team member",
          subtitle: row.email?.trim() || "Technicians",
          href: `/technicians?open=${encodeURIComponent(row.id)}`,
        }))
        groups.push({ id: "technicians", label: "Technicians", results: techResults })
      }
    }
  }

  return groups
}
