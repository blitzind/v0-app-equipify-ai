"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { notFound, usePathname } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { BLITZPAY_FCC_SLUG_SET } from "@/lib/navigation/blitzpay-financial-command-center-nav"
import { BlitzpayDynamicSection } from "./blitzpay-dynamic-section"

const FCC_BASE = "/insights/financial-command-center"

function resolveFccSlug(pathname: string): string | null {
  if (!pathname.startsWith(FCC_BASE)) return null
  if (pathname === FCC_BASE || pathname === `${FCC_BASE}/`) return "overview"
  const rest = pathname.slice(FCC_BASE.length + 1)
  const first = rest.split("/").filter(Boolean)[0] ?? ""
  if (!first || !BLITZPAY_FCC_SLUG_SET.has(first)) return null
  return first
}

export function BlitzpayFccSectionHost() {
  const pathname = usePathname()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const orgReady = orgStatus === "ready"

  const slugResolved = useMemo(() => resolveFccSlug(pathname), [pathname])

  const [visited, setVisited] = useState(() => {
    const s = resolveFccSlug(pathname)
    return new Set(s ? [s] : [])
  })
  const [remountNonceBySlug, setRemountNonceBySlug] = useState<Record<string, number>>({})
  const prevOrgRef = useRef(organizationId)

  useEffect(() => {
    if (!slugResolved) return
    setVisited((prev) => {
      if (prev.has(slugResolved)) return prev
      const next = new Set(prev)
      next.add(slugResolved)
      return next
    })
  }, [slugResolved])

  useEffect(() => {
    if (!slugResolved) return
    if (prevOrgRef.current === organizationId) return
    prevOrgRef.current = organizationId
    setVisited(new Set([slugResolved]))
    setRemountNonceBySlug({})
  }, [organizationId, slugResolved])

  const refreshActive = useCallback(() => {
    if (!slugResolved) return
    setRemountNonceBySlug((prev) => ({
      ...prev,
      [slugResolved]: (prev[slugResolved] ?? 0) + 1,
    }))
  }, [slugResolved])

  if (!pathname.startsWith(FCC_BASE)) {
    return null
  }
  if (slugResolved === null) {
    notFound()
  }

  const visitedList = Array.from(visited)

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void refreshActive()}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden />
          Refresh section
        </Button>
      </div>

      <div className="relative min-w-0">
        {visitedList.map((s) => {
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
        })}
      </div>
    </div>
  )
}
