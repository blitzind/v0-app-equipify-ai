"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { notFound, usePathname, useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BLITZPAY_FCC_FUNDS_DISCLAIMER } from "@/lib/blitzpay/blitzpay-fcc-executive-overview-types"
import { invalidateFccExecutiveOverviewSessionCache } from "@/components/blitzpay/blitzpay-fcc-executive-overview"
import { BlitzpayFccSectionUpgradePreview } from "@/components/blitzpay/blitzpay-fcc-section-upgrade-preview"
import { FCC_TOOL_STRIP } from "@/lib/navigation-chrome"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useBlitzPayCapabilities } from "@/hooks/use-blitzpay-capabilities"
import { resolveBlitzPayFccSectionSurface } from "@/lib/blitzpay/capabilities"
import { isFccSectionAllowedForTier } from "@/lib/blitzpay/fcc-tier-navigation"
import { BLITZPAY_FCC_PREFETCH_PRIORITY, BLITZPAY_FCC_SLUG_SET } from "@/lib/navigation/blitzpay-financial-command-center-nav"
import type { BlitzPayFccSectionId } from "@/lib/blitzpay/sections"
import { BlitzpayDynamicSection, prefetchBlitzpayFccSectionChunk } from "./blitzpay-dynamic-section"

const FCC_BASE = "/insights/financial-command-center"
const FCC_OVERVIEW_PATH = "/insights/financial-command-center"

function resolveFccSlug(pathname: string): string | null {
  if (!pathname.startsWith(FCC_BASE)) return null
  if (pathname === FCC_BASE || pathname === `${FCC_BASE}/`) return "overview"
  const rest = pathname.slice(FCC_BASE.length + 1)
  const first = rest.split("/").filter(Boolean)[0] ?? ""
  if (!first || !BLITZPAY_FCC_SLUG_SET.has(first)) return null
  return first
}

function readSaveData(): boolean {
  if (typeof navigator === "undefined") return false
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return !!c?.saveData
}

function readCoarseMobileViewport(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(max-width: 767px)").matches
}

function readEffectiveConnectionType(): string {
  if (typeof navigator === "undefined") return ""
  const c = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
  return (c?.effectiveType ?? "").toLowerCase()
}

