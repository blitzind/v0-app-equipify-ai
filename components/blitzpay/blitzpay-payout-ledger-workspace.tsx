"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAdmin } from "@/lib/admin-store"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { blitzpayConnectOnboardingToastDescription } from "@/lib/blitzpay/connect-onboarding-client-messages"

export type BlitzpayPayoutLedgerWorkspacePayload = {
  payouts: Array<{
    id: string
    stripePayoutIdTail: string
    status: string
    amountCents: number
    currency: string
    arrivalDate: string | null
    stripeCreatedAt: string
    balanceTransactionCount: number
    balanceTransactionSyncedAt: string | null
  }>
  recentRuns: Array<{
    id: string
    trigger: string
    status: string
    payoutsTouched: number
    balanceTransactionsUpserted: number
    createdAt: string
    finishedAt: string | null
    error: string | null
  }>
  sinceIso: string
  balanceTransactionTotals: {
    activityRowCount: number
    sumGrossCents: number
    sumStripeFeesCents: number
    sumNetCents: number
    paymentLikeNetCents: number
    refundLikeNetCents: number
    disputeLikeNetCents: number
  }
  paidOutToBankCents: number
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return "—"
  }
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

/**
 * Staff payout ledger + balance transaction rollup (Stripe Connect mirror).
 * Lives in BlitzPay FCC — not Settings.
 */
export function BlitzpayPayoutLedgerWorkspace({ organizationId, orgReady }: Props) {
  const { toast } = useToast()
  const orgPermissions = useOrgPermissions()
  const { rawRole, status: permStatus } = orgPermissions
  const { isPlatformAdmin } = useAdmin()

  const canView =
    permStatus === "ready" && (orgPermissions.has("canViewFinancials") || orgPermissions.has("canEditInvoices"))
  const canSync =
    permStatus === "ready" && (isPlatformAdmin || rawRole === "owner" || rawRole === "admin")

  const [loading, setLoading] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [panel, setPanel] = useState<BlitzpayPayoutLedgerWorkspacePayload | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !orgReady || !canView) {
      setPanel(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/payout-ledger?since=${encodeURIComponent(
          new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        )}`,
        { cache: "no-store", credentials: "include" },
      )
      const json = (await res.json()) as { payoutLedger?: BlitzpayPayoutLedgerWorkspacePayload; message?: string }
      if (!res.ok) {
        setPanel(null)
        return
      }
      setPanel(json.payoutLedger ?? null)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady, canView])

  useEffect(() => {
    void load()
  }, [load])

  const runSync = useCallback(async () => {
    if (!organizationId || !canSync) return
    setSyncBusy(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/payout-ledger`, {
        method: "POST",
        credentials: "include",
      })
      const json = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Payout sync failed",
          description: json.message ?? json.error ?? res.statusText,
        })
        return
      }
      toast({ title: "Payout ledger synced", description: "Latest payouts and balance lines were pulled from Stripe." })
      await load()
    } finally {
      setSyncBusy(false)
    }
  }, [organizationId, canSync, load, toast])

  if (!organizationId || !orgReady || !canView) return null

  return (
    <div id="blitzpay-fcc-payout-ledger-anchor" className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">Payout ledger</p>
        {canSync ? (
          <Button type="button" variant="outline" size="sm" disabled={syncBusy} onClick={() => void runSync()}>
            {syncBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Sync from Stripe
          </Button>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Operational finance data from Stripe Connect payouts and balance transactions. Sync after payouts settle or when
        troubleshooting reconciliation.
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading payout ledger…
        </div>
      ) : panel ? (
        <div className="space-y-3 text-xs">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="font-medium text-foreground">Last 30 days (synced activity)</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-[11px]">
              <div>
                <dt className="text-muted-foreground">Balance tx rows</dt>
                <dd className="font-medium">{panel.balanceTransactionTotals.activityRowCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Stripe fees (sum)</dt>
                <dd className="font-medium">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                    panel.balanceTransactionTotals.sumStripeFeesCents / 100,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Net activity</dt>
                <dd className="font-medium">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                    panel.balanceTransactionTotals.sumNetCents / 100,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Paid out (paid payouts)</dt>
                <dd className="font-medium">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                    panel.paidOutToBankCents / 100,
                  )}
                </dd>
              </div>
            </dl>
            <p className="text-[10px] text-muted-foreground mt-2">
              Refund-like net:{" "}
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                panel.balanceTransactionTotals.refundLikeNetCents / 100,
              )}
              {" · "}
              Dispute-like net:{" "}
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                panel.balanceTransactionTotals.disputeLikeNetCents / 100,
              )}
            </p>
          </div>
          {panel.payouts.length > 0 ? (
            <div className="min-w-0 max-w-full overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-0 text-left text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-2 font-medium">Arrival</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium text-right">Amount</th>
                    <th className="p-2 font-medium text-right">BTs</th>
                  </tr>
                </thead>
                <tbody>
                  {panel.payouts.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-2">{p.arrivalDate ?? formatWhen(p.stripeCreatedAt)}</td>
                      <td className="p-2">{p.status}</td>
                      <td className="p-2 text-right font-medium">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(p.amountCents / 100)}
                      </td>
                      <td className="p-2 text-right text-muted-foreground">{p.balanceTransactionCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No payouts stored yet — run sync or wait for payout webhooks.</p>
          )}
          {panel.recentRuns.length > 0 ? (
            <details className="text-[11px]">
              <summary className="cursor-pointer text-muted-foreground">Recent reconciliation runs</summary>
              <ul className="mt-2 space-y-1 list-disc pl-4">
                {panel.recentRuns.map((r) => (
                  <li key={r.id}>
                    {formatWhen(r.createdAt)} — {r.trigger} {r.status} {r.payoutsTouched > 0 ? `(${r.payoutsTouched} payouts)` : ""}
                    {r.error ? ` — ${r.error}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Could not load payout ledger.</p>
      )}
    </div>
  )
}
