import type { SupabaseClient } from "@supabase/supabase-js"
import {
  evaluateCertificatePortalAccess,
  resolveEffectiveCertificateReleaseMode,
  type CertificateReleaseMode,
} from "@/lib/portal/certificate-release"
import { fetchInvoicesLinkedToWorkOrdersBatch } from "@/lib/portal/work-order-invoices"

export type PortalCertificateItem = {
  id: string
  createdAt: string
  workOrderId: string
  equipmentId: string | null
  equipmentName: string | null
  equipmentLocationLabel: string | null
  templateName: string
  unlocked: boolean
  reasonLabel: string
  reasonCode: string
  effectiveMode: CertificateReleaseMode
  /** Relative API path; client prepends origin or uses fetch with credentials */
  downloadPath: string | null
}

export type PortalCertificateSummary = {
  total: number
  unlocked: number
  locked: number
}

/**
 * Certificates visible to a portal customer, with release evaluation and display fields.
 */
export async function buildPortalCertificateItems(
  svc: SupabaseClient,
  organizationId: string,
  customerId: string,
  options?: { workOrderIds?: string[]; recordIds?: string[] },
): Promise<{ items: PortalCertificateItem[]; summary: PortalCertificateSummary }> {
  const [{ data: orgRow }, { data: custRow }] = await Promise.all([
    svc.from("organizations").select("portal_certificate_release_mode").eq("id", organizationId).maybeSingle(),
    svc
      .from("customers")
      .select("portal_certificate_release_mode")
      .eq("organization_id", organizationId)
      .eq("id", customerId)
      .maybeSingle(),
  ])

  const orgMode = (orgRow as { portal_certificate_release_mode?: string } | null)?.portal_certificate_release_mode
  const custMode = (custRow as { portal_certificate_release_mode?: string } | null)?.portal_certificate_release_mode

  type CrRow = {
    id: string
    created_at: string
    work_order_id: string
    equipment_id: string | null
    template_id: string
    portal_released_at?: string | null
    portal_revoked_at?: string | null
  }

  const selFull =
    "id, created_at, work_order_id, equipment_id, template_id, portal_released_at, portal_revoked_at"
  const selMini = "id, created_at, work_order_id, equipment_id, template_id"

  let q = svc
    .from("calibration_records")
    .select(selFull)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(400)

  if (options?.recordIds && options.recordIds.length > 0) {
    q = q.in("id", options.recordIds)
  } else if (options?.workOrderIds && options.workOrderIds.length > 0) {
    q = q.in("work_order_id", options.workOrderIds)
  }

  let res = await q

  if (res.error) {
    let q2 = svc
      .from("calibration_records")
      .select(selMini)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(400)
    if (options?.recordIds && options.recordIds.length > 0) {
      q2 = q2.in("id", options.recordIds)
    } else if (options?.workOrderIds && options.workOrderIds.length > 0) {
      q2 = q2.in("work_order_id", options.workOrderIds)
    }
    res = await q2
  }

  if (res.error) throw new Error(res.message)
  const crs = (res.data ?? []) as CrRow[]

  const woIds = [...new Set(crs.map((c) => c.work_order_id).filter(Boolean))] as string[]
  if (woIds.length === 0) {
    return { items: [], summary: { total: 0, unlocked: 0, locked: 0 } }
  }

  const { data: wos } = await svc
    .from("work_orders")
    .select("id, customer_id")
    .eq("organization_id", organizationId)
    .in("id", woIds)
    .eq("customer_id", customerId)

  const allowedWo = new Set((wos ?? []).map((w) => w.id as string))
  const filtered = crs.filter((c) => allowedWo.has(c.work_order_id as string))

  const woIdsF = [...new Set(filtered.map((c) => c.work_order_id as string))]
  const invoiceMap = await fetchInvoicesLinkedToWorkOrdersBatch(svc, organizationId, woIdsF)

  const equipIds = [...new Set(filtered.map((c) => c.equipment_id).filter(Boolean))] as string[]
  const tmplIds = [...new Set(filtered.map((c) => c.template_id).filter(Boolean))] as string[]

  let equipMap = new Map<string, { name: string; location_label: string | null }>()
  let tmplMap = new Map<string, string>()
  if (equipIds.length > 0) {
    const { data: eqs } = await svc
      .from("equipment")
      .select("id, name, location_label")
      .eq("organization_id", organizationId)
      .in("id", equipIds)
    equipMap = new Map(
      (eqs ?? []).map((e) => [
        e.id as string,
        { name: (e.name as string) ?? "", location_label: (e.location_label as string | null) ?? null },
      ]),
    )
  }
  if (tmplIds.length > 0) {
    const { data: ts } = await svc
      .from("calibration_templates")
      .select("id, name")
      .eq("organization_id", organizationId)
      .in("id", tmplIds)
    tmplMap = new Map((ts ?? []).map((t) => [t.id as string, (t.name as string) ?? ""]))
  }

  const items: PortalCertificateItem[] = []
  let unlocked = 0
  let locked = 0

  for (const c of filtered) {
    const woId = c.work_order_id as string
    const linked = invoiceMap.get(woId) ?? []
    const overrides = linked.map((i) => i.portal_certificate_release_override)
    const effectiveMode = resolveEffectiveCertificateReleaseMode({
      organizationMode: orgMode,
      customerMode: custMode,
      invoiceOverrides: overrides,
    })
    const access = c.portal_revoked_at?.trim()
      ? {
          unlocked: false,
          reasonCode: "locked_manual",
          reasonLabel: "Certificate access has been revoked.",
          effectiveMode,
        }
      : evaluateCertificatePortalAccess(effectiveMode, {
      linkedInvoices: linked,
      portalReleasedAt: (c.portal_released_at as string | null) ?? null,
    })
    if (access.unlocked) unlocked++
    else locked++

    const eid = c.equipment_id as string | null
    const eq = eid ? equipMap.get(eid) : undefined

    items.push({
      id: c.id as string,
      createdAt: c.created_at as string,
      workOrderId: woId,
      equipmentId: eid,
      equipmentName: eid ? (eq?.name ?? null) : null,
      equipmentLocationLabel: eid ? (eq?.location_label ?? null) : null,
      templateName: tmplMap.get(c.template_id as string) ?? "Certificate",
      unlocked: access.unlocked,
      reasonLabel: access.reasonLabel,
      reasonCode: access.reasonCode,
      effectiveMode: access.effectiveMode,
      downloadPath: access.unlocked ? `/api/portal/certificates/${c.id as string}/download` : null,
    })
  }

  return {
    items,
    summary: { total: items.length, unlocked, locked },
  }
}

