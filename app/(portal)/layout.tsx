"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  Calendar,
  FileText,
  Receipt,
  FilePen,
  UserCog,
  Bell,
  LogOut,
  ChevronDown,
  Settings,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Simulated logged-in customer — Riverstone Logistics (CUS-001)
const PORTAL_CUSTOMER = {
  id: "CUS-001",
  name: "Dale Whitmore",
  company: "Riverstone Logistics",
  initials: "DW",
  email: "dale@riverstonelogistics.com",
}

const NAV_ITEMS = [
  { href: "/portal", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/portal/equipment", label: "Equipment", icon: Wrench },
  { href: "/portal/work-orders", label: "Work Orders", icon: ClipboardList },
  { href: "/portal/maintenance", label: "Maintenance", icon: Calendar },
  { href: "/portal/invoices", label: "Invoices", icon: Receipt },
  { href: "/portal/quotes", label: "Quotes", icon: FilePen },
  { href: "/portal/reports", label: "Reports", icon: FileText },
]

function NavLink({ href, label, icon: Icon, exact }: (typeof NAV_ITEMS)[number]) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
        active
          ? "text-[--portal-accent] bg-[--portal-accent-muted]"
          : "text-[--portal-nav-text] hover:text-[--portal-foreground] hover:bg-[--portal-hover]"
      )}
    >
      <Icon size={15} className={active ? "text-[--portal-accent]" : "text-[--portal-nav-icon]"} />
      {label}
    </Link>
  )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--portal-bg)" }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: "var(--portal-surface)", borderColor: "var(--portal-border)" }}
      >
        <div className="max-w-screen-xl mx-auto px-6 flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <Link href="/portal" className="flex items-center gap-2 mr-2">
              <span
                className="flex items-center justify-center w-7 h-7 rounded-md text-white text-xs font-bold"
                style={{ background: "var(--portal-accent)" }}
              >
                E
              </span>
              <span className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
                Equipify
                <span className="font-normal ml-0.5" style={{ color: "var(--portal-accent)" }}>
                  .ai
                </span>
              </span>
            </Link>

            {/* Nav */}
            <nav className="hidden md:flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button
              className="relative flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-[--portal-hover]"
              aria-label="Notifications"
            >
              <Bell size={16} style={{ color: "var(--portal-nav-icon)" }} />
              <span
                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--portal-accent)" }}
              />
            </button>

            {/* Account dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors hover:bg-[--portal-hover]">
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold text-white"
                    style={{ background: "var(--portal-accent)" }}
                  >
                    {PORTAL_CUSTOMER.initials}
                  </span>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-medium leading-none" style={{ color: "var(--portal-foreground)" }}>
                      {PORTAL_CUSTOMER.name}
                    </p>
                    <p className="text-[11px] leading-none mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                      {PORTAL_CUSTOMER.company}
                    </p>
                  </div>
                  <ChevronDown size={12} style={{ color: "var(--portal-nav-icon)" }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link href="/portal/account" className="flex items-center gap-2">
                    <UserCog size={14} /> Account &amp; Contacts
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/portal" className="flex items-center gap-2">
                    <Settings size={14} /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/" className="flex items-center gap-2 text-destructive">
                    <LogOut size={14} /> Sign out
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-screen-xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
