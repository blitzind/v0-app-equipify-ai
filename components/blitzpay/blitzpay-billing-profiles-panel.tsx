"use client"

import { useCallback, useEffect, useState } from "react"
import { CreditCard, Loader2, RefreshCw, Landmark, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"
import { cn } from "@/lib/utils"

type BillingProfileRow = {
  id: string
  customerId: string
  customerLabel: string | null
  status: string
  autopayEnabled: boolean
  preferredInvoiceDelivery: string
  defaultPaymentMethodLabel: string | null
  collectionReadiness: string
  autopayReadiness: string
  billingRisk: string
}

type PaymentMethodRow = {
  id: string
  customerId: string
  displayLabel: string
  paymentMethodType: string
  isDefault: boolean
  status: string
}

type AutopayRow = {
  id: string
  customerId: string
  billingProfileId: string
  enrollmentStatus: string
  paymentTiming: string
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayBillingProfilesPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<BillingProfileRow[]>([])
  const [methods, setMethods] = useState<PaymentMethodRow[]>([])
  const [autopay, setAutopay] = useState<AutopayRow[]>([])
  const [customerIdInput, setCustomerIdInput] = useState("")
  const [syncBusy, setSyncBusy] = useState(false)

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setProfiles([])
      setMethods([])
      setAutopay([])
      return
    }
    setLoading(true)
    setError(null)
    const base = `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay`
    try {
      const [pr, pm, ap] = await Promise.all([
        fetch(`${base}/billing-profiles`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/payment-methods`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/autopay`, { cache: "no-store", credentials: "include" }),
      ])
      let pj: { billingProfiles?: BillingProfileRow[] }
      let mj: { paymentMethods?: PaymentMethodRow[] }
      let aj: { autopayEnrollments?: AutopayRow[] }
      try {
        pj = (await pr.json()) as { billingProfiles?: BillingProfileRow[] }
        mj = (await pm.json()) as { paymentMethods?: PaymentMethodRow[] }
        aj = (await ap.json()) as { autopayEnrollments?: AutopayRow[] }
      } catch {
        setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
        return
      }
      if (!pr.ok || !pm.ok || !ap.ok) {
        setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
        return
      }
      setProfiles(pj.billingProfiles ?? [])
      setMethods(mj.paymentMethods ?? [])
      setAutopay(aj.autopayEnrollments ?? [])
    } catch {
      setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  async function createProfile() {
    if (!organizationId || !customerIdInput.trim()) return
    setError(null)
    const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/billing-profiles`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: customerIdInput.trim() }),
    })
    if (!res.ok) {
      setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
      return
    }
    setCustomerIdInput("")
    await load()
  }

  async function syncStripe() {
    if (!organizationId || !customerIdInput.trim()) return
    setSyncBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/payment-methods/sync`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: customerIdInput.trim() }),
        },
      )
      if (!res.ok) {
        setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
        return
      }
      await load()
    } finally {
      setSyncBusy(false)
    }
  }

  if (!organizationId || !orgReady) return null

  return (
    <div
      id="blitzpay-billing-profiles-anchor"
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Landmark className="h-5 w-5 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Customer billing profiles</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              Saved payment preferences and autopay enrollment — staff only. Stripe remains the vault; Equipify stores
              masked metadata and hashed references only.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2 flex gap-2 items-start">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Payment methods are securely managed through Stripe. Equipify does not store full payment credentials.
        </p>
      </div>

      {error ? <p className="text-xs text-muted-foreground leading-relaxed">{error}</p> : null}

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1 min-w-[200px]">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Customer UUID</p>
          <Input
            value={customerIdInput}
            onChange={(e) => setCustomerIdInput(e.target.value)}
            placeholder="Create or sync for customer…"
            className="h-8 text-xs font-mono"
          />
        </div>
        <Button type="button" size="sm" className="h-8 text-xs" variant="secondary" onClick={() => void createProfile()}>
          Ensure profile
        </Button>
        <Button type="button" size="sm" className="h-8 text-xs" variant="outline" disabled={syncBusy} onClick={() => void syncStripe()}>
          {syncBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CreditCard className="w-3.5 h-3.5 mr-1" />}
          Sync from Stripe
        </Button>
      </div>

      {loading && !profiles.length ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">Billing profiles</p>
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Autopay</TableHead>
                <TableHead className="text-xs">Default method</TableHead>
                <TableHead className="text-xs">Collection readiness</TableHead>
                <TableHead className="text-xs">Autopay readiness</TableHead>
                <TableHead className="text-xs">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-xs text-muted-foreground">
                    No billing profiles yet. Create one with a customer UUID, then sync payment methods after a hosted
                    checkout.
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs font-medium">{p.customerLabel ?? p.customerId.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs">{formatBlitzpayUiLabel(p.status)}</TableCell>
                    <TableCell className="text-xs">{p.autopayEnabled ? "On" : "Off"}</TableCell>
                    <TableCell className="text-xs">{p.defaultPaymentMethodLabel ?? "—"}</TableCell>
                    <TableCell className="text-xs">{formatBlitzpayUiLabel(p.collectionReadiness)}</TableCell>
                    <TableCell className="text-xs">{formatBlitzpayUiLabel(p.autopayReadiness)}</TableCell>
                    <TableCell className="text-xs capitalize">{p.billingRisk}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border/80 bg-background/40 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold">Saved payment methods (masked)</p>
          {methods.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No synced methods in the bounded list.</p>
          ) : (
            <ul className="space-y-1.5 text-[11px]">
              {methods.slice(0, 12).map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span>{m.displayLabel}</span>
                  <span className="text-muted-foreground">{m.isDefault ? "Default" : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border/80 bg-background/40 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold">Autopay enrollments</p>
          {autopay.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No enrollment rows.</p>
          ) : (
            <ul className="space-y-1.5 text-[11px]">
              {autopay.slice(0, 12).map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span className="capitalize">{a.enrollmentStatus}</span>
                  <span className="text-muted-foreground">{formatBlitzpayUiLabel(a.paymentTiming)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
