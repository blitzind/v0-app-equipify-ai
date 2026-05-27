"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { isGrowthNavigationInputTarget } from "@/lib/growth/navigation/growth-navigation-input-guard"

type GrowthNavigationContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const GrowthNavigationContext = createContext<GrowthNavigationContextValue | null>(null)

export function GrowthNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isGrowthRoute = pathname.startsWith("/admin/growth")

  const toggle = useCallback(() => setOpen((v) => !v), [])

  useEffect(() => {
    if (!isGrowthRoute) return

    function onKeyDown(event: KeyboardEvent) {
      if (isGrowthNavigationInputTarget(event.target)) return
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      if (event.key.toLowerCase() !== "k") return
      event.preventDefault()
      setOpen((v) => !v)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isGrowthRoute])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const value = useMemo(
    () => ({
      open: isGrowthRoute ? open : false,
      setOpen,
      toggle,
    }),
    [isGrowthRoute, open, toggle],
  )

  return <GrowthNavigationContext.Provider value={value}>{children}</GrowthNavigationContext.Provider>
}

export function useGrowthNavigation() {
  const ctx = useContext(GrowthNavigationContext)
  if (!ctx) {
    return {
      open: false,
      setOpen: () => {},
      toggle: () => {},
    }
  }
  return ctx
}
