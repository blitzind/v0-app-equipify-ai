import { resolveMapped } from "./map-columns"
import type { CommitResult, ImportEngineContext, RowOutcome } from "./types"

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

function parseIsoDate(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return null
  return t.slice(0, 10)
}

async function resolveCustomerId(
  ctx: ImportEngineContext,
  caches: {
    idByExt: Map<string, string>
    idsByCompany: Map<string, string[]>
  },
  row: Record<string, string>,
): Promise<string | null> {
  const ext = resolveMapped(row, ctx.columnMapping, "customer_external_code")
  const comp = resolveMapped(row, ctx.columnMapping, "customer_company")
  if (ext) {
    const id = caches.idByExt.get(ext.trim().toLowerCase())
    if (id) return id
  }
  if (comp) {
    const cand = caches.idsByCompany.get(normName(comp)) ?? []
    if (cand.length === 1) return cand[0]
  }
  return null
}

export async function commitEquipment(ctx: ImportEngineContext): Promise<CommitResult> {
  const { supabase, organizationId, userId, columnMapping, rows, options } = ctx
  const strategy = options.duplicateStrategy ?? "skip_duplicates"

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

  const { data: equipRows } = await supabase
    .from("equipment")
    .select("serial_number")
    .eq("organization_id", organizationId)
    .is("archived_at", null)

  const existingSerials = new Set<string>()
  for (const e of equipRows ?? []) {
    const sn = (e as { serial_number: string | null }).serial_number?.trim()
    if (sn) existingSerials.add(sn.toLowerCase())
  }

  const caches = { idByExt, idsByCompany }
  const outcomes: RowOutcome[] = []
  let successCount = 0
  let errorCount = 0
  let skippedCount = 0
  const fileSerials = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowIndex = i + 1

    const name = resolveMapped(row, columnMapping, "name")
    if (!name) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["missing_name"],
        message: "Equipment name required.",
      })
      continue
    }

    const customerId = await resolveCustomerId(ctx, caches, row)
    if (!customerId) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["customer_not_found"],
        message: "Could not resolve customer — check external code or company name.",
      })
      continue
    }

    const serial = resolveMapped(row, columnMapping, "serial_number")
    if (serial) {
      const low = serial.toLowerCase()
      if (fileSerials.has(low)) {
        errorCount += 1
        outcomes.push({
          rowIndex,
          status: "error",
          codes: ["duplicate_serial_file"],
          message: "Duplicate serial in file.",
        })
        continue
      }
      fileSerials.add(low)
      if (existingSerials.has(low)) {
        if (strategy === "fail_on_duplicate") {
          errorCount += 1
          outcomes.push({
            rowIndex,
            status: "error",
            codes: ["duplicate_serial"],
            message: "Serial number already exists.",
          })
        } else {
          skippedCount += 1
          outcomes.push({
            rowIndex,
            status: "skipped",
            codes: ["duplicate_serial"],
            message: "Skipped — serial already exists.",
          })
        }
        continue
      }
    }

    const installDate = parseIsoDate(resolveMapped(row, columnMapping, "install_date"))
    const warrantyExp = parseIsoDate(resolveMapped(row, columnMapping, "warranty_expires_at"))
    const nextDue = parseIsoDate(resolveMapped(row, columnMapping, "next_due_at"))
    const nextCal = parseIsoDate(resolveMapped(row, columnMapping, "next_calibration_due_at"))

    const intervalRaw = resolveMapped(row, columnMapping, "calibration_interval_months")
    let calibration_interval_months: number | null = null
    if (intervalRaw) {
      const n = parseInt(intervalRaw, 10)
      if (!Number.isNaN(n) && n > 0) calibration_interval_months = n
    }

    const payload: Record<string, unknown> = {
      organization_id: organizationId,
      customer_id: customerId,
      name: name.trim(),
      manufacturer: resolveMapped(row, columnMapping, "manufacturer") || null,
      category: resolveMapped(row, columnMapping, "category") || null,
      subcategory: resolveMapped(row, columnMapping, "subcategory") || null,
      serial_number: serial || null,
      install_date: installDate,
      warranty_expires_at: warrantyExp,
      last_service_at: null,
      next_due_at: nextDue,
      next_calibration_due_at: nextCal,
      calibration_interval_months,
      location_label: resolveMapped(row, columnMapping, "location_label") || null,
      notes: resolveMapped(row, columnMapping, "notes") || null,
      status: "active",
      created_by: userId,
    }

    const { data: ins, error } = await supabase
      .from("equipment")
      .insert(payload)
      .select("id")
      .maybeSingle()

    if (error || !ins) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["insert_failed"],
        message: error?.message ?? "Insert failed.",
      })
      continue
    }

    const id = (ins as { id: string }).id
    if (serial) existingSerials.add(serial.toLowerCase())

    successCount += 1
    outcomes.push({
      rowIndex,
      status: "imported",
      codes: [],
      message: null,
      entityKind: "equipment",
      entityId: id,
    })
  }

  return { successCount, errorCount, skippedCount, outcomes }
}
