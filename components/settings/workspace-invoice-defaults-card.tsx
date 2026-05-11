"use client"

/**
 * Invoicing Phase 3 — Workspace invoice defaults editor.
 *
 * Used on Settings → Payments. Reads / writes
 * `organizations.default_invoice_terms_code` via the new
 * `/api/organizations/[organizationId]/billing/default-invoice-terms` route.
 *
 * The editor only allows preset codes (custom is not a workspace default).
 * Behavior is additive — when null, every customer falls back to the legacy
 * Net 30 default.
 */

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  ORG_DEFAULT_TERMS_OPTIONS,
  invoiceTermsCodeLabel,
  type InvoiceTermsCode,
} from "@/lib/billing/invoice-terms"

const ORG_OPTIONS = ORG_DEFAULT_TERMS_OPTIONS.filter((o) => o.code !== "custom") as Array<{
  code: InvoiceTermsCode
  label: string
}>

export type WorkspaceInvoiceDefaultsCardProps = {
  organizationId: string | null
  /** When false, the form is disabled (e.g. viewer / non-billing role). */
  canEdit: boolean
  className?: string
}

export function WorkspaceInvoiceDefaultsCard({
  organizationId,
  canEdit,
  className,
}: WorkspaceInvoiceDefaultsCardProps) {
  const { toast } = useToast()
  const [loaded, setLoaded] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [code, setCode] = React.useState<string>("")
  const [persistedCode, setPersistedCode] = React.useState<string>("")
  const [schemaPending, setSchemaPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    if (!organizationId) return
    setLoaded(false)
    void (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/billing/default-invoice-terms`,
          { credentials: "include" },
        )
        const body = (await res.json().catch(() => ({}))) as {
          default_invoice_terms_code?: string | null
          schemaMigrationPending?: boolean
          error?: string
        }
        if (cancelled) return
        if (!res.ok) {
          setError(body.error ?? "Could not load workspace invoice defaults.")
          return
        }
        setSchemaPending(Boolean(body.schemaMigrationPending))
        const value = (body.default_invoice_terms_code ?? "").trim()
        setCode(value)
        setPersistedCode(value)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load defaults.")
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  async function handleSave() {
    if (!organizationId || !canEdit) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        default_invoice_terms_code: code.trim() === "" ? null : code.trim(),
      }
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/billing/default-invoice-terms`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      const body = (await res.json().catch(() => ({}))) as {
        default_invoice_terms_code?: string | null
        error?: string
      }
      if (!res.ok) {
        setError(body.error ?? "Could not save default.")
        toast({
          variant: "destructive",
          title: "Could not save",
          description: body.error ?? "Please retry.",
        })
        return
      }
      const next = (body.default_invoice_terms_code ?? "").trim()
      setPersistedCode(next)
      setCode(next)
      toast({
        title: "Workspace default saved",
        description: next
          ? `New invoices will default to ${invoiceTermsCodeLabel(next)} unless overridden by a customer.`
          : "Reverted to the built-in Net 30 fallback.",
      })
    } finally {
      setSaving(false)
    }
  }

  const dirty = code.trim() !== persistedCode.trim()

  return (
    <div
      className={
        className ?? "bg-card border border-border rounded-lg overflow-hidden"
      }
    >
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Invoice payment defaults</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Workspace-wide payment terms for <strong className="font-medium text-foreground/90">customer invoices</strong> you create
          in Equipify — separate from your Equipify workspace subscription under Settings → Billing. Customers can override this on
          their record.
        </p>
      </div>
      <div className="px-6 py-5 space-y-3">
        {!organizationId ? (
          <p className="text-xs text-muted-foreground">No organization selected.</p>
        ) : !loaded ? (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading defaults…
          </p>
        ) : (
          <>
            <div className="space-y-2 max-w-md">
              <label className="block text-xs font-medium text-foreground">
                Default payment terms
              </label>
              <select
                disabled={!canEdit || schemaPending}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                <option value="">Use built-in fallback (Net 30)</option>
                {ORG_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                {code
                  ? `Invoices created without a customer or per-invoice override will default to ${invoiceTermsCodeLabel(code)}.`
                  : "No workspace default — every invoice falls back to Net 30 unless the customer or invoice sets a different code."}
              </p>
            </div>
            {schemaPending ? (
              <p className="text-[11px] text-[color:var(--status-warning)]">
                Workspace default not yet enabled in this database. Apply migration
                {" "}
                <span className="font-mono">20260719120000_service_lifecycle_phase1.sql</span> to
                persist a default.
              </p>
            ) : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                disabled={!canEdit || schemaPending || saving || !dirty}
                onClick={() => void handleSave()}
              >
                {saving ? "Saving…" : dirty ? "Save default" : "No changes to save"}
              </Button>
              {!canEdit ? (
                <p className="text-[11px] text-muted-foreground">
                  Workspace owners and admins with billing access can change this.
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
