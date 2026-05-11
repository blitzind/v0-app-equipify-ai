"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

function fmtCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

type WalletSummary = {
  availableCreditCents: number
  refundableCreditCents: number
  unappliedEstimateDepositCents: number
  lifetimeCreditsCents: number
  appliedToInvoicesCents: number
  recentActivity: Array<{ id: string; entryKind: string; amountCents: number; createdAt: string; label: string }>
}

export function CustomerBlitzpayWalletCard({
  organizationId,
  customerId,
  allowManualCredit = false,
}: {
  organizationId: string
  customerId: string
  /** Requires `canViewFinancials` on the server; hide UI when false (e.g. billing-only viewers). */
  allowManualCredit?: boolean
}) {
  const { toast } = useToast()
  const [summary, setSummary] = useState<WalletSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [manualDollars, setManualDollars] = useState("")
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    return fetch(
      `/api/organizations/${encodeURIComponent(organizationId)}/customers/${encodeURIComponent(customerId)}/blitzpay/wallet`,
    )
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as WalletSummary & { error?: string }
        if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not load wallet.")
        setSummary(j as WalletSummary)
      })
      .catch((e) => {
        toast({
          title: "Wallet",
          description: e instanceof Error ? e.message : "Could not load wallet.",
          variant: "destructive",
        })
        setSummary(null)
      })
      .finally(() => setLoading(false))
  }, [organizationId, customerId, toast])

  useEffect(() => {
    void reload()
  }, [reload])

  async function postManualCredit() {
    const raw = manualDollars.trim().replace(/[^0-9.]/g, "")
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) {
      toast({ title: "Invalid amount", description: "Enter a positive dollar amount.", variant: "destructive" })
      return
    }
    const amountCents = Math.round(n * 100)
    if (amountCents < 1) return
    setBusy(true)
    try {
      const r = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/customers/${encodeURIComponent(customerId)}/blitzpay/wallet/manual-credit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountCents, note: "Staff manual credit" }),
        },
      )
      const j = (await r.json().catch(() => ({}))) as { duplicate?: boolean; error?: string }
      if (!r.ok) {
        toast({
          title: "Could not add credit",
          description: typeof j.error === "string" ? j.error : "Request failed.",
          variant: "destructive",
        })
        return
      }
      toast({
        title: j.duplicate ? "Already recorded" : "Credit added",
        description: j.duplicate ? "This credit was already applied." : `${fmtCents(amountCents)} added to account balance.`,
      })
      setManualDollars("")
      await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          BlitzPay account balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : summary ? (
          <>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Spendable credit</p>
                <p className="text-lg font-semibold tabular-nums">{fmtCents(summary.availableCreditCents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Refundable (hosted pay)</p>
                <p className="text-lg font-semibold tabular-nums">{fmtCents(summary.refundableCreditCents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Deposits on open estimates</p>
                <p className="font-medium tabular-nums">{fmtCents(summary.unappliedEstimateDepositCents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Applied from wallet to invoices</p>
                <p className="font-medium tabular-nums">{fmtCents(summary.appliedToInvoicesCents)}</p>
              </div>
            </div>
            {allowManualCredit ? (
              <div className="rounded-md border border-border/80 p-3 space-y-2">
                <Label className="text-xs text-muted-foreground">Manual credit (USD)</Label>
                <div className="flex flex-wrap gap-2 items-end">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={manualDollars}
                    onChange={(e) => setManualDollars(e.target.value)}
                    className="h-9 max-w-[140px] text-xs"
                  />
                  <Button type="button" size="sm" className="h-9 text-xs" disabled={busy} onClick={() => void postManualCredit()}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add credit"}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Manual credits post to the customer wallet ledger (replay-safe). Use for goodwill adjustments; refunds
                  still flow through Stripe.
                </p>
              </div>
            ) : null}
            {summary.recentActivity.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Recent activity</p>
                <ul className="space-y-1 text-[11px] max-h-40 overflow-y-auto">
                  {summary.recentActivity.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2 border-b border-border/40 pb-1">
                      <span className="text-muted-foreground truncate">{a.label}</span>
                      <span className="tabular-nums shrink-0">{fmtCents(a.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Wallet data unavailable.</p>
        )}
      </CardContent>
    </Card>
  )
}
