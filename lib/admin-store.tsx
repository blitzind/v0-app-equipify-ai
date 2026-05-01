"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import { CURRENT_PLATFORM_ADMIN, type PlatformAccount, type FeatureFlag } from "./admin-data"

interface ImpersonationState {
  active: boolean
  accountId: string | null
  accountName: string | null
  adminName: string
  adminRole: string
}

interface AdminContextValue {
  impersonation: ImpersonationState
  startImpersonation: (account: PlatformAccount) => void
  endImpersonation: () => void
  isPlatformAdmin: boolean
}

const AdminContext = createContext<AdminContextValue | null>(null)

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [impersonation, setImpersonation] = useState<ImpersonationState>({
    active: false,
    accountId: null,
    accountName: null,
    adminName: CURRENT_PLATFORM_ADMIN.name,
    adminRole: CURRENT_PLATFORM_ADMIN.role,
  })

  const startImpersonation = useCallback((account: PlatformAccount) => {
    setImpersonation({
      active: true,
      accountId: account.id,
      accountName: account.name,
      adminName: CURRENT_PLATFORM_ADMIN.name,
      adminRole: CURRENT_PLATFORM_ADMIN.role,
    })
  }, [])

  const endImpersonation = useCallback(() => {
    setImpersonation((prev) => ({ ...prev, active: false, accountId: null, accountName: null }))
  }, [])

  return (
    <AdminContext.Provider value={{
      impersonation,
      startImpersonation,
      endImpersonation,
      isPlatformAdmin: true,
    }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider")
  return ctx
}
