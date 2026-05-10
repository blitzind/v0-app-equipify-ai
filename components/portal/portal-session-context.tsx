"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

export type PortalBootstrap = {
  portalUserId: string
  organizationId: string
  customerId: string
  email: string
  displayName: string
  initials: string
  organizationName: string
  /** Workspace branding — document logo preferred, then app logo */
  workspaceLogoUrl: string | null
  /**
   * `organizations.primary_color` when set — shell maps to `--portal-accent*` via
   * `portalAccentCssVariables`. Null/empty: inherit `globals.css` defaults.
   */
  portalPrimaryColor: string | null
  customerCompanyName: string
  features: { onlinePayments: boolean }
}

const PortalSessionContext = createContext<{
  bootstrap: PortalBootstrap | null
  loading: boolean
  error: boolean
  refresh: () => void
} | null>(null)

export function PortalSessionProvider({ children }: { children: React.ReactNode }) {
  const [bootstrap, setBootstrap] = useState<PortalBootstrap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch("/api/portal/bootstrap")
      .then((r) => {
        if (!r.ok) throw new Error("bootstrap")
        return r.json() as Promise<PortalBootstrap>
      })
      .then(setBootstrap)
      .catch(() => {
        setBootstrap(null)
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const value = useMemo(
    () => ({
      bootstrap,
      loading,
      error,
      refresh: load,
    }),
    [bootstrap, loading, error, load],
  )

  return <PortalSessionContext.Provider value={value}>{children}</PortalSessionContext.Provider>
}

export function usePortalSession() {
  const ctx = useContext(PortalSessionContext)
  if (!ctx) {
    throw new Error("usePortalSession must be used within PortalSessionProvider")
  }
  return ctx
}
