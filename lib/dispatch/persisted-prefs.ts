"use client"

/**
 * Phase 2: small per-organization persistence helper for dispatch /
 * service-schedule UI preferences (status filter chips, "include invoiced",
 * etc.).
 *
 * Additive only. Defaults preserve Phase 1 behavior when no value is stored.
 * SSR-safe: reads/writes are no-ops when `window` is undefined; consumers
 * should hydrate after mount via the returned `usePersistedState` hook.
 */

import { useCallback, useEffect, useRef, useState } from "react"

const KEY_PREFIX = "equipify:dispatch:v1"

export type DispatchPrefScope = "dispatch" | "schedule"

export type DispatchPrefKey =
  | "status-filter" // string[] of DispatchStatusKey
  | "include-invoiced" // boolean
  | "week-overview-visible" // boolean — Phase 3: collapsed by default
  | "more-filters-expanded" // boolean — Phase 3: advanced focus filters
  | "all-signals-expanded" // boolean — Phase 3: KPI overflow

export function dispatchPrefStorageKey(
  scope: DispatchPrefScope,
  key: DispatchPrefKey,
  organizationId: string | null | undefined,
): string | null {
  if (!organizationId?.trim()) return null
  return `${KEY_PREFIX}:${scope}:${key}:${organizationId.trim()}`
}

function safeRead<T>(key: string | null): T | null {
  if (!key || typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function safeWrite<T>(key: string | null, value: T): void {
  if (!key || typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage may be disabled (private mode, quota) — ignore.
  }
}

/**
 * `useState`-style hook that lazily hydrates from `localStorage` on mount and
 * writes back on change. Switching `organizationId` (or `null`) re-hydrates
 * to the per-org value (or default).
 */
export function usePersistedDispatchPref<T>({
  scope,
  key,
  organizationId,
  defaultValue,
  isValid,
}: {
  scope: DispatchPrefScope
  key: DispatchPrefKey
  organizationId: string | null | undefined
  defaultValue: T
  /** Optional schema guard — discard stored value if shape no longer matches. */
  isValid?: (v: unknown) => v is T
}): [T, (next: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(defaultValue)
  const hasHydratedRef = useRef(false)

  useEffect(() => {
    hasHydratedRef.current = false
    const storageKey = dispatchPrefStorageKey(scope, key, organizationId)
    const raw = safeRead<unknown>(storageKey)
    if (raw == null) {
      setState(defaultValue)
    } else if (isValid && !isValid(raw)) {
      setState(defaultValue)
    } else {
      setState(raw as T)
    }
    // Defer flagging hydrated until after this microtask so the initial
    // hydration write does not double-fire to localStorage.
    queueMicrotask(() => {
      hasHydratedRef.current = true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, key, organizationId])

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next
        if (hasHydratedRef.current) {
          const storageKey = dispatchPrefStorageKey(scope, key, organizationId)
          safeWrite(storageKey, value)
        }
        return value
      })
    },
    [scope, key, organizationId],
  )

  return [state, update]
}
