"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import type { FccExecutiveOverviewPayload } from "@/lib/blitzpay/blitzpay-fcc-executive-overview-types"
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import {
  fccExecutiveOverviewDataScopeForTier,
  getExecutiveOverviewWidgetsForTier,
} from "@/lib/blitzpay/executive-overview-widgets"
import { ExecutiveOverviewDashboard } from "@/components/blitzpay/executive-overview/executive-overview-dashboard"

const fccExecutiveOverviewByOrg = new Map<string, FccExecutiveOverviewPayload>()

function cacheKey(organizationId: string, dataScope: string): string {
  return `${organizationId}::${dataScope}`
}

export function invalidateFccExecutiveOverviewSessionCache(organizationId?: string | null): void {
  if (!organizationId) {
    fccExecutiveOverviewByOrg.clear()
    return
  }
  for (const k of [...fccExecutiveOverviewByOrg.keys()]) {
    if (k.startsWith(`${organizationId}::`)) fccExecutiveOverviewByOrg.delete(k)
  }
}

function readFccExecutiveOverviewSessionCache(organizationId: string, dataScope: string): FccExecutiveOverviewPayload | null {
  return fccExecutiveOverviewByOrg.get(cacheKey(organizationId, dataScope)) ?? null
}

function writeFccExecutiveOverviewSessionCache(
  organizationId: string,
  dataScope: string,
  payload: FccExecutiveOverviewPayload,
): void {
  fccExecutiveOverviewByOrg.set(cacheKey(organizationId, dataScope), payload)
}

function defaultFccHrefAllowed(_slug?: string): boolean {
  return true
}

type Props = {
  organizationId: string | null
  orgReady: boolean
  fccHrefAllowed?: (fccSlug: string | undefined) => boolean
  commercialTier: CommercialProductTier
  billingReady: boolean
}

export function BlitzpayFccExecutiveOverview({
  organizationId,
  orgReady,
  fccHrefAllowed,
  commercialTier,
  billingReady,
}: Props) {
  const allowFcc = fccHrefAllowed ?? defaultFccHrefAllowed
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<FccExecutiveOverviewPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dataScope = useMemo(
    () => (billingReady ? fccExecutiveOverviewDataScopeForTier(commercialTier) : "solo_lite"),
    [billingReady, commercialTier],
  )

  const fetchOverview = useCallback(async () => {
    if (!organizationId || !orgReady) return
    setLoading(true)
    setError(null)
    try {
      const scope = billingReady ? fccExecutiveOverviewDataScopeForTier(commercialTier) : "solo_lite"
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/fcc-executive-overview?windowDays=30&dataScope=${encodeURIComponent(scope)}`,
        { cache: "no-store", credentials: "include" },
      )
      const j = (await res.json()) as { overview?: FccExecutiveOverviewPayload; message?: string }
      if (!res.ok) {
        setData(null)
        setError(j.message ?? blitzpayStaffWidgetLoadCopy.executiveBusinessHealth)
        return
      }
      const overview = j.overview ?? null
      if (overview) writeFccExecutiveOverviewSessionCache(organizationId, scope, overview)
      setData(overview)
      if (!overview) setError(blitzpayStaffWidgetLoadCopy.executiveBusinessHealth)
    } catch {
      setData(null)
      setError(blitzpayStaffWidgetLoadCopy.executiveBusinessHealth)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady, billingReady, commercialTier])

  useLayoutEffect(() => {
    if (!organizationId || !orgReady) return
    const scope = billingReady ? fccExecutiveOverviewDataScopeForTier(commercialTier) : "solo_lite"
    const cached = readFccExecutiveOverviewSessionCache(organizationId, scope)
    if (cached) {
      setData(cached)
      setError(null)
      setLoading(false)
    } else {
      setData(null)
      setError(null)
      setLoading(true)
    }
  }, [organizationId, orgReady, billingReady, commercialTier])

  useEffect(() => {
    if (!organizationId || !orgReady) return
    const scope = billingReady ? fccExecutiveOverviewDataScopeForTier(commercialTier) : "solo_lite"
    if (readFccExecutiveOverviewSessionCache(organizationId, scope)) return
    void fetchOverview()
  }, [organizationId, orgReady, fetchOverview, billingReady, commercialTier])

  const widgets = useMemo(
    () => getExecutiveOverviewWidgetsForTier(commercialTier, allowFcc),
    [commercialTier, allowFcc],
  )

  if (!organizationId || !orgReady) return null

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-8 animate-pulse min-h-[120px]" aria-busy="true" />
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        {error ?? "Executive overview is unavailable."}
      </div>
    )
  }

  return (
    <ExecutiveOverviewDashboard
      data={data}
      tier={commercialTier}
      widgets={widgets}
      allowFcc={allowFcc}
      dataScope={dataScope}
    />
  )
}
