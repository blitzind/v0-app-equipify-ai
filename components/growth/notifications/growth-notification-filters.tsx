"use client"

import { GROWTH_OPERATOR_NOTIFICATION_EVENTS } from "@/lib/growth/notifications/growth-notification-events"
import type { GrowthOperatorNotificationCenterStatus } from "@/lib/growth/notifications/growth-notification-center-utils"
import { GROWTH_OPERATOR_NOTIFICATION_RECIPIENT_ROLES } from "@/lib/growth/notifications/growth-notification-routing"
import { GROWTH_OPERATOR_NOTIFICATION_SEVERITIES } from "@/lib/growth/notifications/growth-notification-severity"

export type GrowthNotificationCenterFilters = {
  status: GrowthOperatorNotificationCenterStatus
  severity: string
  event: string
  recipientRole: string
}

export const DEFAULT_GROWTH_NOTIFICATION_CENTER_FILTERS: GrowthNotificationCenterFilters = {
  status: "unread",
  severity: "",
  event: "",
  recipientRole: "",
}

const STATUS_OPTIONS: Array<{ value: GrowthOperatorNotificationCenterStatus; label: string }> = [
  { value: "unread", label: "Unread" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
]

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function GrowthNotificationFilters({
  filters,
  onChange,
}: {
  filters: GrowthNotificationCenterFilters
  onChange: (next: GrowthNotificationCenterFilters) => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <FilterSelect
        label="Status"
        value={filters.status}
        onChange={(status) =>
          onChange({
            ...filters,
            status: status as GrowthOperatorNotificationCenterStatus,
          })
        }
        options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
      />
      <FilterSelect
        label="Severity"
        value={filters.severity}
        onChange={(severity) => onChange({ ...filters, severity })}
        options={[
          { value: "", label: "All severities" },
          ...GROWTH_OPERATOR_NOTIFICATION_SEVERITIES.map((severity) => ({
            value: severity,
            label: severity,
          })),
        ]}
      />
      <FilterSelect
        label="Event"
        value={filters.event}
        onChange={(event) => onChange({ ...filters, event })}
        options={[
          { value: "", label: "All events" },
          ...GROWTH_OPERATOR_NOTIFICATION_EVENTS.map((event) => ({
            value: event,
            label: event.replace(/_/g, " "),
          })),
        ]}
      />
      <FilterSelect
        label="Recipient"
        value={filters.recipientRole}
        onChange={(recipientRole) => onChange({ ...filters, recipientRole })}
        options={[
          { value: "", label: "All recipients" },
          ...GROWTH_OPERATOR_NOTIFICATION_RECIPIENT_ROLES.map((role) => ({
            value: role,
            label: role.replace(/_/g, " "),
          })),
        ]}
      />
    </div>
  )
}
