"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Bell,
  BellRing,
  ChevronDown,
  ChevronRight,
  CreditCard,
  LogOut,
  Plug,
  Settings,
  Shield,
  ShieldCheck,
  User,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useTenant } from "@/lib/tenant-store"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { getOrgPermissionsForRole, type OrgMemberRole, type OrgPermissions } from "@/lib/permissions/model"
import { planBadgeFromWorkspace } from "@/lib/plan-display"
import { useAdmin } from "@/lib/admin-store"
import { useActiveOrganizationOptional } from "@/lib/active-organization-context"
import { clearAuthSessionClientStorage } from "@/lib/auth/session-context-storage"
import { logSessionContextDiagnostics } from "@/lib/auth/session-context-diagnostics"
import { initialsFromDisplayLabel } from "@/lib/user-display"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import {
  NAV_HUB_TRIGGER_OPEN,
  NAV_ICON_INACTIVE_CARD,
  NAV_LAUNCHER_ROW_LAYOUT,
  NAV_PRIMARY_ROW_MOTION,
  NAV_ROW_INACTIVE_HOVER_CARD,
} from "@/lib/navigation-chrome"
import { formatRelativeTime } from "@/lib/notifications/format-relative"
import { communicationEventPresentation } from "@/lib/notifications/event-icons"
import { hrefForRelatedEntity } from "@/lib/notifications/event-links"

export const WORKSPACE_TOPBAR_ACCOUNT_CONTROLS_QA_MARKER = "workspace-topbar-account-controls-v1" as const

type FeedPreview = {
  id: string
  title: string
  summary: string | null
  created_at: string
  event_type: string
  channel: string
  is_read?: boolean
  related_entity_type: string | null
  related_entity_id: string | null
}

