"use client"

import { useState, useRef, useEffect, useContext, useMemo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Bell, Search, ChevronDown,
  User, BellRing, Shield,
  Building2, Users,
  CreditCard, Plug, Settings, ShieldCheck,
  LogOut, ChevronRight, Menu, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarContext } from "@/components/app-sidebar"
import { BrandLogo } from "@/components/brand-logo"
import { useTenant } from "@/lib/tenant-store"
import { planBadgeFromWorkspace } from "@/lib/plan-display"
import { useAdmin } from "@/lib/admin-store"
import { useActiveOrganizationOptional } from "@/lib/active-organization-context"
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

// ─── Account hub sections ─────────────────────────────────────────────────────

function formatOrganizationMemberRole(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const LAUNCHER_LINKS = [
  { icon: User,        label: "My Profile",      href: "/settings/general" },
  { icon: Bell,        label: "Communications",  href: "/communications" },
  { icon: BellRing,    label: "Notification preferences",   href: "/settings/notifications" },
  { icon: Shield,      label: "Security",        href: "/settings/security" },
  { icon: Settings,    label: "Settings",        href: "/settings/general" },
  { icon: Users,       label: "Team",            href: "/settings/team" },
  { icon: CreditCard,  label: "Billing",         href: "/settings/billing" },
  { icon: Plug,        label: "Integrations",    href: "/settings/integrations" },
  { icon: ShieldCheck, label: "Platform Admin",  href: "/admin" },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function AppTopbar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { sessionIdentity, sessionIdentityLoading, platformAdminNavVisible } = useAdmin()
  const activeOrgOpt = useActiveOrganizationOptional()
  const [orgRoleLabel, setOrgRoleLabel] = useState<string | null>(null)
  const { workspace } = useTenant()
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
  const [notifOpen, setNotifOpen]   = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [hubOpen, setHubOpen]       = useState(false)
  const hubRef     = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { setMobileOpen } = useContext(SidebarContext)

  const hubRoleLabel =
    orgRoleLabel ??
    (sessionIdentity?.platformAdmin ? (sessionIdentity.platformRoleLabel ?? "Platform Admin") : null) ??
    "Member"

  const menuDisplayName =
    sessionIdentity?.displayName?.trim() ||
    sessionIdentity?.email?.trim() ||
    (sessionIdentityLoading ? "…" : "Account")

  const menuEmail = sessionIdentity?.email?.trim() ?? ""
  const avatarInitials = initialsFromDisplayLabel(
    sessionIdentity?.displayName?.trim()
      ? sessionIdentity.displayName
      : (sessionIdentity?.email ?? ""),
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
      const role = (row as { role: string } | null)?.role
      setOrgRoleLabel(role ? formatOrganizationMemberRole(role) : null)
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, activeOrgOpt?.organizationId])

  useEffect(() => {
    const orgId = activeOrgOpt?.organizationId
    if (!orgId) {
      setNotifFeed([])
      setUnreadCount(0)
      return
    }
    let cancelled = false
    void (async () => {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(orgId)}/communications?limit=8`,
        { cache: "no-store" },
      )
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

  const launcherLinks = useMemo(
    () =>
      LAUNCHER_LINKS.filter((link) => link.href !== "/admin" || platformAdminNavVisible),
    [platformAdminNavVisible],
  )

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
    await supabase.auth.signOut()
    setHubOpen(false)
    router.push("/login")
  }

  // Close account hub on outside click or ESC
  useEffect(() => {
    if (!hubOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setHubOpen(false) }
    function onPointerDown(e: MouseEvent) {
      if (
        hubRef.current && !hubRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setHubOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [hubOpen])

  // Close hub on route change
  useEffect(() => { setHubOpen(false) }, [pathname])

  return (
    <header className="flex items-center h-14 md:h-16 px-3 md:px-6 bg-sidebar md:bg-card border-b border-sidebar-border md:border-border gap-3 shrink-0 relative z-30 sticky top-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden flex items-center justify-center w-10 h-10 rounded-md hover:bg-sidebar-accent/60 transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-sidebar-foreground" />
      </button>

      {/* Mobile logo — centered absolutely so it doesn't shift layout */}
      <Link
        href="/"
        className="md:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none cursor-pointer"
        aria-label="Equipify — Home"
      >
        <BrandLogo className="h-7 w-auto max-h-7" priority />
      </Link>

      {/* Search — desktop only (sm+), hidden on mobile */}
      <div
        className={cn(
          "items-center gap-2 flex-1 max-w-sm rounded-md border px-3 py-1.5 bg-background",
          "hidden md:flex",
          "transition-all duration-150",
          searchFocused
            ? "border-primary ring-2 ring-primary/20 shadow-[0_0_0_3px_rgba(15,122,229,0.08)]"
            : "border-border hover:border-border/80"
        )}
      >
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search equipment, work orders..."
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground min-w-0"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="relative flex items-center justify-center w-10 h-10 rounded-md hover:bg-sidebar-accent/60 md:hover:bg-muted transition-colors cursor-pointer"
              aria-label={`Notifications — ${unreadCount} unread`}
            >
              <Bell className="w-5 h-5 text-sidebar-foreground md:text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-30" />
                  <span className="relative flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-white text-[10px] font-bold leading-none">
                    {unreadCount}
                  </span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{unreadCount} new</Badge>
                )}
              </div>
              {unreadCount > 0 && (
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
              )}
            </div>

            {/* Items */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
              {notifFeed.length === 0 ? (
                <p className="text-xs text-muted-foreground px-4 py-6 text-center">No notifications yet.</p>
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
                        unread ? "bg-primary/[0.03]" : "bg-card"
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

            {/* Footer */}
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

        {/* Account / Settings Hub trigger */}
        <button
          ref={triggerRef}
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
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground hidden md:block transition-transform duration-150", hubOpen && "rotate-180")} />
        </button>
      </div>

      {/* Mobile search bar — full-width dropdown */}
      {searchOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 z-40 bg-sidebar border-b border-sidebar-border px-4 py-2 flex items-center gap-2 shadow-md">
          <Search className="w-4 h-4 text-sidebar-foreground/60 shrink-0" />
          <input
            type="text"
            placeholder="Search equipment, work orders..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-sidebar-foreground/40 text-sidebar-foreground"
            autoFocus
          />
          <button onClick={() => setSearchOpen(false)} className="text-sidebar-foreground/60 hover:text-sidebar-foreground cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Premium Account Hub Panel */}
      {hubOpen && (
        <div
          ref={hubRef}
          className="absolute top-[calc(100%+6px)] right-2 md:right-4 z-50 w-[calc(100vw-1rem)] max-w-[480px] bg-card border border-border rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden"
          role="dialog"
          aria-label="Account settings hub"
        >
          {/* User header */}
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

          {/* Launcher grid */}
          <div className="grid grid-cols-2 gap-1 p-3">
            {launcherLinks.map(({ icon: Icon, label, href }) => (
              <Link
                key={label}
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

          {/* Footer: Session */}
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
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
