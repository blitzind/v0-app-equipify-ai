"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  expandGrowthDrawerCallIntelligencePanels,
  scrollGrowthDrawerRealtimeCallIntelligence,
} from "@/lib/growth/call-workflow"

export type GrowthCallWorkflowHandles = {
  startRealtimeCoaching: () => Promise<void>
  startCallCopilot: () => Promise<void>
  refreshCallPanels: () => Promise<void>
}

type GrowthCallWorkflowState = {
  dialSessionId: string | null
  dialLabel: string | null
  callWorkflowActive: boolean
}

type GrowthCallWorkflowContextValue = {
  state: GrowthCallWorkflowState
  expandToken: number
  refreshToken: number
  notifyDialStarted: (input: { sessionId: string; dialLabel: string }) => void
  surfaceCallIntelligence: () => void
  registerHandles: (handles: Partial<GrowthCallWorkflowHandles>) => void
  runStartRealtimeCoaching: () => Promise<void>
  runStartCallCopilot: () => Promise<void>
  clearCallWorkflow: () => void
}

const GrowthCallWorkflowContext = createContext<GrowthCallWorkflowContextValue | null>(null)

export function GrowthCallWorkflowProvider({ children }: { children: ReactNode }) {
  const handlesRef = useRef<Partial<GrowthCallWorkflowHandles>>({})
  const [state, setState] = useState<GrowthCallWorkflowState>({
    dialSessionId: null,
    dialLabel: null,
    callWorkflowActive: false,
  })
  const [expandToken, setExpandToken] = useState(0)
  const [refreshToken, setRefreshToken] = useState(0)

  const registerHandles = useCallback((handles: Partial<GrowthCallWorkflowHandles>) => {
    handlesRef.current = { ...handlesRef.current, ...handles }
  }, [])

  const surfaceCallIntelligence = useCallback(() => {
    expandGrowthDrawerCallIntelligencePanels()
    setExpandToken((value) => value + 1)
    scrollGrowthDrawerRealtimeCallIntelligence()
  }, [])

  const notifyDialStarted = useCallback(
    (input: { sessionId: string; dialLabel: string }) => {
      setState({
        dialSessionId: input.sessionId,
        dialLabel: input.dialLabel,
        callWorkflowActive: true,
      })
      setRefreshToken((value) => value + 1)
      surfaceCallIntelligence()
    },
    [surfaceCallIntelligence],
  )

  const clearCallWorkflow = useCallback(() => {
    setState({
      dialSessionId: null,
      dialLabel: null,
      callWorkflowActive: false,
    })
  }, [])

  const runStartRealtimeCoaching = useCallback(async () => {
    surfaceCallIntelligence()
    await handlesRef.current.startRealtimeCoaching?.()
    setRefreshToken((value) => value + 1)
    scrollGrowthDrawerRealtimeCallIntelligence()
  }, [surfaceCallIntelligence])

  const runStartCallCopilot = useCallback(async () => {
    surfaceCallIntelligence()
    await handlesRef.current.startCallCopilot?.()
    setRefreshToken((value) => value + 1)
    scrollGrowthDrawerRealtimeCallIntelligence()
  }, [surfaceCallIntelligence])

  const value = useMemo(
    () => ({
      state,
      expandToken,
      refreshToken,
      notifyDialStarted,
      surfaceCallIntelligence,
      registerHandles,
      runStartRealtimeCoaching,
      runStartCallCopilot,
      clearCallWorkflow,
    }),
    [
      state,
      expandToken,
      refreshToken,
      notifyDialStarted,
      surfaceCallIntelligence,
      registerHandles,
      runStartRealtimeCoaching,
      runStartCallCopilot,
      clearCallWorkflow,
    ],
  )

  return <GrowthCallWorkflowContext.Provider value={value}>{children}</GrowthCallWorkflowContext.Provider>
}

export function useGrowthCallWorkflow(): GrowthCallWorkflowContextValue {
  const context = useContext(GrowthCallWorkflowContext)
  if (!context) {
    throw new Error("useGrowthCallWorkflow must be used within GrowthCallWorkflowProvider")
  }
  return context
}

export function useGrowthCallWorkflowOptional(): GrowthCallWorkflowContextValue | null {
  return useContext(GrowthCallWorkflowContext)
}
