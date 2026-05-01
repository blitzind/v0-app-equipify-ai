"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useQuickAddDispatch } from "@/lib/quick-add-context"
import type { QuickAddAction } from "@/lib/quick-add-context"
import {
  LayoutDashboard, CalendarClock, Users, MoreHorizontal, Plus,
  Wrench, ClipboardList, FileText, Receipt, BarChart3, Sparkles,
  Settings, X, UserPlus, CalendarPlus, ClipboardPlus, FilePlus, ReceiptText,
} from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCENT = "#f59f1c"

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname.startsWith(href)
}

// ─── BottomSheet ──────────────────────────────────────────────────────────────

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[90] bg-black/40 transition-opacity duration-200 lg:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[91] lg:hidden",
          "bg-background rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.15)]",
          "transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </>
  )
}

// ─── QuickAddSheet ────────────────────────────────────────────────────────────

// Map each action to the page it lives on
const ACTION_ROUTES: Record<QuickAddAction, string> = {
  "new-customer":    "/customers",
  "new-equipment":   "/equipment",
  "new-work-order":  "/work-orders",
  "new-quote":       "/quotes",
  "new-invoice":     "/invoices",
  "schedule-service": "/service-schedule",
}

function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useQuickAddDispatch()
  const router = useRouter()
  const pathname = usePathname()

  function fire(action: QuickAddAction) {
    onClose()
    const target = ACTION_ROUTES[action]
    if (pathname === target) {
      // Already on the right page — use context broadcast
      setTimeout(() => dispatch(action), 80)
    } else {
      // Navigate to the target page with ?action= param so it opens the modal on mount
      router.push(`${target}?action=${action}`)
    }
  }

  const items: { icon: React.ElementType; label: string; action: QuickAddAction }[] = [
    { icon: UserPlus,      label: "Add Customer",    action: "new-customer" },
    { icon: Wrench,        label: "Add Equipment",   action: "new-equipment" },
    { icon: CalendarPlus,  label: "Schedule Service", action: "schedule-service" },
    { icon: ClipboardPlus, label: "New Work Order",  action: "new-work-order" },
    { icon: FilePlus,      label: "Create Quote",    action: "new-quote" },
    { icon: ReceiptText,   label: "Create Invoice",  action: "new-invoice" },
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
              onClick={() => fire(action)}
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

// ─── MoreSheet ────────────────────────────────────────────────────────────────

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()

  const items = [
    { icon: Wrench,        label: "Equipment",  href: "/equipment" },
    { icon: ClipboardList, label: "Work Orders", href: "/work-orders" },
    { icon: FileText,      label: "Quotes",      href: "/quotes" },
    { icon: Receipt,       label: "Invoices",    href: "/invoices" },
    { icon: BarChart3,     label: "Reports",     href: "/reports" },
    { icon: Sparkles,      label: "AI Insights", href: "/insights" },
    { icon: Settings,      label: "Settings",    href: "/settings/workspace" },
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
                className="flex items-center gap-3 py-3.5 transition-colors"
                style={active ? { color: ACCENT } : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: active ? ACCENT : "var(--muted-foreground)" }} />
                <span className={cn("text-sm", active && "font-semibold")}>{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </BottomSheet>
  )
}

// ─── MobileBottomNav ──────────────────────────────────────────────────────────

export function MobileBottomNav() {
  const pathname = usePathname()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const navItems: ({ icon: React.ElementType; label: string; href: string } | null)[] = [
    { icon: LayoutDashboard, label: "Home",      href: "/" },
    { icon: CalendarClock,   label: "Schedule",  href: "/service-schedule" },
    null, // center FAB
    { icon: Users,           label: "Customers", href: "/customers" },
    { icon: MoreHorizontal,  label: "More",      href: "" },
  ]

  return (
    <>
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
                    <span className="text-[10px] font-medium mt-1" style={{ color: ACCENT }}>Add</span>
                  </div>
                )
              }

              const { icon: Icon, label, href } = item

              if (href === "") {
                const active = moreOpen
                return (
                  <button
                    key="more"
                    onClick={() => setMoreOpen(true)}
                    className="flex flex-col items-center gap-1 px-3 py-1 min-w-[52px] active:opacity-70 transition-opacity"
                    aria-label="More"
                  >
                    <Icon className="w-5 h-5" style={{ color: active ? ACCENT : "var(--muted-foreground)" }} />
                    <span className="text-[10px] font-medium" style={{ color: active ? ACCENT : "var(--muted-foreground)" }}>More</span>
                  </button>
                )
              }

              const active = isActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-1 px-3 py-1 min-w-[52px] active:opacity-70 transition-opacity"
                  aria-label={label}
                >
                  <Icon className="w-5 h-5" style={{ color: active ? ACCENT : "var(--muted-foreground)" }} />
                  <span className="text-[10px] font-medium" style={{ color: active ? ACCENT : "var(--muted-foreground)" }}>{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
