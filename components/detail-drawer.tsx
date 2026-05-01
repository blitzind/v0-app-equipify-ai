"use client"

import { useEffect, useCallback } from "react"
import { X, ChevronRight, ExternalLink, CheckCircle2, Clock, AlertTriangle, Download, FileText, Printer } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// ─── Shared drawer shell ──────────────────────────────────────────────────────

interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  width?: "md" | "lg" | "xl" | "2xl"
  /** When true, disables the built-in scrollable body so children can manage their own scroll */
  noScroll?: boolean
}

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  actions,
  children,
  width = "md",
  noScroll = false,
}: DetailDrawerProps) {

  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose() },
    [onClose]
  )

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKey)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [open, handleKey])

  const widthClass = width === "2xl" ? "max-w-4xl" : width === "xl" ? "max-w-2xl" : width === "lg" ? "max-w-xl" : "max-w-lg"

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]",
          "transition-opacity duration-300 ease-in-out",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full bg-background border-l border-border shadow-2xl",
          "flex flex-col transition-transform duration-300 ease-in-out will-change-transform",
          widthClass,
          open ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-foreground leading-tight truncate">{title}</h2>
              {badge}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action buttons row */}
        {actions && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border shrink-0 flex-wrap">
            {actions}
          </div>
        )}

        {/* Body */}
        <div className={noScroll ? "flex flex-col flex-1 min-h-0 overflow-hidden" : "flex-1 overflow-y-auto px-5 py-5 space-y-5"}>
          {children}
        </div>
      </div>
    </>
  )
}

// ─── Re-usable drawer section ─────────────────────────────────────────────────

export function DrawerSection({
  title,
  children,
  className,
  action,
}: {
  title: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  )
}

export function DrawerRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-1.5 border-b border-border/50 last:border-0", className)}>
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <span className="text-xs font-medium text-foreground text-right">{value}</span>
    </div>
  )
}

export function DrawerTimeline({ items }: {
  items: { date: string; label: string; description?: string; accent?: "success" | "warning" | "danger" | "muted" }[]
}) {
  const accentMap = {
    success: "bg-[color:var(--status-success)]",
    warning: "bg-[color:var(--status-warning)]",
    danger: "bg-destructive",
    muted: "bg-muted-foreground",
  }

  return (
    <div className="relative pl-4">
      {/* Vertical line */}
      <div className="absolute left-1.5 top-2 bottom-2 w-px bg-border" />
      <div className="flex flex-col gap-4">
        {items.map((item, i) => (
          <div key={i} className="relative flex gap-3">
            <div className={cn(
              "absolute -left-4 top-1 w-2 h-2 rounded-full border-2 border-background shrink-0",
              accentMap[item.accent ?? "muted"]
            )} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-foreground">{item.label}</span>
                <span className="text-[10px] text-muted-foreground">{item.date}</span>
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DrawerLineItems({ items, total }: {
  items: { description: string; qty: number; unit: number }[]
  total: number
}) {
  function fmt$(n: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Description</th>
            <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-10">Qty</th>
            <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-16">Unit</th>
            <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-16">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item, i) => (
            <tr key={i} className="bg-card">
              <td className="px-3 py-2 text-foreground">{item.description}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{item.qty}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{fmt$(item.unit)}</td>
              <td className="px-3 py-2 text-right font-medium text-foreground">{fmt$(item.qty * item.unit)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/40 border-t border-border">
          <tr>
            <td colSpan={3} className="px-3 py-2 text-right font-semibold text-foreground text-xs uppercase tracking-wide">Total</td>
            <td className="px-3 py-2 text-right font-bold text-foreground">{fmt$(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Toast component ──────────────────────────────────────────────────────────

export interface ToastItem { id: number; message: string; type?: "success" | "info" }

export function DrawerToastStack({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[200] flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto",
            "animate-in slide-in-from-right-4 fade-in duration-200",
            t.type === "success" || t.type == null
              ? "bg-[color:var(--status-success)] text-white"
              : "bg-foreground text-background"
          )}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {t.message}
          <button onClick={() => onRemove(t.id)} aria-label="Dismiss" className="ml-1 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
