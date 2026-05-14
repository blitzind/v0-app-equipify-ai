"use client"

/**
 * Customer Hierarchy + Billing/Service Address — Phase 1
 *
 * Manage-hierarchy dialog: lets owners/admins/managers
 *   - link this customer to a parent account (or clear it)
 *   - choose whether the billing address inherits from the default service
 *     location, or set explicit billing fields
 *
 * Strict rules:
 *   - No raw UUIDs in UI: parent options render company names only.
 *   - Same-org enforced server-side via the composite FK; client also filters
 *     candidates to the same org and excludes the customer itself.
 *   - Cycle protection comes from `customers_prevent_parent_cycle()` — the
 *     Postgres trigger raises `23514` which we surface as a friendly error.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { missingCustomerHierarchyColumns } from "@/lib/customers/postgrest-fallback"
import {
  PAYMENT_TERMS_OPTIONS,
  invoiceTermsCodeLabel,
  netDaysForTermsCode,
  type InvoiceTermsCode,
} from "@/lib/billing/invoice-terms"

type Props = {
  open: boolean
  onClose: () => void
  onSaved?: () => void
  organizationId: string
  customerId: string
  /** Used to exclude self + show "Linking <Acme> to …". */
  customerCompany: string
  /** Initial parent (when present). */
  initialParent: { id: string; companyName: string } | null
  /** Initial billing snapshot. */
  initialBilling: {
    billingName: string | null
    /** DB `billing_address_same_as_service` — street lines from a location vs custom columns. */
    billingAddressSameAsService: boolean
    /** When set with billingAddressSameAsService, bill-to uses this customer_locations row. */
    billingLocationId: string | null
    attention: string | null
    contactName: string | null
    email: string | null
    phone: string | null
    line1: string
    line2: string | null
    city: string
    state: string
    postalCode: string
    country: string | null
    notes: string | null
    behavior: "own_billing" | "parent_billing" | "custom" | null
    poRequired: boolean
    poRequiredBeforeService: boolean
    poRequiredBeforeInvoice: boolean
    defaultPoNumber: string | null
    invoiceInstructions: string | null
    invoiceDeliveryPreference: string | null
    defaultPaymentTermsKey: string | null
    defaultPaymentTermsDays: number | null
    defaultPaymentTermsLabel: string | null
    taxExempt: boolean
    taxExemptionId: string | null
    taxExemptionNotes: string | null
    defaultTaxBasis: string | null
    defaultTaxCategory: string | null
  }
}

type ParentOption = { id: string; company_name: string }

const SECTION_HEADER =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground"

