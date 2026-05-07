import { resolveMapped } from "./map-columns"
import { resolveImportStrategy } from "./strategy"
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

type EquipRow = {
  id: string
  customer_id: string
  serial_number: string | null
  equipment_code: string | null
  name: string
  manufacturer: string | null
  category: string | null
  subcategory: string | null
  install_date: string | null
  warranty_expires_at: string | null
  next_due_at: string | null
  next_calibration_due_at: string | null
  calibration_interval_months: number | null
  location_label: string | null
  notes: string | null
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

function findExistingEquipment(
  serial: string,
  equipCode: string,
  bySerial: Map<string, EquipRow>,
  byCode: Map<string, EquipRow>,
): EquipRow | null {
  if (serial) {
    const low = serial.toLowerCase()
    const hit = bySerial.get(low)
    if (hit) return hit
  }
  const code = equipCode.trim().toLowerCase()
  if (code) {
    return byCode.get(code) ?? null
  }
  return null
}

export async function commitEquipment(ctx: ImportEngineContext): Promise<CommitResult> {
  const { supabase, organizationId, userId, columnMapping, rows } = ctx
  const strategy = resolveImportStrategy(ctx.options)

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

  const { data: equipData } = await supabase
    .from("equipment")
    .select(
      "id, customer_id, serial_number, equipment_code, name, manufacturer, category, subcategory, install_date, warranty_expires_at, next_due_at, next_calibration_due_at, calibration_interval_months, location_label, notes",
    )
    .eq("organization_id", organizationId)
    .is("archived_at", null)

  const bySerial = new Map<string, EquipRow>()
  const byCode = new Map<string, EquipRow>()
  const rowsById = new Map<string, EquipRow>()
  for (const e of equipData ?? []) {
    const er = e as EquipRow
    rowsById.set(er.id, er)
    const sn = er.serial_number?.trim()
    if (sn) bySerial.set(sn.toLowerCase(), er)
    const ec = er.equipment_code?.trim().toLowerCase()
    if (ec) byCode.set(ec, er)
  }

  const caches = { idByExt, idsByCompany }
  const outcomes: RowOutcome[] = []
  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0
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
    const equipCodeRaw = resolveMapped(row, columnMapping, "equipment_code")
    const equipCode = equipCodeRaw.trim()

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
    }

    const existing = findExistingEquipment(serial, equipCode, bySerial, byCode)

    if (existing) {
      const label = existing.serial_number?.trim() || existing.equipment_code?.trim() || existing.name
      if (existing.customer_id !== customerId) {
        errorCount += 1
        outcomes.push({
          rowIndex,
          status: "error",
          codes: ["equipment_customer_mismatch"],
          message: "Matched asset belongs to a different customer — serial/code is org-wide unique.",
          matchedLabel: label,
        })
        continue
      }

      if (strategy === "skip_duplicates") {
        skippedCount += 1
        outcomes.push({
          rowIndex,
          status: "skipped",
          codes: ["duplicate_equipment"],
          message: "Skipped — equipment already exists.",
          entityKind: "equipment",
          entityId: existing.id,
          matchedLabel: label,
        })
        continue
      }

      if (strategy === "create_new_only") {
        errorCount += 1
        outcomes.push({
          rowIndex,
          status: "error",
          codes: ["duplicate_blocked"],
          message: "Matches existing equipment — not allowed for “only create new”.",
          matchedLabel: label,
        })
        continue
      }

      const installDate = parseIsoDate(resolveMapped(row, columnMapping, "install_date"))
      const warrantyExp = parseIsoDate(resolveMapped(row, columnMapping, "warranty_expires_at"))
      const nextDue = parseIsoDate(resolveMapped(row, columnMapping, "next_due_at"))
      const nextCal = parseIsoDate(resolveMapped(row, columnMapping, "next_calibration_due_at"))
      const intervalRaw = resolveMapped(row, columnMapping, "calibration_interval_months")
      let calibration_interval_months: number | null = existing.calibration_interval_months
      if (intervalRaw) {
        const n = parseInt(intervalRaw, 10)
        if (!Number.isNaN(n) && n > 0) calibration_interval_months = n
      }

      const patch: Record<string, unknown> = {}
      if (strategy === "update_existing") {
        patch.name = name.trim()
        patch.manufacturer = resolveMapped(row, columnMapping, "manufacturer") || null
        patch.category = resolveMapped(row, columnMapping, "category") || null
        patch.subcategory = resolveMapped(row, columnMapping, "subcategory") || null
        patch.install_date = installDate
        patch.warranty_expires_at = warrantyExp
        patch.next_due_at = nextDue
        patch.next_calibration_due_at = nextCal
        patch.calibration_interval_months = calibration_interval_months
        patch.location_label = resolveMapped(row, columnMapping, "location_label") || null
        const nNotes = resolveMapped(row, columnMapping, "notes") || null
        patch.notes = nNotes
        if (equipCode && !existing.equipment_code?.trim()) {
          patch.equipment_code = equipCodeRaw.trim()
        }
      } else {
        // update_empty_fields
        if (!(existing.manufacturer?.trim()) && resolveMapped(row, columnMapping, "manufacturer"))
          patch.manufacturer = resolveMapped(row, columnMapping, "manufacturer") || null
        if (!(existing.category?.trim()) && resolveMapped(row, columnMapping, "category"))
          patch.category = resolveMapped(row, columnMapping, "category") || null
        if (!(existing.subcategory?.trim()) && resolveMapped(row, columnMapping, "subcategory"))
          patch.subcategory = resolveMapped(row, columnMapping, "subcategory") || null
        if (!existing.install_date && installDate) patch.install_date = installDate
        if (!existing.warranty_expires_at && warrantyExp) patch.warranty_expires_at = warrantyExp
        if (!existing.next_due_at && nextDue) patch.next_due_at = nextDue
        if (!existing.next_calibration_due_at && nextCal) patch.next_calibration_due_at = nextCal
        if (
          (existing.calibration_interval_months == null || existing.calibration_interval_months === 0) &&
          intervalRaw
        ) {
          const n = parseInt(intervalRaw, 10)
          if (!Number.isNaN(n) && n > 0) patch.calibration_interval_months = n
        }
        if (!(existing.location_label?.trim()) && resolveMapped(row, columnMapping, "location_label"))
          patch.location_label = resolveMapped(row, columnMapping, "location_label") || null
        if (!(existing.notes?.trim()) && resolveMapped(row, columnMapping, "notes"))
          patch.notes = resolveMapped(row, columnMapping, "notes") || null
        if (!(existing.name?.trim()) || existing.name === "Equipment") patch.name = name.trim()
        if (!(existing.equipment_code?.trim()) && equipCode) patch.equipment_code = equipCodeRaw.trim()
      }

      if (Object.keys(patch).length === 0) {
        skippedCount += 1
        outcomes.push({
          rowIndex,
          status: "skipped",
          codes: ["no_fields_to_update"],
          message: "No empty fields to fill.",
          matchedLabel: label,
        })
        continue
      }

      const { error: uErr } = await supabase
        .from("equipment")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("organization_id", organizationId)

      if (uErr) {
        errorCount += 1
        outcomes.push({
          rowIndex,
          status: "error",
          codes: ["update_failed"],
          message: uErr.message,
          matchedLabel: label,
        })
        continue
      }

      const merged = { ...existing, ...patch } as EquipRow
      rowsById.set(existing.id, merged)
      if (serial) bySerial.set(serial.toLowerCase(), merged)
      if (equipCode) byCode.set(equipCode.toLowerCase(), merged)

      updatedCount += 1
      outcomes.push({
        rowIndex,
        status: "updated",
        codes: [],
        message: null,
        entityKind: "equipment",
        entityId: existing.id,
        matchedLabel: label,
      })
      continue
    }

    // Create
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
      equipment_code: equipCodeRaw.trim() || null,
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

    const newId = (ins as { id: string }).id
    const er: EquipRow = {
      id: newId,
      customer_id: customerId,
      serial_number: serial || null,
      equipment_code: equipCodeRaw.trim() || null,
      name: name.trim(),
      manufacturer: (payload.manufacturer as string | null) ?? null,
      category: (payload.category as string | null) ?? null,
      subcategory: (payload.subcategory as string | null) ?? null,
      install_date: (payload.install_date as string | null) ?? null,
      warranty_expires_at: (payload.warranty_expires_at as string | null) ?? null,
      next_due_at: (payload.next_due_at as string | null) ?? null,
      next_calibration_due_at: (payload.next_calibration_due_at as string | null) ?? null,
      calibration_interval_months: (payload.calibration_interval_months as number | null) ?? null,
      location_label: (payload.location_label as string | null) ?? null,
      notes: (payload.notes as string | null) ?? null,
    }
    rowsById.set(er.id, er)
    if (serial) bySerial.set(serial.toLowerCase(), er)
    if (equipCode) byCode.set(equipCode.toLowerCase(), er)

    createdCount += 1
    outcomes.push({
      rowIndex,
      status: "imported",
      codes: [],
      message: null,
      entityKind: "equipment",
      entityId: er.id,
      matchedLabel: serial || er.name,
    })
  }

  return { createdCount, updatedCount, skippedCount, errorCount, outcomes }
}