/** Minimal authz + release check for a single certificate download (avoids rebuilding the full list). */
export async function canPortalDownloadCertificate(
  svc: SupabaseClient,
  organizationId: string,
  customerId: string,
  recordId: string,
): Promise<boolean> {
  let rec: { work_order_id: string; portal_released_at?: string | null; portal_revoked_at?: string | null } | null = null

  let r = await svc
    .from("calibration_records")
    .select("work_order_id, portal_released_at, portal_revoked_at")
    .eq("organization_id", organizationId)
    .eq("id", recordId)
    .maybeSingle()

  if (r.error) {
    r = await svc
      .from("calibration_records")
      .select("work_order_id")
      .eq("organization_id", organizationId)
      .eq("id", recordId)
      .maybeSingle()
  }

  if (r.error || !r.data) return false
  rec = r.data as { work_order_id: string; portal_released_at?: string | null; portal_revoked_at?: string | null }
  if (rec.portal_revoked_at?.trim()) return false

  const { data: wo } = await svc
    .from("work_orders")
    .select("customer_id")
    .eq("organization_id", organizationId)
    .eq("id", rec.work_order_id)
    .maybeSingle()

  if (!wo || (wo as { customer_id: string }).customer_id !== customerId) return false

  const [{ data: orgRow }, { data: custRow }] = await Promise.all([
    svc.from("organizations").select("portal_certificate_release_mode").eq("id", organizationId).maybeSingle(),
    svc
      .from("customers")
      .select("portal_certificate_release_mode")
      .eq("organization_id", organizationId)
      .eq("id", customerId)
      .maybeSingle(),
  ])

  const invoiceMap = await fetchInvoicesLinkedToWorkOrdersBatch(svc, organizationId, [rec.work_order_id])
  const linked = invoiceMap.get(rec.work_order_id) ?? []

  const orgMode = (orgRow as { portal_certificate_release_mode?: string } | null)?.portal_certificate_release_mode
  const custMode = (custRow as { portal_certificate_release_mode?: string } | null)?.portal_certificate_release_mode
  const overrides = linked.map((i) => i.portal_certificate_release_override)
  const effectiveMode = resolveEffectiveCertificateReleaseMode({
    organizationMode: orgMode,
    customerMode: custMode,
    invoiceOverrides: overrides,
  })
  const access = evaluateCertificatePortalAccess(effectiveMode, {
    linkedInvoices: linked,
    portalReleasedAt: rec.portal_released_at ?? null,
  })
  return access.unlocked
}
