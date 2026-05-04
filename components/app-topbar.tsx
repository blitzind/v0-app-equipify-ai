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
  AlertCircle, Repeat2, ShieldAlert, CheckCircle2, CalendarClock, UserCog,
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
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import type { LucideIcon } from "lucide-react"

// ─── Notification data ────────────────────────────────────────────────────────

interface Notification {
  id: number
  icon: LucideIcon
  iconColor: string
  title: string
  desc: string
  time: string
  unread: boolean
  href: string           // route to navigate to
  drawerParam?: string   // optional query param to open a specific drawer
}

const NOTIFICATIONS_BY_WORKSPACE: Record<string, Notification[]> = {
  "ws-acme": [
    {
      id: 1,
      icon: AlertCircle,
      iconColor: "text-destructive",
      title: "Overdue: WO-2038",
      desc: "Crane #CR-02 repair past due",
      time: "5m ago",
      unread: true,
      href: "/work-orders",
      drawerParam: "WO-2038",
    },
    {
      id: 2,
      icon: Repeat2,
      iconColor: "text-destructive",
      title: "Repeat Repair Alert",
      desc: "CNC Machine #CNC-3 flagged (4 repairs)",
      time: "1h ago",
      unread: true,
      href: "/insights",
    },
    {
      id: 3,
      icon: Shield,
      iconColor: "text-[oklch(0.50_0.12_70)]",
      title: "Warranty Expiring",
      desc: "Excavator #EX-4 expires in 15 days",
      time: "3h ago",
      unread: true,
      href: "/equipment",
      drawerParam: "EQ-188",
    },
    {
      id: 4,
      icon: CheckCircle2,
      iconColor: "text-[oklch(0.42_0.17_145)]",
      title: "WO-2039 Completed",
      desc: "Tyler Oakes closed HVAC inspection",
      time: "5h ago",
      unread: false,
      href: "/work-orders",
      drawerParam: "WO-2039",
    },
    {
      id: 5,
      icon: CalendarClock,
      iconColor: "text-primary",
      title: "PM Due: Forklift #EQ-188",
      desc: "Toyota 8FGU25 service due Apr 30",
      time: "8h ago",
      unread: false,
      href: "/service-schedule",
    },
    {
      id: 6,
      icon: UserCog,
      iconColor: "text-primary",
      title: "Technician schedule change",
      desc: "Marcus Webb reassigned to WO-2041",
      time: "1d ago",
      unread: false,
      href: "/technicians",
    },
  ],
  "ws-medology": [
    {
      id: 1,
      icon: AlertCircle,
      iconColor: "text-destructive",
      title: "Overdue: MWO-2038",
      desc: "Sacramento Pediatric — OAE calibration past due",
      time: "2h ago",
      unread: true,
      href: "/work-orders",
      drawerParam: "MWO-2038",
    },
    {
      id: 2,
      icon: ShieldAlert,
      iconColor: "text-[oklch(0.50_0.12_70)]",
      title: "Invoice Overdue",
      desc: "MINV-3003 — $390 unpaid (55+ days)",
      time: "4h ago",
      unread: true,
      href: "/invoices",
    },
    {
      id: 3,
      icon: CalendarClock,
      iconColor: "text-primary",
      title: "PM Due: Tympanometer",
      desc: "San Diego Audiology Clinic due May 3",
      time: "8h ago",
      unread: true,
      href: "/service-schedule",
    },
    {
      id: 4,
      icon: CheckCircle2,
      iconColor: "text-[oklch(0.42_0.17_145)]",
      title: "MWO-2034 Completed",
      desc: "Megan Brooks closed LA Hearing Center repair",
      time: "1d ago",
      unread: false,
      href: "/work-orders",
      drawerParam: "MWO-2034",
    },
    {
      id: 5,
      icon: Repeat2,
      iconColor: "text-destructive",
      title: "Repeat Repair Alert",
      desc: "VNG system at Sierra Balance Center flagged",
      time: "2d ago",
      unread: false,
      href: "/insights",
    },
  ],
  "ws-precision-biomedical": [
    {
      id: 1,
      icon: AlertCircle,
      iconColor: "text-destructive",
      title: "Calibration due: infusion pumps",
      desc: "Maple Street Dialysis — four modules due before May 12",
      time: "1h ago",
      unread: true,
      href: "/service-schedule",
    },
    {
      id: 2,
      icon: ShieldAlert,
      iconColor: "text-[oklch(0.50_0.12_70)]",
      title: "Invoice follow-up",
      desc: "PBS-INV-5003 anesthesia deposit — materials management",
      time: "3h ago",
      unread: true,
      href: "/invoices",
    },
    {
      id: 3,
      icon: Repeat2,
      iconColor: "text-destructive",
      title: "Repeat imaging QA flags",
      desc: "Riverstone Imaging Center mobile DR warm-up pattern",
      time: "5h ago",
      unread: true,
      href: "/insights",
    },
    {
      id: 4,
      icon: CheckCircle2,
      iconColor: "text-[oklch(0.42_0.17_145)]",
      title: "PBS-W0004 completed",
      desc: "Sterilizer temperature variance closed at Valley Regional",
      time: "1d ago",
      unread: false,
      href: "/work-orders",
      drawerParam: "PBS-W0004",
    },
    {
      id: 5,
      icon: CalendarClock,
      iconColor: "text-primary",
      title: "OR block: anesthesia checkout",
      desc: "Blue Harbor Rehab — NFPA 99 documentation pack ready",
      time: "1d ago",
      unread: false,
      href: "/technicians",
    },
  ],
}

