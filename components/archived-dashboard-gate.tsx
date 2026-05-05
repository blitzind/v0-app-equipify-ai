"use client"

import { useEffect } from "react"
import { useAdmin } from "@/lib/admin-store"

/**
 * Client fallback when middleware was skipped (SPA transitions): members whose only orgs are archived
 * are sent to `/login?error=archived`. Platform admins and impersonation sessions are exempt.
 */
export function ArchivedDashboardGate() {
  const { impersonation, isPlatformAdmin, sessionIdentityLoading } = useAdmin()

  useEffect(() => {
    if (sessionIdentityLoading || impersonation.active || isPlatformAdmin) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/session/archive-access", { cache: "no-store" })
        const data = (await res.json()) as { blocked?: boolean }
        if (!cancelled && data.blocked) {
          window.location.assign("/login?error=archived")
        }
      } catch {
        /* ignore */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionIdentityLoading, impersonation.active, isPlatformAdmin])

  return null
}
