import type { LucideIcon } from "lucide-react"
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Repeat2,
  Shield,
  UserCog,
} from "lucide-react"

/** DB + API `alert_type` values (snake_case; never shown verbatim in UI). */
export const WORKSPACE_ALERT_TYPES = [
  "overdue_work_orders",
  "repeat_repair_alerts",
  "warranty_expiring",
  "maintenance_due",
  "work_order_completed",
  "schedule_changes",
] as const

export type WorkspaceAlertType = (typeof WORKSPACE_ALERT_TYPES)[number]

export type WorkspaceAlertRegistryEntry = {
  alertType: WorkspaceAlertType
  label: string
  description: string
  icon: LucideIcon
  iconColorClass: string
  defaultInApp: boolean
  defaultEmail: boolean
  defaultSms: boolean
}

export const WORKSPACE_ALERT_REGISTRY: readonly WorkspaceAlertRegistryEntry[] = [
  {
    alertType: "overdue_work_orders",
    label: "Overdue work orders",
    description: "When a work order passes its due date without being closed.",
    icon: AlertCircle,
    iconColorClass: "text-destructive",
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  {
    alertType: "repeat_repair_alerts",
    label: "Repeat repair alerts",
    description: "When the same equipment is flagged for repeated repairs.",
    icon: Repeat2,
    iconColorClass: "text-destructive",
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  {
    alertType: "warranty_expiring",
    label: "Warranty expiring",
    description: "When equipment warranties are approaching expiration.",
    icon: Shield,
    iconColorClass: "text-[oklch(0.50_0.12_70)]",
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  {
    alertType: "maintenance_due",
    label: "Maintenance due",
    description: "When scheduled preventive maintenance is upcoming.",
    icon: CalendarClock,
    iconColorClass: "text-primary",
    defaultInApp: true,
    defaultEmail: false,
    defaultSms: false,
  },
  {
    alertType: "work_order_completed",
    label: "Work order completed",
    description: "When a technician closes a work order.",
    icon: CheckCircle2,
    iconColorClass: "text-[oklch(0.42_0.17_145)]",
    defaultInApp: true,
    defaultEmail: false,
    defaultSms: false,
  },
  {
    alertType: "schedule_changes",
    label: "Schedule changes",
    description: "When a technician is reassigned or an appointment is rescheduled.",
    icon: UserCog,
    iconColorClass: "text-primary",
    defaultInApp: true,
    defaultEmail: false,
    defaultSms: false,
  },
]

const ALERT_SET = new Set<string>(WORKSPACE_ALERT_TYPES)

export function isWorkspaceAlertType(v: string): v is WorkspaceAlertType {
  return ALERT_SET.has(v)
}

export function getWorkspaceAlertEntry(type: WorkspaceAlertType): WorkspaceAlertRegistryEntry {
  const row = WORKSPACE_ALERT_REGISTRY.find((e) => e.alertType === type)
  if (!row) throw new Error(`Missing registry entry for ${type}`)
  return row
}