export function ManageHierarchyDialog({
  open,
  onClose,
  onSaved,
  organizationId,
  customerId,
  customerCompany,
  initialParent,
  initialBilling,
}: Props) {
  const [parentOptions, setParentOptions] = useState<ParentOption[]>([])
  const [parentLoading, setParentLoading] = useState(false)
  const [parentId, setParentId] = useState<string>("")
  const [billingBehavior, setBillingBehavior] = useState<"own_billing" | "parent_billing" | "custom">("own_billing")
  const [billingName, setBillingName] = useState("")
  const [sameAsService, setSameAsService] = useState(true)
  const [billingLocationId, setBillingLocationId] = useState<string | null>(null)
  const billingLocationSnapshotOnOpen = useRef<string | null>(null)
  const [attention, setAttention] = useState("")
  const [contactName, setContactName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [line1, setLine1] = useState("")
  const [line2, setLine2] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [country, setCountry] = useState("")
  const [poRequired, setPoRequired] = useState(false)
  const [poBeforeService, setPoBeforeService] = useState(false)
  const [poBeforeInvoice, setPoBeforeInvoice] = useState(false)
  const [defaultPoNumber, setDefaultPoNumber] = useState("")
  const [paymentTermsKey, setPaymentTermsKey] = useState<InvoiceTermsCode | "">("")
  const [paymentTermsDays, setPaymentTermsDays] = useState(30)
  const [invoiceDeliveryPreference, setInvoiceDeliveryPreference] = useState("")
  const [invoiceInstructions, setInvoiceInstructions] = useState("")
  const [taxExempt, setTaxExempt] = useState(false)
  const [taxExemptionId, setTaxExemptionId] = useState("")
  const [taxExemptionNotes, setTaxExemptionNotes] = useState("")
  const [defaultTaxBasis, setDefaultTaxBasis] = useState("")
  const [defaultTaxCategory, setDefaultTaxCategory] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schemaMissing, setSchemaMissing] = useState(false)

  // Sync initial values whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    setParentId(initialParent?.id ?? "")
    setBillingBehavior(initialBilling.behavior ?? "own_billing")
    setBillingName(initialBilling.billingName ?? "")
    setSameAsService(initialBilling.billingAddressSameAsService)
    billingLocationSnapshotOnOpen.current = initialBilling.billingLocationId ?? null
    setBillingLocationId(initialBilling.billingLocationId ?? null)
    setAttention(initialBilling.attention ?? "")
    setContactName(initialBilling.contactName ?? "")
    setEmail(initialBilling.email ?? "")
    setPhone(initialBilling.phone ?? "")
    setLine1(initialBilling.line1 ?? "")
    setLine2(initialBilling.line2 ?? "")
    setCity(initialBilling.city ?? "")
    setState(initialBilling.state ?? "")
    setPostalCode(initialBilling.postalCode ?? "")
    setCountry(initialBilling.country ?? "")
    setPoRequired(initialBilling.poRequired)
    setPoBeforeService(initialBilling.poRequiredBeforeService)
    setPoBeforeInvoice(initialBilling.poRequiredBeforeInvoice)
    setDefaultPoNumber(initialBilling.defaultPoNumber ?? "")
    const nextTerms = (initialBilling.defaultPaymentTermsKey ?? "") as InvoiceTermsCode | ""
    setPaymentTermsKey(nextTerms)
    setPaymentTermsDays(initialBilling.defaultPaymentTermsDays ?? netDaysForTermsCode(nextTerms || "net_30"))
    setInvoiceDeliveryPreference(initialBilling.invoiceDeliveryPreference ?? "")
    setInvoiceInstructions(initialBilling.invoiceInstructions ?? "")
    setTaxExempt(initialBilling.taxExempt)
    setTaxExemptionId(initialBilling.taxExemptionId ?? "")
    setTaxExemptionNotes(initialBilling.taxExemptionNotes ?? "")
    setDefaultTaxBasis(initialBilling.defaultTaxBasis ?? "")
    setDefaultTaxCategory(initialBilling.defaultTaxCategory ?? "")
    setNotes(initialBilling.notes ?? "")
    setError(null)
  }, [open, initialParent?.id, initialBilling])

  // Load parent candidates: other active, non-archived customers in the same org.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setParentLoading(true)
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const { data, error } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", organizationId)
        .neq("id", customerId)
        .is("archived_at", null)
        .is("parent_customer_id", null)
        .order("company_name", { ascending: true })
        .limit(500)
      if (cancelled) return
      if (!error && data) {
        setParentOptions(data as ParentOption[])
      }
      setParentLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, customerId])

  const filteredParentOptions = useMemo(
    () => parentOptions.filter((p) => p.id !== customerId),
    [parentOptions, customerId],
  )

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const updates: Record<string, unknown> = {
        parent_customer_id: parentId.trim() ? parentId : null,
        billing_behavior: billingBehavior,
        billing_name: billingName.trim() || null,
        billing_address_same_as_service: sameAsService,
        billing_location_id: sameAsService ? billingLocationId || null : null,
        billing_attention: attention.trim() || null,
        billing_contact_name: contactName.trim() || null,
        billing_email: email.trim() || null,
        billing_contact_phone: phone.trim() || null,
        billing_country: country.trim() || null,
        po_required: poRequired,
        po_number_required_before_service: poBeforeService,
        po_number_required_before_invoice: poBeforeInvoice,
        default_po_number: defaultPoNumber.trim() || null,
        default_invoice_terms_code: paymentTermsKey || null,
        default_payment_terms_key: paymentTermsKey || null,
        default_payment_terms_days: paymentTermsKey ? netDaysForTermsCode(paymentTermsKey, paymentTermsDays) : null,
        default_payment_terms_label: paymentTermsKey
          ? paymentTermsKey === "custom"
            ? `Custom ${paymentTermsDays} days`
            : invoiceTermsCodeLabel(paymentTermsKey)
          : null,
        invoice_delivery_preference: invoiceDeliveryPreference.trim() || null,
        invoice_instructions: invoiceInstructions.trim() || null,
        tax_exempt: taxExempt,
        tax_exemption_id: taxExemptionId.trim() || null,
        tax_exemption_notes: taxExemptionNotes.trim() || null,
        default_tax_basis: defaultTaxBasis.trim() || null,
        default_tax_category: defaultTaxCategory.trim() || null,
      }
      if (sameAsService) {
        // When inheriting, clear explicit billing fields so the read remains
        // unambiguous. Notes are preserved (they may be billing instructions).
        updates.billing_address_line1 = null
        updates.billing_address_line2 = null
        updates.billing_city = null
        updates.billing_state = null
        updates.billing_postal_code = null
        updates.billing_notes = notes.trim() || null
      } else {
        updates.billing_address_line1 = line1.trim() || null
        updates.billing_address_line2 = line2.trim() || null
        updates.billing_city = city.trim() || null
        updates.billing_state = state.trim() || null
        updates.billing_postal_code = postalCode.trim() || null
        updates.billing_notes = notes.trim() || null
      }

      const { error: updErr } = await supabase
        .from("customers")
        .update(updates)
        .eq("organization_id", organizationId)
        .eq("id", customerId)

      if (updErr) {
        if (missingCustomerHierarchyColumns(updErr)) {
          setSchemaMissing(true)
          setError(
            "Hierarchy fields are not yet available on this database. Run the latest migration to enable them.",
          )
          return
        }
        // Cycle / depth guard from `customers_prevent_parent_cycle()`.
        const msg = (updErr.message ?? "").toLowerCase()
        if (msg.includes("cycle") || msg.includes("depth limit")) {
          setError(
            "Could not save: that parent account would create a hierarchy cycle.",
          )
          return
        }
        setError(updErr.message || "Could not save hierarchy changes.")
        return
      }

      onSaved?.()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground truncate">
              Hierarchy &amp; billing
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {customerCompany}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[75vh] space-y-5 overflow-y-auto px-5 py-4"
        >
          {/* Parent account */}
          <section className="space-y-2">
            <label className={SECTION_HEADER} htmlFor="hierarchy-parent">
              Parent account
            </label>
            <select
              id="hierarchy-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              disabled={parentLoading || schemaMissing}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="">No parent — top-level account</option>
              {filteredParentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company_name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Linking to a parent enables consolidated reporting and a clear
              hierarchy in the customer list.
            </p>
          </section>

          <section className="space-y-2">
            <label className={SECTION_HEADER} htmlFor="billing-behavior">
              Billing behavior
            </label>
            <select
              id="billing-behavior"
              value={billingBehavior}
              onChange={(e) =>
                setBillingBehavior(e.target.value as "own_billing" | "parent_billing" | "custom")
              }
              disabled={schemaMissing}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="own_billing">Bills independently</option>
              <option value="parent_billing">Use parent address</option>
              <option value="custom">Custom billing</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              This controls invoice defaults only. Consolidated parent billing is not enabled in this phase.
            </p>
          </section>

          {/* Billing address */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className={SECTION_HEADER}>Billing address</span>
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={sameAsService}
                  onChange={(e) => {
                    const v = e.target.checked
                    setSameAsService(v)
                    if (!v) {
                      setBillingLocationId(null)
                    } else {
                      setBillingLocationId(billingLocationSnapshotOnOpen.current)
                    }
                  }}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                Use service location for street address
              </label>
            </div>
            {sameAsService && billingLocationId ? (
              <p className="text-[11px] text-muted-foreground">
                A specific billing site is selected on the customer Overview (multi-location
                cards). Clear it there to fall back to the primary service location.
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Bill-to name (optional)
                </label>
                <input
                  value={billingName}
                  onChange={(e) => setBillingName(e.target.value)}
                  placeholder={customerCompany}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Attn (optional)
                </label>
                <input
                  value={attention}
                  onChange={(e) => setAttention(e.target.value)}
                  placeholder="Accounts Payable"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Billing contact (optional)
                </label>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Accounts Payable"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Billing email (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ap@customer.com"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Billing phone (optional)
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-0123"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>

              <div className={`sm:col-span-2 ${sameAsService ? "opacity-50" : ""}`}>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Street address
                </label>
                <input
                  disabled={sameAsService}
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className={`sm:col-span-2 ${sameAsService ? "opacity-50" : ""}`}>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Address line 2
                </label>
                <input
                  disabled={sameAsService}
                  value={line2}
                  onChange={(e) => setLine2(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className={sameAsService ? "opacity-50" : ""}>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  City
                </label>
                <input
                  disabled={sameAsService}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className={`grid grid-cols-2 gap-2 ${sameAsService ? "opacity-50" : ""}`}>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-foreground">
                    State
                  </label>
                  <input
                    disabled={sameAsService}
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-foreground">
                    Postal code
                  </label>
                  <input
                    disabled={sameAsService}
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
              </div>
              <div className={sameAsService ? "opacity-50" : ""}>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Country
                </label>
                <input
                  disabled={sameAsService}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="US"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-foreground">
                Billing notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="PO required, tax-exempt, etc."
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <span className={SECTION_HEADER}>PO requirements</span>
            <label className="flex items-start gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={poRequired}
                onChange={(e) => setPoRequired(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-border"
              />
              <span>PO is generally required for this customer</span>
            </label>
            <label className="flex items-start gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={poBeforeService}
                onChange={(e) => setPoBeforeService(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-border"
              />
              <span>PO number should be collected before service</span>
            </label>
            <label className="flex items-start gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={poBeforeInvoice}
                onChange={(e) => setPoBeforeInvoice(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-border"
              />
              <span>PO number should be collected before invoicing</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Default PO number
                </label>
                <input
                  value={defaultPoNumber}
                  onChange={(e) => setDefaultPoNumber(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Invoice delivery
                </label>
                <select
                  value={invoiceDeliveryPreference}
                  onChange={(e) => setInvoiceDeliveryPreference(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="">No preference</option>
                  <option value="email">Email</option>
                  <option value="portal">Portal</option>
                  <option value="mail">Mail</option>
                  <option value="manual">Manual / customer system</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Payment terms
                </label>
                <select
                  value={paymentTermsKey}
                  onChange={(e) => {
                    const next = e.target.value as InvoiceTermsCode | ""
                    setPaymentTermsKey(next)
                    if (next && next !== "custom") setPaymentTermsDays(netDaysForTermsCode(next))
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="">Use workspace default</option>
                  {PAYMENT_TERMS_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {paymentTermsKey === "custom" ? (
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-foreground">
                    Custom net days
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(Number.parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {paymentTermsKey
                ? paymentTermsKey === "due_on_receipt"
                  ? "Invoices are due on the issue date."
                  : `Invoices due ${netDaysForTermsCode(paymentTermsKey, paymentTermsDays)} days after issue date.`
                : "Invoices use the workspace default terms, falling back to Net 30."}
            </p>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-foreground">
                Invoice instructions
              </label>
              <textarea
                value={invoiceInstructions}
                onChange={(e) => setInvoiceInstructions(e.target.value)}
                rows={2}
                placeholder="Include PO on invoice, submit through vendor portal, reference department code, etc."
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <span className={SECTION_HEADER}>Tax defaults</span>
            <label className="flex items-start gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={taxExempt}
                onChange={(e) => setTaxExempt(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-border"
              />
              <span>Customer is tax exempt by default</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Exemption ID
                </label>
                <input
                  value={taxExemptionId}
                  onChange={(e) => setTaxExemptionId(e.target.value)}
                  placeholder="Certificate or account ID"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Default tax basis
                </label>
                <select
                  value={defaultTaxBasis}
                  onChange={(e) => setDefaultTaxBasis(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="">Use invoice context</option>
                  <option value="service_location">Service location</option>
                  <option value="billing_address">Billing address</option>
                  <option value="manual">Manual review</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Tax category
                </label>
                <input
                  value={defaultTaxCategory}
                  onChange={(e) => setDefaultTaxCategory(e.target.value)}
                  placeholder="Optional future provider category for US jurisdiction tax"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Exemption notes
                </label>
                <textarea
                  value={taxExemptionNotes}
                  onChange={(e) => setTaxExemptionNotes(e.target.value)}
                  rows={2}
                  placeholder="Store exemption notes for internal review. This is not tax-compliance validation."
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
          </section>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting || schemaMissing}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
