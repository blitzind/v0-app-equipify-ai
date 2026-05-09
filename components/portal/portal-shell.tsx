"use client"

import Link from "next/link"
import { useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  Calendar,
  Receipt,
  FilePen,
  FileText,
  Folder,
  UserCog,
  Bell,
  Inbox,
  LogOut,
  ChevronDown,
  Settings,
  ShieldCheck,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PortalWorkspaceBrand } from "@/components/portal/portal-workspace-brand"
import { ProvidedByEquipify } from "@/components/portal/provided-by-equipify"
import { usePortalSession } from "@/components/portal/portal-session-context"

const NAV_ITEMS = [
  { href: "/portal/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/portal/service-requests", label: "Requests", icon: Inbox },
  { href: "/portal/equipment", label: "Equipment", icon: Wrench },
  { href: "/portal/work-orders", label: "Work Orders", icon: ClipboardList },
  { href: "/portal/maintenance", label: "Maintenance", icon: Calendar },
  { href: "/portal/invoices", label: "Invoices", icon: Receipt },
  { href: "/portal/quotes", label: "Quotes", icon: FilePen },
  // Phase: Customer Portal Document Access — single landing page for
  // invoices, certificates, service summaries, and uploaded documents.
  { href: "/portal/documents", label: "Documents", icon: Folder },
  { href: "/portal/reports", label: "Reports", icon: FileText },
  { href: "/portal/certificates", label: "Certificates", icon: ShieldCheck },
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
          : "text-[--portal-nav-text] hover:text-[--portal-foreground] hover:bg-[--portal-hover]",
      )}
    >
      <Icon size={15} className={active ? "text-[--portal-accent]" : "text-[--portal-nav-icon]"} />
      {label}
    </Link>
  )
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { bootstrap, loading, error } = usePortalSession()

  const label = useMemo(() => {
    if (loading) return "…"
    if (error || !bootstrap) return "Portal"
    return bootstrap.displayName
  }, [bootstrap, error, loading])

  const company = useMemo(() => {
    if (!bootstrap) return ""
    return bootstrap.customerCompanyName
  }, [bootstrap])

  const initials = bootstrap?.initials ?? "?"

  async function handleLogout() {
    await fetch("/api/portal/session/logout", { method: "POST" })
    router.replace("/portal/login")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--portal-bg)" }}>
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: "var(--portal-surface)", borderColor: "var(--portal-border)" }}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-y-3 py-2 min-h-14">
          <div className="flex items-start md:items-center gap-4 md:gap-6 min-w-0 flex-1">
            <Link href="/portal/dashboard" className="flex shrink-0 min-w-0 max-w-[min(280px,46vw)] md:max-w-[320px]">
              {loading ? (
                <span className="text-sm font-medium" style={{ color: "var(--portal-nav-text)" }}>
                  Loading…
                </span>
              ) : error || !bootstrap ? (
                <span className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
                  Portal
                </span>
              ) : (
                <PortalWorkspaceBrand
                  organizationName={bootstrap.organizationName}
                  logoUrl={bootstrap.workspaceLogoUrl}
                  size="compact"
                  equipifyVariant="onLight"
                />
              )}
            </Link>

            <nav className="hidden md:flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="relative flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-[--portal-hover]"
              aria-label="Notifications"
            >
              <Bell size={16} style={{ color: "var(--portal-nav-icon)" }} />
              <span
                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--portal-accent)" }}
              />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors hover:bg-[--portal-hover]"
                >
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold text-white"
                    style={{ background: "var(--portal-accent)" }}
                  >
                    {initials}
                  </span>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-medium leading-none" style={{ color: "var(--portal-foreground)" }}>
                      {label}
                    </p>
                    <p className="text-[11px] leading-none mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                      {company || "—"}
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
                  <Link href="/portal/dashboard" className="flex items-center gap-2">
                    <Settings size={14} /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 text-destructive"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8 w-full flex-1">{children}</main>

      {/* Tertiary attribution band — matches main app navigation color (#0F172A).
          Workspace branding remains primary in the header above. */}
      <footer
        className="mt-auto border-t px-4 py-3 sm:px-6 flex items-center justify-center"
        style={{
          borderColor: "rgba(255, 255, 255, 0.06)",
          background: "#0F172A",
        }}
      >
        <ProvidedByEquipify variant="onDark" size="lg" logoHref="https://equipify.ai" />
      </footer>
    </div>
  )
}
