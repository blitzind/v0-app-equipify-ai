"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, CalendarClock, Users, MoreHorizontal, Plus,
  Wrench, ClipboardList, FileText, Receipt, BarChart3, Sparkles,
  Settings, X, UserPlus, CalendarPlus, ClipboardPlus, FilePlus, ReceiptText,
} from "lucide-react"

// ─── helpers ──────────────────────────────────────────────────────────────────

const ACCENT = "#f59f1c"

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname.startsWith(href)
}

// ─── Sub-sheets ───────────────────────────────────────────────────────────────

function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[90] bg-black/40 transition-opacity duration-200 lg:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[91] lg:hidden",
          "bg-background rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.15)]",
          "transition-transform duration-300 ease-out",
          // extra bottom padding for home indicator
          "pb-safe",
          open ? "translate-y-0" : "translate-y-full",
        )}
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </>
  )
}

// ─── Quick Add Sheet ──────────────────────────────────────────────────────────

function QuickAddSheet({
  open,
  onClose,
  onSchedule,
}: {
  open: boolean
  onClose: () => void
  onSchedule: () => void
}) {
  const router = useRouter()

  const items = [
    {
      icon: UserPlus,
      label: "Add Customer",
      action: () => { router.push("/customers"); onClose() },
    },
    {
      icon: Wrench,
      label: "Add Equipment",
      action: () => { router.push("/equipment"); onClose() },
    },
    {
      icon: CalendarPlus,
      label: "Schedule Service",
      action: () => { onClose(); onSchedule() },
    },
    {
      icon: ClipboardPlus,
      label: "New Work Order",
      action: () => { router.push("/work-orders"); onClose() },
    },
    {
      icon: FilePlus,
      label: "Create Quote",
      action: () => { router.push("/quotes"); onClose() },
    },
    {
      icon: ReceiptText,
      label: "Create Invoice",
      action: () => { router.push("/invoices"); onClose() },
    },
  ]

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-foreground">Quick Add</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {items.map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={action}
              className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-border bg-muted/30 active:scale-95 transition-transform"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: `${ACCENT}22` }}
              >
                <Icon className="w-5 h-5" style={{ color: ACCENT }} />
              </div>
              <span className="text-[11px] font-medium text-foreground text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  )
}

// ─── More Sheet ───────────────────────────────────────────────────────────────

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()

  const items = [
    { icon: Wrench,        label: "Equipment",   href: "/equipment" },
    { icon: ClipboardList, label: "Work Orders",  href: "/work-orders" },
    { icon: FileText,      label: "Quotes",       href: "/quotes" },
    { icon: Receipt,       label: "Invoices",     href: "/invoices" },
    { icon: BarChart3,     label: "Reports",      href: "/reports" },
    { icon: Sparkles,      label: "AI Insights",  href: "/insights" },
    { icon: Settings,      label: "Settings",     href: "/settings/workspace" },
  ]

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">More</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col divide-y divide-border">
          {items.map(({ icon: Icon, label, href }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 py-3.5 transition-colors",
                  active ? "font-semibold" : "text-foreground",
                )}
                style={active ? { color: ACCENT } : undefined}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" style={active ? { color: ACCENT } : { color: "var(--muted-foreground)" }} />
                <span className="text-sm">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </BottomSheet>
  )
}

// ─── Main Nav ─────────────────────────────────────────────────────────────────

export function MobileBottomNav({
  onScheduleService,
}: {
  onScheduleService?: () => void
}) {
  const pathname = usePathname()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const navItems = [
    { icon: LayoutDashboard, label: "Home",     href: "/" },
    { icon: CalendarClock,   label: "Schedule", href: "/service-schedule" },
    null, // center fab placeholder
    { icon: Users,           label: "Customers", href: "/customers" },
    { icon: MoreHorizontal,  label: "More",     href: null as string | null },
  ]

  return (
    <>
      {/* Nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[80] lg:hidden"
        aria-label="Mobile navigation"
      >
        <div
          className="bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-2px_16px_rgba(0,0,0,0.08)] rounded-t-2xl"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-around px-2 pt-2">
            {navItems.map((item, i) => {
              // Center FAB
              if (item === null) {
                return (
                  <div key="fab" className="flex flex-col items-center" style={{ marginTop: "-18px" }}>
                    <button
                      onClick={() => setQuickAddOpen(true)}
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                      style={{ background: ACCENT }}
                      aria-label="Quick add"
                    >
                      <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
                    </button>
                    <span className="text-[10px] font-medium mt-1" style={{ color: ACCENT }}>
                      Add
                    </span>
                  </div>
                )
              }

              const { icon: Icon, label, href } = item
              const active = href ? isActive(pathname, href) : moreOpen

              if (href === null) {
                // More button
                return (
                  <button
                    key={label}
                    onClick={() => setMoreOpen(true)}
                    className="flex flex-col items-center gap-1 px-3 py-1 min-w-[52px] active:opacity-70 transition-opacity"
                    aria-label={label}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: active ? ACCENT : "var(--muted-foreground)" }}
                    />
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: active ? ACCENT : "var(--muted-foreground)" }}
                    >
                      {label}
                    </span>
                  </button>
                )
              }

              return (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-1 px-3 py-1 min-w-[52px] active:opacity-70 transition-opacity"
                  aria-label={label}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: active ? ACCENT : "var(--muted-foreground)" }}
                  />
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: active ? ACCENT : "var(--muted-foreground)" }}
                  >
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Quick Add sheet */}
      <QuickAddSheet
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSchedule={() => {
          setQuickAddOpen(false)
          onScheduleService?.()
        }}
      />

      {/* More sheet */}
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
