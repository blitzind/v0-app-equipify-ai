"use client"

import React from "react"
import { Check, X } from "lucide-react"
import type { UserRole } from "@/lib/tenant-data"

const ROLES: UserRole[] = ["Admin", "Manager", "Tech", "Read Only"]

const ROLE_META: Record<UserRole, { color: string; bg: string }> = {
  Admin:       { color: "#1d4ed8", bg: "#eff6ff" },
  Manager:     { color: "#15803d", bg: "#f0fdf4" },
  Tech:        { color: "#b45309", bg: "#fffbeb" },
  "Read Only": { color: "#6b7280", bg: "#f9fafb" },
}

const PERMISSION_GROUPS: {
  group: string
  rows: { label: string; key: string; perms: Record<UserRole, boolean> }[]
}[] = [
  {
    group: "Workspace & Administration",
    rows: [
      { label: "Manage workspace settings", key: "ws", perms: { Admin: true, Manager: false, Tech: false, "Read Only": false } },
      { label: "Manage billing & subscription", key: "billing", perms: { Admin: true, Manager: false, Tech: false, "Read Only": false } },
      { label: "Invite & manage team members", key: "team", perms: { Admin: true, Manager: false, Tech: false, "Read Only": false } },
      { label: "View billing & invoices", key: "viewbill", perms: { Admin: true, Manager: true, Tech: false, "Read Only": false } },
    ],
  },
  {
    group: "Work Orders",
    rows: [
      { label: "Create work orders", key: "wo-create", perms: { Admin: true, Manager: true, Tech: false, "Read Only": false } },
      { label: "Edit work orders", key: "wo-edit", perms: { Admin: true, Manager: true, Tech: true, "Read Only": false } },
      { label: "Delete work orders", key: "wo-del", perms: { Admin: true, Manager: false, Tech: false, "Read Only": false } },
      { label: "View all work orders", key: "wo-view", perms: { Admin: true, Manager: true, Tech: true, "Read Only": true } },
    ],
  },
  {
    group: "Equipment",
    rows: [
      { label: "Add equipment records", key: "eq-add", perms: { Admin: true, Manager: true, Tech: false, "Read Only": false } },
      { label: "Edit equipment records", key: "eq-edit", perms: { Admin: true, Manager: true, Tech: false, "Read Only": false } },
      { label: "View equipment", key: "eq-view", perms: { Admin: true, Manager: true, Tech: true, "Read Only": true } },
    ],
  },
  {
    group: "Maintenance Plans",
    rows: [
      { label: "Create & edit plans", key: "pm-edit", perms: { Admin: true, Manager: true, Tech: false, "Read Only": false } },
      { label: "View maintenance plans", key: "pm-view", perms: { Admin: true, Manager: true, Tech: true, "Read Only": true } },
    ],
  },
  {
    group: "AI & Insights",
    rows: [
      { label: "Access AI Insights module", key: "ai", perms: { Admin: true, Manager: true, Tech: false, "Read Only": true } },
      { label: "Export insight reports", key: "ai-exp", perms: { Admin: true, Manager: true, Tech: false, "Read Only": false } },
    ],
  },
  {
    group: "Customer Portal",
    rows: [
      { label: "Access customer portal", key: "portal", perms: { Admin: true, Manager: true, Tech: false, "Read Only": true } },
    ],
  },
]

function PermIcon({ allowed }: { allowed: boolean }) {
  return allowed
    ? <Check size={14} className="ds-icon-success mx-auto" />
    : <X size={14} className="text-muted-foreground/40 mx-auto" />
}

export default function PermissionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Role permissions matrix</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            A read-only overview of what each role can do. Permissions are fixed per role. Contact support to request custom roles (Enterprise only).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground w-64">Permission</th>
                {ROLES.map((role) => {
                  const { color, bg } = ROLE_META[role]
                  return (
                    <th key={role} className="text-center px-4 py-3 min-w-[120px]">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ color, background: bg }}>{role}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <React.Fragment key={group.group}>
                  <tr className="bg-secondary/30">
                    <td colSpan={5} className="px-6 py-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {group.group}
                      </span>
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.key} className="border-t border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-3 text-xs text-foreground">{row.label}</td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-4 py-3 text-center">
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

      <div className="rounded-lg border ds-alert-warning px-5 py-4">
        <p className="text-sm font-medium">Custom role permissions</p>
        <p className="text-xs mt-0.5">
          Custom role configuration is available on the Enterprise plan. <a href="/settings/billing" className="underline font-medium">Upgrade to Enterprise</a> to define granular permissions per role.
        </p>
      </div>
    </div>
  )
}
