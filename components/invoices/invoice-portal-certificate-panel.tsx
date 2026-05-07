"use client"

import { useCallback, useEffect, useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import type { AdminInvoice } from "@/lib/mock-data"
import { fetchInvoicesLinkedToWorkOrder } from "@/lib/portal/work-order-invoices"
import { allLinkedInvoicesPaid } from "@/lib/portal/work-order-invoices"
import { staffPortalCertificateBullets, INVOICE_CERT_RELEASE_OPTIONS } from "@/lib/portal/certificate-release-staff"
import { useInvoices } from "@/lib/quote-invoice-store"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CheckCircle2, FileText, Loader2, Lock } from "lucide-react"

export function InvoicePortalCertificatePanel({ invoice }: { invoice: AdminInvoice }) {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { updateInvoice, refreshInvoices } = useInvoices()
  const [orgMode, setOrgMode] = useState<string | null>(null)
  const [custMode, setCustMode] = useState<string | null>(null)
  const [calReleasedAt, setCalReleasedAt] = useState<string | null>(null)
  const [linkedPaid, setLinkedPaid] = useState(false)
  const [hasLinked, setHasLinked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [overrideLocal, setOverrideLocal] = useState<string>(
    invoice.portalCertificateReleaseOverride ?? "",
  )
  const [saving, setSaving] = useState(false)
  const [certCount, setCertCount] = useState<number | null>(null)
  const [releasedCertCount, setReleasedCertCount] = useState<number | null>(null)

  useEffect(() => {
    setOverrideLocal(invoice.portalCertificateReleaseOverride ?? "")
  }, [invoice.portalCertificateReleaseOverride])

  const loadContext = useCallback(async () => {
    if (orgStatus !== "ready" || !organizationId) return
    setLoading(true)
    const supabase = createBrowserSupabaseClient()
    try {
      const [{ data: orgRow }, { data: custRow }] = await Promise.all([
        supabase.from("organizations").select("portal_certificate_release_mode").eq("id", organizationId).maybeSingle(),
        supabase
          .from("customers")
          .select("portal_certificate_release_mode")
          .eq("id", invoice.customerId)
          .eq("organization_id", organizationId)
          .maybeSingle(),
      ])
      setOrgMode((orgRow as { portal_certificate_release_mode?: string | null } | null)?.portal_certificate_release_mode ?? null)
      setCustMode((custRow as { portal_certificate_release_mode?: string | null } | null)?.portal_certificate_release_mode ?? null)

      if (invoice.calibrationRecordId) {
        const { data: rec } = await supabase
          .from("calibration_records")
          .select("portal_released_at")
          .eq("id", invoice.calibrationRecordId)
          .eq("organization_id", organizationId)
          .maybeSingle()
        setCalReleasedAt((rec as { portal_released_at?: string | null } | null)?.portal_released_at ?? null)
      } else {
        setCalReleasedAt(null)
      }

      const woId = invoice.workOrderId?.trim()
      if (woId) {
        const linked = await fetchInvoicesLinkedToWorkOrder(supabase, organizationId, woId)
        setHasLinked(linked.length > 0)
        setLinkedPaid(allLinkedInvoicesPaid(linked))

        // Phase 2: count certificates linked to this work order, plus how many
        // are already released to the portal (when manual_release rule applies).
        const totalRes = await supabase
          .from("calibration_records")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("work_order_id", woId)
        const total = totalRes.error ? null : totalRes.count ?? 0
        setCertCount(total)

        const releasedRes = await supabase
          .from("calibration_records")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("work_order_id", woId)
          .not("portal_released_at", "is", null)
        if (releasedRes.error) {
          // Phase 1 column may be missing on legacy DBs.
          setReleasedCertCount(null)
        } else {
          setReleasedCertCount(releasedRes.count ?? 0)
        }
      } else {
        setHasLinked(false)
        setLinkedPaid(false)
        setCertCount(null)
        setReleasedCertCount(null)
      }
    } finally {
      setLoading(false)
    }
  }, [orgStatus, organizationId, invoice.customerId, invoice.calibrationRecordId, invoice.workOrderId])

  useEffect(() => {
    void loadContext()
  }, [loadContext])

  const bullets = staffPortalCertificateBullets({
    organizationMode: orgMode,
    customerMode: custMode,
    invoiceOverride: invoice.portalCertificateReleaseOverride ?? null,
    portalReleasedAt: calReleasedAt,
    invoicesAllPaid: linkedPaid,
    hasLinkedInvoices: hasLinked,
  })

  async function saveOverride() {
    if (!organizationId) return
    setSaving(true)
    try {
      const raw = overrideLocal.trim()
      const portalCertificateReleaseOverride =
        raw === "" ? null : raw === "immediate_release" || raw === "release_on_payment" || raw === "manual_release"
          ? raw
          : null
      const { error } = await updateInvoice(invoice.id, { portalCertificateReleaseOverride })
      if (error) {
        console.warn("[invoice certificate override]", error)
        return
      }
      await refreshInvoices()
      await loadContext()
    } finally {
      setSaving(false)
    }
  }

  const blockedByPayment = hasLinked && !linkedPaid && bullets.some((b) => b.tone === "warning")

  return (
    <div className="rounded-xl border border-border bg-muted/15 p-4 space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Portal certificate access</p>
        <p className="text-xs text-muted-foreground mt-1">
          Controls customer portal downloads for calibration certificates linked to this invoice context. Does not change
          invoice totals or QuickBooks sync.
        </p>
      </div>

      {certCount !== null && certCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground">
            <FileText className="w-3 h-3" aria-hidden />
            {certCount} certificate{certCount === 1 ? "" : "s"} on linked job
          </span>
          {releasedCertCount !== null && releasedCertCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--status-success)]/30 bg-[color:var(--status-success)]/10 px-2 py-1 text-[11px] text-[color:var(--status-success)]">
              <CheckCircle2 className="w-3 h-3" aria-hidden />
              {releasedCertCount} released
            </span>
          ) : null}
          {blockedByPayment ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 px-2 py-1 text-[11px] text-[color:var(--status-warning)]">
              <Lock className="w-3 h-3" aria-hidden />
              Blocked until invoice paid
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-[10px] font-medium text-foreground" htmlFor="inv-cert-override">
          Certificate release override
        </label>
        <select
          id="inv-cert-override"
          value={overrideLocal === null || overrideLocal === undefined ? "" : overrideLocal}
          onChange={(e) => setOverrideLocal(e.target.value)}
          disabled={saving}
          className={cn(
            "w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground",
          )}
        >
          {INVOICE_CERT_RELEASE_OPTIONS.map((o) => (
            <option key={o.value === "" ? "inherit" : o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground">
          {INVOICE_CERT_RELEASE_OPTIONS.find((o) => o.value === (overrideLocal || ""))?.helper}
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="text-xs"
          disabled={
            saving ||
            (overrideLocal || "") === (invoice.portalCertificateReleaseOverride ?? "")
          }
          onClick={() => void saveOverride()}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Save override
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading portal rules…
        </p>
      ) : (
        <ul className="space-y-1.5 border-t border-border pt-3">
          {bullets.map((b, i) => (
            <li
              key={i}
              className={cn(
                "text-xs leading-snug",
                b.tone === "warning" && "text-[color:var(--status-warning)]",
                b.tone === "success" && "text-[color:var(--status-success)]",
                b.tone === "info" && "text-[color:var(--status-info)]",
                b.tone === "neutral" && "text-muted-foreground",
              )}
            >
              {b.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
