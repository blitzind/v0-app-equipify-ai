import { resolveMapped } from "./map-columns"
import { resolveImportStrategy } from "./strategy"
import { normalizeImportedInvoiceTerms } from "@/lib/billing/invoice-terms"
import { normalizeBooleanImport } from "@/lib/billing/tax-framework"
import type { CommitResult, ImportEngineContext, RowOutcome } from "./types"

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

function tooLong(value: string, max: number) {
  return value.length > max
}

function truthyImportValue(value: string): boolean | null {
  const v = value.trim().toLowerCase()
  if (!v) return null
  if (["true", "yes", "y", "1", "required", "required before invoice", "required before service"].includes(v)) return true
  if (["false", "no", "n", "0", "not required", "none"].includes(v)) return false
  return true
}

function normalizeBillingBehavior(value: string): "own_billing" | "parent_billing" | "custom" | null {
  const v = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")
  if (!v) return null
  if (["parent_billing", "uses_parent_billing", "parent", "bill_to_parent"].includes(v)) return "parent_billing"
  if (["custom", "custom_billing"].includes(v)) return "custom"
  if (["own_billing", "own", "independent", "bills_independently"].includes(v)) return "own_billing"
  return null
}

type CustomerRow = {
  id: string
  company_name: string
  external_code: string | null
  notes: string | null
  status: string
  parent_customer_id: string | null
  billing_name: string | null
  billing_contact_name: string | null
  billing_email: string | null
  billing_contact_phone: string | null
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_postal_code: string | null
  billing_country: string | null
  po_required: boolean | null
  default_po_number: string | null
  invoice_instructions: string | null
  billing_behavior: string | null
  default_invoice_terms_code: string | null
  default_payment_terms_key: string | null
  default_payment_terms_days: number | null
  default_payment_terms_label: string | null
  tax_exempt: boolean | null
  tax_exemption_id: string | null
  tax_exemption_notes: string | null
  default_tax_basis: string | null
}

