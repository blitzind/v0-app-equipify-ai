"use client"

import { useState, useRef, useEffect, useContext } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell, Search, ChevronDown,
  User, Lock, BellRing,
  Building2, Palette, MapPin, Users,
  CreditCard, Receipt, Wallet, BarChart3,
  Plug, KeyRound, ScrollText,
  LogOut, ChevronRight, Menu, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarContext } from "@/components/app-sidebar"

const notifications = [
  { id: 1, title: "Overdue: WO-2038", desc: "Crane #CR-02 repair past due", time: "5m ago", unread: true },
  { id: 2, title: "Repeat Repair Alert", desc: "CNC Machine #CNC-3 flagged (4 repairs)", time: "1h ago", unread: true },
  { id: 3, title: "Warranty Expiring", desc: "Excavator #EX-4 expires in 15 days", time: "3h ago", unread: true },
  { id: 4, title: "WO-2039 Completed", desc: "Tyler Oakes closed HVAC inspection", time: "5h ago", unread: false },
]

const ACCOUNT_SECTIONS = [
  {
    label: "Account",
    items: [
      { icon: User,    label: "My Profile",          sub: "Edit your name & contact info", href: "/settings/workspace" },
      { icon: Lock,    label: "Password & Security",  sub: "Two-factor auth, password reset", href: "/settings/workspace" },
      { icon: BellRing,label: "Notifications",        sub: "Alerts, digests & preferences", href: "/settings/workspace" },
    ],
  },
  {
    label: "Company",
    items: [
      { icon: Building2, label: "Company Settings", sub: "Name, timezone, date formats", href: "/settings/workspace" },
      { icon: Palette,   label: "Branding",         sub: "Logo, colors & white-label", href: "/settings/workspace" },
      { icon: MapPin,    label: "Locations",         sub: "Manage service regions & sites", href: "/settings/workspace" },
      { icon: Users,     label: "Team Members",      sub: "Invite, roles & seat limits", href: "/settings/team" },
    ],
  },
  {
    label: "Billing",
    items: [
      { icon: CreditCard, label: "Subscription Plan", sub: "Starter · Growth · Enterprise", href: "/settings/billing" },
      { icon: Receipt,    label: "Invoices",           sub: "Download past invoices", href: "/settings/billing" },
      { icon: Wallet,     label: "Payment Methods",    sub: "Cards, ACH & billing email", href: "/settings/billing" },
      { icon: BarChart3,  label: "Usage",              sub: "Seats, equipment & API calls", href: "/settings/billing" },
    ],
  },
  {
    label: "System",
    items: [
      { icon: Plug,       label: "Integrations", sub: "Connect third-party apps", href: "/settings/workspace" },
      { icon: KeyRound,   label: "API Keys",     sub: "Generate & manage API tokens", href: "/settings/workspace" },
      { icon: ScrollText, label: "Audit Log",    sub: "All user actions & changes", href: "/settings/workspace" },
    ],
  },
]

export function AppTopbar() {
  const pathname = usePathname()
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [hubOpen, setHubOpen] = useState(false)
  const hubRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { setMobileOpen } = useContext(SidebarContext)
  const unreadCount = notifications.filter((n) => n.unread).length

  // Close on outside click or ESC
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
    <header className="flex items-center h-14 md:h-16 px-3 md:px-6 bg-card border-b border-border gap-3 shrink-0 relative z-30">
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-md hover:bg-muted transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Search — hidden on mobile unless expanded */}
      <div
        className={cn(
          "items-center gap-2 flex-1 max-w-sm rounded-md border px-3 py-1.5 bg-background",
          "hidden sm:flex",
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

      {/* Mobile search icon */}
      <button
        className="sm:hidden flex items-center justify-center w-9 h-9 rounded-md hover:bg-muted transition-colors"
        aria-label="Search"
        onClick={() => setSearchOpen((v) => !v)}
      >
        <Search className="w-4 h-4 text-muted-foreground" />
      </button>

      <div className="flex items-center gap-2 ml-auto">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative flex items-center justify-center w-9 h-9 rounded-md hover:bg-muted transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-muted-foreground" />
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
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              <Badge variant="secondary" className="text-xs">{unreadCount} new</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.map((n) => (
              <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer">
                <div className="flex items-center gap-2 w-full">
                  {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                  <span className={cn("text-sm font-medium flex-1", !n.unread && "pl-3.5")}>{n.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{n.time}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-3.5">{n.desc}</p>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Account / Settings Hub trigger */}
        <button
          ref={triggerRef}
          onClick={() => setHubOpen((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
            hubOpen ? "bg-muted" : "hover:bg-muted"
          )}
          aria-label="Account menu"
          aria-expanded={hubOpen}
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
            AJ
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-foreground leading-tight">Alex Johnson</p>
            <p className="text-xs text-muted-foreground leading-tight">Admin</p>
          </div>
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground hidden sm:block transition-transform duration-150", hubOpen && "rotate-180")} />
        </button>
      </div>

      {/* Mobile search bar — full-width dropdown */}
      {searchOpen && (
        <div className="sm:hidden absolute top-full left-0 right-0 z-40 bg-card border-b border-border px-4 py-2 flex items-center gap-2 shadow-md">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search equipment, work orders..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
            autoFocus
          />
          <button onClick={() => setSearchOpen(false)} className="text-muted-foreground hover:text-foreground">
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

          {/* Sections grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-border max-h-[70vh] overflow-y-auto">
            {ACCOUNT_SECTIONS.map((section) => (
              <div key={section.label} className="py-3">
                <p className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  {section.label}
                </p>
                {section.items.map(({ icon: Icon, label, sub, href }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setHubOpen(false)}
                    className="group flex items-center gap-3 px-4 py-2 hover:bg-secondary/60 transition-colors"
                  >
                    <div className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary border border-border shrink-0 group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
                      <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{sub}</p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            ))}
          </div>

          {/* Footer: Session */}
          <div className="border-t border-border px-5 py-3 flex items-center justify-between bg-secondary/20">
            <p className="text-[10px] text-muted-foreground">
              Equipify.ai &middot; Growth Plan &middot; <span className="font-medium" style={{ color: "var(--status-success)" }}>Active</span>
            </p>
            <Link
              href="/login"
              onClick={() => setHubOpen(false)}
              className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
