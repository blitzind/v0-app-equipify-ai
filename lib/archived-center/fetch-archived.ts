import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  ARCHIVED_TYPE_LABELS,
  type ArchivedCenterRow,
  type ArchivedRecordType,
} from "@/lib/archived-center/types"

function profileLabel(
  map: Map<string, string>,
  userId: string | null | undefined,
): string | null {
  if (!userId) return null
  return map.get(userId) ?? "Team member"
}

async function buildProfileLabelMap(
  admin: SupabaseClient,
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map

  const { data } = await admin.from("profiles").select("id, email, full_name").in("id", unique)
  for (const row of data ?? []) {
    const r = row as { id: string; email?: string | null; full_name?: string | null }
    const label = (r.full_name?.trim() || r.email?.trim() || "").trim()
    map.set(r.id, label || "Team member")
  }
  return map
}

export async function fetchArchivedCenterRows(
  admin: SupabaseClient,
  organizationId: string,
): Promise<ArchivedCenterRow[]> {
  const [
    customersRes,
    equipmentRes,
    workOrdersRes,
    quotesRes,
    invoicesRes,
    plansRes,
    templatesRes,
    recordsRes,
    vendorsRes,
  ] = await Promise.all([
    admin
      .from("customers")
      .select("id, company_name, archived_at, archived_by, archive_reason")
      .eq("organization_id", organizationId)
      .not("archived_at", "is", null),
    admin
      .from("equipment")
      .select("id, name, archived_at, archived_by, archive_reason")
      .eq("organization_id", organizationId)
      .not("archived_at", "is", null),
    admin
      .from("work_orders")
      .select("id, title, work_order_number, archived_at, archived_by, archive_reason")
      .eq("organization_id", organizationId)
      .not("archived_at", "is", null),
    admin
      .from("org_quotes")
      .select("id, title, quote_number, archived_at, archived_by, archive_reason")
      .eq("organization_id", organizationId)
      .not("archived_at", "is", null),
    admin
      .from("org_invoices")
      .select("id, title, invoice_number, archived_at, archived_by, archive_reason")
      .eq("organization_id", organizationId)
      .not("archived_at", "is", null),
    admin
      .from("maintenance_plans")
      .select("id, name, archived_at, archived_by, archive_reason")
      .eq("organization_id", organizationId)
      .not("archived_at", "is", null),
    admin
      .from("calibration_templates")
      .select("id, name, archived_at, archived_by, archive_reason")
      .eq("organization_id", organizationId)
      .not("archived_at", "is", null),
    admin
      .from("calibration_records")
      .select("id, work_order_id, template_id, archived_at, archived_by, archive_reason")
      .eq("organization_id", organizationId)
      .not("archived_at", "is", null),
    admin
      .from("org_vendors")
      .select("id, name, archived_at, archived_by, archive_reason")
      .eq("organization_id", organizationId)
      .not("archived_at", "is", null),
  ])

  const recordRows = (recordsRes.data ?? []) as Array<{
    id: string
    work_order_id: string
    template_id: string
    archived_at: string
    archived_by: string | null
    archive_reason: string | null
  }>

  const woIds = [...new Set(recordRows.map((r) => r.work_order_id))]
  const tplIds = [...new Set(recordRows.map((r) => r.template_id))]

  let woRows: { id: string; work_order_number: number; title: string }[] = []
  let tplRows: { id: string; name: string }[] = []

  if (woIds.length > 0) {
    const { data } = await admin
      .from("work_orders")
      .select("id, work_order_number, title")
      .eq("organization_id", organizationId)
      .in("id", woIds)
    woRows = (data ?? []) as typeof woRows
  }
  if (tplIds.length > 0) {
    const { data } = await admin
      .from("calibration_templates")
      .select("id, name")
      .eq("organization_id", organizationId)
      .in("id", tplIds)
    tplRows = (data ?? []) as typeof tplRows
  }

  const woById = new Map(woRows.map((w) => [w.id, w]))
  const tplById = new Map(tplRows.map((t) => [t.id, t]))

  const allArchivedByIds: string[] = []
  function collect(row: { archived_by?: string | null }) {
    if (row.archived_by) allArchivedByIds.push(row.archived_by)
  }

  for (const bundle of [
    customersRes.data,
    equipmentRes.data,
    workOrdersRes.data,
    quotesRes.data,
    invoicesRes.data,
    plansRes.data,
    templatesRes.data,
    recordsRes.data,
    vendorsRes.data,
  ]) {
    for (const row of bundle ?? []) collect(row as { archived_by?: string | null })
  }

  const profileMap = await buildProfileLabelMap(admin, allArchivedByIds)

  const rows: ArchivedCenterRow[] = []

  function pushRow(r: ArchivedCenterRow) {
    rows.push(r)
  }

  for (const c of (customersRes.data ?? []) as Array<{
    id: string
    company_name: string
    archived_at: string
    archived_by: string | null
    archive_reason: string | null
  }>) {
    pushRow({
      id: c.id,
      type: "customer",
      typeLabel: ARCHIVED_TYPE_LABELS.customer,
      title: c.company_name,
      archivedAt: c.archived_at,
      archivedByLabel: profileLabel(profileMap, c.archived_by),
      archiveReason: c.archive_reason,
      detailHref: `/customers?open=${encodeURIComponent(c.id)}`,
    })
  }

  for (const e of (equipmentRes.data ?? []) as Array<{
    id: string
    name: string
    archived_at: string
    archived_by: string | null
    archive_reason: string | null
  }>) {
    pushRow({
      id: e.id,
      type: "equipment",
      typeLabel: ARCHIVED_TYPE_LABELS.equipment,
      title: e.name,
      archivedAt: e.archived_at,
      archivedByLabel: profileLabel(profileMap, e.archived_by),
      archiveReason: e.archive_reason,
      detailHref: `/equipment?open=${encodeURIComponent(e.id)}`,
    })
  }

  for (const w of (workOrdersRes.data ?? []) as Array<{
    id: string
    title: string
    work_order_number: number
    archived_at: string
    archived_by: string | null
    archive_reason: string | null
  }>) {
    pushRow({
      id: w.id,
      type: "work_order",
      typeLabel: ARCHIVED_TYPE_LABELS.work_order,
      title: `#${w.work_order_number} · ${w.title}`,
      archivedAt: w.archived_at,
      archivedByLabel: profileLabel(profileMap, w.archived_by),
      archiveReason: w.archive_reason,
      detailHref: `/work-orders?open=${encodeURIComponent(w.id)}`,
    })
  }

  for (const q of (quotesRes.data ?? []) as Array<{
    id: string
    title: string
    quote_number: string
    archived_at: string
    archived_by: string | null
    archive_reason: string | null
  }>) {
    pushRow({
      id: q.id,
      type: "quote",
      typeLabel: ARCHIVED_TYPE_LABELS.quote,
      title: `${q.quote_number} · ${q.title}`,
      archivedAt: q.archived_at,
      archivedByLabel: profileLabel(profileMap, q.archived_by),
      archiveReason: q.archive_reason,
      detailHref: `/quotes?open=${encodeURIComponent(q.id)}`,
    })
  }

  for (const inv of (invoicesRes.data ?? []) as Array<{
    id: string
    title: string
    invoice_number: string
    archived_at: string
    archived_by: string | null
    archive_reason: string | null
  }>) {
    pushRow({
      id: inv.id,
      type: "invoice",
      typeLabel: ARCHIVED_TYPE_LABELS.invoice,
      title: `${inv.invoice_number} · ${inv.title}`,
      archivedAt: inv.archived_at,
      archivedByLabel: profileLabel(profileMap, inv.archived_by),
      archiveReason: inv.archive_reason,
      detailHref: `/invoices?open=${encodeURIComponent(inv.id)}`,
    })
  }

  for (const p of (plansRes.data ?? []) as Array<{
    id: string
    name: string
    archived_at: string
    archived_by: string | null
    archive_reason: string | null
  }>) {
    pushRow({
      id: p.id,
      type: "maintenance_plan",
      typeLabel: ARCHIVED_TYPE_LABELS.maintenance_plan,
      title: p.name,
      archivedAt: p.archived_at,
      archivedByLabel: profileLabel(profileMap, p.archived_by),
      archiveReason: p.archive_reason,
      detailHref: `/maintenance-plans?open=${encodeURIComponent(p.id)}`,
    })
  }

  for (const t of (templatesRes.data ?? []) as Array<{
    id: string
    name: string
    archived_at: string
    archived_by: string | null
    archive_reason: string | null
  }>) {
    pushRow({
      id: t.id,
      type: "calibration_template",
      typeLabel: ARCHIVED_TYPE_LABELS.calibration_template,
      title: t.name,
      archivedAt: t.archived_at,
      archivedByLabel: profileLabel(profileMap, t.archived_by),
      archiveReason: t.archive_reason,
      detailHref: `/calibration-templates`,
    })
  }

  for (const cr of recordRows) {
    const wo = woById.get(cr.work_order_id)
    const tpl = tplById.get(cr.template_id)
    const woBit = wo ? `#${wo.work_order_number}` : "Work order"
    const tplBit = tpl?.name?.trim() ? tpl.name : "Template"
    pushRow({
      id: cr.id,
      type: "calibration_record",
      typeLabel: ARCHIVED_TYPE_LABELS.calibration_record,
      title: `${tplBit} · ${woBit}`,
      archivedAt: cr.archived_at,
      archivedByLabel: profileLabel(profileMap, cr.archived_by),
      archiveReason: cr.archive_reason,
      detailHref: wo
        ? `/work-orders?open=${encodeURIComponent(wo.id)}&tab=certificates`
        : `/calibration-templates`,
    })
  }

  for (const v of (vendorsRes.data ?? []) as Array<{
    id: string
    name: string
    archived_at: string
    archived_by: string | null
    archive_reason: string | null
  }>) {
    pushRow({
      id: v.id,
      type: "vendor",
      typeLabel: ARCHIVED_TYPE_LABELS.vendor,
      title: v.name,
      archivedAt: v.archived_at,
      archivedByLabel: profileLabel(profileMap, v.archived_by),
      archiveReason: v.archive_reason,
      detailHref: `/vendors?open=${encodeURIComponent(v.id)}`,
    })
  }

  rows.sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime())

  return rows
}

export function filterArchivedRows(
  rows: ArchivedCenterRow[],
  q: string,
  typeFilter: string,
): ArchivedCenterRow[] {
  let list = rows
  const needle = q.trim().toLowerCase()
  if (needle) {
    list = list.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        (r.archiveReason?.toLowerCase().includes(needle) ?? false) ||
        (r.archivedByLabel?.toLowerCase().includes(needle) ?? false) ||
        r.typeLabel.toLowerCase().includes(needle),
    )
  }

  if (typeFilter && typeFilter !== "all") {
    if (typeFilter === "certificate") {
      list = list.filter((r) => r.type === "calibration_template" || r.type === "calibration_record")
    } else {
      list = list.filter((r) => r.type === typeFilter)
    }
  }

  return list
}

export function isArchivedRecordType(s: string): s is ArchivedRecordType {
  return (
    s === "customer" ||
    s === "equipment" ||
    s === "work_order" ||
    s === "quote" ||
    s === "invoice" ||
    s === "maintenance_plan" ||
    s === "calibration_template" ||
    s === "calibration_record" ||
    s === "vendor"
  )
}
