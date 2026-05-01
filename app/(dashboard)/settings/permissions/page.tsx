"use client"

import React from "react"
import { Check, X, Info } from "lucide-react"

type Role = "Owner" | "Admin" | "Dispatcher" | "Technician" | "Billing" | "Read Only"

const ROLES: Role[] = ["Owner", "Admin", "Dispatcher", "Technician", "Billing", "Read Only"]

const ROLE_META: Record<Role, { label: string; color: string; bg: string; description: string }> = {
  Owner:       { label: "Owner",      color: "#7c3aed", bg: "#f5f3ff", description: "Full control over workspace, billing, and all settings." },
  Admin:       { label: "Admin",      color: "#1d4ed8", bg: "#eff6ff", description: "Manages team, settings, and operations. Cannot change ownership." },
  Dispatcher:  { label: "Dispatcher", color: "#0369a1", bg: "#f0f9ff", description: "Creates and assigns work orders, schedules technicians." },
  Technician:  { label: "Technician", color: "#b45309", bg: "#fffbeb", description: "Views and updates assigned work orders and equipment in the field." },
  Billing:     { label: "Billing",    color: "#15803d", bg: "#f0fdf4", description: "Manages invoices, payments, and billing settings only." },
  "Read Only": { label: "Read Only",  color: "#6b7280", bg: "#f9fafb", description: "View-only access across the workspace. Cannot make changes." },
}

type PermMatrix = Record<Role, boolean>

const PERMISSION_GROUPS: {
  group: string
  rows: { label: string; key: string; perms: PermMatrix }[]
}[] = [
  {
    group: "Workspace & Administration",
    rows: [
      {
        label: "Manage workspace settings",
        key: "ws",
        perms: { Owner: true, Admin: true, Dispatcher: false, Technician: false, Billing: false, "Read Only": false },
      },
      {
        label: "Manage billing & subscription",
        key: "billing-manage",
        perms: { Owner: true, Admin: false, Dispatcher: false, Technician: false, Billing: true, "Read Only": false },
      },
      {
        label: "View billing & invoices",
        key: "billing-view",
        perms: { Owner: true, Admin: true, Dispatcher: false, Technician: false, Billing: true, "Read Only": false },
      },
      {
        label: "Invite & manage team members",
        key: "team",
        perms: { Owner: true, Admin: true, Dispatcher: false, Technician: false, Billing: false, "Read Only": false },
      },
      {
        label: "Manage permissions & roles",
        key: "perms",
        perms: { Owner: true, Admin: true, Dispatcher: false, Technician: false, Billing: false, "Read Only": false },
      },
      {
        label: "Transfer ownership",
        key: "ownership",
        perms: { Owner: true, Admin: false, Dispatcher: false, Technician: false, Billing: false, "Read Only": false },
      },
    ],
  },
  {
    group: "Work Orders",
    rows: [
      {
        label: "Create work orders",
        key: "wo-create",
        perms: { Owner: true, Admin: true, Dispatcher: true, Technician: false, Billing: false, "Read Only": false },
      },
      {
        label: "Assign & schedule work orders",
        key: "wo-assign",
        perms: { Owner: true, Admin: true, Dispatcher: true, Technician: false, Billing: false, "Read Only": false },
      },
      {
        label: "Edit work orders",
        key: "wo-edit",
        perms: { Owner: true, Admin: true, Dispatcher: true, Technician: true, Billing: false, "Read Only": false },
      },
      {
        label: "Delete work orders",
        key: "wo-del",
        perms: { Owner: true, Admin: true, Dispatcher: false, Technician: false, Billing: false, "Read Only": false },
      },
      {
        label: "View all work orders",
        key: "wo-view",
        perms: { Owner: true, Admin: true, Dispatcher: true, Technician: true, Billing: true, "Read Only": true },
      },
    ],
  },
  {
    group: "Equipment",
    rows: [
      {
        label: "Add equipment records",
        key: "eq-add",
        perms: { Owner: true, Admin: true, Dispatcher: true, Technician: false, Billing: false, "Read Only": false },
      },
      {
        label: "Edit equipment records",
        key: "eq-edit",
        perms: { Owner: true, Admin: true, Dispatcher: true, Technician: false, Billing: false, "Read Only": false },
      },
      {
        label: "View equipment",
        key: "eq-view",
        perms: { Owner: true, Admin: true, Dispatcher: true, Technician: true, Billing: false, "Read Only": true },
      },
    ],
  },
  {
    group: "Customers & Invoices",
    rows: [
      {
        label: "Create & send invoices",
        key: "inv-create",
        perms: { Owner: true, Admin: true, Dispatcher: false, Technician: false, Billing: true, "Read Only": false },
      },
      {
        label: "Edit & void invoices",
        key: "inv-edit",
        perms: { Owner: true, Admin: true, Dispatcher: false, Technician: false, Billing: true, "Read Only": false },
      },
      {
        label: "View invoices & payments",
        key: "inv-view",
        perms: { Owner: true, Admin: true, Dispatcher: true, Technician: false, Billing: true, "Read Only": true },
      },
      {
        label: "Create & send quotes",
        key: "quote-create",
        perms: { Owner: true, Admin: true, Dispatcher: true, Technician: false, Billing: false, "Read Only": false },
      },
    ],
  },
  {
    group: "Maintenance Plans",
    rows: [
      {
        label: "Create & edit plans",
        key: "pm-edit",
        perms: { Owner: true, Admin: true, Dispatcher: true, Technician: false, Billing: false, "Read Only": false },
      },
      {
        label: "View maintenance plans",
        key: "pm-view",
        perms: { Owner: true, Admin: true, Dispatcher: true, Technician: true, Billing: false, "Read Only": true },
      },
    ],
  },
  {
    group: "AI & Insights",
    rows: [
      {
        label: "Access AI Insights module",
        key: "ai",
        perms: { Owner: true, Admin: true, Dispatcher: true, Technician: false, Billing: false, "Read Only": false },
      },
      {
        label: "Export insight reports",
        key: "ai-exp",
        perms: { Owner: true, Admin: true, Dispatcher: false, Technician: false, Billing: true, "Read Only": false },
      },
    ],
  },
  {
    group: "Customer Portal & Settings",
    rows: [
      {
        label: "Access customer portal",
        key: "portal",
        perms: { Owner: true, Admin: true, Dispatcher: true, Technician: false, Billing: true, "Read Only": true },
      },
      {
        label: "Manage automations & notifications",
        key: "automations",
        perms: { Owner: true, Admin: true, Dispatcher: false, Technician: false, Billing: false, "Read Only": false },
      },
      {
        label: "View audit log",
        key: "audit",
        perms: { Owner: true, Admin: true, Dispatcher: false, Technician: false, Billing: false, "Read Only": false },
      },
    ],
  },
]

