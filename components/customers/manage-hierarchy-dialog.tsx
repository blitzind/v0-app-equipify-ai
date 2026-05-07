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

import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { missingCustomerHierarchyColumns } from "@/lib/customers/postgrest-fallback"

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
    sameAsService: boolean
    attention: string | null
    email: string | null
    line1: string
    line2: string | null
    city: string
    state: string
    postalCode: string
    notes: string | null
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
  const [sameAsService, setSameAsService] = useState(true)
  const [attention, setAttention] = useState("")
  const [email, setEmail] = useState("")
  const [line1, setLine1] = useState("")
  const [line2, setLine2] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schemaMissing, setSchemaMissing] = useState(false)

  // Sync initial values whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    setParentId(initialParent?.id ?? "")
    setSameAsService(initialBilling.sameAsService)
    setAttention(initialBilling.attention ?? "")
    setEmail(initialBilling.email ?? "")
    setLine1(initialBilling.line1 ?? "")
    setLine2(initialBilling.line2 ?? "")
    setCity(initialBilling.city ?? "")
    setState(initialBilling.state ?? "")
    setPostalCode(initialBilling.postalCode ?? "")
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
        billing_address_same_as_service: sameAsService,
        billing_attention: attention.trim() || null,
        billing_email: email.trim() || null,
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

          {/* Billing address */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className={SECTION_HEADER}>Billing address</span>
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={sameAsService}
                  onChange={(e) => setSameAsService(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                Use default service location
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <div className="sm:col-span-2">
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