function formatOrganizationMemberRole(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Order matches Equipify account hub hierarchy (see app-topbar launcher grid). */
const LAUNCHER_LINKS = [
  { icon: User, label: "My Profile", href: "/settings/general" },
  { icon: BellRing, label: "Notifications", href: "/settings/notifications" },
  { icon: Bell, label: "Communications", href: "/communications" },
  { icon: Users, label: "Team", href: "/settings/team" },
  { icon: CreditCard, label: "Billing", href: "/settings/billing" },
  { icon: Plug, label: "Integrations", href: "/settings/integrations" },
  { icon: Shield, label: "Security", href: "/settings/security" },
  { icon: Settings, label: "Settings", href: "/settings/general" },
  { icon: ShieldCheck, label: "Platform Admin", href: "/admin" },
] as const

function resolveLauncherNavPermissions(args: {
  role: OrgMemberRole | null
  status: "loading" | "ready" | "no_org"
}): OrgPermissions {
  if (args.status === "loading") return getOrgPermissionsForRole(null)
  if (args.status !== "ready" || !args.role) return getOrgPermissionsForRole(null)
  return getOrgPermissionsForRole(args.role)
}

/** Core topbar notifications + account/settings hub — shared by Core and Growth. */
export function WorkspaceTopbarAccountControls() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { sessionIdentity, sessionIdentityLoading, isPlatformAdmin, clearSessionIdentity } = useAdmin()
  const activeOrgOpt = useActiveOrganizationOptional()
  const [orgRoleLabel, setOrgRoleLabel] = useState<string | null>(null)
  const { workspace } = useTenant()
  const { role, status: permissionsStatus } = useOrgPermissions()
  const planBadge = planBadgeFromWorkspace(workspace)
  const subscriptionChrome =
    workspace.organizationSubscription === undefined
      ? "Active"
      : workspace.organizationSubscription === null
        ? "Unassigned"
        : workspace.subscriptionStatus === "trialing"
          ? "Trialing"
          : workspace.subscriptionStatus === "past_due"
            ? "Past due"
            : workspace.subscriptionStatus === "canceled"
              ? "Canceled"
              : "Active"
  const [notifFeed, setNotifFeed] = useState<FeedPreview[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [hubOpen, setHubOpen] = useState(false)
  const hubRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const hubRoleLabel =
    orgRoleLabel ??
    (!sessionIdentityLoading && sessionIdentity?.platformAdmin
      ? (sessionIdentity.platformRoleLabel ?? "Platform Admin")
      : null) ??
    (sessionIdentityLoading ? "…" : "Member")

  const menuDisplayName =
    sessionIdentity?.displayName?.trim() ||
    sessionIdentity?.email?.trim() ||
    (sessionIdentityLoading ? "…" : "Account")

  const menuEmail = sessionIdentity?.email?.trim() ?? ""
  const avatarInitials = initialsFromDisplayLabel(
    sessionIdentity?.displayName?.trim() ? sessionIdentity.displayName : (sessionIdentity?.email ?? ""),
  )

  useEffect(() => {
    const orgId = activeOrgOpt?.organizationId
    if (!orgId) {
      setOrgRoleLabel(null)
      return
    }

    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data: row } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (cancelled) return
      const memberRole = (row as { role: string } | null)?.role
      setOrgRoleLabel(memberRole ? formatOrganizationMemberRole(memberRole) : null)
      logSessionContextDiagnostics({
        label: "topbar_org_role",
        authUserId: user.id,
        profileUserId: user.id,
        profileEmail: sessionIdentity?.email ?? user.email ?? null,
        activeOrganizationId: orgId,
        orgMemberRole: memberRole ?? null,
        platformAdmin: sessionIdentity?.platformAdmin ?? false,
      })
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, activeOrgOpt?.organizationId, sessionIdentity?.email, sessionIdentity?.platformAdmin])

  useEffect(() => {
    const orgId = activeOrgOpt?.organizationId
    if (!orgId) {
      setNotifFeed([])
      setUnreadCount(0)
      return
    }
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications?limit=8`, {
        cache: "no-store",
      })
      const body = (await res.json()) as { events?: FeedPreview[]; unreadCount?: number; error?: string }
      if (cancelled) return
      if (!res.ok) {
        setNotifFeed([])
        setUnreadCount(0)
        return
      }
      setNotifFeed(body.events ?? [])
      setUnreadCount(Number(body.unreadCount ?? 0))
    })()
    return () => {
      cancelled = true
    }
  }, [activeOrgOpt?.organizationId])

  const launcherLinks = useMemo(() => {
    const navPermissions = resolveLauncherNavPermissions({ role, status: permissionsStatus })
    return LAUNCHER_LINKS.filter((link) => {
      if (link.href === "/admin") return isPlatformAdmin
      if (link.href === "/communications") return navPermissions.canViewCommunications
      if (link.href === "/settings/billing") return navPermissions.canViewBilling
      if (link.href === "/settings/integrations") return navPermissions.canManageIntegrations
      if (link.href === "/settings/security") return navPermissions.canManageSecuritySettings
      if (link.href === "/settings/team") return navPermissions.canManageWorkspaceSettings
      if (link.href === "/settings/notifications") return navPermissions.canManageWorkspaceSettings
      return true
    })
  }, [isPlatformAdmin, role, permissionsStatus])

  async function handleNotifClick(n: FeedPreview) {
    const orgId = activeOrgOpt?.organizationId
    if (orgId && n.is_read === false) {
      await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications/${encodeURIComponent(n.id)}/read`, {
        method: "POST",
      })
      setNotifFeed((prev) => prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)))
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    setNotifOpen(false)
    const href = hrefForRelatedEntity(n.related_entity_type, n.related_entity_id) ?? "/communications"
    router.push(href)
  }

  async function markAllRead() {
    const orgId = activeOrgOpt?.organizationId
    if (!orgId) return
    await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    })
    setNotifFeed((prev) => prev.map((item) => ({ ...item, is_read: true })))
    setUnreadCount(0)
  }

  async function handleLogout() {
    clearAuthSessionClientStorage()
    clearSessionIdentity()
    setOrgRoleLabel(null)
    await supabase.auth.signOut()
    setHubOpen(false)
    window.location.assign("/login")
  }

  useEffect(() => {
    if (!hubOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setHubOpen(false)
    }
    function onPointerDown(e: MouseEvent) {
      if (
        hubRef.current &&
        !hubRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setHubOpen(false)
      }
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [hubOpen])

  useEffect(() => {
    setHubOpen(false)
  }, [pathname])

  return (
    <>
      <div
        className="flex items-center gap-1 ml-auto"
        data-qa-marker={WORKSPACE_TOPBAR_ACCOUNT_CONTROLS_QA_MARKER}
      >
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="relative flex items-center justify-center w-10 h-10 rounded-md hover:bg-sidebar-accent/60 md:hover:bg-muted transition-colors cursor-pointer"
              aria-label={`Notifications — ${unreadCount} unread`}
            >
              <Bell className="w-5 h-5 text-sidebar-foreground md:text-muted-foreground" />
              {unreadCount > 0 ? (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-30" />
                  <span className="relative flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-white text-[10px] font-bold leading-none">
                    {unreadCount}
                  </span>
                </span>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
                {unreadCount > 0 ? (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {unreadCount} new
                  </Badge>
                ) : null}
              </div>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void markAllRead()
                  }}
                  className="text-[10px] font-medium text-primary hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              ) : null}
            </div>

            <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
              {notifFeed.length === 0 ? (
                <div className="px-4 py-8 text-center space-y-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Bell className="h-5 w-5 text-muted-foreground" aria-hidden />
                  </div>
                  <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    New alerts will appear here when there&apos;s activity in your workspace.
                  </p>
                </div>
              ) : (
                notifFeed.map((n) => {
                  const unread = n.is_read === false
                  const { Icon, iconColor } = communicationEventPresentation(n.event_type, n.channel)
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => void handleNotifClick(n)}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer",
                        "transition-colors duration-100 ds-hover-list-row-menu",
                        unread ? "bg-primary/[0.03]" : "bg-card",
                      )}
                      aria-label={`${n.title}: ${n.summary ?? ""}`}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5",
                          unread ? "bg-primary/10" : "bg-muted",
                        )}
                      >
                        <Icon className={cn("w-4 h-4", unread ? iconColor : "text-muted-foreground")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {unread ? <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" /> : null}
                          <p
                            className={cn(
                              "text-xs font-semibold leading-tight truncate",
                              unread ? "text-foreground" : "text-foreground/80 pl-3",
                            )}
                          >
                            {n.title}
                          </p>
                        </div>
                        {n.summary ? (
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2 pl-3.5">
                            {n.summary}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5 ds-tabular">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            <DropdownMenuSeparator className="my-0" />
            <div className="px-4 py-2.5">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(false)
                  router.push("/communications")
                }}
                className="w-full text-center text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                Open communications center
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          ref={triggerRef}
          type="button"
          onClick={() => setHubOpen((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer",
            NAV_PRIMARY_ROW_MOTION,
            hubOpen ? NAV_HUB_TRIGGER_OPEN : "hover:bg-blue-500/[0.10]",
          )}
          aria-label="Account menu"
          aria-expanded={hubOpen}
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
            {avatarInitials}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-foreground leading-tight">{menuDisplayName}</p>
            <p className="text-xs text-muted-foreground leading-tight">{hubRoleLabel}</p>
          </div>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-muted-foreground hidden md:block transition-transform duration-150",
              hubOpen && "rotate-180",
            )}
          />
        </button>
      </div>

      {hubOpen ? (
        <div
          ref={hubRef}
          className="absolute top-[calc(100%+6px)] right-2 md:right-4 z-50 w-[calc(100vw-1rem)] max-w-[480px] bg-card border border-border rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden"
          role="dialog"
          aria-label="Account settings hub"
        >
          <div className="flex items-center gap-3 px-5 py-4 bg-secondary/40 border-b border-border">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              {avatarInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">{menuDisplayName}</p>
              <p className="text-xs text-muted-foreground truncate">{menuEmail || "—"}</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              {hubRoleLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-0.5 p-2.5">
            {launcherLinks.map(({ icon: Icon, label, href }) => (
              <Link
                key={`${href}::${label}`}
                href={href}
                onClick={() => setHubOpen(false)}
                className={cn(NAV_LAUNCHER_ROW_LAYOUT, NAV_PRIMARY_ROW_MOTION, NAV_ROW_INACTIVE_HOVER_CARD)}
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary border border-border shrink-0 transition-all duration-150">
                  <Icon className={cn("w-3.5 h-3.5 transition-all duration-150", NAV_ICON_INACTIVE_CARD)} />
                </div>
                <span className="text-xs font-medium">{label}</span>
                <ChevronRight className="w-3 h-3 text-foreground/30 shrink-0 ml-auto opacity-0 group-hover:opacity-100 group-hover:text-foreground/50 transition-all duration-150" />
              </Link>
            ))}
          </div>

          <div className="border-t border-border px-5 py-3 flex items-center justify-between bg-secondary/20">
            <p className="text-[10px] text-muted-foreground">
              Equipify.ai &middot; {planBadge.label} &middot;{" "}
              <span
                className="font-medium"
                style={{
                  color:
                    subscriptionChrome === "Active"
                      ? "var(--status-success)"
                      : subscriptionChrome === "Unassigned"
                        ? "var(--muted-foreground)"
                        : undefined,
                }}
              >
                {subscriptionChrome}
              </span>
            </p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