function PermIcon({ allowed }: { allowed: boolean }) {
  return allowed
    ? <Check size={13} className="ds-icon-success mx-auto" />
    : <X size={13} className="text-muted-foreground/35 mx-auto" />
}

export default function PermissionsPage() {
  return (
    <div className="flex flex-col gap-6">

      {/* Role cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ROLES.map((role) => {
          const { color, bg, description } = ROLE_META[role]
          return (
            <div key={role} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1.5">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full self-start"
                style={{ color, background: bg }}>
                {role}
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
            </div>
          )
        })}
      </div>

      {/* Matrix table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Role permissions matrix</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            A read-only overview of what each role can do. Contact support to request custom roles (Enterprise only).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground w-56 min-w-[14rem]">
                  Permission
                </th>
                {ROLES.map((role) => {
                  const { color, bg } = ROLE_META[role]
                  return (
                    <th key={role} className="text-center px-3 py-3 min-w-[100px]">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ color, background: bg }}>
                        {role}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <React.Fragment key={group.group}>
                  <tr className="bg-secondary/30">
                    <td colSpan={ROLES.length + 1} className="px-6 py-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {group.group}
                      </span>
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.key} className="border-t border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-2.5 text-xs text-foreground">{row.label}</td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-3 py-2.5 text-center">
                          <PermIcon allowed={row.perms[role]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border ds-alert-info px-5 py-4">
        <Info size={14} className="mt-0.5 shrink-0 ds-icon-info" />
        <div>
          <p className="text-sm font-medium">Custom role permissions</p>
          <p className="text-xs mt-0.5">
            Custom role configuration with granular per-permission overrides is available on the{" "}
            <a href="/settings/billing" className="underline font-medium">Enterprise plan</a>.
            Contact your account manager to enable this feature.
          </p>
        </div>
      </div>
    </div>
  )
}
