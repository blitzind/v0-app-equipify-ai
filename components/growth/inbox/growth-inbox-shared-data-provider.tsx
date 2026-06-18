"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { GrowthRevenueCommandCenterLead } from "@/lib/growth/revenue-execution/revenue-execution-types"
import { fetchPlatformGrowthClient } from "@/lib/growth/platform-growth-client-fetch"

type CommandCenterDashboard = {
  sections?: Record<string, GrowthRevenueCommandCenterLead[]>
}

type GrowthInboxSharedDataValue = {
  commandCenterDashboard: CommandCenterDashboard | null
  commandCenterLoading: boolean
  getCommandCenterLead: (leadId: string) => GrowthRevenueCommandCenterLead | null
  refreshCommandCenter: () => Promise<void>
}

const GrowthInboxSharedDataContext = createContext<GrowthInboxSharedDataValue | null>(null)

export function findCommandCenterLead(
  dashboard: CommandCenterDashboard | null,
  leadId: string,
): GrowthRevenueCommandCenterLead | null {
  if (!dashboard?.sections) return null
  for (const leads of Object.values(dashboard.sections)) {
    const match = leads.find((entry) => entry.leadId === leadId)
    if (match) return match
  }
  return null
}

export function useGrowthInboxSharedData(): GrowthInboxSharedDataValue {
  const value = useContext(GrowthInboxSharedDataContext)
  if (!value) {
    throw new Error("useGrowthInboxSharedData must be used within GrowthInboxSharedDataProvider")
  }
  return value
}

/** Org-scoped inbox data — fetched once per workspace session (Phase 4B). */
export function GrowthInboxSharedDataProvider({ children }: { children: ReactNode }) {
  const [commandCenterDashboard, setCommandCenterDashboard] = useState<CommandCenterDashboard | null>(null)
  const [commandCenterLoading, setCommandCenterLoading] = useState(false)
  const loadedRef = useRef(false)

  const refreshCommandCenter = useCallback(async () => {
    setCommandCenterLoading(true)
    try {
      const response = await fetchPlatformGrowthClient("/api/platform/growth/revenue-execution/command-center", {
        cache: "no-store",
      })
      const payload = (await response.json()) as { dashboard?: CommandCenterDashboard }
      if (response.ok) {
        setCommandCenterDashboard(payload.dashboard ?? null)
        loadedRef.current = true
      } else {
        setCommandCenterDashboard(null)
      }
    } catch {
      setCommandCenterDashboard(null)
    } finally {
      setCommandCenterLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loadedRef.current) return
    void refreshCommandCenter()
  }, [refreshCommandCenter])

  const getCommandCenterLead = useCallback(
    (leadId: string) => findCommandCenterLead(commandCenterDashboard, leadId),
    [commandCenterDashboard],
  )

  const value = useMemo(
    () => ({
      commandCenterDashboard,
      commandCenterLoading,
      getCommandCenterLead,
      refreshCommandCenter,
    }),
    [commandCenterDashboard, commandCenterLoading, getCommandCenterLead, refreshCommandCenter],
  )

  return <GrowthInboxSharedDataContext.Provider value={value}>{children}</GrowthInboxSharedDataContext.Provider>
}
