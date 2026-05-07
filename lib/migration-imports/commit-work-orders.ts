import { resolveMapped } from "./map-columns"
import {
  csvWorkOrderPriorityToDb,
  csvWorkOrderStatusToDb,
  csvWorkOrderTypeToDb,
} from "./work-order-csv"
import { resolveImportStrategy } from "./strategy"
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

function parseWoNumber(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = parseInt(t, 10)
  if (Number.isNaN(n) || n < 1) return null
  return n
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

async function findExistingWorkOrderId(
  supabase: ImportEngineContext["supabase"],
  organizationId: string,
  customerId: string,
  equipmentId: string,
  scheduledOn: string | null,
  woNum: number | null,
): Promise<string | null> {
  if (woNum != null) {
    const { data } = await supabase
      .from("work_orders")
      .select("id, customer_id, equipment_id")
      .eq("organization_id", organizationId)
      .eq("work_order_number", woNum)
      .maybeSingle()
    const row = data as { id: string; customer_id: string; equipment_id: string } | null
    if (row && row.customer_id === customerId && row.equipment_id === equipmentId) {
      return row.id
    }
    if (row) return row.id
  }
  if (scheduledOn) {
    const { data } = await supabase
      .from("work_orders")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .eq("equipment_id", equipmentId)
      .eq("scheduled_on", scheduledOn)
      .limit(1)
      .maybeSingle()
    return (data as { id: string } | null)?.id ?? null
  }
  return null
}

export async function commitWorkOrders(ctx: ImportEngineContext): Promise<CommitResult> {
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

  const caches = { idByExt, idsByCompany }
  const outcomes: RowOutcome[] = []
  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

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

    const woNum = parseWoNumber(resolveMapped(row, columnMapping, "work_order_number"))

    const existingId = await findExistingWorkOrderId(
      supabase,
      organizationId,
      resolved.customerId,
      resolved.equipmentId,
      scheduledOn,
      woNum,
    )

    if (existingId) {
      const { data: exRow } = await supabase
        .from("work_orders")
        .select("id, customer_id, equipment_id, status, priority, type, scheduled_on, completed_at, notes, invoice_number, title")
        .eq("id", existingId)
        .eq("organization_id", organizationId)
        .maybeSingle()

      const ex = exRow as {
        id: string
        customer_id: string
        equipment_id: string
        status: string
        priority: string
        type: string
        scheduled_on: string | null
        completed_at: string | null
        notes: string | null
        invoice_number: string | null
        title: string
      } | null

      if (!ex) {
        errorCount += 1
        outcomes.push({
          rowIndex,
          status: "error",
          codes: ["load_failed"],
          message: "Could not load existing work order.",
        })
        continue
      }

      if (ex.customer_id !== resolved.customerId || ex.equipment_id !== resolved.equipmentId) {
        errorCount += 1
        outcomes.push({
          rowIndex,
          status: "error",
          codes: ["wo_number_conflict"],
          message: "Work order number exists for another job.",
          matchedLabel: woNum != null ? `WO #${woNum}` : "Existing row",
        })
        continue
      }

      const label = woNum != null ? `WO #${woNum}` : ex.title?.slice(0, 40) || "Work order"

      if (strategy === "skip_duplicates") {
        skippedCount += 1
        outcomes.push({
          rowIndex,
          status: "skipped",
          codes: ["duplicate_work_order"],
          message: "Skipped — matches existing work order.",
          entityKind: "work_order",
          entityId: ex.id,
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
          message: "Matches existing work order — not allowed for “only create new”.",
          matchedLabel: label,
        })
        continue
      }

      const patch: Record<string, unknown> = {}
      if (strategy === "update_existing") {
        patch.title = title.slice(0, 500)
        patch.status = status
        patch.priority = priority
        patch.type = type
        patch.scheduled_on = scheduledOn
        patch.completed_at = completedAt
        patch.notes = notes
        patch.problem_reported = problemReported
        if (legacyInv) patch.invoice_number = legacyInv.trim().slice(0, 120)
      } else {
        if (!(ex.notes?.trim()) && notes) patch.notes = notes
        if (!ex.completed_at && completedAt) patch.completed_at = completedAt
        if (!(ex.invoice_number?.trim()) && legacyInv) {
          patch.invoice_number = legacyInv.trim().slice(0, 120)
        }
        if (ex.status === "open" && status === "completed") patch.status = status
      }

      if (Object.keys(patch).length === 0) {
        skippedCount += 1
        outcomes.push({
          rowIndex,
          status: "skipped",
          codes: ["no_fields_to_update"],
          message: "No updates applied.",
          matchedLabel: label,
        })
        continue
      }

      const { error: uErr } = await supabase
        .from("work_orders")
        .update(patch as never)
        .eq("id", ex.id)
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

      updatedCount += 1
      outcomes.push({
        rowIndex,
        status: "updated",
        codes: [],
        message: null,
        entityKind: "work_order",
        entityId: ex.id,
        matchedLabel: label,
      })
      continue
    }

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

    if (woNum != null) {
      payload.work_order_number = woNum
    }

    const { data: ins, error } = await supabase
      .from("work_orders")
      .insert(payload as never)
      .select("id, work_order_number")
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

    const insRow = ins as { id: string; work_order_number: number }
    createdCount += 1
    outcomes.push({
      rowIndex,
      status: "imported",
      codes: [],
      message: null,
      entityKind: "work_order",
      entityId: insRow.id,
      matchedLabel: `WO #${insRow.work_order_number}`,
    })
  }

  return { createdCount, updatedCount, skippedCount, errorCount, outcomes }
}
