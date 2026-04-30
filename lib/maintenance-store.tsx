"use client"

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react"
import {
  maintenancePlans as initialPlans,
  notificationLog as initialLog,
} from "@/lib/mock-data"
import type {
  MaintenancePlan,
  NotificationLogEntry,
  PlanStatus,
  NotificationRule,
} from "@/lib/mock-data"

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  plans: MaintenancePlan[]
  notificationLog: NotificationLogEntry[]
}

type Action =
  | { type: "CREATE_PLAN"; payload: MaintenancePlan }
  | { type: "UPDATE_PLAN"; id: string; payload: Partial<MaintenancePlan> }
  | { type: "SET_STATUS"; id: string; status: PlanStatus }
  | { type: "UPDATE_RULES"; id: string; rules: NotificationRule[] }
  | { type: "LOG_NOTIFICATION"; entry: NotificationLogEntry }
  | { type: "FIRE_NOTIFICATIONS"; planId: string }

function computeNextDueDate(lastServiceDate: string, interval: MaintenancePlan["interval"], customDays: number): string {
  const base = new Date(lastServiceDate)
  switch (interval) {
    case "Annual":       base.setFullYear(base.getFullYear() + 1); break
    case "Semi-Annual":  base.setMonth(base.getMonth() + 6); break
    case "Quarterly":    base.setMonth(base.getMonth() + 3); break
    case "Monthly":      base.setMonth(base.getMonth() + 1); break
    case "Custom":       base.setDate(base.getDate() + (customDays || 90)); break
  }
  return base.toISOString().split("T")[0]
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "CREATE_PLAN":
      return { ...state, plans: [action.payload, ...state.plans] }

    case "UPDATE_PLAN":
      return {
        ...state,
        plans: state.plans.map((p) => {
          if (p.id !== action.id) return p
          const updated = { ...p, ...action.payload }
          // Recompute nextDueDate if interval-related fields changed
          if (action.payload.interval || action.payload.lastServiceDate || action.payload.customIntervalDays !== undefined) {
            updated.nextDueDate = computeNextDueDate(
              updated.lastServiceDate,
              updated.interval,
              updated.customIntervalDays,
            )
          }
          return updated
        }),
      }

    case "SET_STATUS":
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === action.id ? { ...p, status: action.status } : p
        ),
      }

    case "UPDATE_RULES":
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === action.id ? { ...p, notificationRules: action.rules } : p
        ),
      }

    case "LOG_NOTIFICATION":
      return { ...state, notificationLog: [action.entry, ...state.notificationLog] }

    case "FIRE_NOTIFICATIONS": {
      const plan = state.plans.find((p) => p.id === action.planId)
      if (!plan) return state
      const now = new Date().toISOString()
      const dueDate = new Date(plan.nextDueDate)
      const today = new Date()
      const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const thresholds = [30, 14, 7, 1] as const
      const newEntries: NotificationLogEntry[] = []

      thresholds.forEach((days) => {
        if (daysUntilDue <= days) {
          plan.notificationRules
            .filter((r) => r.enabled && r.triggerDays === days)
            .forEach((rule) => {
              rule.recipients.forEach((recipient) => {
                newEntries.push({
                  id: `NL-SIM-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  planId: plan.id,
                  planName: plan.name,
                  equipmentName: plan.equipmentName,
                  customerName: plan.customerName,
                  channel: rule.channel,
                  triggerDays: days,
                  sentAt: now,
                  recipient,
                  message: `${rule.channel === "SMS" ? "Equipify: " : "Reminder: "}${plan.equipmentName} — "${plan.name}" is due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""} (${plan.nextDueDate}).`,
                  status: "Simulated",
                })
              })
            })
        }
      })

      return { ...state, notificationLog: [...newEntries, ...state.notificationLog] }
    }

    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface MaintenanceContextValue {
  plans: MaintenancePlan[]
  notificationLog: NotificationLogEntry[]
  createPlan: (plan: MaintenancePlan) => void
  updatePlan: (id: string, payload: Partial<MaintenancePlan>) => void
  setStatus: (id: string, status: PlanStatus) => void
  updateRules: (id: string, rules: NotificationRule[]) => void
  fireNotifications: (planId: string) => void
  getById: (id: string) => MaintenancePlan | undefined
}

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null)

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    plans: initialPlans,
    notificationLog: initialLog,
  })

  const createPlan   = useCallback((plan: MaintenancePlan) => dispatch({ type: "CREATE_PLAN", payload: plan }), [])
  const updatePlan   = useCallback((id: string, payload: Partial<MaintenancePlan>) => dispatch({ type: "UPDATE_PLAN", id, payload }), [])
  const setStatus    = useCallback((id: string, status: PlanStatus) => dispatch({ type: "SET_STATUS", id, status }), [])
  const updateRules  = useCallback((id: string, rules: NotificationRule[]) => dispatch({ type: "UPDATE_RULES", id, rules }), [])
  const fireNotifications = useCallback((planId: string) => dispatch({ type: "FIRE_NOTIFICATIONS", planId }), [])
  const getById      = useCallback((id: string) => state.plans.find((p) => p.id === id), [state.plans])

  return (
    <MaintenanceContext.Provider value={{ plans: state.plans, notificationLog: state.notificationLog, createPlan, updatePlan, setStatus, updateRules, fireNotifications, getById }}>
      {children}
    </MaintenanceContext.Provider>
  )
}

export function useMaintenancePlans() {
  const ctx = useContext(MaintenanceContext)
  if (!ctx) throw new Error("useMaintenancePlans must be used inside MaintenanceProvider")
  return ctx
}
