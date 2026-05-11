"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Repeat } from "lucide-react"

type Props = {
  organizationId: string | null
  orgReady: boolean
  customerId: string | null
  canViewFinancial: boolean
}

/**
 * Compact recurring-membership hint for customer / work-order surfaces (no Stripe ids).
 */
export function BlitzpayCustomerMembershipHint({ organizationId, orgReady, customerId, canViewFinancial }: Props) {
  const [summary, setSummary] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId || !orgReady || !customerId || !canViewFinancial) {
      setSummary(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/memberships?customerId=${encodeURIComponent(customerId)}`,
          { credentials: "include", cache: "no-store" },
        )
        const j = (await res.json()) as { memberships?: Array<{ membership_number: string; status: string }> }
        if (!res.ok || cancelled) return
        const rows = j.memberships ?? []
        const active = rows.filter((r) => String(r.status).toLowerCase() === "active")
        if (active.length === 0) return
        const nums = active.map((r) => r.membership_number).slice(0, 3)
        setSummary(`${active.length} active membership${active.length === 1 ? "" : "s"} on file (${nums.join(", ")}).`)
      } catch {
        if (!cancelled) setSummary(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, orgReady, customerId, canViewFinancial])

  if (!summary) return null

  return (
    <div className="flex flex-wrap items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-foreground">
      <Repeat className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-emerald-900 dark:text-emerald-100">Recurring membership</p>
        <p className="text-muted-foreground mt-0.5 leading-snug">{summary}</p>
        <Link
          href="/memberships"
          className="mt-1 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Open memberships
        </Link>
      </div>
    </div>
  )
}
