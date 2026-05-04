"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type {
  MaintenancePlan,
  NotificationLogEntry,
  NotificationRule,
  PlanStatus,
  NotificationTriggerDays,
} from "@/lib/mock-data"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { loadMaintenancePlansForOrg } from "@/lib/maintenance-plans/load-plans"
import {
  computeNextDueDate,
  intervalToDb,
  notificationRulesToJsonb,
  planStatusUiToDb,
  serializeServicesForDb,
} from "@/lib/maintenance-plans/db-map"

interface MaintenanceContextValue {
  plans: MaintenancePlan[]
  notificationLog: NotificationLogEntry[]
  loading: boolean
  error: string | null
  organizationId: string | null
  refreshPlans: (opts?: { silent?: boolean }) => Promise<void>
  createPlan: (plan: MaintenancePlan) => Promise<{ error?: string }>
  updatePlan: (id: string, payload: Partial<MaintenancePlan>) => Promise<{ error?: string }>
  setStatus: (id: string, status: PlanStatus) => Promise<{ error?: string }>
  updateRules: (id: string, rules: NotificationRule[]) => Promise<{ error?: string }>
  /** Soft-archive: hides plan from active lists (sets `is_archived`, `archived_at`). */
  archivePlan: (id: string) => Promise<{ error?: string }>
  /** Soft-remove: archives and marks plan expired; disables auto work orders. */
  deletePlan: (id: string) => Promise<{ error?: string }>
  fireNotifications: (planId: string) => void
  getById: (id: string) => MaintenancePlan | undefined
}

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null)

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const activeOrg = useActiveOrganization()
  const [plans, setPlans] = useState<MaintenancePlan[]>([])
  const [notificationLog, setNotificationLog] = useState<NotificationLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const refreshPlans = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    setError(null)
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setOrganizationId(null)
      setPlans([])
      if (!silent) setLoading(false)
      return
    }

    if (activeOrg.status !== "ready") {
      if (!silent) setLoading(true)
      return
    }

    if (!activeOrg.organizationId) {
      setOrganizationId(null)
      setPlans([])
      setError(
        activeOrg.organizations.length === 0
          ? "No organizations found for this account."
          : "Select an organization.",
      )
      if (!silent) setLoading(false)
      return
    }

    const orgId = activeOrg.organizationId
    setOrganizationId(orgId)

    const { plans: loaded, error: loadErr } = await loadMaintenancePlansForOrg(supabase, orgId)
    setPlans(loaded)
    setError(loadErr)
    if (!silent) setLoading(false)
  }, [activeOrg.status, activeOrg.organizationId, activeOrg.organizations.length])

  useEffect(() => {
    void refreshPlans()
  }, [refreshPlans])

  const createPlan = useCallback(
    async (plan: MaintenancePlan) => {
      if (!organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const { interval_value, interval_unit } = intervalToDb(plan.interval, plan.customIntervalDays)
      const nextDue =
        plan.nextDueDate ||
        computeNextDueDate(plan.lastServiceDate, plan.interval, plan.customIntervalDays)

      const { error: insertError } = await supabase.from("maintenance_plans").insert({
        organization_id: organizationId,
        customer_id: plan.customerId,
        equipment_id: plan.equipmentId?.trim() ? plan.equipmentId : null,
        assigned_user_id: plan.technicianId?.trim() ? plan.technicianId : null,
        name: plan.name.trim(),
        status: planStatusUiToDb(plan.status),
        priority: "normal",
        interval_value,
        interval_unit,
        last_service_date: plan.lastServiceDate?.trim() ? plan.lastServiceDate : null,
        next_due_date: nextDue?.trim() ? nextDue : null,
        auto_create_work_order: plan.autoCreateWorkOrder,
        notes: plan.notes?.trim() ? plan.notes : null,
        services: serializeServicesForDb(plan.services, plan.workOrderType, plan.workOrderPriority),
        notification_rules: notificationRulesToJsonb(plan.notificationRules),
      })

      if (insertError) return { error: insertError.message }
      await refreshPlans({ silent: true })
      return {}
    },
    [organizationId, refreshPlans]
  )

  const updatePlan = useCallback(
    async (id: string, payload: Partial<MaintenancePlan>) => {
      if (!organizationId) return { error: "No organization selected." }
      const current = plans.find((p) => p.id === id)
      if (!current) return { error: "Plan not found." }

      const merged: MaintenancePlan = { ...current, ...payload }

      const scheduleInputsChanged =
        payload.lastServiceDate !== undefined ||
        payload.interval !== undefined ||
        payload.customIntervalDays !== undefined

      if (scheduleInputsChanged && payload.nextDueDate === undefined) {
        merged.nextDueDate = computeNextDueDate(
          merged.lastServiceDate,
          merged.interval,
          merged.customIntervalDays
        )
      }

      const { interval_value, interval_unit } = intervalToDb(merged.interval, merged.customIntervalDays)

      const supabase = createBrowserSupabaseClient()
      const { error: upError } = await supabase
        .from("maintenance_plans")
        .update({
          customer_id: merged.customerId,
          equipment_id: merged.equipmentId?.trim() ? merged.equipmentId : null,
          status: planStatusUiToDb(merged.status),
          assigned_user_id: merged.technicianId?.trim() ? merged.technicianId : null,
          name: merged.name.trim(),
          interval_value,
          interval_unit,
          last_service_date: merged.lastServiceDate?.trim() ? merged.lastServiceDate : null,
          next_due_date: merged.nextDueDate?.trim() ? merged.nextDueDate : null,
          auto_create_work_order: merged.autoCreateWorkOrder,
          notes: merged.notes?.trim() ? merged.notes : null,
          services: serializeServicesForDb(
            merged.services,
            merged.workOrderType,
            merged.workOrderPriority
          ),
          notification_rules: notificationRulesToJsonb(merged.notificationRules),
        })
        .eq("id", id)
        .eq("organization_id", organizationId)

      if (upError) return { error: upError.message }
      await refreshPlans({ silent: true })
      return {}
    },
    [organizationId, plans, refreshPlans]
  )

  const setStatus = useCallback(
    async (id: string, status: PlanStatus) => {
      if (!organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const { error: upError } = await supabase
        .from("maintenance_plans")
        .update({ status: planStatusUiToDb(status) })
        .eq("id", id)
        .eq("organization_id", organizationId)

      if (upError) return { error: upError.message }
      await refreshPlans({ silent: true })
      return {}
    },
    [organizationId, refreshPlans]
  )

  const updateRules = useCallback(
    async (id: string, rules: NotificationRule[]) => {
      if (!organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const { error: upError } = await supabase
        .from("maintenance_plans")
        .update({ notification_rules: notificationRulesToJsonb(rules) })
        .eq("id", id)
        .eq("organization_id", organizationId)

      if (upError) return { error: upError.message }
      await refreshPlans({ silent: true })
      return {}
    },
    [organizationId, refreshPlans]
  )

  const archivePlan = useCallback(
    async (id: string) => {
      if (!organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const archivedAt = new Date().toISOString()
      const { error: upError } = await supabase
        .from("maintenance_plans")
        .update({
          is_archived: true,
          archived_at: archivedAt,
        })
        .eq("id", id)
        .eq("organization_id", organizationId)

      if (upError) return { error: upError.message }
      await refreshPlans({ silent: true })
      return {}
    },
    [organizationId, refreshPlans]
  )

  const deletePlan = useCallback(
    async (id: string) => {
      if (!organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const archivedAt = new Date().toISOString()
      const { error: upError } = await supabase
        .from("maintenance_plans")
        .update({
          is_archived: true,
          archived_at: archivedAt,
          status: "expired",
          auto_create_work_order: false,
        })
        .eq("id", id)
        .eq("organization_id", organizationId)

      if (upError) return { error: upError.message }
      await refreshPlans({ silent: true })
      return {}
    },
    [organizationId, refreshPlans]
  )

  const fireNotifications = useCallback((planId: string) => {
    const plan = plans.find((p) => p.id === planId)
    if (!plan) return
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
                triggerDays: days as NotificationTriggerDays,
                sentAt: now,
                recipient,
                message: `${rule.channel === "SMS" ? "Equipify: " : "Reminder: "}${plan.equipmentName} — "${plan.name}" is due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""} (${plan.nextDueDate}).`,
                status: "Simulated",
              })
            })
          })
      }
    })

    if (newEntries.length > 0) {
      setNotificationLog((prev) => [...newEntries, ...prev])
    }
  }, [plans])

  const getById = useCallback(
    (id: string) => plans.find((p) => p.id === id),
    [plans]
  )

  return (
    <MaintenanceContext.Provider
      value={{
        plans,
        notificationLog,
        loading,
        error,
        organizationId,
        refreshPlans,
        createPlan,
        updatePlan,
        setStatus,
        updateRules,
        archivePlan,
        deletePlan,
        fireNotifications,
        getById,
      }}
    >
      {children}
    </MaintenanceContext.Provider>
  )
}

export function useMaintenancePlans() {
  const ctx = useContext(MaintenanceContext)
  if (!ctx) throw new Error("useMaintenancePlans must be used inside MaintenanceProvider")
  return ctx
}
