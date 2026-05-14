import { resolveMapped } from "./map-columns"
import { findParentImportMatch, readParentImportSources } from "./parent-import"
import { normalizeImportedInvoiceTerms } from "@/lib/billing/invoice-terms"
import { normalizeBooleanImport } from "@/lib/billing/tax-framework"
import type { PreviewIssue, PreviewResult, PreviewSampleRow } from "./public-types"
import type { ImportEngineContext } from "./types"
import { MIGRATION_IMPORT_MAX_ROWS } from "./constants"

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

function oversized(field: string, value: string, max: number): PreviewIssue | null {
  if (value.length <= max) return null
  return {
    rowIndex: 0,
    severity: "error",
    code: `${field}_too_long`,
    message: `${field.replace(/_/g, " ")} exceeds ${max} characters.`,
  }
}

function truthyImportValue(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (!v) return false
  if (["false", "no", "n", "0", "not required", "none"].includes(v)) return false
  return ["true", "yes", "y", "1", "required", "required before invoice", "required before service"].includes(v) || v.includes("required")
}

export async function buildCustomerPreview(
  ctx: ImportEngineContext,
): Promise<PreviewResult> {
  const { supabase, organizationId, columnMapping, rows } = ctx

  const { data: existing } = await supabase
    .from("customers")
    .select("id, company_name, external_code")
    .eq("organization_id", organizationId)
    .is("archived_at", null)

  const byCode = new Map<string, { id: string; name: string }>()
  const byName = new Map<string, { id: string; code: string | null; name: string }>()
  for (const c of existing ?? []) {
    const r = c as { id: string; company_name: string; external_code: string | null }
    if (r.external_code?.trim()) {
      byCode.set(r.external_code.trim().toLowerCase(), { id: r.id, name: r.company_name })
    }
    byName.set(normName(r.company_name), { id: r.id, code: r.external_code, name: r.company_name })
  }

  const { data: contacts } = await supabase
    .from("customer_contacts")
    .select("customer_id, email, phone, customers(company_name)")
    .eq("organization_id", organizationId)

  const byEmail = new Map<string, string>()
  const byPhone = new Map<string, string>()
  for (const contact of contacts ?? []) {
    const r = contact as {
      email: string | null
      phone: string | null
      customers?: { company_name?: string | null } | null
    }
    const label = r.customers?.company_name?.trim() || "existing customer"
    const email = r.email?.trim().toLowerCase()
    const phone = r.phone ? normPhone(r.phone) : ""
    if (email && !byEmail.has(email)) byEmail.set(email, label)
    if (phone && !byPhone.has(phone)) byPhone.set(phone, label)
  }

  const { data: locations } = await supabase
    .from("customer_locations")
    .select("address_line1, city, state, postal_code, customers(company_name)")
    .eq("organization_id", organizationId)
    .is("archived_at", null)

  const byAddress = new Map<string, string>()
  for (const location of locations ?? []) {
    const r = location as {
      address_line1: string
      city: string
      state: string
      postal_code: string
      customers?: { company_name?: string | null } | null
    }
    const key = normAddress([r.address_line1, r.city, r.state, r.postal_code])
    if (key && !byAddress.has(key)) byAddress.set(key, r.customers?.company_name?.trim() || "existing customer")
  }

  const duplicateHints: PreviewResult["duplicateHints"] = []
  const unresolvedRefs: { rowIndex: number; message: string }[] = []
  const sampleRows: PreviewSampleRow[] = []

  let errorRows = 0
  let warningRows = 0
  let okRows = 0
  const issueCounts: Record<string, number> = {}

  const maxScan = Math.min(rows.length, MIGRATION_IMPORT_MAX_ROWS)

  for (let i = 0; i < maxScan; i++) {
    const row = rows[i]
    const rowIndex = i + 1
    const issues: PreviewIssue[] = []

    let company =
      resolveMapped(row, columnMapping, "company_name") ||
      resolveMapped(row, columnMapping, "contact_full_name")
    if (!company) {
      issues.push({
        rowIndex,
        severity: "error",
        code: "missing_company",
        message: "Company name (or contact name) is required.",
      })
    }

    const ext = resolveMapped(row, columnMapping, "external_code")
    if (ext && byCode.has(ext.toLowerCase())) {
      const match = byCode.get(ext.toLowerCase())
      duplicateHints.push({
        rowIndex,
        message: `External code matches existing account (${ext.trim()}).`,
        importedLabel: company || ext.trim(),
        matchedLabel: match?.name,
        matchReason: "external ID",
        confidence: "high",
      })
      issues.push({
        rowIndex,
        severity: "warning",
        code: "duplicate_external_code",
        message: "Matches existing customer by external code — row may be skipped depending on your duplicate strategy.",
      })
    }

    if (company && byName.has(normName(company))) {
      const match = byName.get(normName(company))
      duplicateHints.push({
        rowIndex,
        message: `Company name matches existing account (${company.trim()}).`,
        importedLabel: company.trim(),
        matchedLabel: match?.code ? `${company.trim()} (${match.code})` : company.trim(),
        matchReason: "company name",
        confidence: "medium",
      })
      issues.push({
        rowIndex,
        severity: "warning",
        code: "duplicate_company_name",
        message: "Possible duplicate company name — review before committing.",
      })
    }

    const email = resolveMapped(row, columnMapping, "contact_email")
    if (!isValidEmail(email)) {
      issues.push({
        rowIndex,
        severity: "error",
        code: "invalid_email",
        message: "Contact email is not a valid email address.",
      })
    } else if (email && byEmail.has(email.trim().toLowerCase())) {
      duplicateHints.push({
        rowIndex,
        message: `Contact email matches ${byEmail.get(email.trim().toLowerCase())}.`,
        importedLabel: company || email.trim(),
        matchedLabel: byEmail.get(email.trim().toLowerCase()),
        matchReason: "email",
        confidence: "high",
      })
      issues.push({
        rowIndex,
        severity: "warning",
        code: "duplicate_email",
        message: "Possible duplicate by contact email.",
      })
    }

    const phone = resolveMapped(row, columnMapping, "contact_phone")
    if (!isValidPhone(phone)) {
      issues.push({
        rowIndex,
        severity: "warning",
        code: "invalid_phone",
        message: "Phone number has an unusual format; normalize before importing if possible.",
      })
    } else {
      const phoneKey = normPhone(phone)
      if (phoneKey && byPhone.has(phoneKey)) {
        duplicateHints.push({
          rowIndex,
          message: `Phone matches ${byPhone.get(phoneKey)}.`,
          importedLabel: company || phone,
          matchedLabel: byPhone.get(phoneKey),
          matchReason: "phone",
          confidence: "medium",
        })
        issues.push({
          rowIndex,
          severity: "warning",
          code: "duplicate_phone",
          message: "Possible duplicate by phone number.",
        })
      }
    }

    const a1 = resolveMapped(row, columnMapping, "address_line1") || resolveMapped(row, columnMapping, "service_address_line1")
    const city = resolveMapped(row, columnMapping, "city") || resolveMapped(row, columnMapping, "service_city")
    const state = resolveMapped(row, columnMapping, "state") || resolveMapped(row, columnMapping, "service_state")
    const postal = resolveMapped(row, columnMapping, "postal_code") || resolveMapped(row, columnMapping, "service_postal_code")
    const anyAddr = Boolean(a1 || city || state || postal)
    const fullAddr = Boolean(a1 && city && state && postal)
    if (anyAddr && !fullAddr) {
      issues.push({
        rowIndex,
        severity: "warning",
        code: "partial_address",
        message:
          "Service/billing location requires address line 1, city, state, and postal code — incomplete rows skip location creation.",
      })
      unresolvedRefs.push({
        rowIndex,
        message: "Incomplete address — default service location will not be created for this row.",
      })
    }
    if (fullAddr) {
      const addressKey = normAddress([a1, city, state, postal])
      if (addressKey && byAddress.has(addressKey)) {
        duplicateHints.push({
          rowIndex,
          message: `Billing/service address matches ${byAddress.get(addressKey)}.`,
          importedLabel: company || a1,
          matchedLabel: byAddress.get(addressKey),
          matchReason: "billing/service address",
          confidence: "medium",
        })
        issues.push({
          rowIndex,
          severity: "warning",
          code: "duplicate_address",
          message: "Possible duplicate by billing/service address.",
        })
      }
    }

    const poRequired =
      truthyImportValue(resolveMapped(row, columnMapping, "po_required")) ||
      truthyImportValue(resolveMapped(row, columnMapping, "po_requirements"))
    const invoiceInstructions = resolveMapped(row, columnMapping, "invoice_instructions")
    if (poRequired && !invoiceInstructions.trim()) {
      issues.push({
        rowIndex,
        severity: "warning",
        code: "po_required_without_invoice_instructions",
        message: "PO is marked required, but no invoice instructions are mapped for this customer.",
      })
    }
    const importedTerms =
      resolveMapped(row, columnMapping, "default_payment_terms_key") ||
      resolveMapped(row, columnMapping, "default_payment_terms_label")
    const importedTermsDays = resolveMapped(row, columnMapping, "default_payment_terms_days")
    if ((importedTerms || importedTermsDays) && !normalizeImportedInvoiceTerms(importedTerms, importedTermsDays)) {
      issues.push({
        rowIndex,
        severity: "warning",
        code: "unrecognized_payment_terms",
        message: "Payment terms could not be recognized. Use values like Net 30, net_30, 30, Due on Receipt, or Custom 45.",
      })
    }
    const importedTaxExempt = resolveMapped(row, columnMapping, "tax_exempt")
    if (importedTaxExempt && normalizeBooleanImport(importedTaxExempt) === null) {
      issues.push({
        rowIndex,
        severity: "warning",
        code: "ambiguous_tax_exempt",
        message: "Tax exempt value is ambiguous. Use Yes/No, True/False, or Exempt/Taxable.",
      })
    }

    const maxChecks = [
      oversized("company_name", company, 200),
      oversized("external_code", ext, 120),
      oversized("contact_email", email, 254),
      oversized("contact_phone", phone, 60),
      oversized("notes", resolveMapped(row, columnMapping, "notes"), 8000),
      oversized("tax_id", resolveMapped(row, columnMapping, "tax_id"), 120),
      oversized("po_requirements", resolveMapped(row, columnMapping, "po_requirements"), 1000),
      oversized("billing_name", resolveMapped(row, columnMapping, "billing_name"), 200),
      oversized("billing_contact_email", resolveMapped(row, columnMapping, "billing_contact_email"), 254),
      oversized("default_po_number", resolveMapped(row, columnMapping, "default_po_number"), 120),
      oversized("invoice_instructions", resolveMapped(row, columnMapping, "invoice_instructions"), 4000),
      oversized("default_payment_terms_label", resolveMapped(row, columnMapping, "default_payment_terms_label"), 120),
      oversized("tax_exemption_id", resolveMapped(row, columnMapping, "tax_exemption_id"), 120),
      oversized("tax_exemption_notes", resolveMapped(row, columnMapping, "tax_exemption_notes"), 1000),
      oversized("default_tax_basis", resolveMapped(row, columnMapping, "default_tax_basis"), 40),
      oversized("legacy_source_ids", resolveMapped(row, columnMapping, "legacy_source_ids"), 1000),
      oversized("parent_account", resolveMapped(row, columnMapping, "parent_account"), 200),
      oversized("parent_external_code", resolveMapped(row, columnMapping, "parent_external_code"), 120),
      oversized("parent_company_name", resolveMapped(row, columnMapping, "parent_company_name"), 200),
    ]
    for (const issue of maxChecks) {
      if (issue) issues.push({ ...issue, rowIndex })
    }

    const parentSources = readParentImportSources(row, columnMapping)
    if (parentSources.parentExt || parentSources.parentCompany || parentSources.parentAccount) {
      const parentMatch = findParentImportMatch(parentSources, company, {
        resolveCode: (codeLower) => {
          const hit = byCode.get(codeLower)
          return hit ? { id: hit.id, label: hit.name } : null
        },
        resolveName: (raw) => {
          const hit = byName.get(normName(raw))
          return hit ? { id: hit.id, label: hit.name } : null
        },
      })
      issues.push({
        rowIndex,
        severity: "warning",
        code: parentMatch && ctx.options.linkChildrenToExistingParents ? "parent_link_ready" : "hierarchy_preserved",
        message:
          parentMatch && ctx.options.linkChildrenToExistingParents
            ? `Will link to parent account ${parentMatch.label} if the row is imported or updated.`
            : parentMatch
              ? `Parent account ${parentMatch.label} matched. Enable parent linking to connect this child during import.`
              : ctx.options.linkChildrenToExistingParents
                ? "Parent account column is mapped, but no existing parent was matched by external ID or company name."
                : "Parent account values are preview-only until you enable parent linking; no existing parent was matched.",
      })
      if (!parentMatch) {
        const detailParts: string[] = []
        if (parentSources.parentExt) detailParts.push(`external code ${parentSources.parentExt}`)
        if (parentSources.parentAccount) detailParts.push(`parent account ${parentSources.parentAccount}`)
        if (parentSources.parentCompany) detailParts.push(`company name ${parentSources.parentCompany}`)
        unresolvedRefs.push({
          rowIndex,
          message: `Parent account not found${detailParts.length ? ` (${detailParts.join("; ")})` : ""}.`,
        })
      }
    }

    const hasError = issues.some((x) => x.severity === "error")
    const hasWarn = issues.some((x) => x.severity === "warning")
    for (const issue of issues) {
      issueCounts[issue.code] = (issueCounts[issue.code] ?? 0) + 1
    }
    if (hasError) errorRows += 1
    else if (hasWarn) warningRows += 1
    else okRows += 1

    if (sampleRows.length < 20) {
      const cells: Record<string, string> = {}
      const keys = [
        "company_name",
        "external_code",
        "contact_full_name",
        "contact_email",
        "city",
        "state",
      ] as const
      for (const k of keys) {
        const v = resolveMapped(row, columnMapping, k)
        if (v) cells[k] = v.length > 48 ? `${v.slice(0, 45)}…` : v
      }
      sampleRows.push({ rowIndex, cells, issues })
    }
  }

  return {
    rowCount: rows.length,
    truncated: rows.length > MIGRATION_IMPORT_MAX_ROWS,
    duplicateHints,
    unresolvedRefs,
    sampleRows,
    summary: {
      errorRows,
      warningRows,
      okRows,
      issueCounts,
    },
  }
}
