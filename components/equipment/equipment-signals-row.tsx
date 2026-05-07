"use client"

/**
 * Equipment Intelligence — Phase 2
 *
 * Compact inline strip of operational signals for an equipment record.
 * Usable on equipment list rows (table cell + drawer footer) and detail
 * page header. Designed to surface the highest-priority indicator only —
 * if you need every signal, render the equipment detail page.
 */

import * as React from "react"
import { AlertTriangle, RefreshCcw, ShieldCheck, ShieldAlert, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EquipmentSignals } from "@/lib/equipment/intelligence-rollup"

export type EquipmentSignalsRowProps = {
  signals: EquipmentSignals | null | undefined
  /** Show smaller variant for table rows. */
  size?: "sm" | "md"
  className?: string
}

type Chip = {
  key: string
  label: string
  tone: "ok" | "warn" | "danger" | "info" | "muted"
  icon: React.ReactNode
  title?: string
}

const TONE_CLASS: Record<Chip["tone"], string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
  info: "bg-primary/10 text-primary border-primary/30",
  muted: "bg-muted text-muted-foreground border-border",
}

export function EquipmentSignalsRow({
  signals,
  size = "sm",
  className,
}: EquipmentSignalsRowProps) {
  if (!signals) return null

  const chips: Chip[] = []

  if (signals.maintenance === "overdue") {
    chips.push({
      key: "mx-overdue",
      label: "Service overdue",
      tone: "danger",
      icon: <AlertTriangle className="h-3 w-3" />,
      title: "Maintenance or calibration is past due.",
    })
  } else if (signals.maintenance === "due_soon") {
    chips.push({
      key: "mx-due",
      label: "Service due soon",
      tone: "warn",
      icon: <Wrench className="h-3 w-3" />,
      title: "Maintenance or calibration due within 14 days.",
    })
  }

  if (signals.warranty === "expired") {
    chips.push({
      key: "wty-expired",
      label: "Warranty expired",
      tone: "danger",
      icon: <ShieldAlert className="h-3 w-3" />,
    })
  } else if (signals.warranty === "expiring_soon") {
    chips.push({
      key: "wty-expiring",
      label:
        signals.daysToWarrantyExpiry != null && signals.daysToWarrantyExpiry >= 0
          ? `Warranty ${signals.daysToWarrantyExpiry}d`
          : "Warranty soon",
      tone: "warn",
      icon: <ShieldAlert className="h-3 w-3" />,
      title: "Warranty expires within 30 days.",
    })
  } else if (signals.warranty === "active") {
    chips.push({
      key: "wty-ok",
      label: "Warranty",
      tone: "ok",
      icon: <ShieldCheck className="h-3 w-3" />,
      title: "Warranty active.",
    })
  }

  if (signals.repeatRepair) {
    chips.push({
      key: "repeat",
      label: "Repeat repair",
      tone: "warn",
      icon: <RefreshCcw className="h-3 w-3" />,
      title: "2+ repair work orders in the last 90 days.",
    })
  }

  if (signals.openWorkOrderCount > 0) {
    chips.push({
      key: "open-wos",
      label: `${signals.openWorkOrderCount} open WO${signals.openWorkOrderCount === 1 ? "" : "s"}`,
      tone: "info",
      icon: <Wrench className="h-3 w-3" />,
    })
  }

  if (signals.historyCount > 0) {
    chips.push({
      key: "history",
      label: `${signals.historyCount} service${signals.historyCount === 1 ? "" : "s"}`,
      tone: "muted",
      icon: <Wrench className="h-3 w-3" />,
      title: "Lifetime service touches (last 365d).",
    })
  }

  if (chips.length === 0) return null

  const padCls = size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]"

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {chips.map((c) => (
        <span
          key={c.key}
          title={c.title}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border font-medium",
            padCls,
            TONE_CLASS[c.tone],
          )}
        >
          {c.icon}
          {c.label}
        </span>
      ))}
    </div>
  )
}