export async function commitCustomers(ctx: ImportEngineContext): Promise<CommitResult> {
  const { supabase, organizationId, userId, columnMapping, rows } = ctx
  const strategy = resolveImportStrategy(ctx.options)

  const { data: existing } = await supabase
    .from("customers")
    .select("id, company_name, external_code, notes, status, parent_customer_id, billing_name, billing_contact_name, billing_email, billing_contact_phone, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country, po_required, default_po_number, invoice_instructions, billing_behavior, default_invoice_terms_code, default_payment_terms_key, default_payment_terms_days, default_payment_terms_label, tax_exempt, tax_exemption_id, tax_exemption_notes, default_tax_basis")
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
    .eq("is_archived", false)

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

  const outcomes: RowOutcome[] = []
  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  function findMatch(
    company: string,
    ext: string | null,
    contactEmail: string,
    contactPhone: string,
    addressKey: string,
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
    const phone = normPhone(contactPhone)
    if (phone && phoneToCustomer.has(phone)) {
      const id = phoneToCustomer.get(phone)!
      const row = customersById.get(id)
      return { id, label: row?.company_name?.trim() || phone }
    }
    if (addressKey && addressToCustomer.has(addressKey)) {
      const id = addressToCustomer.get(addressKey)!
      const row = customersById.get(id)
      return { id, label: row?.company_name?.trim() || "matching address" }
    }
    return null
  }

  function findParent(row: Record<string, string>, childName: string): { id: string; label: string } | null {
    if (!ctx.options.linkChildrenToExistingParents) return null
    const parentExt = resolveMapped(row, columnMapping, "parent_external_code").trim()
    const parentCompany = resolveMapped(row, columnMapping, "parent_company_name").trim()
    const parentId =
      (parentExt ? byCode.get(parentExt.toLowerCase()) : null) ||
      (parentCompany ? byName.get(normName(parentCompany)) : null) ||
      null
    if (!parentId) return null
    const parent = customersById.get(parentId)
    if (!parent || normName(parent.company_name) === normName(childName)) return null
    return { id: parentId, label: parent.company_name }
  }

  function addBillingPatch(
    patch: Record<string, unknown>,
    values: {
      billing_name: string
      billing_contact_name: string
      billing_email: string
      billing_contact_phone: string
      billing_address_line1: string
      billing_address_line2: string
      billing_city: string
      billing_state: string
      billing_postal_code: string
      billing_country: string
      default_po_number: string
      invoice_instructions: string
      billing_behavior: "own_billing" | "parent_billing" | "custom" | null
      po_required: boolean | null
      payment_terms: ReturnType<typeof normalizeImportedInvoiceTerms>
      tax_exempt: boolean | null
      tax_exemption_id: string
      tax_exemption_notes: string
      default_tax_basis: string
    },
    current?: CustomerRow,
  ) {
    const setText = (field: keyof CustomerRow, value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return
      if (strategy === "update_existing" || !current || !String(current[field] ?? "").trim()) {
        patch[field] = trimmed
      }
    }
    setText("billing_name", values.billing_name)
    setText("billing_contact_name", values.billing_contact_name)
    setText("billing_email", values.billing_email)
    setText("billing_contact_phone", values.billing_contact_phone)
    setText("billing_address_line1", values.billing_address_line1)
    setText("billing_address_line2", values.billing_address_line2)
    setText("billing_city", values.billing_city)
    setText("billing_state", values.billing_state)
    setText("billing_postal_code", values.billing_postal_code)
    setText("billing_country", values.billing_country)
    setText("default_po_number", values.default_po_number)
    setText("invoice_instructions", values.invoice_instructions)
    if (values.billing_behavior && (strategy === "update_existing" || !current || !current.billing_behavior)) {
      patch.billing_behavior = values.billing_behavior
    }
    if (
      values.payment_terms &&
      (strategy === "update_existing" || !current || !current.default_payment_terms_key)
    ) {
      patch.default_invoice_terms_code = values.payment_terms.code
      patch.default_payment_terms_key = values.payment_terms.code
      patch.default_payment_terms_days = values.payment_terms.days
      patch.default_payment_terms_label = values.payment_terms.label
    }
    if (values.po_required !== null && (strategy === "update_existing" || !current || current.po_required === null)) {
      patch.po_required = values.po_required
      if (values.po_required) patch.po_number_required_before_invoice = true
    }
    if (values.tax_exempt !== null && (strategy === "update_existing" || !current || current.tax_exempt === null)) {
      patch.tax_exempt = values.tax_exempt
    }
    setText("tax_exemption_id", values.tax_exemption_id)
    setText("tax_exemption_notes", values.tax_exemption_notes)
    setText("default_tax_basis", values.default_tax_basis)
    if (
      (values.billing_address_line1 || values.billing_city || values.billing_state || values.billing_postal_code) &&
      (strategy === "update_existing" || !current || current.billing_address_line1 === null)
    ) {
      patch.billing_address_same_as_service = false
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowIndex = i + 1

    let company =
      resolveMapped(row, columnMapping, "company_name") ||
      resolveMapped(row, columnMapping, "contact_full_name")
    const cEmail = resolveMapped(row, columnMapping, "contact_email")
    if (!company) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["missing_company"],
        message: "Customer name is required.",
      })
      continue
    }
    if (!isValidEmail(cEmail)) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["invalid_email"],
        message: "Contact email is not a valid email address.",
      })
      continue
    }

    const extRaw = resolveMapped(row, columnMapping, "external_code")
    const ext = extRaw?.trim() || null
    const cPhone = resolveMapped(row, columnMapping, "contact_phone")
    if (!isValidPhone(cPhone)) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["invalid_phone"],
        message: "Phone number format is invalid.",
      })
      continue
    }

    const a1 = resolveMapped(row, columnMapping, "address_line1") || resolveMapped(row, columnMapping, "service_address_line1")
    const city = resolveMapped(row, columnMapping, "city") || resolveMapped(row, columnMapping, "service_city")
    const state = resolveMapped(row, columnMapping, "state") || resolveMapped(row, columnMapping, "service_state")
    const postal = resolveMapped(row, columnMapping, "postal_code") || resolveMapped(row, columnMapping, "service_postal_code")
    const addressKey = a1 && city && state && postal ? normAddress([a1, city, state, postal]) : ""
    const oversizedFields = [
      tooLong(company, 200) ? "company_name" : null,
      ext && tooLong(ext, 120) ? "external_code" : null,
      tooLong(cEmail, 254) ? "contact_email" : null,
      tooLong(cPhone, 60) ? "contact_phone" : null,
      tooLong(resolveMapped(row, columnMapping, "notes"), 8000) ? "notes" : null,
      tooLong(resolveMapped(row, columnMapping, "tax_id"), 120) ? "tax_id" : null,
      tooLong(resolveMapped(row, columnMapping, "po_requirements"), 1000) ? "po_requirements" : null,
      tooLong(resolveMapped(row, columnMapping, "default_payment_terms_label"), 120) ? "default_payment_terms_label" : null,
      tooLong(resolveMapped(row, columnMapping, "tax_exemption_id"), 120) ? "tax_exemption_id" : null,
      tooLong(resolveMapped(row, columnMapping, "tax_exemption_notes"), 1000) ? "tax_exemption_notes" : null,
      tooLong(resolveMapped(row, columnMapping, "default_tax_basis"), 40) ? "default_tax_basis" : null,
      tooLong(resolveMapped(row, columnMapping, "legacy_source_ids"), 1000) ? "legacy_source_ids" : null,
    ].filter(Boolean)
    if (oversizedFields.length > 0) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["oversized_fields"],
        message: `Fields exceed import limits: ${oversizedFields.join(", ")}.`,
      })
      continue
    }

    const notesParts: string[] = []
    const notesBase = resolveMapped(row, columnMapping, "notes")
    if (notesBase) notesParts.push(notesBase)
    const taxId = resolveMapped(row, columnMapping, "tax_id")
    if (taxId) notesParts.push(`Tax ID (imported): ${taxId}`)
    const poRequirements = resolveMapped(row, columnMapping, "po_requirements")
    if (poRequirements) notesParts.push(`PO requirements (imported): ${poRequirements}`)
    const legacySourceIds = resolveMapped(row, columnMapping, "legacy_source_ids")
    if (legacySourceIds) notesParts.push(`Legacy source IDs (imported): ${legacySourceIds}`)
    const tags = resolveMapped(row, columnMapping, "tags")
    if (tags) notesParts.push(`Tags (imported): ${tags}`)
    const importNotes = notesParts.length ? notesParts.join("\n\n") : null

    const statusRaw = resolveMapped(row, columnMapping, "status").toLowerCase()
    const csvStatus = statusRaw === "inactive" ? "inactive" : "active"
    const billingValues = {
      billing_name: resolveMapped(row, columnMapping, "billing_name"),
      billing_contact_name: resolveMapped(row, columnMapping, "billing_contact_name"),
      billing_email: resolveMapped(row, columnMapping, "billing_contact_email"),
      billing_contact_phone: resolveMapped(row, columnMapping, "billing_contact_phone"),
      billing_address_line1:
        resolveMapped(row, columnMapping, "billing_address_line_1") ||
        resolveMapped(row, columnMapping, "address_line1"),
      billing_address_line2:
        resolveMapped(row, columnMapping, "billing_address_line_2") ||
        resolveMapped(row, columnMapping, "address_line2"),
      billing_city: resolveMapped(row, columnMapping, "billing_city") || resolveMapped(row, columnMapping, "city"),
      billing_state: resolveMapped(row, columnMapping, "billing_state") || resolveMapped(row, columnMapping, "state"),
      billing_postal_code:
        resolveMapped(row, columnMapping, "billing_postal_code") ||
        resolveMapped(row, columnMapping, "postal_code"),
      billing_country: resolveMapped(row, columnMapping, "billing_country") || resolveMapped(row, columnMapping, "country"),
      default_po_number: resolveMapped(row, columnMapping, "default_po_number"),
      invoice_instructions: resolveMapped(row, columnMapping, "invoice_instructions"),
      billing_behavior: normalizeBillingBehavior(resolveMapped(row, columnMapping, "billing_behavior")),
      po_required:
        truthyImportValue(resolveMapped(row, columnMapping, "po_required")) ??
        truthyImportValue(resolveMapped(row, columnMapping, "po_requirements")),
      payment_terms: normalizeImportedInvoiceTerms(
        resolveMapped(row, columnMapping, "default_payment_terms_key") ||
          resolveMapped(row, columnMapping, "default_payment_terms_label"),
        resolveMapped(row, columnMapping, "default_payment_terms_days"),
      ),
      tax_exempt: normalizeBooleanImport(resolveMapped(row, columnMapping, "tax_exempt")),
      tax_exemption_id: resolveMapped(row, columnMapping, "tax_exemption_id"),
      tax_exemption_notes: resolveMapped(row, columnMapping, "tax_exemption_notes"),
      default_tax_basis: resolveMapped(row, columnMapping, "default_tax_basis"),
    }

    const match = findMatch(company, ext, cEmail, cPhone, addressKey)
    const parentMatch = findParent(row, company)

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
        if (parentMatch && parentMatch.id !== match.id) patch.parent_customer_id = parentMatch.id
        addBillingPatch(patch, billingValues, cur)
      } else {
        // update_empty_fields
        if (ext && !(cur.external_code?.trim())) patch.external_code = ext
        if (importNotes && !(cur.notes?.trim())) patch.notes = importNotes
        if (csvStatus === "inactive" && cur.status === "active") patch.status = csvStatus
        if (parentMatch && parentMatch.id !== match.id && !cur.parent_customer_id) patch.parent_customer_id = parentMatch.id
        addBillingPatch(patch, billingValues, cur)
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
            parent_customer_id: (patch.parent_customer_id as string) ?? cur.parent_customer_id,
          })
        } else {
          customersById.set(match.id, {
            ...cur,
            external_code: (patch.external_code as string) ?? cur.external_code,
            notes: (patch.notes as string) ?? cur.notes,
            status: (patch.status as string) ?? cur.status,
            parent_customer_id: (patch.parent_customer_id as string) ?? cur.parent_customer_id,
          })
        }
        if (patch.external_code && ext) {
          byCode.set(ext.toLowerCase(), match.id)
        }
      }

      const cName = resolveMapped(row, columnMapping, "contact_full_name")
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
              address_line2: resolveMapped(row, columnMapping, "address_line2") || resolveMapped(row, columnMapping, "service_address_line2") || null,
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
            address_line2: resolveMapped(row, columnMapping, "address_line2") || resolveMapped(row, columnMapping, "service_address_line2") || null,
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
          codes: patch.parent_customer_id ? ["parent_linked"] : [],
          message: patch.parent_customer_id ? `Linked to parent account ${parentMatch?.label}.` : null,
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
        parent_customer_id: parentMatch?.id ?? null,
        billing_name: billingValues.billing_name.trim() || null,
        billing_contact_name: billingValues.billing_contact_name.trim() || null,
        billing_email: billingValues.billing_email.trim() || null,
        billing_contact_phone: billingValues.billing_contact_phone.trim() || null,
        billing_address_same_as_service: !billingValues.billing_address_line1.trim(),
        billing_address_line1: billingValues.billing_address_line1.trim() || null,
        billing_address_line2: billingValues.billing_address_line2.trim() || null,
        billing_city: billingValues.billing_city.trim() || null,
        billing_state: billingValues.billing_state.trim() || null,
        billing_postal_code: billingValues.billing_postal_code.trim() || null,
        billing_country: billingValues.billing_country.trim() || null,
        po_required: billingValues.po_required,
        po_number_required_before_invoice: billingValues.po_required ? true : null,
        default_po_number: billingValues.default_po_number.trim() || null,
        invoice_instructions: billingValues.invoice_instructions.trim() || null,
        billing_behavior: billingValues.billing_behavior,
        default_invoice_terms_code: billingValues.payment_terms?.code ?? null,
        default_payment_terms_key: billingValues.payment_terms?.code ?? null,
        default_payment_terms_days: billingValues.payment_terms?.days ?? null,
        default_payment_terms_label: billingValues.payment_terms?.label ?? null,
        tax_exempt: billingValues.tax_exempt,
        tax_exemption_id: billingValues.tax_exemption_id.trim() || null,
        tax_exemption_notes: billingValues.tax_exemption_notes.trim() || null,
        default_tax_basis: billingValues.default_tax_basis.trim() || null,
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
      parent_customer_id: parentMatch?.id ?? null,
      billing_name: billingValues.billing_name.trim() || null,
      billing_contact_name: billingValues.billing_contact_name.trim() || null,
      billing_email: billingValues.billing_email.trim() || null,
      billing_contact_phone: billingValues.billing_contact_phone.trim() || null,
      billing_address_line1: billingValues.billing_address_line1.trim() || null,
      billing_address_line2: billingValues.billing_address_line2.trim() || null,
      billing_city: billingValues.billing_city.trim() || null,
      billing_state: billingValues.billing_state.trim() || null,
      billing_postal_code: billingValues.billing_postal_code.trim() || null,
      billing_country: billingValues.billing_country.trim() || null,
      po_required: billingValues.po_required,
      default_po_number: billingValues.default_po_number.trim() || null,
      invoice_instructions: billingValues.invoice_instructions.trim() || null,
      billing_behavior: billingValues.billing_behavior,
      default_invoice_terms_code: billingValues.payment_terms?.code ?? null,
      default_payment_terms_key: billingValues.payment_terms?.code ?? null,
      default_payment_terms_days: billingValues.payment_terms?.days ?? null,
      default_payment_terms_label: billingValues.payment_terms?.label ?? null,
      tax_exempt: billingValues.tax_exempt,
      tax_exemption_id: billingValues.tax_exemption_id.trim() || null,
      tax_exemption_notes: billingValues.tax_exemption_notes.trim() || null,
      default_tax_basis: billingValues.default_tax_basis.trim() || null,
    }
    customersById.set(customerId, newRow)
    if (ext) byCode.set(ext.toLowerCase(), customerId)
    byName.set(normName(company), customerId)
    if (cEmail.trim()) {
      emailToCustomer.set(cEmail.trim().toLowerCase(), customerId)
    }
    if (cPhone.trim()) {
      phoneToCustomer.set(normPhone(cPhone), customerId)
    }

    const a2 = resolveMapped(row, columnMapping, "address_line2") || resolveMapped(row, columnMapping, "service_address_line2")
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
        const np = [...notesParts, `(Import warning: location not saved — ${lErr.message})`]
        await supabase
          .from("customers")
          .update({ notes: np.filter(Boolean).join("\n\n") })
          .eq("id", customerId)
          .eq("organization_id", organizationId)
      } else if (addressKey) {
        addressToCustomer.set(addressKey, customerId)
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
      codes: parentMatch ? ["parent_linked"] : [],
      message: parentMatch ? `Linked to parent account ${parentMatch.label}.` : null,
      entityKind: "customer",
      entityId: customerId,
      matchedLabel: company.trim(),
    })
  }

  return { createdCount, updatedCount, skippedCount, errorCount, outcomes }
}
