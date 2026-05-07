import { resolveMapped } from "./map-columns"
import {
  csvWorkOrderPriorityToDb,
  csvWorkOrderStatusToDb,
  csvWorkOrderTypeToDb,
} from "./work-order-csv"
import type { CommitResult, ImportEngineContext, RowOutcome } from "./types"

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

function parseDateOnly(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return s.slice(0, 10)
}

function parseTs(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

async function resolveCustomerAndEquipment(
  ctx: ImportEngineContext,
  caches: {
    idByExt: Map<string, string>
    idsByCompany: Map<string, string[]>
  },
  row: Record<string, string>,
): Promise<{ customerId: string; equipmentId: string } | null> {
  const ext = resolveMapped(row, ctx.columnMapping, "customer_external_code")
  const comp = resolveMapped(row, ctx.columnMapping, "customer_company")
  const serial = resolveMapped(row, ctx.columnMapping, "equipment_serial")

  let customerId: string | null = null
  if (ext) customerId = caches.idByExt.get(ext.trim().toLowerCase()) ?? null
  if (!customerId && comp) {
    const cand = caches.idsByCompany.get(normName(comp)) ?? []
    if (cand.length === 1) customerId = cand[0]
  }
  if (!customerId || !serial) return null

  const { data: eq } = await ctx.supabase
    .from("equipment")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("customer_id", customerId)
    .ilike("serial_number", serial.trim())
    .is("archived_at", null)
    .maybeSingle()

  const equipmentId = (eq as { id: string } | null)?.id
  if (!equipmentId) return null
  return { customerId, equipmentId }
}

export async function commitWorkOrders(ctx: ImportEngineContext): Promise<CommitResult> {
  const { supabase, organizationId, userId, columnMapping, rows } = ctx

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

  const caches = { idByExt, idsByCompany }
  const outcomes: RowOutcome[] = []
  let successCount = 0
  let errorCount = 0
  let skippedCount = 0

  const defaultRepairLog = {
    problemReported: "",
    diagnosis: "",
    partsUsed: [] as unknown[],
    laborHours: 0,
    technicianNotes: "",
    photos: [] as unknown[],
    signatureDataUrl: "",
    signedBy: "",
    signedAt: "",
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowIndex = i + 1

    const title = resolveMapped(row, columnMapping, "title").trim()
    if (!title) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["missing_title"],
        message: "Title required.",
      })
      continue
    }

    const resolved = await resolveCustomerAndEquipment(ctx, caches, row)
    if (!resolved) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["resolve_failed"],
        message: "Could not resolve customer + equipment serial.",
      })
      continue
    }

    const status = csvWorkOrderStatusToDb(resolveMapped(row, columnMapping, "status"))
    const priority = csvWorkOrderPriorityToDb(resolveMapped(row, columnMapping, "priority"))
    const type = csvWorkOrderTypeToDb(resolveMapped(row, columnMapping, "type"))

    const scheduledOn = parseDateOnly(resolveMapped(row, columnMapping, "scheduled_on"))
    let completedAt = parseTs(resolveMapped(row, columnMapping, "completed_at"))
    if (!completedAt && status === "completed") {
      const base = scheduledOn ?? parseDateOnly(resolveMapped(row, columnMapping, "issued_at"))
      if (base) completedAt = `${base}T17:00:00.000Z`
    }

    const tech = resolveMapped(row, columnMapping, "technician_name")
    const notesParts = [resolveMapped(row, columnMapping, "notes")]
    if (tech) notesParts.push(`Imported technician: ${tech}`)
    const legacyInv = resolveMapped(row, columnMapping, "legacy_invoice_number")
    if (legacyInv) notesParts.push(`Legacy invoice reference: ${legacyInv}`)
    const notes = notesParts.filter(Boolean).join("\n\n") || null

    const problemReported =
      notes?.slice(0, 500) ||
      `Historical service import — ${title.slice(0, 200)}`

    const payload: Record<string, unknown> = {
      organization_id: organizationId,
      customer_id: resolved.customerId,
      equipment_id: resolved.equipmentId,
      title: title.slice(0, 500),
      status,
      priority,
      type,
      scheduled_on: scheduledOn,
      scheduled_time: null,
      completed_at: completedAt,
      assigned_user_id: null,
      invoice_number: legacyInv ? legacyInv.trim().slice(0, 120) : null,
      notes,
      problem_reported: problemReported,
      repair_log: { ...defaultRepairLog, problemReported },
      created_by: userId,
    }

    const { data: ins, error } = await supabase
      .from("work_orders")
      .insert(payload as never)
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

    successCount += 1
    outcomes.push({
      rowIndex,
      status: "imported",
      codes: [],
      message: null,
      entityKind: "work_order",
      entityId: (ins as { id: string }).id,
    })
  }

  return { successCount, errorCount, skippedCount, outcomes }
}
