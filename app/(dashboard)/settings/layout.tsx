"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { getOrgPermissionsForRole, type OrgMemberRole, type OrgPermissions } from "@/lib/permissions/model"
import {
  User, Building2, Users, CreditCard, Bell,
  Zap, Plug, Shield, Code2, ScrollText, Wrench, Lock, Globe, Database, Archive, Upload, Sparkles,
} from "lucide-react"
import {
  NAV_ICON_INACTIVE_CARD,
  NAV_PRIMARY_ROW_MOTION,
  NAV_ROW_INACTIVE_HOVER_CARD,
} from "@/lib/navigation-chrome"

type SettingsNavItem = {
  label: string
  href: string
  icon: React.ElementType
  /** Omit or return true to show for every signed-in member. */
  visible?: (p: OrgPermissions) => boolean
}

const NAV_ITEMS: SettingsNavItem[] = [
  { label: "General", href: "/settings/general", icon: User, visible: (p) => p.canManageWorkspaceSettings },
  { label: "Workspace", href: "/settings/workspace", icon: Building2, visible: (p) => p.canManageWorkspaceSettings },
  { label: "Sample data", href: "/settings/sample-data", icon: Database, visible: (p) => p.canManageWorkspaceSettings },
  { label: "Migration center", href: "/settings/imports", icon: Upload, visible: (p) => p.canManageHistoricalImports },
  { label: "Team", href: "/settings/team", icon: Users, visible: (p) => p.canManageWorkspaceSettings },
  { label: "Permissions", href: "/settings/permissions", icon: Lock, visible: (p) => p.canManageWorkspaceSettings },
  { label: "Billing", href: "/settings/billing", icon: CreditCard, visible: (p) => p.canViewBilling },
  { label: "AI Usage", href: "/settings/ai-usage", icon: Sparkles, visible: (p) => p.canViewInsights },
  {
    label: "Notifications",
    href: "/settings/notifications",
    icon: Bell,
    visible: (p) => p.canManageWorkspaceSettings,
  },
  { label: "Automations", href: "/settings/automations", icon: Zap, visible: (p) => p.canManageAutomations },
  { label: "Customer Portal", href: "/settings/portal", icon: Globe, visible: (p) => p.canManagePortalSettings },
  { label: "Integrations", href: "/settings/integrations", icon: Plug, visible: (p) => p.canManageIntegrations },
  { label: "Security", href: "/settings/security", icon: Shield, visible: (p) => p.canManageSecuritySettings },
  { label: "API / Developers", href: "/settings/api", icon: Code2, visible: (p) => p.canManageApiKeys },
  {
    label: "Audit Log",
    href: "/settings/audit-log",
    icon: ScrollText,
    visible: (p) => p.canViewOperationalReports || p.canManageSecuritySettings,
  },
  { label: "Archived", href: "/settings/archived", icon: Archive, visible: (p) => p.canArchiveRecords },
  {
    label: "Equipment Types",
    href: "/settings/equipment-types",
    icon: Wrench,
    visible: (p) => p.canManageWorkspaceSettings,
  },
]

function resolveSettingsNavPermissions(args: {
  role: OrgMemberRole | null
  status: "loading" | "ready" | "no_org"
}): OrgPermissions {
  // Phase 20 retry: settings navigation stays on DB role defaults and fails
  // open while membership loads. Profile overlays are intentionally not used
  // here so owner/admin/manager settings nav cannot disappear on refresh.
  if (args.status !== "ready" || !args.role) return getOrgPermissionsForRole("owner")
  return getOrgPermissionsForRole(args.role)
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { role, status } = useOrgPermissions()
  const navPermissions = resolveSettingsNavPermissions({ role, status })
  const visibleNav = NAV_ITEMS.filter((item) => !item.visible || item.visible(navPermissions))

  return (
    <div className="flex flex-col gap-0 md:gap-5">
      {/* Mobile: scrollable horizontal tab strip */}
      <nav
        className="md:hidden flex items-center gap-1 overflow-x-auto scrollbar-none border-b border-border bg-card px-3 py-2 -mx-4 sticky top-0 z-20"
        aria-label="Settings navigation"
      >
        {visibleNav.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium shrink-0 min-h-[44px]",
                NAV_PRIMARY_ROW_MOTION,
                active
                  ? "bg-primary/10 text-primary"
                  : NAV_ROW_INACTIVE_HOVER_CARD,
              )}
            >
              <Icon size={14} className={active ? "text-primary" : NAV_ICON_INACTIVE_CARD} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="flex gap-8 items-start mt-3 md:mt-0">
        {/* Desktop: left sidebar nav */}
        <nav className="hidden md:flex w-48 shrink-0 flex-col gap-0.5 sticky top-4" aria-label="Settings navigation">
          {visibleNav.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm",
                  NAV_PRIMARY_ROW_MOTION,
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : NAV_ROW_INACTIVE_HOVER_CARD,
                )}
              >
                <Icon size={15} className={active ? "text-primary" : NAV_ICON_INACTIVE_CARD} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0 pb-24 md:pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}
