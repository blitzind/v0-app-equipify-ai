"use client"

import { usePathname } from "next/navigation"
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

type GrowthBreadcrumbContextValue = {
  detailLabel: string | null
  detailLoading: boolean
  setDetailLabel: (label: string | null) => void
  setDetailLoading: (loading: boolean) => void
}

const GrowthBreadcrumbContext = createContext<GrowthBreadcrumbContextValue | null>(null)

export function GrowthBreadcrumbProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [detailLabel, setDetailLabel] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    setDetailLabel(null)
    setDetailLoading(false)
  }, [pathname])

  const value = useMemo(
    () => ({ detailLabel, detailLoading, setDetailLabel, setDetailLoading }),
    [detailLabel, detailLoading],
  )

  return <GrowthBreadcrumbContext.Provider value={value}>{children}</GrowthBreadcrumbContext.Provider>
}

function useGrowthBreadcrumbContext(): GrowthBreadcrumbContextValue {
  const ctx = useContext(GrowthBreadcrumbContext)
  if (!ctx) {
    throw new Error("useGrowthBreadcrumbContext must be used within GrowthBreadcrumbProvider")
  }
  return ctx
}

/** Sync breadcrumb detail label from page data already on screen — no breadcrumb-only API calls. */
export function useGrowthBreadcrumbDetail(label?: string | null, loading = false) {
  const ctx = useContext(GrowthBreadcrumbContext)

  useEffect(() => {
    if (!ctx) return
    ctx.setDetailLabel(label ?? null)
    ctx.setDetailLoading(loading)
    return () => {
      ctx.setDetailLabel(null)
      ctx.setDetailLoading(false)
    }
  }, [ctx, label, loading])
}

export function useGrowthBreadcrumbState() {
  const { detailLabel, detailLoading } = useGrowthBreadcrumbContext()
  return { detailLabel, detailLoading }
}
