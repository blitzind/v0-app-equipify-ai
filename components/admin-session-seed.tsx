"use client"

import { useLayoutEffect } from "react"
import type { SessionIdentity } from "@/lib/session-identity"
import { useAdmin } from "@/lib/admin-store"

/** Applies server-verified platform identity under the global {@link AdminProvider}. */
export function AdminSessionSeed({ identity }: { identity: SessionIdentity }) {
  const { seedPlatformSessionIdentity } = useAdmin()
  useLayoutEffect(() => {
    seedPlatformSessionIdentity(identity)
  }, [identity, seedPlatformSessionIdentity])
  return null
}
