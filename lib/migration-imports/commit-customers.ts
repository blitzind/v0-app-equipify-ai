import { resolveMapped } from "./map-columns"
import type { CommitResult, ImportEngineContext, RowOutcome } from "./types"

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

export async function commitCustomers(ctx: ImportEngineContext): Promise<CommitResult> {
  const { supabase, organizationId, userId, columnMapping, rows, options } = ctx
  const strategy = options.duplicateStrategy ?? "skip_duplicates"

  const { data: existing } = await supabase
    .from("customers")
    .select("id, company_name, external_code")
    .eq("organization_id", organizationId)
    .is("archived_at", null)

  const byCode = new Map<string, string>()
  const byName = new Map<string, string>()
  for (const c of existing ?? []) {
    const r = c as { id: string; company_name: string; external_code: string | null }
    if (r.external_code?.trim()) {
      byCode.set(r.external_code.trim().toLowerCase(), r.id)
    }
    byName.set(normName(r.company_name), r.id)
  }

  const outcomes: RowOutcome[] = []
  let successCount = 0
  let errorCount = 0
  let skippedCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowIndex = i + 1

    let company =
      resolveMapped(row, columnMapping, "company_name") ||
      resolveMapped(row, columnMapping, "contact_full_name")
    if (!company) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["missing_company"],
        message: "Company or contact name required.",
      })
      continue
    }

    const extRaw = resolveMapped(row, columnMapping, "external_code")
    const ext = extRaw?.trim() || null

    if (ext && byCode.has(ext.toLowerCase())) {
      if (strategy === "fail_on_duplicate") {
        errorCount += 1
        outcomes.push({
          rowIndex,
          status: "error",
          codes: ["duplicate_external_code"],
          message: "External code already exists in this workspace.",
        })
      } else {
        skippedCount += 1
        outcomes.push({
          rowIndex,
          status: "duplicate",
          codes: ["duplicate_external_code"],
          message: "Skipped — external code already exists.",
        })
      }
      continue
    }

    if (byName.has(normName(company))) {
      if (strategy === "fail_on_duplicate") {
        errorCount += 1
        outcomes.push({
          rowIndex,
          status: "error",
          codes: ["duplicate_company"],
          message: "Company name already exists.",
        })
      } else {
        skippedCount += 1
        outcomes.push({
          rowIndex,
          status: "duplicate",
          codes: ["duplicate_company_name"],
          message: "Skipped — company name already exists.",
        })
      }
      continue
    }

    const notesParts: string[] = []
    const notesBase = resolveMapped(row, columnMapping, "notes")
    if (notesBase) notesParts.push(notesBase)
    const tags = resolveMapped(row, columnMapping, "tags")
    if (tags) notesParts.push(`Tags (imported): ${tags}`)
    const parentExt = resolveMapped(row, columnMapping, "parent_external_code")
    if (parentExt) {
      notesParts.push(`Legacy parent account reference: ${parentExt.trim()}`)
    }
    const notes = notesParts.length ? notesParts.join("\n\n") : null

    const statusRaw = resolveMapped(row, columnMapping, "status").toLowerCase()
    const status = statusRaw === "inactive" ? "inactive" : "active"

    const { data: custIns, error: cErr } = await supabase
      .from("customers")
      .insert({
        organization_id: organizationId,
        company_name: company.trim(),
        external_code: ext,
        notes,
        status,
        created_by: userId,
      })
      .select("id")
      .maybeSingle()

    if (cErr || !custIns) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["insert_failed"],
        message: cErr?.message ?? "Could not create customer.",
      })
      continue
    }

    const customerId = (custIns as { id: string }).id
    if (ext) byCode.set(ext.toLowerCase(), customerId)
    byName.set(normName(company), customerId)

    const a1 = resolveMapped(row, columnMapping, "address_line1")
    const a2 = resolveMapped(row, columnMapping, "address_line2")
    const city = resolveMapped(row, columnMapping, "city")
    const state = resolveMapped(row, columnMapping, "state")
    const postal = resolveMapped(row, columnMapping, "postal_code")
    if (a1 && city && state && postal) {
      const locName =
        resolveMapped(row, columnMapping, "location_name").trim() || "Primary service location"
      const { error: lErr } = await supabase.from("customer_locations").insert({
        organization_id: organizationId,
        customer_id: customerId,
        name: locName,
        address_line1: a1,
        address_line2: a2 || null,
        city,
        state,
        postal_code: postal,
        phone: resolveMapped(row, columnMapping, "contact_phone") || null,
        contact_person: resolveMapped(row, columnMapping, "contact_full_name") || null,
        is_default: true,
      })
      if (lErr) {
        notesParts.push(`(Import warning: location not saved — ${lErr.message})`)
        await supabase
          .from("customers")
          .update({ notes: notesParts.filter(Boolean).join("\n\n") })
          .eq("id", customerId)
          .eq("organization_id", organizationId)
      }
    }

    const cName = resolveMapped(row, columnMapping, "contact_full_name")
    const cEmail = resolveMapped(row, columnMapping, "contact_email")
    const cPhone = resolveMapped(row, columnMapping, "contact_phone")
    if (cName || cEmail || cPhone) {
      const fullName =
        cName.trim() || (cEmail ? cEmail.split("@")[0] : "") || "Primary contact"
      await supabase.from("customer_contacts").insert({
        organization_id: organizationId,
        customer_id: customerId,
        full_name: fullName,
        email: cEmail || null,
        phone: cPhone || null,
        is_primary: true,
      })
    }

    successCount += 1
    outcomes.push({
      rowIndex,
      status: "imported",
      codes: [],
      message: null,
      entityKind: "customer",
      entityId: customerId,
    })
  }

  return { successCount, errorCount, skippedCount, outcomes }
}
