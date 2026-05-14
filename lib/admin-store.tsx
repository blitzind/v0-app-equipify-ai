"use client"

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { PlatformAccount } from "./admin-data"
import type { SessionIdentity } from "./session-identity"
import { EQUIPIFY_SUPPORT_SESSION_ORG_CACHE_KEY } from "@/lib/support-session-storage"

interface ImpersonationState {
  active: boolean
  accountId: string | null
  accountName: string | null
  /** From Platform Admin account row — drives tenant slug/mapping when impersonating. */
  accountSlug: string | null
  adminName: string
  adminRole: string
}

interface AdminContextValue {
  sessionIdentity: SessionIdentity | null
  sessionIdentityLoading: boolean
  impersonation: ImpersonationState
  startImpersonation: (account: PlatformAccount) => void
  endImpersonation: () => Promise<void>
  /** Server gate for `/admin` — hydrates global session before client fetch. */
  seedPlatformSessionIdentity: (identity: SessionIdentity) => void
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
    accountSlug: null,
    adminName,
    adminRole,
  }
}

type SupportSessionGetResponse =
  | { active: false }
  | {
      active: true
      organizationId: string
      organizationName: string
      organizationSlug: string
      organizationStatus?: string
      expiresAt: string
    }

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const sessionSeededRef = useRef(false)

  const [sessionIdentity, setSessionIdentity] = useState<SessionIdentity | null>(null)

  const [sessionIdentityLoading, setSessionIdentityLoading] = useState(true)

  useEffect(() => {
    if (sessionSeededRef.current) {
      return
    }

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
  }, [])

  const seedPlatformSessionIdentity = useCallback((identity: SessionIdentity) => {
    sessionSeededRef.current = true
    setSessionIdentity(identity)
    setSessionIdentityLoading(false)
  }, [])

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

  /** Restore workspace banner from DB after refresh / new tab. */
  useEffect(() => {
    if (sessionIdentityLoading || !sessionIdentity?.platformAdmin) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/platform/support-session", { cache: "no-store" })
        const data = (await res.json()) as SupportSessionGetResponse
        if (cancelled) return
        if (data.active) {
          const sid = sessionIdentityRef.current
          if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEBUG_NAV === "true") {
            console.info("[equipify:admin] support_session_restore", {
              organizationId: data.organizationId,
            })
          }
          setImpersonation({
            active: true,
            accountId: data.organizationId,
            accountName: data.organizationName?.trim() || "Organization",
            accountSlug: data.organizationSlug?.trim() ? data.organizationSlug.trim() : null,
            adminName: sid?.displayName ?? "Platform admin",
            adminRole: sid?.platformRoleLabel ?? "Platform Admin",
          })
        } else {
          setImpersonation((prev) =>
            prev.active ? impersonationIdle(adminLabel, adminRoleLabel) : prev,
          )
        }
      } catch {
        /* ignore */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionIdentityLoading, sessionIdentity?.platformAdmin, adminLabel, adminRoleLabel])

  const startImpersonation = useCallback((account: PlatformAccount) => {
    const sid = sessionIdentityRef.current
    setImpersonation({
      active: true,
      accountId: account.id,
      accountName: account.name,
      accountSlug: account.slug?.trim() ? account.slug.trim() : null,
      adminName: sid?.displayName ?? "Platform admin",
      adminRole: sid?.platformRoleLabel ?? "Platform Admin",
    })
  }, [])

  const endImpersonation = useCallback(async () => {
    try {
      await fetch("/api/platform/support-session", { method: "DELETE" })
    } catch {
      /* still clear local UI */
    }
    try {
      localStorage.removeItem(EQUIPIFY_SUPPORT_SESSION_ORG_CACHE_KEY)
    } catch {
      /* ignore */
    }
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
        seedPlatformSessionIdentity,
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
