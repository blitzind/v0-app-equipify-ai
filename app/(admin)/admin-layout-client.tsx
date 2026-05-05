"use client"

import type { ReactNode } from "react"
import type { SessionIdentity } from "@/lib/session-identity"
import { AdminProvider } from "@/lib/admin-store"

export function AdminLayoutClient({
  children,
  initialSessionIdentity,
}: {
  children: ReactNode
  initialSessionIdentity: SessionIdentity
}) {
  return (
    <AdminProvider initialSessionIdentity={initialSessionIdentity}>
      {children}
    </AdminProvider>
  )
}
