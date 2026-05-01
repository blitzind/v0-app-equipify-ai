"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useWorkOrders } from "@/lib/work-order-store"
import { useWorkspaceData } from "@/lib/tenant-store"
import type { WorkOrder, WorkOrderStatus } from "@/lib/mock-data"
import {
  ChevronLeft, ChevronRight, MapPin, Clock, Wrench, User,
  CheckCircle2, AlertTriangle, Circle, PlayCircle, Package,
  Phone, Mail, CalendarDays, ArrowRight,
} from "lucide-react"
import { AppointmentActions } from "@/components/appointments/appointment-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  })
}

function fmtShortDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  })
}

function isoDate(d: Date) {
  return d.toISOString().split("T")[0]
}

function addDays(base: Date, n: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkOrderStatus, { icon: React.ReactNode; color: string; label: string }> = {
  "Open":        { icon: <Circle className="w-4 h-4" />,         color: "text-[color:var(--status-info)] bg-[color:var(--status-info)]/10 border-[color:var(--status-info)]/30",         label: "Open" },
  "Scheduled":   { icon: <CalendarDays className="w-4 h-4" />,   color: "text-[color:var(--status-info)] bg-[color:var(--status-info)]/10 border-[color:var(--status-info)]/25",         label: "Scheduled" },
  "In Progress": { icon: <PlayCircle className="w-4 h-4" />,     color: "text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10 border-[color:var(--status-warning)]/30", label: "In Progress" },
  "Completed":   { icon: <CheckCircle2 className="w-4 h-4" />,   color: "text-[color:var(--status-success)] bg-[color:var(--status-success)]/10 border-[color:var(--status-success)]/30", label: "Completed" },
  "Invoiced":    { icon: <CheckCircle2 className="w-4 h-4" />,   color: "text-muted-foreground bg-muted border-border",                                                                     label: "Invoiced" },
}

const PRIORITY_DOT: Record<string, string> = {
  "High":     "bg-destructive",
  "Medium":   "bg-[color:var(--status-warning)]",
  "Low":      "bg-[color:var(--status-success)]",
  "Critical": "bg-destructive animate-pulse",
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({
  wo,
  idx,
  onStatusChange,
}: {
  wo: WorkOrder
  idx: number
  onStatusChange: (id: string, status: WorkOrderStatus) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const sc = STATUS_CONFIG[wo.status]

  const nextStatus: WorkOrderStatus | null =
    wo.status === "Scheduled"   ? "In Progress" :
    wo.status === "In Progress" ? "Completed"   : null

  return (
    <div className={cn(
      "rounded-2xl border border-border bg-card overflow-hidden transition-shadow",
      wo.status === "In Progress" && "ring-2 ring-primary/30 shadow-md",
      wo.status === "Completed" && "opacity-70",
    )}>
      {/* Priority bar */}
      <div className={cn("h-1 w-full", PRIORITY_DOT[wo.priority] ?? "bg-border")} />

      <div className="p-4 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
              {idx + 1}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug truncate">{wo.equipmentName}</p>
              <p className="text-xs text-muted-foreground truncate">{wo.customerName}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-[10px] shrink-0 border", sc.color)}>
            <span className="mr-1">{sc.icon}</span>
            {sc.label}
          </Badge>
        </div>

        {/* Location + time row */}
        <div className="flex flex-col gap-1.5">
          {wo.location && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
              <span className="leading-snug">{wo.location}</span>
            </div>
          )}
          {wo.scheduledTime && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span>{wo.scheduledTime}</span>
              {wo.type && <span className="text-muted-foreground/60">· {wo.type}</span>}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="w-3.5 h-3.5 shrink-0 text-primary" />
            <span className="font-mono text-[10px] text-primary">{wo.id}</span>
            <span className="text-muted-foreground/60">· {wo.priority} priority</span>
          </div>
        </div>

        {/* Map + Email actions */}
        {wo.location && (
          <AppointmentActions
            address={wo.location}
            emailParams={{
              customerName:   wo.customerName,
              equipmentName:  wo.equipmentName,
              technicianName: wo.technicianName,
              scheduledDate:  wo.scheduledDate,
              scheduledTime:  wo.scheduledTime,
              address:        wo.location,
              workOrderId:    wo.id,
              ccEmails:       ["service@equipify.ai"],
            }}
          />
        )}

        {/* Expandable description */}
        {wo.description && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-left text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {expanded ? wo.description : `${wo.description.slice(0, 80)}${wo.description.length > 80 ? "..." : ""}`}
            {wo.description.length > 80 && (
              <span className="ml-1 text-primary font-medium">{expanded ? "Less" : "More"}</span>
            )}
          </button>
        )}

        {/* Status action buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          {nextStatus && (
            <Button
              size="sm"
              className="flex-1 gap-1.5 text-xs h-9 cursor-pointer"
              onClick={() => onStatusChange(wo.id, nextStatus)}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              {nextStatus === "In Progress" ? "Start Job" : "Mark Complete"}
            </Button>
          )}
          <Link
            href={`/work-orders/${wo.id}`}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <Wrench className="w-3.5 h-3.5" />
            View WO
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Day strip ────────────────────────────────────────────────────────────────

function DayStrip({
  selectedDate,
  onSelect,
}: {
  selectedDate: string
  onSelect: (d: string) => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 1) // yesterday + 5 more
    return { date: isoDate(d), label: d.toLocaleDateString("en-US", { weekday: "short" }), num: d.getDate() }
  })

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
      {days.map(({ date, label, num }) => {
        const isToday = date === isoDate(today)
        const isSelected = date === selectedDate
        return (
          <button
            key={date}
            type="button"
            onClick={() => onSelect(date)}
            className={cn(
              "flex flex-col items-center justify-center min-w-[48px] py-2 rounded-xl transition-colors cursor-pointer",
              isSelected
                ? "bg-primary text-primary-foreground"
                : isToday
                ? "bg-primary/10 text-primary"
                : "bg-muted/30 text-muted-foreground hover:bg-muted"
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
            <span className={cn("text-lg font-bold leading-tight", isToday && !isSelected && "text-primary")}>
              {num}
            </span>
            {isToday && <span className="w-1.5 h-1.5 rounded-full bg-current mt-0.5 opacity-70" />}
          </button>
        )
      })}
    </div>
  )
}

// ─── Technician selector ──────────────────────────────────────────────────────

function TechSelector({
  selectedId,
  onChange,
  technicians,
}: {
  selectedId: string
  onChange: (id: string) => void
  technicians: { id: string; name: string; avatar: string }[]
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
      {technicians.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer shrink-0",
            selectedId === t.id
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-card border-border text-foreground hover:bg-muted"
          )}
        >
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
            selectedId === t.id ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"
          )}>
            {t.avatar}
          </div>
          <span className="truncate max-w-[80px]">{t.name.split(" ")[0]}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TechnicianDailySchedulePage() {
  const { workOrders, updateStatus } = useWorkOrders()
  const { technicians } = useWorkspaceData()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [selectedDate, setSelectedDate] = useState(isoDate(today))
  const [selectedTechId, setSelectedTechId] = useState(technicians[0]?.id ?? "")

  const selectedTech = technicians.find((t) => t.id === selectedTechId)

  const dayJobs = useMemo(() => {
    return workOrders
      .filter((wo) => wo.technicianId === selectedTechId && wo.scheduledDate === selectedDate)
      .sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""))
  }, [workOrders, selectedTechId, selectedDate])

  const completedCount = dayJobs.filter((j) => j.status === "Completed" || j.status === "Invoiced").length
  const activeJob = dayJobs.find((j) => j.status === "In Progress")

  const techsForSelector = technicians.slice(0, 8).map((t) => ({
    id: t.id,
    name: t.name,
    avatar: t.avatar,
  }))

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto">

      {/* Back link */}
      <div className="flex items-center gap-2">
        <Link
          href="/technicians"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Technicians
        </Link>
        <span className="text-muted-foreground/40 text-sm">/</span>
        <span className="text-sm font-semibold text-foreground">Daily Schedule</span>
      </div>

      {/* Technician selector */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Technician</p>
        <TechSelector
          selectedId={selectedTechId}
          onChange={setSelectedTechId}
          technicians={techsForSelector}
        />
      </div>

      {/* Day strip */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</p>
        <DayStrip selectedDate={selectedDate} onSelect={setSelectedDate} />
      </div>

      {/* Day header */}
      {selectedTech && (
        <div className="rounded-2xl border border-border bg-card p-4 flex items-start gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-base shrink-0">
            {selectedTech.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-foreground">{selectedTech.name}</p>
            <p className="text-xs text-muted-foreground">{selectedTech.role}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <a
                href={`tel:${selectedTech.phone}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Phone className="w-3 h-3" /> {selectedTech.phone}
              </a>
              <a
                href={`mailto:${selectedTech.email}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Mail className="w-3 h-3" /> {selectedTech.email}
              </a>
            </div>
          </div>
          {/* Progress ring */}
          <div className="flex flex-col items-center shrink-0">
            <span className="text-2xl font-bold text-foreground">{completedCount}</span>
            <span className="text-[10px] text-muted-foreground">of {dayJobs.length}</span>
            <span className="text-[10px] text-muted-foreground">done</span>
          </div>
        </div>
      )}

      {/* Active job banner */}
      {activeJob && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
          <PlayCircle className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary">Currently In Progress</p>
            <p className="text-xs text-muted-foreground truncate">{activeJob.equipmentName} · {activeJob.customerName}</p>
          </div>
          <Link
            href={`/work-orders/${activeJob.id}`}
            className="text-xs font-medium text-primary hover:underline shrink-0"
          >
            View
          </Link>
        </div>
      )}

      {/* Day summary pill */}
      {dayJobs.length > 0 && (
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">{fmtDate(selectedDate)}</h2>
          <span className="text-xs text-muted-foreground">{dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Job cards */}
      {dayJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border bg-muted/20">
          <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">No jobs scheduled</p>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedDate === isoDate(today) ? "Nothing on the schedule for today." : `Nothing scheduled for ${fmtShortDate(selectedDate)}.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {dayJobs.map((wo, idx) => (
            <JobCard
              key={wo.id}
              wo={wo}
              idx={idx}
              onStatusChange={(id, status) => updateStatus(id, status)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
