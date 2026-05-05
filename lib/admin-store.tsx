"use client"

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { PlatformAccount } from "./admin-data"
import type { SessionIdentity } from "./session-identity"

interface ImpersonationState {
  active: boolean
  accountId: string | null
  accountName: string | null
  adminName: string
  adminRole: string
}

interface AdminContextValue {
  sessionIdentity: SessionIdentity | null
  sessionIdentityLoading: boolean
  impersonation: ImpersonationState
  startImpersonation: (account: PlatformAccount) => void
  endImpersonation: () => void
  /** Confirmed after bootstrap: session user email is in EQUIPIFY_PLATFORM_ADMIN_EMAILS (org role ignored). */
  isPlatformAdmin: boolean
  /** Show Platform Admin nav entry while loading or when confirmed platform admin (middleware still enforces /admin). */
  platformAdminNavVisible: boolean
}

const AdminContext = createContext<AdminContextValue | null>(null)

function impersonationIdle(adminName: string, adminRole: string): ImpersonationState {
  return {
    active: false,
    accountId: null,
    accountName: null,
    adminName,
    adminRole,
  }
}

export function AdminProvider({
  children,
  initialSessionIdentity,
}: {
  children: React.ReactNode
  /** Server-rendered session on `/admin`; omit on dashboard to bootstrap via API. */
  initialSessionIdentity?: SessionIdentity | null
}) {
  const skipBootstrapFetch = initialSessionIdentity !== undefined

  const [sessionIdentity, setSessionIdentity] = useState<SessionIdentity | null>(() =>
    initialSessionIdentity !== undefined ? initialSessionIdentity ?? null : null,
  )

  const [sessionIdentityLoading, setSessionIdentityLoading] = useState(!skipBootstrapFetch)

  useEffect(() => {
    if (skipBootstrapFetch) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/session/account-summary")
        const data = (await res.json()) as
          | { authenticated: false }
          | ({ authenticated: true } & SessionIdentity)

        if (cancelled) return

        if ("authenticated" in data && data.authenticated === true) {
          const { authenticated: _a, ...identity } = data
          setSessionIdentity(identity)
        } else {
          setSessionIdentity(null)
        }
      } catch {
        if (!cancelled) setSessionIdentity(null)
      } finally {
        if (!cancelled) setSessionIdentityLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [skipBootstrapFetch])

  const adminLabel = sessionIdentity?.displayName ?? "Platform admin"
  const adminRoleLabel = sessionIdentity?.platformRoleLabel ?? "Platform Admin"

  const [impersonation, setImpersonation] = useState<ImpersonationState>(() =>
    impersonationIdle(adminLabel, adminRoleLabel),
  )

  useEffect(() => {
    setImpersonation((prev) => {
      if (prev.active) return prev
      return impersonationIdle(adminLabel, adminRoleLabel)
    })
  }, [adminLabel, adminRoleLabel])

  const sessionIdentityRef = useRef(sessionIdentity)
  sessionIdentityRef.current = sessionIdentity

  const startImpersonation = useCallback((account: PlatformAccount) => {
    const sid = sessionIdentityRef.current
    setImpersonation({
      active: true,
      accountId: account.id,
      accountName: account.name,
      adminName: sid?.displayName ?? "Platform admin",
      adminRole: sid?.platformRoleLabel ?? "Platform Admin",
    })
  }, [])

  const endImpersonation = useCallback(() => {
    setImpersonation(impersonationIdle(adminLabel, adminRoleLabel))
  }, [adminLabel, adminRoleLabel])

  const isPlatformAdmin = Boolean(sessionIdentity?.platformAdmin)
  const platformAdminNavVisible = sessionIdentityLoading || isPlatformAdmin

  return (
    <AdminContext.Provider
      value={{
        sessionIdentity,
        sessionIdentityLoading,
        impersonation,
        startImpersonation,
        endImpersonation,
        isPlatformAdmin,
        platformAdminNavVisible,
      }}
    >
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider")
  return ctx
}
