"use client"

/**
 * Invoicing Phase 2 — Customer-level invoice terms clarity card.
 *
 * Sits on the customer detail Overview tab and explains in human language
 * whether the customer inherits the workspace default invoice terms or
 * overrides it. Mirrors the visual language of the
 * `CustomerPortalCertificateRuleCard` (Phase 2 / certificates).
 */

import * as React from "react"
import { CalendarClock, CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import {
  describeTermsResolution,
  invoiceTermsCodeLabel,
  netDaysForTermsCode,
} from "@/lib/billing/invoice-terms"

export type CustomerBillingTermsCardProps = {
  organizationId: string
  /** Customer-level override; null/empty means inherit workspace default. */
  customerTermsCode: string | null
  className?: string
}

export function CustomerBillingTermsCard({
  organizationId,
  customerTermsCode,
  className,
}: CustomerBillingTermsCardProps) {
  const [orgCode, setOrgCode] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    if (!organizationId) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const { data, error } = await supabase
        .from("organizations")
        .select("default_invoice_terms_code")
        .eq("id", organizationId)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        // Schema-drift safety: if the workspace default column is missing in
        // legacy environments, treat as fallback (Net 30) and continue.
        setOrgCode(null)
      } else {
        setOrgCode(
          (data as { default_invoice_terms_code?: string | null } | null)?.default_invoice_terms_code ??
            null,
        )
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  const resolution = describeTermsResolution({
    customerCode: customerTermsCode,
    organizationCode: orgCode,
  })
  const effective = resolution.effective
  const days = netDaysForTermsCode(effective)
  const orgLabel = invoiceTermsCodeLabel(orgCode)

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex w-8 h-8 rounded-lg bg-secondary/40 items-center justify-center shrink-0">
          {effective === "due_on_receipt" ? (
            <CheckCircle2 className="w-4 h-4 text-foreground" aria-hidden />
          ) : (
            <CalendarClock className="w-4 h-4 text-foreground" aria-hidden />
          )}
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Invoice payment terms
          </p>
          <p className="text-sm font-semibold text-foreground">
            {invoiceTermsCodeLabel(effective)}
          </p>
          <p className="text-xs text-muted-foreground leading-snug">
            {effective === "due_on_receipt"
              ? "New invoices for this customer are due on the issue date."
              : effective === "custom"
                ? "New invoices use a custom number of days after the issue date."
                : `New invoices are due ${days} days after the issue date.`}
          </p>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-1.5 text-[11px] text-muted-foreground">
        {loading ? (
          <p>Loading workspace default…</p>
        ) : resolution.source === "customer_override" ? (
          <p className="flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
            <span>
              Customer override active. Workspace default is{" "}
              <span className="text-foreground font-medium">{orgLabel}</span>. Switch this
              customer to “Use organization default” to inherit the workspace setting.
            </span>
          </p>
        ) : resolution.source === "organization_default" ? (
          <p className="flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
            <span>
              Using the workspace default (<span className="text-foreground font-medium">{orgLabel}</span>).
              Update <span className="font-medium text-foreground">Settings → Billing</span> to
              change every customer that uses the default.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
            <span>
              No workspace default set — using the built-in fallback{" "}
              <span className="text-foreground font-medium">Net 30</span>. Configure a default in{" "}
              <span className="font-medium text-foreground">Settings → Billing</span>.
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