export function BlitzpayFccSectionHost() {
  const pathname = usePathname()
  const router = useRouter()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const orgReady = orgStatus === "ready"
  const {
    billingReady,
    commercialTier,
    enforceTierGates,
    prefetchAllowedSlugSet,
    fccSectionAllowsDataLoad,
  } = useBlitzPayCapabilities()

  const slugResolved = useMemo(() => resolveFccSlug(pathname), [pathname])

  const activeSurface = useMemo(() => {
    if (!slugResolved) return "enabled" as const
    if (!billingReady) return "enabled" as const
    return resolveBlitzPayFccSectionSurface(commercialTier, slugResolved as BlitzPayFccSectionId, {
      enforceTierGates: enforceTierGates,
    })
  }, [billingReady, commercialTier, enforceTierGates, slugResolved])

  const [visited, setVisited] = useState(() => {
    const s = resolveFccSlug(pathname)
    return new Set(s ? [s] : [])
  })
  const [remountNonceBySlug, setRemountNonceBySlug] = useState<Record<string, number>>({})
  const prevOrgRef = useRef(organizationId)
  const visitedRef = useRef(visited)

  useEffect(() => {
    visitedRef.current = visited
  }, [visited])

  useLayoutEffect(() => {
    if (!billingReady || !slugResolved) return
    if (activeSurface === "hidden") {
      router.replace(FCC_OVERVIEW_PATH)
    }
  }, [activeSurface, billingReady, router, slugResolved])

  useEffect(() => {
    if (!slugResolved) return
    if (!billingReady) {
      setVisited((prev) => {
        if (prev.has(slugResolved)) return prev
        const next = new Set(prev)
        next.add(slugResolved)
        return next
      })
      return
    }
    if (!fccSectionAllowsDataLoad(slugResolved as BlitzPayFccSectionId)) return
    setVisited((prev) => {
      if (prev.has(slugResolved)) return prev
      const next = new Set(prev)
      next.add(slugResolved)
      return next
    })
  }, [billingReady, fccSectionAllowsDataLoad, slugResolved])

  useEffect(() => {
    if (!slugResolved) return
    if (prevOrgRef.current === organizationId) return
    prevOrgRef.current = organizationId
    setVisited(new Set([slugResolved]))
    setRemountNonceBySlug({})
  }, [organizationId, slugResolved])

  const billingPlanKey = useMemo(
    () =>
      `${organizationId ?? "none"}:${billingReady ? 1 : 0}:${commercialTier}:${enforceTierGates ? 1 : 0}`,
    [organizationId, billingReady, commercialTier, enforceTierGates],
  )

  useEffect(() => {
    if (!billingReady) return
    setVisited((prev) => {
      let changed = false
      const next = new Set<string>()
      for (const s of prev) {
        const sid = s as BlitzPayFccSectionId
        if (isFccSectionAllowedForTier(commercialTier, sid)) next.add(s)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [billingReady, commercialTier])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!slugResolved || !organizationId || !orgReady) return
    if (prefetchAllowedSlugSet === null) return

    const saveData = readSaveData()
    const isMobile = readCoarseMobileViewport()
    const eff = readEffectiveConnectionType()
    const slowNetwork = eff === "slow-2g" || eff === "2g"

    let cancelled = false
    const disposers: Array<() => void> = []

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(() => {
          if (!cancelled) resolve()
        }, ms)
        disposers.push(() => clearTimeout(t))
      })

    const runIdle = (fn: () => void, timeoutMs: number) =>
      new Promise<void>((resolve) => {
        const wrap = () => {
          if (cancelled) {
            resolve()
            return
          }
          fn()
          resolve()
        }
        const ric = window.requestIdleCallback
        if (typeof ric === "function") {
          const id = ric(wrap, { timeout: timeoutMs })
          disposers.push(() => window.cancelIdleCallback?.(id))
        } else {
          const id = window.setTimeout(wrap, Math.min(timeoutMs, 900))
          disposers.push(() => clearTimeout(id))
        }
      })

    const warmedMountSlugs = new Set<string>()
    const buildQueue = () => {
      const v = visitedRef.current
      const q: string[] = []
      for (const s of BLITZPAY_FCC_PREFETCH_PRIORITY) {
        if (s === slugResolved) continue
        if (v.has(s) || warmedMountSlugs.has(s)) continue
        if (!prefetchAllowedSlugSet.has(s)) continue
        q.push(s)
      }
      return q
    }

    const chunkBatchSize = saveData ? 2 : slowNetwork ? 2 : isMobile ? 3 : 4
    const mountBatchSize =
      saveData || slowNetwork ? 0 : isMobile ? 1 : eff === "3g" ? 1 : 2
    const interMountMs = saveData ? 6000 : slowNetwork ? 4200 : isMobile ? 2800 : 1750
    const interChunkMs = saveData ? 3200 : slowNetwork ? 2400 : isMobile ? 1400 : 950
    const postPaintDeferMs = saveData ? 2400 : slowNetwork ? 1800 : 900

    void (async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
      await delay(postPaintDeferMs)
      if (cancelled) return

      const queue = buildQueue()
      if (queue.length === 0) return

      let idx = 0
      while (idx < queue.length && !cancelled) {
        const slice = queue.slice(idx, idx + chunkBatchSize)
        idx += slice.length
        await runIdle(() => {
          for (const slug of slice) {
            const p = prefetchBlitzpayFccSectionChunk(slug)
            if (p) void p.catch(() => {})
          }
        }, saveData ? 3200 : 2200)
        if (cancelled) return
        if (idx < queue.length) await delay(interChunkMs)
      }

      if (mountBatchSize === 0) return

      idx = 0
      while (!cancelled) {
        const q2 = buildQueue()
        if (q2.length === 0) break
        const slice = q2.slice(0, mountBatchSize)
        await delay(interMountMs)
        if (cancelled) return
        await runIdle(() => {
          if (cancelled) return
          setVisited((prev) => {
            let next: Set<string> | null = null
            for (const slug of slice) {
              if (prev.has(slug)) continue
              if (!next) next = new Set(prev)
              next.add(slug)
            }
            return next ?? prev
          })
          for (const slug of slice) warmedMountSlugs.add(slug)
        }, 3800)
      }
    })()

    return () => {
      cancelled = true
      for (const d of disposers) d()
    }
  }, [organizationId, orgReady, prefetchAllowedSlugSet, slugResolved, billingPlanKey])

  const refreshActive = useCallback(() => {
    if (!slugResolved) return
    if (slugResolved === "overview" && organizationId) {
      invalidateFccExecutiveOverviewSessionCache(organizationId)
    }
    setRemountNonceBySlug((prev) => ({
      ...prev,
      [slugResolved]: (prev[slugResolved] ?? 0) + 1,
    }))
  }, [organizationId, slugResolved])

  if (!pathname.startsWith(FCC_BASE)) {
    return null
  }
  if (slugResolved === null) {
    notFound()
  }

  if (billingReady && activeSurface === "hidden") {
    return (
      <div className="flex flex-col gap-4 min-w-0">
        <p className="text-sm text-muted-foreground px-1">Taking you to BlitzPay overview…</p>
      </div>
    )
  }

  const visitedList = Array.from(visited).filter((s) =>
    billingReady ? fccSectionAllowsDataLoad(s as BlitzPayFccSectionId) : true,
  )

  const showUpgradePreview = billingReady && activeSurface === "upgrade_preview" && slugResolved

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className={FCC_TOOL_STRIP}>
        <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug min-w-0 flex-1 basis-full sm:basis-0 sm:min-w-[12rem]">
          {BLITZPAY_FCC_FUNDS_DISCLAIMER}
        </p>
        {!showUpgradePreview ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 sm:ml-auto"
            onClick={() => void refreshActive()}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            Refresh section
          </Button>
        ) : null}
      </div>

      <div className="relative min-w-0">
        {showUpgradePreview && slugResolved ? (
          <BlitzpayFccSectionUpgradePreview slug={slugResolved as BlitzPayFccSectionId} tier={commercialTier} />
        ) : (
          visitedList.map((s) => {
            const active = s === slugResolved
            const nonce = remountNonceBySlug[s] ?? 0
            return (
              <div
                key={s}
                id={`blitzpay-fcc-section-${s}`}
                role="tabpanel"
                aria-hidden={!active}
                className={cn("min-w-0", active ? "block" : "hidden")}
              >
                <BlitzpayDynamicSection
                  key={`${s}-${organizationId ?? "none"}-${nonce}`}
                  slug={s}
                  organizationId={organizationId}
                  orgReady={orgReady}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
