"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { Technician } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import { Mail, Star, Clock, MessageSquare, Shield } from "lucide-react"

let toastCounter = 0

const STATUS_COLORS: Record<string, string> = {
  Available: "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  Busy:      "bg-[color:var(--status-warning)]/15 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  Off:       "bg-muted text-muted-foreground border-border",
}

interface TechnicianDrawerProps {
  techId: string | null
  techs: Technician[]
  onClose: () => void
  onMessage?: (tech: Technician) => void
  onSchedule?: (tech: Technician) => void
}

export function TechnicianDrawer({ techId, techs, onClose, onMessage, onSchedule }: TechnicianDrawerProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const tech = techId ? techs.find((t) => t.id === techId) ?? null : null

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  if (!tech) return null

  const statusCls = STATUS_COLORS[tech.status] ?? STATUS_COLORS.Off

  return (
    <>
      <DetailDrawer
        open={!!techId}
        onClose={onClose}
        title={tech.name}
        subtitle={tech.role}
        width="md"
        badge={
          <Badge variant="outline" className={cn("text-[10px] font-semibold", statusCls)}>
            {tech.status}
          </Badge>
        }
        actions={
          <>
            {onSchedule && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => onSchedule(tech)}>
                <Clock className="w-3.5 h-3.5" /> Schedule
              </Button>
            )}
            {onMessage && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => onMessage(tech)}>
                <MessageSquare className="w-3.5 h-3.5" /> Message
              </Button>
            )}
          </>
        }
      >
        {/* Performance KPIs */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Jobs/wk", value: tech.jobsThisWeek },
            { label: "Done %", value: `${tech.completionPct}%` },
            { label: "Total", value: tech.totalCompleted },
            { label: "Util %", value: `${tech.utilizationPct}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted/40 rounded-lg p-2.5 text-center border border-border">
              <p className="text-sm font-bold text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Star rating */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn("w-4 h-4", i < Math.round(tech.rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25")}
            />
          ))}
          <span className="text-sm font-semibold text-foreground ml-1">{tech.rating.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">/ 5.0</span>
        </div>

        {/* Utilization bars */}
        <DrawerSection title="Performance">
          {[
            { label: "Utilization", pct: tech.utilizationPct, color: "bg-primary" },
            { label: "Completion rate", pct: tech.completionPct, color: "bg-[color:var(--status-success)]" },
          ].map(({ label, pct, color }) => (
            <div key={label} className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{label}</span>
                <span className="font-semibold text-foreground">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          ))}
        </DrawerSection>

        {/* Contact */}
        <DrawerSection title="Contact">
          <DrawerRow label="Email" value={<a href={`mailto:${tech.email}`} className="text-primary hover:underline">{tech.email}</a>} />
          <DrawerRow label="Phone" value={tech.phone} />
          <DrawerRow label="Region" value={tech.region} />
        </DrawerSection>

        {/* Skills */}
        <DrawerSection title="Skills">
          <div className="flex flex-wrap gap-1.5">
            {tech.skills.map((s) => (
              <span key={s} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/20">
                {s}
              </span>
            ))}
          </div>
        </DrawerSection>

        {/* Certifications */}
        <DrawerSection title="Certifications">
          {tech.certifications.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No certifications on file.</p>
          ) : (
            <div className="space-y-1.5">
              {tech.certifications.map((c) => (
                <div key={c} className="flex items-center gap-2 text-xs text-foreground">
                  <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                  {c}
                </div>
              ))}
            </div>
          )}
        </DrawerSection>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
