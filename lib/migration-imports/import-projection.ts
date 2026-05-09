import { resolveMapped } from "./map-columns"
import type { ImportProjection } from "./public-types"
import { resolveImportStrategy } from "./strategy"
import type { ImportEngineContext, MigrationImportKind } from "./types"

export type { ImportProjection } from "./public-types"

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

function normPhone(s: string) {
  return s.replace(/\D/g, "")
}

function normAddress(parts: string[]) {
  return parts.map((part) => normName(part)).filter(Boolean).join("|")
}

function isValidEmail(s: string) {
  if (!s.trim()) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

function isValidPhone(s: string) {
  if (!s.trim()) return true
  const digits = normPhone(s)
  return digits.length >= 7 && digits.length <= 15
}

function parseDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return s.slice(0, 10)
}

function parseWoNum(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = parseInt(t, 10)
  if (Number.isNaN(n) || n < 1) return null
  return n
}

export async function computeImportProjection(
  ctx: ImportEngineContext & { kind: MigrationImportKind },
): Promise<ImportProjection> {
  const strategy = resolveImportStrategy(ctx.options)
  const z: ImportProjection = { willCreate: 0, willUpdate: 0, willSkip: 0, willFail: 0 }

  if (
    ctx.kind === "certificate" ||
    ctx.kind === "quickbooks_snapshot" ||
    ctx.kind === "generic"
  ) {
    return z
  }

  const { supabase, organizationId, columnMapping, rows } = ctx

  if (ctx.kind === "customer") {
    const { data: existing } = await supabase
      .from("customers")
      .select("id, company_name, external_code")
      .eq("organization_id", organizationId)
      .is("archived_at", null)

    const byCode = new Map<string, string>()
    const byName = new Map<string, string>()
    for (const c of existing ?? []) {
      const r = c as { company_name: string; external_code: string | null }
      if (r.external_code?.trim()) byCode.set(r.external_code.trim().toLowerCase(), r.id)
      byName.set(normName(r.company_name), r.id)
    }

    const { data: contactRows } = await supabase
      .from("customer_contacts")
      .select("customer_id, email, phone")
      .eq("organization_id", organizationId)

    const emailToCustomer = new Map<string, string>()
    const phoneToCustomer = new Map<string, string>()
    for (const cr of contactRows ?? []) {
      const r = cr as { customer_id: string; email: string | null; phone: string | null }
      const em = r.email?.trim().toLowerCase()
      if (em && !emailToCustomer.has(em)) emailToCustomer.set(em, r.customer_id)
      const phone = r.phone ? normPhone(r.phone) : ""
      if (phone && !phoneToCustomer.has(phone)) phoneToCustomer.set(phone, r.customer_id)
    }

    const { data: locationRows } = await supabase
      .from("customer_locations")
      .select("customer_id, address_line1, city, state, postal_code")
      .eq("organization_id", organizationId)
      .is("archived_at", null)

    const addressToCustomer = new Map<string, string>()
    for (const lr of locationRows ?? []) {
      const r = lr as {
        customer_id: string
        address_line1: string
        city: string
        state: string
        postal_code: string
      }
      const key = normAddress([r.address_line1, r.city, r.state, r.postal_code])
      if (key && !addressToCustomer.has(key)) addressToCustomer.set(key, r.customer_id)
    }

    for (const row of rows) {
      let company =
        resolveMapped(row, columnMapping, "company_name") ||
        resolveMapped(row, columnMapping, "contact_full_name")
      const cEmail = resolveMapped(row, columnMapping, "contact_email")
      if (!company || !isValidEmail(cEmail)) {
        z.willFail += 1
        continue
      }
      const ext = resolveMapped(row, columnMapping, "external_code")?.trim() || null
      const cPhone = resolveMapped(row, columnMapping, "contact_phone")
      if (!isValidPhone(cPhone)) {
        z.willFail += 1
        continue
      }
      const a1 = resolveMapped(row, columnMapping, "address_line1") || resolveMapped(row, columnMapping, "service_address_line1")
      const city = resolveMapped(row, columnMapping, "city") || resolveMapped(row, columnMapping, "service_city")
      const state = resolveMapped(row, columnMapping, "state") || resolveMapped(row, columnMapping, "service_state")
      const postal = resolveMapped(row, columnMapping, "postal_code") || resolveMapped(row, columnMapping, "service_postal_code")
      const addressKey = a1 && city && state && postal ? normAddress([a1, city, state, postal]) : ""

      const match =
        (ext && byCode.has(ext.toLowerCase())) ||
        byName.has(normName(company)) ||
        (cEmail.trim() && emailToCustomer.has(cEmail.trim().toLowerCase())) ||
        (cPhone.trim() && phoneToCustomer.has(normPhone(cPhone))) ||
        (addressKey && addressToCustomer.has(addressKey))

      if (match) {
        if (strategy === "skip_duplicates") z.willSkip += 1
        else if (strategy === "create_new_only") z.willFail += 1
        else z.willUpdate += 1
      } else {
        z.willCreate += 1
      }
    }
    return z
  }

  if (ctx.kind === "equipment") {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, company_name, external_code")
      .eq("organization_id", organizationId)
      .is("archived_at", null)

    const idByExt = new Map<string, string>()
    const idsByCompany = new Map<string, string[]>()
    for (const c of customers ?? []) {
      const r = c as { id: string; company_name: string; external_code: string | null }
      if (r.external_code?.trim()) idByExt.set(r.external_code.trim().toLowerCase(), r.id)
      const k = normName(r.company_name)
      const arr = idsByCompany.get(k) ?? []
      arr.push(r.id)
      idsByCompany.set(k, arr)
    }

    const { data: equips } = await supabase
      .from("equipment")
      .select("id, serial_number, equipment_code, customer_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)

    const bySerial = new Map<string, { customer_id: string }>()
    const byCode = new Map<string, { customer_id: string }>()
    for (const e of equips ?? []) {
      const r = e as { serial_number: string | null; equipment_code: string | null; customer_id: string }
      const sn = r.serial_number?.trim()
      if (sn) bySerial.set(sn.toLowerCase(), { customer_id: r.customer_id })
      const ec = r.equipment_code?.trim().toLowerCase()
      if (ec) byCode.set(ec, { customer_id: r.customer_id })
    }

    const fileSerials = new Set<string>()
    for (const row of rows) {
      const name = resolveMapped(row, columnMapping, "name")
      if (!name) {
        z.willFail += 1
        continue
      }
      const ext = resolveMapped(row, columnMapping, "customer_external_code")
      const comp = resolveMapped(row, columnMapping, "customer_company")
      let customerId: string | null = null
      if (ext) customerId = idByExt.get(ext.trim().toLowerCase()) ?? null
      if (!customerId && comp) {
        const cand = idsByCompany.get(normName(comp)) ?? []
        if (cand.length === 1) customerId = cand[0]
      }
      if (!customerId) {
        z.willFail += 1
        continue
      }

      const serial = resolveMapped(row, columnMapping, "serial_number")
      const eqCode = resolveMapped(row, columnMapping, "equipment_code").trim().toLowerCase()
      if (serial) {
        const low = serial.toLowerCase()
        if (fileSerials.has(low)) {
          z.willFail += 1
          continue
        }
        fileSerials.add(low)
      }

      const hit =
        (serial && bySerial.get(serial.toLowerCase())) ||
        (eqCode && byCode.get(eqCode)) ||
        null

      if (hit) {
        if (hit.customer_id !== customerId) {
          z.willFail += 1
          continue
        }
        if (strategy === "skip_duplicates") z.willSkip += 1
        else if (strategy === "create_new_only") z.willFail += 1
        else z.willUpdate += 1
      } else {
        z.willCreate += 1
      }
    }
    return z
  }

  if (ctx.kind === "invoice") {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, company_name, external_code")
      .eq("organization_id", organizationId)
      .is("archived_at", null)

    const idByExt = new Map<string, string>()
    const idsByCompany = new Map<string, string[]>()
    for (const c of customers ?? []) {
      const r = c as { id: string; company_name: string; external_code: string | null }
      if (r.external_code?.trim()) idByExt.set(r.external_code.trim().toLowerCase(), r.id)
      const k = normName(r.company_name)
      const arr = idsByCompany.get(k) ?? []
      arr.push(r.id)
      idsByCompany.set(k, arr)
    }

    const { data: invs } = await supabase
      .from("org_invoices")
      .select("invoice_number, customer_id")
      .eq("organization_id", organizationId)

    const invMap = new Map<string, string>()
    for (const inv of invs ?? []) {
      const r = inv as { invoice_number: string; customer_id: string }
      invMap.set(r.invoice_number.trim().toLowerCase(), r.customer_id)
    }

    const seen = new Set<string>()
    for (const row of rows) {
      const num = resolveMapped(row, columnMapping, "invoice_number").trim()
      if (!num) {
        z.willFail += 1
        continue
      }
      const nk = num.toLowerCase()
      if (seen.has(nk)) {
        z.willFail += 1
        continue
      }
      seen.add(nk)

      const ext = resolveMapped(row, columnMapping, "customer_external_code")
      const comp = resolveMapped(row, columnMapping, "customer_company")
      let customerId: string | null = null
      if (ext) customerId = idByExt.get(ext.trim().toLowerCase()) ?? null
      if (!customerId && comp) {
        const cand = idsByCompany.get(normName(comp)) ?? []
        if (cand.length === 1) customerId = cand[0]
      }
      if (!customerId) {
        z.willFail += 1
        continue
      }
      if (!parseDate(resolveMapped(row, columnMapping, "issued_at"))) {
        z.willFail += 1
        continue
      }

      const custExisting = invMap.get(nk)
      if (custExisting) {
        if (custExisting !== customerId) {
          z.willFail += 1
          continue
        }
        if (strategy === "skip_duplicates") z.willSkip += 1
        else if (strategy === "create_new_only") z.willFail += 1
        else z.willUpdate += 1
      } else {
        z.willCreate += 1
      }
    }
    return z
  }

  if (ctx.kind === "work_order") {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, company_name, external_code")
      .eq("organization_id", organizationId)
      .is("archived_at", null)

    const idByExt = new Map<string, string>()
    const idsByCompany = new Map<string, string[]>()
    for (const c of customers ?? []) {
      const r = c as { id: string; company_name: string; external_code: string | null }
      if (r.external_code?.trim()) idByExt.set(r.external_code.trim().toLowerCase(), r.id)
      const k = normName(r.company_name)
      const arr = idsByCompany.get(k) ?? []
      arr.push(r.id)
      idsByCompany.set(k, arr)
    }

    for (const row of rows) {
      const title = resolveMapped(row, columnMapping, "title").trim()
      if (!title) {
        z.willFail += 1
        continue
      }
      const ext = resolveMapped(row, columnMapping, "customer_external_code")
      const comp = resolveMapped(row, columnMapping, "customer_company")
      const serial = resolveMapped(row, columnMapping, "equipment_serial")
      let customerId: string | null = null
      if (ext) customerId = idByExt.get(ext.trim().toLowerCase()) ?? null
      if (!customerId && comp) {
        const cand = idsByCompany.get(normName(comp)) ?? []
        if (cand.length === 1) customerId = cand[0]
      }
      if (!customerId || !serial) {
        z.willFail += 1
        continue
      }

      const { data: eq } = await supabase
        .from("equipment")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .ilike("serial_number", serial.trim())
        .is("archived_at", null)
        .maybeSingle()

      if (!eq) {
        z.willFail += 1
        continue
      }

      const equipmentId = (eq as { id: string }).id
      const scheduledOn = parseDate(resolveMapped(row, columnMapping, "scheduled_on"))
      const woNum = parseWoNum(resolveMapped(row, columnMapping, "work_order_number"))

      let existingId: string | null = null
      if (woNum != null) {
        const { data: wo } = await supabase
          .from("work_orders")
          .select("id, customer_id, equipment_id")
          .eq("organization_id", organizationId)
          .eq("work_order_number", woNum)
          .maybeSingle()
        const w = wo as { id: string; customer_id: string; equipment_id: string } | null
        if (w && w.customer_id === customerId && w.equipment_id === equipmentId) {
          existingId = w.id
        } else if (w) {
          z.willFail += 1
          continue
        }
      }
      if (!existingId && scheduledOn) {
        const { data: wo } = await supabase
          .from("work_orders")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .eq("equipment_id", equipmentId)
          .eq("scheduled_on", scheduledOn)
          .limit(1)
          .maybeSingle()
        existingId = (wo as { id: string } | null)?.id ?? null
      }

      if (existingId) {
        if (strategy === "skip_duplicates") z.willSkip += 1
        else if (strategy === "create_new_only") z.willFail += 1
        else z.willUpdate += 1
      } else {
        z.willCreate += 1
      }
    }
    return z
  }

  return z
}