// ─── Account hub sections ─────────────────────────────────────────────────────

const LAUNCHER_LINKS = [
  { icon: User,        label: "My Profile",      href: "/settings/general" },
  { icon: BellRing,    label: "Notifications",   href: "/settings/notifications" },
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
  const { workspace } = useTenant()
  const workspaceNotifs = NOTIFICATIONS_BY_WORKSPACE[workspace.id] ?? NOTIFICATIONS_BY_WORKSPACE["ws-acme"]
  const [notifications, setNotifications] = useState<Notification[]>(workspaceNotifs)

  // Reset notifications whenever the workspace changes
  useEffect(() => {
    setNotifications(NOTIFICATIONS_BY_WORKSPACE[workspace.id] ?? NOTIFICATIONS_BY_WORKSPACE["ws-acme"])
  }, [workspace.id])
  const [notifOpen, setNotifOpen]   = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [hubOpen, setHubOpen]       = useState(false)
  const hubRef     = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { setMobileOpen } = useContext(SidebarContext)
  const unreadCount = notifications.filter((n) => n.unread).length

  // Mark a notification as read and navigate
  function handleNotifClick(n: Notification) {
    setNotifications((prev) =>
      prev.map((item) => item.id === n.id ? { ...item, unread: false } : item)
    )
    setNotifOpen(false)
    router.push(n.href)
  }

  // Mark all as read
  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
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
      <div className="md:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
        <BrandLogo className="h-7 w-auto max-h-7" priority />
      </div>

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
                  onClick={(e) => { e.stopPropagation(); markAllRead() }}
                  className="text-[10px] font-medium text-primary hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Items */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
              {notifications.map((n) => {
                const Icon = n.icon
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer",
                      "transition-colors duration-100",
                      "hover:bg-muted/60",
                      n.unread ? "bg-primary/[0.03]" : "bg-card"
                    )}
                    aria-label={`${n.title}: ${n.desc}`}
                  >
                    {/* Icon tile */}
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5",
                      n.unread ? "bg-primary/10" : "bg-muted"
                    )}>
                      <Icon className={cn("w-4 h-4", n.unread ? n.iconColor : "text-muted-foreground")} />
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                        <p className={cn(
                          "text-xs font-semibold leading-tight truncate",
                          n.unread ? "text-foreground" : "text-foreground/80 pl-3"
                        )}>
                          {n.title}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-1 pl-3.5">{n.desc}</p>
                    </div>
                    {/* Time */}
                    <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5 ds-tabular">{n.time}</span>
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <DropdownMenuSeparator className="my-0" />
            <div className="px-4 py-2.5">
              <button
                onClick={() => { setNotifOpen(false); router.push("/service-schedule") }}
                className="w-full text-center text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                View all notifications
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Account / Settings Hub trigger */}
        <button
          ref={triggerRef}
          onClick={() => setHubOpen((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors cursor-pointer",
            hubOpen
              ? "bg-sidebar-accent/60 md:bg-muted"
              : "hover:bg-sidebar-accent/60 md:hover:bg-muted"
          )}
          aria-label="Account menu"
          aria-expanded={hubOpen}
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
            AJ
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-foreground leading-tight">Alex Johnson</p>
            <p className="text-xs text-muted-foreground leading-tight">Admin</p>
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
              AJ
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">Alex Johnson</p>
              <p className="text-xs text-muted-foreground truncate">alex.johnson@acmecorp.com</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              Admin
            </span>
          </div>

          {/* Launcher grid */}
          <div className="grid grid-cols-2 gap-1 p-3">
            {LAUNCHER_LINKS.map(({ icon: Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setHubOpen(false)}
                className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary/70 transition-colors"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary border border-border shrink-0 group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{label}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>

          {/* Footer: Session */}
          <div className="border-t border-border px-5 py-3 flex items-center justify-between bg-secondary/20">
            <p className="text-[10px] text-muted-foreground">
              Equipify.ai &middot; Growth Plan &middot; <span className="font-medium" style={{ color: "var(--status-success)" }}>Active</span>
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
