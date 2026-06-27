"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import type { GrowthHomeAiEmployeeStatus } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

type AiEmployeeStatusContextValue = {
  status: GrowthHomeAiEmployeeStatus | null
  setStatus: (status: GrowthHomeAiEmployeeStatus | null) => void
}

const AiEmployeeStatusContext = createContext<AiEmployeeStatusContextValue | null>(null)

const DEFAULT_STATUS: GrowthHomeAiEmployeeStatus = {
  kind: "working",
  label: "Working",
  activityLabel: "advancing your revenue priorities",
}

export function AiEmployeeStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatusState] = useState<GrowthHomeAiEmployeeStatus | null>(null)

  const setStatus = useCallback((next: GrowthHomeAiEmployeeStatus | null) => {
    setStatusState(next)
  }, [])

  const value = useMemo(() => ({ status, setStatus }), [status, setStatus])

  return <AiEmployeeStatusContext.Provider value={value}>{children}</AiEmployeeStatusContext.Provider>
}

export function useAiEmployeeStatus() {
  const context = useContext(AiEmployeeStatusContext)
  if (!context) {
    return {
      status: DEFAULT_STATUS,
      setStatus: () => {},
    }
  }
  return {
    status: context.status ?? DEFAULT_STATUS,
    setStatus: context.setStatus,
  }
}
