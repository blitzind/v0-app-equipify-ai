import { resolveMapped } from "./map-columns"
import { resolveImportStrategy } from "./strategy"
import type { CommitResult, ImportEngineContext, RowOutcome } from "./types"

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

type CustomerRow = {
  id: string
  company_name: string
  external_code: string | null
  notes: string | null
  status: string
}

export async function commitCustomers(ctx: ImportEngineContext): Promise<CommitResult> {
  const { supabase, organizationId, userId, columnMapping, rows } = ctx
  const strategy = resolveImportStrategy(ctx.options)

  const { data: existing } = await supabase
    .from("customers")
    .select("id, company_name, external_code, notes, status")
    .eq("organization_id", organizationId)
    .is("archived_at", null)

  const byCode = new Map<string, string>()
  const byName = new Map<string, string>()
  const customersById = new Map<string, CustomerRow>()
  for (const c of existing ?? []) {
    const r = c as CustomerRow
    customersById.set(r.id, r)
    if (r.external_code?.trim()) {
      byCode.set(r.external_code.trim().toLowerCase(), r.id)
    }
    byName.set(normName(r.company_name), r.id)
  }

  const { data: contactRows } = await supabase
    .from("customer_contacts")
    .select("customer_id, email")
    .eq("organization_id", organizationId)

  const emailToCustomer = new Map<string, string>()
  for (const cr of contactRows ?? []) {
    const r = cr as { customer_id: string; email: string | null }
    const em = r.email?.trim().toLowerCase()
    if (em && !emailToCustomer.has(em)) emailToCustomer.set(em, r.customer_id)
  }

  const outcomes: RowOutcome[] = []
  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  function findMatch(
    company: string,
    ext: string | null,
    contactEmail: string,
  ): { id: string; label: string } | null {
    if (ext && byCode.has(ext.toLowerCase())) {
      const id = byCode.get(ext.toLowerCase())!
      const row = customersById.get(id)
      return { id, label: row?.company_name?.trim() || ext }
    }
    if (byName.has(normName(company))) {
      const id = byName.get(normName(company))!
      const row = customersById.get(id)
      return { id, label: row?.company_name?.trim() || company.trim() }
    }
    const em = contactEmail.trim().toLowerCase()
    if (em && emailToCustomer.has(em)) {
      const id = emailToCustomer.get(em)!
      const row = customersById.get(id)
      return { id, label: row?.company_name?.trim() || em }
    }
    return null
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowIndex = i + 1

    let company =
      resolveMapped(row, columnMapping, "company_name") ||
      resolveMapped(row, columnMapping, "contact_full_name")
    const cEmail = resolveMapped(row, columnMapping, "contact_email")
    if (!company && !cEmail.trim()) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["missing_company"],
        message: "Company name or contact email required.",
      })
      continue
    }
    if (!company) {
      company = cEmail.split("@")[0] || "Imported account"
    }

    const extRaw = resolveMapped(row, columnMapping, "external_code")
    const ext = extRaw?.trim() || null

    const notesParts: string[] = []
    const notesBase = resolveMapped(row, columnMapping, "notes")
    if (notesBase) notesParts.push(notesBase)
    const tags = resolveMapped(row, columnMapping, "tags")
    if (tags) notesParts.push(`Tags (imported): ${tags}`)
    const parentExt = resolveMapped(row, columnMapping, "parent_external_code")
    if (parentExt) {
      notesParts.push(`Legacy parent account reference: ${parentExt.trim()}`)
    }
    const importNotes = notesParts.length ? notesParts.join("\n\n") : null

    const statusRaw = resolveMapped(row, columnMapping, "status").toLowerCase()
    const csvStatus = statusRaw === "inactive" ? "inactive" : "active"

    const match = findMatch(company, ext, cEmail)

    if (match) {
      const cur = customersById.get(match.id)!
      const label = match.label

      if (strategy === "skip_duplicates") {
        skippedCount += 1
        outcomes.push({
          rowIndex,
          status: "duplicate",
          codes: ["duplicate_customer"],
          message: "Skipped — matches existing customer.",
          entityKind: "customer",
          entityId: match.id,
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
          message: "Matches existing customer — not allowed for “only create new” strategy.",
          matchedLabel: label,
        })
        continue
      }

      const patch: Record<string, unknown> = {}
      if (strategy === "update_existing") {
        patch.company_name = company.trim()
        if (ext != null) patch.external_code = ext
        if (importNotes != null) patch.notes = importNotes
        patch.status = csvStatus
      } else {
        // update_empty_fields
        if (ext && !(cur.external_code?.trim())) patch.external_code = ext
        if (importNotes && !(cur.notes?.trim())) patch.notes = importNotes
        if (csvStatus === "inactive" && cur.status === "active") patch.status = csvStatus
      }

      let rowTouched = false

      if (Object.keys(patch).length > 0) {
        const { error: uErr } = await supabase
          .from("customers")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", match.id)
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
        rowTouched = true
        if (patch.company_name) {
          byName.delete(normName(cur.company_name))
          byName.set(normName(company.trim()), match.id)
          customersById.set(match.id, {
            ...cur,
            company_name: company.trim(),
            external_code: (patch.external_code as string) ?? cur.external_code,
            notes: (patch.notes as string) ?? cur.notes,
            status: (patch.status as string) ?? cur.status,
          })
        } else {
          customersById.set(match.id, {
            ...cur,
            external_code: (patch.external_code as string) ?? cur.external_code,
            notes: (patch.notes as string) ?? cur.notes,
            status: (patch.status as string) ?? cur.status,
          })
        }
        if (patch.external_code && ext) {
          byCode.set(ext.toLowerCase(), match.id)
        }
      }

      const cName = resolveMapped(row, columnMapping, "contact_full_name")
      const cPhone = resolveMapped(row, columnMapping, "contact_phone")
      if (cName || cEmail || cPhone) {
        const { data: primaries } = await supabase
          .from("customer_contacts")
          .select("id, email, phone, full_name")
          .eq("organization_id", organizationId)
          .eq("customer_id", match.id)
          .eq("is_primary", true)
          .limit(1)

        const primary = primaries?.[0] as
          | { id: string; email: string | null; phone: string | null; full_name: string }
          | undefined

        if (strategy === "update_existing" && primary) {
          const fullName =
            cName.trim() || (cEmail ? cEmail.split("@")[0] : "") || primary.full_name
          await supabase
            .from("customer_contacts")
            .update({
              full_name: fullName,
              email: cEmail || primary.email,
              phone: cPhone || primary.phone,
            })
            .eq("id", primary.id)
          rowTouched = true
        } else if (strategy === "update_empty_fields" && primary) {
          const fullName =
            cName.trim() || (cEmail ? cEmail.split("@")[0] : "") || primary.full_name
          await supabase
            .from("customer_contacts")
            .update({
              full_name: !(primary.full_name?.trim()) ? fullName : primary.full_name,
              email: !(primary.email?.trim()) && cEmail ? cEmail : primary.email,
              phone: !(primary.phone?.trim()) && cPhone ? cPhone : primary.phone,
            })
            .eq("id", primary.id)
          if (
            !(primary.full_name?.trim()) ||
            (!(primary.email?.trim()) && Boolean(cEmail.trim())) ||
            (!(primary.phone?.trim()) && Boolean(cPhone.trim()))
          ) {
            rowTouched = true
          }
        } else if (!primary && (cName || cEmail || cPhone)) {
          const fullName =
            cName.trim() || (cEmail ? cEmail.split("@")[0] : "") || "Primary contact"
          await supabase.from("customer_contacts").insert({
            organization_id: organizationId,
            customer_id: match.id,
            full_name: fullName,
            email: cEmail || null,
            phone: cPhone || null,
            is_primary: true,
          })
          rowTouched = true
        }
      }

      const a1 = resolveMapped(row, columnMapping, "address_line1")
      const city = resolveMapped(row, columnMapping, "city")
      const state = resolveMapped(row, columnMapping, "state")
      const postal = resolveMapped(row, columnMapping, "postal_code")
      if (a1 && city && state && postal) {
        const locName =
          resolveMapped(row, columnMapping, "location_name").trim() || "Primary service location"
        const { data: locs } = await supabase
          .from("customer_locations")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("customer_id", match.id)
          .eq("is_default", true)
          .limit(1)
        const locId = (locs?.[0] as { id: string } | undefined)?.id
        if (locId && strategy === "update_existing") {
          await supabase
            .from("customer_locations")
            .update({
              name: locName,
              address_line1: a1,
              address_line2: resolveMapped(row, columnMapping, "address_line2") || null,
              city,
              state,
              postal_code: postal,
              phone: resolveMapped(row, columnMapping, "contact_phone") || null,
            })
            .eq("id", locId)
          rowTouched = true
        } else if (!locId) {
          await supabase.from("customer_locations").insert({
            organization_id: organizationId,
            customer_id: match.id,
            name: locName,
            address_line1: a1,
            address_line2: resolveMapped(row, columnMapping, "address_line2") || null,
            city,
            state,
            postal_code: postal,
            phone: resolveMapped(row, columnMapping, "contact_phone") || null,
            contact_person: resolveMapped(row, columnMapping, "contact_full_name") || null,
            is_default: true,
          })
          rowTouched = true
        }
      }

      if (rowTouched) {
        updatedCount += 1
        outcomes.push({
          rowIndex,
          status: "updated",
          codes: [],
          message: null,
          entityKind: "customer",
          entityId: match.id,
          matchedLabel: label,
        })
      } else {
        skippedCount += 1
        outcomes.push({
          rowIndex,
          status: "skipped",
          codes: ["no_empty_fields_to_fill"],
          message: "No empty fields to update for this strategy.",
          matchedLabel: label,
        })
      }
      continue
    }

    // Create new
    const { data: custIns, error: cErr } = await supabase
      .from("customers")
      .insert({
        organization_id: organizationId,
        company_name: company.trim(),
        external_code: ext,
        notes: importNotes,
        status: csvStatus,
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
    const newRow: CustomerRow = {
      id: customerId,
      company_name: company.trim(),
      external_code: ext,
      notes: importNotes,
      status: csvStatus,
    }
    customersById.set(customerId, newRow)
    if (ext) byCode.set(ext.toLowerCase(), customerId)
    byName.set(normName(company), customerId)
    if (cEmail.trim()) {
      emailToCustomer.set(cEmail.trim().toLowerCase(), customerId)
    }

    const a1 = resolveMapped(row, columnMapping, "address_line1")
    const a2 = resolveMapped(row, columnMapping, "address_line2")
    const city = resolveMapped(row, columnMapping, "city")
    const st = resolveMapped(row, columnMapping, "state")
    const postal = resolveMapped(row, columnMapping, "postal_code")
    if (a1 && city && st && postal) {
      const locName =
        resolveMapped(row, columnMapping, "location_name").trim() || "Primary service location"
      const { error: lErr } = await supabase.from("customer_locations").insert({
        organization_id: organizationId,
        customer_id: customerId,
        name: locName,
        address_line1: a1,
        address_line2: a2 || null,
        city,
        state: st,
        postal_code: postal,
        phone: resolveMapped(row, columnMapping, "contact_phone") || null,
        contact_person: resolveMapped(row, columnMapping, "contact_full_name") || null,
        is_default: true,
      })
      if (lErr) {
        const np = [...notesParts, `(Import warning: location not saved — ${lErr.message})`]
        await supabase
          .from("customers")
          .update({ notes: np.filter(Boolean).join("\n\n") })
          .eq("id", customerId)
          .eq("organization_id", organizationId)
      }
    }

    const cn = resolveMapped(row, columnMapping, "contact_full_name")
    const cp = resolveMapped(row, columnMapping, "contact_phone")
    if (cn || cEmail || cp) {
      const fullName = cn.trim() || (cEmail ? cEmail.split("@")[0] : "") || "Primary contact"
      await supabase.from("customer_contacts").insert({
        organization_id: organizationId,
        customer_id: customerId,
        full_name: fullName,
        email: cEmail || null,
        phone: cp || null,
        is_primary: true,
      })
    }

    createdCount += 1
    outcomes.push({
      rowIndex,
      status: "imported",
      codes: [],
      message: null,
      entityKind: "customer",
      entityId: customerId,
      matchedLabel: company.trim(),
    })
  }

  return { createdCount, updatedCount, skippedCount, errorCount, outcomes }
}
