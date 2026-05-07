"use client"

import * as React from "react"
import { Check, Info, ShieldCheck, X } from "lucide-react"
import {
  CAPABILITY_METADATA,
  ROLE_BEHAVIOR_SUMMARY,
  type CapabilityMetadata,
} from "@/lib/permissions/capabilities"
import {
  getOrgPermissionsForRole,
  type OrgMemberRole,
  type OrgPermissionKey,
  type OrgPermissions,
} from "@/lib/permissions/model"
import { useOrgPermissions } from "@/lib/org-permissions-context"

type LiveRole = OrgMemberRole

const ROLES: LiveRole[] = ["owner", "admin", "manager", "tech", "viewer"]

const ROLE_META: Record<
  LiveRole,
  { label: string; color: string; bg: string; description: string }
> = {
  owner: {
    label: "Owner",
    color: "#7c3aed",
    bg: "#f5f3ff",
    description: ROLE_BEHAVIOR_SUMMARY.owner,
  },
  admin: {
    label: "Admin",
    color: "#1d4ed8",
    bg: "#eff6ff",
    description: ROLE_BEHAVIOR_SUMMARY.admin,
  },
  manager: {
    label: "Manager",
    color: "#0369a1",
    bg: "#f0f9ff",
    description: ROLE_BEHAVIOR_SUMMARY.manager,
  },
  tech: {
    label: "Technician",
    color: "#b45309",
    bg: "#fffbeb",
    description: ROLE_BEHAVIOR_SUMMARY.tech,
  },
  viewer: {
    label: "Viewer",
    color: "#6b7280",
    bg: "#f9fafb",
    description: ROLE_BEHAVIOR_SUMMARY.viewer,
  },
}

const SURFACE_ORDER: Array<{
  surface: CapabilityMetadata["surface"]
  group: string
}> = [
  { surface: "settings", group: "Workspace & administration" },
  { surface: "billing", group: "Billing & finance" },
  { surface: "invoices", group: "Invoices" },
  { surface: "quotes", group: "Quotes" },
  { surface: "work-orders", group: "Work orders" },
  { surface: "dispatch", group: "Dispatch" },
  { surface: "inventory", group: "Inventory" },
  { surface: "certificates", group: "Certificates" },
  { surface: "technicians", group: "Technicians" },
  { surface: "automations", group: "Automations" },
  { surface: "reports", group: "Reports & insights" },
  { surface: "general", group: "General" },
]

type LiveRow = {
  key: OrgPermissionKey
  label: string
  description: string
  perms: Record<LiveRole, boolean>
}

type LiveGroup = {
  group: string
  surface: CapabilityMetadata["surface"]
  rows: LiveRow[]
}

function buildLiveGroups(): LiveGroup[] {
  const permsByRole: Record<LiveRole, OrgPermissions> = {
    owner: getOrgPermissionsForRole("owner"),
    admin: getOrgPermissionsForRole("admin"),
    manager: getOrgPermissionsForRole("manager"),
    tech: getOrgPermissionsForRole("tech"),
    viewer: getOrgPermissionsForRole("viewer"),
  }

  const entries = Object.entries(CAPABILITY_METADATA) as Array<
    [OrgPermissionKey, CapabilityMetadata]
  >

  const bySurface = new Map<CapabilityMetadata["surface"], LiveRow[]>()
  for (const [key, meta] of entries) {
    const row: LiveRow = {
      key,
      label: meta.label,
      description: meta.description,
      perms: {
        owner: Boolean(permsByRole.owner[key]),
        admin: Boolean(permsByRole.admin[key]),
        manager: Boolean(permsByRole.manager[key]),
        tech: Boolean(permsByRole.tech[key]),
        viewer: Boolean(permsByRole.viewer[key]),
      },
    }
    const arr = bySurface.get(meta.surface) ?? []
    arr.push(row)
    bySurface.set(meta.surface, arr)
  }

  return SURFACE_ORDER.flatMap(({ surface, group }) => {
    const rows = bySurface.get(surface)
    if (!rows || rows.length === 0) return []
    rows.sort((a, b) => a.label.localeCompare(b.label))
    return [{ group, surface, rows }]
  })
}

function PermIcon({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <Check size={13} className="ds-icon-success mx-auto" aria-label="Allowed" />
  ) : (
    <X size={13} className="text-muted-foreground/35 mx-auto" aria-label="Not allowed" />
  )
}

export default function PermissionsPage() {
  const { role: viewerRole, status: viewerStatus } = useOrgPermissions()
  const groups = React.useMemo(buildLiveGroups, [])
  const totalCapabilities = groups.reduce((acc, g) => acc + g.rows.length, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-2.5 rounded-lg border ds-alert-info px-5 py-4">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 ds-icon-info" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Live capability map</p>
          <p className="text-xs leading-relaxed">
            This matrix is generated from the role-based permission model used
            by the app. UI gates and API guards both consult the same map, so
            anything you see here is what the system actually enforces. Showing
            {" "}
            <span className="font-medium">{totalCapabilities}</span> capabilities
            across <span className="font-medium">{ROLES.length}</span> built-in
            roles.
          </p>
          {viewerStatus === "ready" && viewerRole ? (
            <p className="text-[11px] text-muted-foreground/80">
              Your role: <span className="font-medium">{ROLE_META[viewerRole].label}</span> —
              {" "}
              {ROLE_BEHAVIOR_SUMMARY[viewerRole]}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {ROLES.map((role) => {
          const meta = ROLE_META[role]
          const isViewerRole = viewerStatus === "ready" && viewerRole === role
          return (
            <div
              key={role}
              className={`bg-card border rounded-lg p-4 flex flex-col gap-1.5 ${
                isViewerRole ? "border-primary/60 ring-1 ring-primary/30" : "border-border"
              }`}
            >
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full self-start"
                style={{ color: meta.color, background: meta.bg }}
              >
                {meta.label}
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {meta.description}
              </p>
              {isViewerRole ? (
                <span className="mt-auto pt-1 text-[10px] font-medium uppercase tracking-wider text-primary">
                  Your role
                </span>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            Role permissions matrix
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            A read-only overview of every capability the system enforces. Custom
            per-user overrides are not yet available.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 dark:bg-card">
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground w-72 min-w-[18rem]">
                  Capability
                </th>
                {ROLES.map((role) => {
                  const meta = ROLE_META[role]
                  return (
                    <th key={role} className="text-center px-3 py-3 min-w-[100px]">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ color: meta.color, background: meta.bg }}
                      >
                        {meta.label}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <React.Fragment key={group.group}>
                  <tr className="bg-secondary/30">
                    <td colSpan={ROLES.length + 1} className="px-6 py-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {group.group}
                      </span>
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr
                      key={row.key}
                      className="border-t border-border/50 hover:bg-secondary/20 transition-colors"
                    >
                      <td className="px-6 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-foreground">{row.label}</span>
                          <span
                            className="text-[10px] text-muted-foreground/80 leading-relaxed"
                            title={row.key}
                          >
                            {row.description}
                          </span>
                        </div>
                      </td>
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
            Granular per-permission overrides and custom roles are on the
            roadmap. Until then, role assignments above (managed in{" "}
            <a href="/settings/team" className="underline font-medium">
              Team settings
            </a>
            ) are the source of truth, enforced by both UI gates and API guards.
          </p>
        </div>
      </div>
    </div>
  )
}
