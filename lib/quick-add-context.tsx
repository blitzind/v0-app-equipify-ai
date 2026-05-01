"use client"

import { createContext, useCallback, useContext, useEffect, useRef } from "react"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type QuickAddAction =
  | "work-order"
  | "customer"
  | "equipment"
  | "quote"
  | "invoice"
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
 * Subscribe to a QuickAdd action. When `MobileBottomNav` dispatches `action`,
 * `handler` is called. The subscription is cleaned up when the component unmounts.
 *
 * Usage:
 *   useQuickAdd("work-order", () => setCreateOpen(true))
 */
export function useQuickAdd(action: QuickAddAction, handler: () => void) {
  const ctx = useContext(QuickAddContext)
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!ctx) return
    return ctx.subscribe((dispatched) => {
      if (dispatched === action) handlerRef.current()
    })
  // subscribe is stable (useCallback), action is a string literal — safe deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, action])
}
