"use client"

import { createContext, useCallback, useContext, useEffect, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type QuickAddAction =
  | "new-work-order"
  | "new-customer"
  | "new-equipment"
  | "new-quote"
  | "new-invoice"
  | "schedule-service"

type Listener = (action: QuickAddAction) => void

interface QuickAddContextValue {
  dispatch: (action: QuickAddAction) => void
  subscribe: (listener: Listener) => () => void
}

// ─── Context ───────────────────────────────────────────────────────────────────

const QuickAddContext = createContext<QuickAddContextValue | null>(null)

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const listeners = useRef<Set<Listener>>(new Set())

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener)
    return () => listeners.current.delete(listener)
  }, [])

  const dispatch = useCallback((action: QuickAddAction) => {
    listeners.current.forEach((l) => l(action))
  }, [])

  return (
    <QuickAddContext.Provider value={{ dispatch, subscribe }}>
      {children}
    </QuickAddContext.Provider>
  )
}

// ─── useQuickAddDispatch — for the nav component ───────────────────────────────

export function useQuickAddDispatch() {
  const ctx = useContext(QuickAddContext)
  if (!ctx) throw new Error("useQuickAddDispatch must be inside QuickAddProvider")
  return ctx.dispatch
}

// ─── useQuickAdd — for pages to listen for a specific action ──────────────────

/**
 * Subscribe to a QuickAdd action via context broadcast (same-page) OR via
 * the `?action=` URL search param (cross-page navigation).
 *
 * Usage:
 *   useQuickAdd("new-work-order", () => setCreateOpen(true))
 */
export function useQuickAdd(action: QuickAddAction, handler: () => void) {
  const ctx = useContext(QuickAddContext)
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  // 1. Same-page context broadcast (e.g. schedule-service from PageShell)
  useEffect(() => {
    if (!ctx) return
    return ctx.subscribe((dispatched) => {
      if (dispatched === action) handlerRef.current()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, action])

  // 2. Cross-page URL param: ?action=<action>
  //    Read on mount, fire handler, then strip the param from the URL.
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const param = searchParams.get("action")
    if (param === action) {
      handlerRef.current()
      // Replace the URL without the ?action param so back/refresh doesn't re-trigger
      router.replace(pathname, { scroll: false })
    }
  // Only run once on mount (searchParams reference is stable on first render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
