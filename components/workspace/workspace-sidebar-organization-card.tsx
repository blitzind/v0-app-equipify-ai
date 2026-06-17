"use client"

import { useState } from "react"
import Link from "next/link"
import { Building2, Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTenant } from "@/lib/tenant-store"
import { useActiveOrganization } from "@/lib/active-organization-context"
import {
  WORKSPACE_SIDEBAR_GROWTH_ENGINE_LABEL,
  WORKSPACE_SIDEBAR_SCALE_ACCENT_COLOR,
} from "@/lib/workspace/workspace-shell-tokens"

export const WORKSPACE_SIDEBAR_ORGANIZATION_CARD_QA_MARKER = "workspace-sidebar-organization-card-v1" as const

export const WORKSPACE_SIDEBAR_GROWTH_ORGANIZATION_PROPS = {
  secondaryLabel: WORKSPACE_SIDEBAR_GROWTH_ENGINE_LABEL,
  secondaryLabelColor: WORKSPACE_SIDEBAR_SCALE_ACCENT_COLOR,
} as const

type WorkspaceSidebarOrganizationCardProps = {
  collapsed: boolean
  secondaryLabel: string
  secondaryLabelColor: string
  showSupportAccessBadge?: boolean
}

/** Organization context card under sidebar logo — matches Core `AppSidebar` workspace selector. */
export function WorkspaceSidebarOrganizationCard({
  collapsed,
  secondaryLabel,
  secondaryLabelColor,
  showSupportAccessBadge = false,
}: WorkspaceSidebarOrganizationCardProps) {
  const { workspace } = useTenant()
  const {
    organizations,
    organizationId,
    switchOrganization,
    status: orgStatus,
    switching,
  } = useActiveOrganization()
  const [wsMenuOpen, setWsMenuOpen] = useState(false)
  const orgPickerLoading = orgStatus === "loading" || switching
  const showOrgSwitcher = organizations.length > 1

  function toggleWorkspaceMenu() {
    if (!showOrgSwitcher) return
    setWsMenuOpen((v) => !v)
  }

  return (
    <div
      className={cn(
        "relative border-b border-sidebar-border shrink-0",
        collapsed ? "px-0 py-2" : "px-3 py-3",
      )}
      data-qa-marker={WORKSPACE_SIDEBAR_ORGANIZATION_CARD_QA_MARKER}
    >
      <button
        type="button"
        onClick={toggleWorkspaceMenu}
        aria-expanded={showOrgSwitcher ? wsMenuOpen : undefined}
        aria-haspopup={showOrgSwitcher ? "menu" : undefined}
        title={collapsed ? workspace.name : undefined}
        className={cn(
          "flex items-center gap-3 rounded-xl border transition-all duration-150",
          showOrgSwitcher && "hover:border-primary/40 hover:bg-sidebar-accent/50",
          !showOrgSwitcher && "cursor-default",
          collapsed
            ? "mx-auto h-10 w-10 aspect-square shrink-0 grow-0 justify-center p-1 border-transparent bg-transparent hover:bg-sidebar-accent/50"
            : "w-full px-3.5 py-3 border-sidebar-border bg-sidebar-accent/30",
        )}
      >
        {workspace.logoUrl ? (
          <img
            src={workspace.logoUrl}
            alt=""
            className={cn(
              "block h-8 w-8 min-h-8 min-w-8 max-h-8 max-w-8 aspect-square",
              "shrink-0 grow-0 basis-8 select-none",
              "rounded-lg border border-sidebar-border bg-white object-contain",
            )}
          />
        ) : (
          <div
            className={cn(
              "flex h-8 w-8 min-h-8 min-w-8 max-h-8 max-w-8 aspect-square",
              "shrink-0 grow-0 basis-8 select-none items-center justify-center",
              "rounded-lg uppercase text-white text-sm font-bold",
            )}
            style={{ background: workspace.primaryColor }}
            suppressHydrationWarning
          >
            {workspace.name[0]}
          </div>
        )}
        {!collapsed ? (
          <>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">{workspace.name}</p>
              {showSupportAccessBadge ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-400">
                  Support workspace
                </span>
              ) : null}
              <span className="text-[11px] font-semibold" style={{ color: secondaryLabelColor }}>
                {secondaryLabel}
              </span>
            </div>
            {showOrgSwitcher ? (
              <ChevronDown
                size={14}
                className={cn(
                  "shrink-0 text-sidebar-foreground/40 transition-transform duration-150",
                  wsMenuOpen && "rotate-180",
                )}
              />
            ) : null}
          </>
        ) : null}
      </button>

      {wsMenuOpen && showOrgSwitcher && !collapsed ? (
        <div className="absolute top-full left-3 right-3 z-50 mt-1 bg-sidebar border border-sidebar-border rounded-xl shadow-xl overflow-hidden">
          <p className="px-3.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Your organizations
          </p>
          {organizations.length > 0 ? (
            organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                disabled={orgPickerLoading}
                onClick={() => {
                  void (async () => {
                    await switchOrganization(org.id)
                    setWsMenuOpen(false)
                  })()
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-sidebar-accent/50 transition-colors disabled:opacity-50"
              >
                <div
                  className={cn(
                    "flex h-7 w-7 min-h-7 min-w-7 max-h-7 max-w-7 aspect-square",
                    "shrink-0 grow-0 basis-7 items-center justify-center",
                    "rounded-lg uppercase text-white text-[11px] font-bold",
                  )}
                  style={{ background: workspace.primaryColor }}
                >
                  {org.name[0]}
                </div>
                <span className="text-sm text-sidebar-foreground truncate flex-1 text-left">{org.name}</span>
                {org.id === organizationId ? <Check size={13} className="text-primary shrink-0" /> : null}
              </button>
            ))
          ) : (
            <p className="px-3.5 py-3 text-xs text-sidebar-foreground/55">No organizations available.</p>
          )}
          <div className="border-t border-sidebar-border px-3.5 py-2.5">
            <Link
              href="/onboarding"
              onClick={() => setWsMenuOpen(false)}
              className="flex items-center gap-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            >
              <Building2 size={13} /> Create new workspace
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
