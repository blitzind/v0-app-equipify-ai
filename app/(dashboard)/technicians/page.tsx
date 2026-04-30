"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { technicians } from "@/lib/mock-data"
import type { Technician, TechStatus, TechSkill } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Star,
  MapPin,
  Phone,
  Mail,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  ClipboardList,
  ShieldCheck,
  X,
  ChevronRight,
  BarChart3,
  AlertTriangle,
  Award,
  User,
  MoreHorizontal,
  MessageSquare,
  Calendar,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "card" | "table"

const ALL_STATUSES: TechStatus[] = ["Available", "On Job", "Off", "Vacation"]
const ALL_SKILLS: TechSkill[] = [
  "HVAC", "Electrical", "Calibration", "Medical Equipment",
  "Industrial Repair", "Installations", "Refrigeration", "Hydraulics", "Welding", "PLC / Controls",
]
const ALL_REGIONS = ["Midwest", "Northeast", "Southeast", "Southwest", "West"]

// ─── Style maps ───────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<TechStatus, string> = {
  "Available": "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "On Job":    "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Off":       "bg-muted text-muted-foreground border-border",
  "Vacation":  "bg-violet-500/10 text-violet-600 border-violet-500/30",
}

const STATUS_DOT: Record<TechStatus, string> = {
  "Available": "bg-[color:var(--status-success)]",
  "On Job":    "bg-[color:var(--status-warning)]",
  "Off":       "bg-muted-foreground",
  "Vacation":  "bg-violet-500",
}

const SCHEDULE_STYLE: Record<string, string> = {
  "Confirmed":  "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Tentative":  "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Completed":  "bg-muted text-muted-foreground border-border",
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500",
  "bg-rose-500", "bg-amber-500", "bg-cyan-500",
]

function avatarColor(id: string) {
  const idx = parseInt(id.replace("T-", ""), 10) - 1
  return AVATAR_COLORS[idx % AVATAR_COLORS.length]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TechStatus }) {
  return (
    <Badge variant="secondary" className={cn("text-xs font-medium border", STATUS_STYLE[status])}>
      <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 inline-block", STATUS_DOT[status])} />
      {status}
    </Badge>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1 text-sm font-medium text-foreground">
      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
      {rating.toFixed(1)}
    </span>
  )
}

function UtilBar({ pct, className }: { pct: number; className?: string }) {
  const color = pct >= 90 ? "bg-[color:var(--status-danger)]" : pct >= 75 ? "bg-[color:var(--status-warning)]" : "bg-primary"
  return (
    <div className={cn("h-1.5 rounded-full bg-muted overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

function TechAvatar({ tech, size = "md" }: { tech: Technician; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "w-14 h-14 text-lg" : size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0", avatarColor(tech.id), sz)}>
      {tech.avatar}
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, iconClass,
}: {
  label: string; value: string | number; sub: string
  icon: React.ElementType; iconClass: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", iconClass)}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Tech Card ───────────────────────────────────────────────────────────────

function TechCard({ tech, onSelect }: { tech: Technician; onSelect: () => void }) {
  return (
    <Card className="hover:border-primary/40 hover:shadow-sm transition-all group">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <TechAvatar tech={tech} />
            <div>
              <p className="font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
                {tech.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{tech.role}</p>
            </div>
          </div>
          <StatusBadge status={tech.status} />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{tech.region}</span>
          <span className="w-px h-3 bg-border" />
          <StarRating rating={tech.rating} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: "Jobs this week", value: tech.jobsThisWeek },
            { label: "Completion", value: `${tech.completionPct}%` },
            { label: "Total jobs", value: tech.totalCompleted },
            { label: "Utilization", value: `${tech.utilizationPct}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-secondary/50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Utilization bar */}
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Utilization</span>
            <span>{tech.utilizationPct}%</span>
          </div>
          <UtilBar pct={tech.utilizationPct} />
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tech.skills.slice(0, 3).map((s) => (
            <span key={s} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/20">
              {s}
            </span>
          ))}
          {tech.skills.length > 3 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              +{tech.skills.length - 3}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <Button size="sm" variant="default" className="flex-1 h-8 text-xs" onClick={onSelect}>
            View
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs px-3">
            <Calendar className="w-3.5 h-3.5 mr-1" />
            Schedule
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs px-3">
            <MessageSquare className="w-3.5 h-3.5 mr-1" />
            Message
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Profile Drawer ───────────────────────────────────────────────────────────

type DrawerTab = "overview" | "schedule" | "certifications" | "history" | "performance"

function ProfileDrawer({ tech, onClose }: { tech: Technician; onClose: () => void }) {
  const [tab, setTab] = useState<DrawerTab>("overview")

  const certExpiringSoon = tech.certifications.filter((c) => {
    const exp = new Date(c.expiryDate)
    const now = new Date("2026-04-30")
    const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 180
  })

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-background border-l border-border shadow-2xl flex flex-col">
        {/* Drawer header */}
        <div className="flex items-start justify-between p-6 border-b border-border shrink-0">
          <div className="flex items-center gap-4">
            <TechAvatar tech={tech} size="lg" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-foreground">{tech.name}</h2>
                <StatusBadge status={tech.status} />
              </div>
              <p className="text-sm text-muted-foreground">{tech.role}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{tech.region}</span>
                <span className="flex items-center gap-1"><StarRating rating={tech.rating} /></span>
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />Since {new Date(tech.hireDate).getFullYear()}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border shrink-0 px-6">
          {(["overview", "schedule", "certifications", "history", "performance"] as DrawerTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "capitalize text-sm py-3 px-3 border-b-2 font-medium transition-colors",
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── Overview ── */}
          {tab === "overview" && (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">{tech.bio}</p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Email", value: tech.email, icon: Mail },
                  { label: "Phone", value: tech.phone, icon: Phone },
                  { label: "Hire Date", value: new Date(tech.hireDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }), icon: CalendarDays },
                  { label: "Region", value: tech.region, icon: MapPin },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                      <Icon className="w-3 h-3" />
                      {label}
                    </div>
                    <p className="text-xs font-medium text-foreground truncate">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {tech.skills.map((s) => (
                    <span key={s} className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/8 text-primary border border-primary/20">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {certExpiringSoon.length > 0 && (
                <div className="rounded-lg border border-[color:var(--status-warning)]/40 bg-[color:var(--status-warning)]/5 p-3">
                  <div className="flex items-center gap-2 text-[color:var(--status-warning)] text-xs font-semibold mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {certExpiringSoon.length} certification{certExpiringSoon.length > 1 ? "s" : ""} expiring within 6 months
                  </div>
                  {certExpiringSoon.map((c) => (
                    <p key={c.name} className="text-xs text-muted-foreground">
                      {c.name} — expires {new Date(c.expiryDate).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}
                    </p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Jobs", value: tech.totalCompleted, icon: ClipboardList },
                  { label: "Completion", value: `${tech.completionPct}%`, icon: CheckCircle2 },
                  { label: "Avg Duration", value: `${tech.avgJobDurationHrs}h`, icon: Clock },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="text-center bg-secondary/50 rounded-lg py-4">
                    <Icon className="w-4 h-4 text-muted-foreground mx-auto mb-2" />
                    <p className="text-lg font-bold text-foreground">{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Schedule ── */}
          {tab === "schedule" && (
            <>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Upcoming Assignments</p>
              {tech.schedule.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No upcoming assignments scheduled.
                </div>
              ) : (
                <div className="space-y-3">
                  {tech.schedule.map((entry) => (
                    <div key={entry.woId} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary leading-none">
                          {new Date(entry.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase()}
                        </span>
                        <span className="text-sm font-bold text-primary leading-none">
                          {new Date(entry.date + "T00:00:00Z").getUTCDate()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-foreground truncate">{entry.jobType}</p>
                          <Badge variant="secondary" className={cn("text-[10px] shrink-0 border", SCHEDULE_STYLE[entry.status])}>
                            {entry.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{entry.customer}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{entry.time} &bull; {entry.woId}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Certifications ── */}
          {tab === "certifications" && (
            <>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Certifications &amp; Licenses</p>
              <div className="space-y-3">
                {tech.certifications.map((cert) => {
                  const exp = new Date(cert.expiryDate)
                  const now = new Date("2026-04-30")
                  const daysLeft = Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  const isExpired = daysLeft < 0
                  const isExpiringSoon = daysLeft >= 0 && daysLeft <= 180

                  return (
                    <div key={cert.name} className={cn(
                      "p-4 rounded-lg border transition-colors",
                      isExpired
                        ? "border-destructive/40 bg-destructive/5"
                        : isExpiringSoon
                          ? "border-[color:var(--status-warning)]/40 bg-[color:var(--status-warning)]/5"
                          : "border-border bg-secondary/30"
                    )}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Award className={cn("w-4 h-4 shrink-0",
                            isExpired ? "text-destructive" : isExpiringSoon ? "text-[color:var(--status-warning)]" : "text-[color:var(--status-success)]"
                          )} />
                          <p className="text-sm font-semibold text-foreground">{cert.name}</p>
                        </div>
                        {isExpired && (
                          <Badge variant="secondary" className="text-[10px] border bg-destructive/10 text-destructive border-destructive/30 shrink-0">Expired</Badge>
                        )}
                        {isExpiringSoon && !isExpired && (
                          <Badge variant="secondary" className="text-[10px] border bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30 shrink-0">Expiring Soon</Badge>
                        )}
                        {!isExpired && !isExpiringSoon && (
                          <Badge variant="secondary" className="text-[10px] border bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30 shrink-0">Valid</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{cert.issuer}</p>
                      <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
                        <span>Issued: {new Date(cert.issuedDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>
                        <span>Expires: {new Date(cert.expiryDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>
                        {!isExpired && <span className={isExpiringSoon ? "text-[color:var(--status-warning)] font-medium" : ""}>{daysLeft} days left</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ── History ── */}
          {tab === "history" && (
            <>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Recent Job History</p>
              {tech.history.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No job history yet.</div>
              ) : (
                <div className="space-y-2">
                  {tech.history.map((entry) => (
                    <div key={entry.woId} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
                      <CheckCircle2 className="w-4 h-4 text-[color:var(--status-success)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-foreground truncate">{entry.jobType}</p>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star key={n} className={cn("w-3 h-3", n <= entry.rating ? "fill-amber-400 text-amber-400" : "text-muted")} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{entry.customer}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {entry.completedDate} &bull; {entry.duration} &bull; {entry.woId}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Performance ── */}
          {tab === "performance" && (
            <>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Performance Summary</p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Jobs Completed", value: tech.totalCompleted, sub: "all time" },
                  { label: "Completion Rate", value: `${tech.completionPct}%`, sub: "first-visit close" },
                  { label: "Customer Rating", value: `${tech.rating}/5.0`, sub: "avg from reviews" },
                  { label: "Utilization", value: `${tech.utilizationPct}%`, sub: "billed time / capacity" },
                  { label: "Jobs This Week", value: tech.jobsThisWeek, sub: "scheduled & active" },
                  { label: "Avg Job Duration", value: `${tech.avgJobDurationHrs}h`, sub: "per work order" },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="bg-secondary/50 rounded-lg p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-xl font-bold text-foreground">{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span className="font-medium text-foreground">Utilization Rate</span>
                  <span>{tech.utilizationPct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", tech.utilizationPct >= 90 ? "bg-[color:var(--status-danger)]" : tech.utilizationPct >= 75 ? "bg-[color:var(--status-warning)]" : "bg-primary")}
                    style={{ width: `${tech.utilizationPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>0%</span>
                  <span className="text-[color:var(--status-warning)]">75% target</span>
                  <span>100%</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Job Completion Rate</p>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-[color:var(--status-success)]" style={{ width: `${tech.completionPct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{tech.completionPct}% of assigned jobs completed on first visit</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Customer Rating</p>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={cn("w-5 h-5", n <= Math.round(tech.rating) ? "fill-amber-400 text-amber-400" : "text-muted")} />
                    ))}
                  </div>
                  <span className="text-xl font-bold text-foreground">{tech.rating.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">/ 5.0 average</span>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Drawer footer */}
        <div className="p-4 border-t border-border flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="flex-1 gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Message
          </Button>
          <Button size="sm" variant="outline" className="flex-1 gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Schedule
          </Button>
          <Button size="sm" variant="default" className="flex-1 gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Assign Job
          </Button>
        </div>
      </aside>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TechniciansPage() {
  const [view, setView] = useState<ViewMode>("card")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [skillFilter, setSkillFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [selectedTech, setSelectedTech] = useState<Technician | null>(null)

  const filtered = useMemo(() => {
    return technicians.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()) &&
          !t.role.toLowerCase().includes(search.toLowerCase())) return false
      if (statusFilter !== "all" && t.status !== statusFilter) return false
      if (skillFilter !== "all" && !t.skills.includes(skillFilter as TechSkill)) return false
      if (regionFilter !== "all" && t.region !== regionFilter) return false
      return true
    })
  }, [search, statusFilter, skillFilter, regionFilter])

  // KPI values
  const activeTechs = technicians.filter((t) => t.status !== "Off" && t.status !== "Vacation").length
  const scheduledToday = technicians.reduce((acc, t) => acc + t.schedule.filter((s) => s.date === "2026-04-30" && s.status !== "Completed").length, 0)
  const avgCompletion = Math.round(technicians.reduce((a, t) => a + t.completionPct, 0) / technicians.length)
  const certExpiring = technicians.reduce((acc, t) => {
    const expiring = t.certifications.filter((c) => {
      const exp = new Date(c.expiryDate)
      const now = new Date("2026-04-30")
      const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      return diff >= 0 && diff <= 90
    })
    return acc + expiring.length
  }, 0)

  return (
    <>
      <div className="flex flex-col gap-6 p-6">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Technicians</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your workforce, assignments, certifications, and productivity.
            </p>
          </div>
          <Button className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Add Technician
          </Button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Active Techs"
            value={activeTechs}
            sub={`${technicians.length - activeTechs} off / vacation`}
            icon={User}
            iconClass="bg-primary/10 text-primary"
          />
          <KpiCard
            label="Scheduled Today"
            value={scheduledToday}
            sub="confirmed & tentative"
            icon={CalendarDays}
            iconClass="bg-[color:var(--status-info)]/10 text-[color:var(--status-info)]"
          />
          <KpiCard
            label="Avg Completion Rate"
            value={`${avgCompletion}%`}
            sub="first-visit close rate"
            icon={CheckCircle2}
            iconClass="bg-[color:var(--status-success)]/10 text-[color:var(--status-success)]"
          />
          <KpiCard
            label="Certifications Expiring"
            value={certExpiring}
            sub="within 90 days"
            icon={ShieldCheck}
            iconClass={certExpiring > 0
              ? "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]"
              : "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)]"}
          />
        </div>

        {/* Filter toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48 max-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search technicians…"
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={skillFilter} onValueChange={setSkillFilter}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Skill" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Skills</SelectItem>
              {ALL_SKILLS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {ALL_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-1 border border-border rounded-md p-0.5 bg-background">
            <button
              onClick={() => setView("card")}
              className={cn("p-1.5 rounded transition-colors", view === "card" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("table")}
              className={cn("p-1.5 rounded transition-colors", view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {(statusFilter !== "all" || skillFilter !== "all" || regionFilter !== "all" || search) && (
            <button
              onClick={() => { setStatusFilter("all"); setSkillFilter("all"); setRegionFilter("all"); setSearch("") }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>

        {/* Result count */}
        <p className="text-xs text-muted-foreground -mt-3">
          {filtered.length} of {technicians.length} technicians
        </p>

        {/* ── Card view ── */}
        {view === "card" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((tech) => (
              <TechCard key={tech.id} tech={tech} onSelect={() => setSelectedTech(tech)} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center text-muted-foreground text-sm">
                No technicians match your filters.
              </div>
            )}
          </div>
        )}

        {/* ── Table view ── */}
        {view === "table" && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technician</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead className="text-right">Jobs / Wk</TableHead>
                  <TableHead className="text-right">Completion</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead className="text-right">Utilization</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tech) => (
                  <TableRow
                    key={tech.id}
                    className="cursor-pointer hover:bg-secondary/40 transition-colors"
                    onClick={() => setSelectedTech(tech)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <TechAvatar tech={tech} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{tech.name}</p>
                          <p className="text-xs text-muted-foreground">{tech.role}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={tech.status} /></TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" />{tech.region}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap max-w-48">
                        {tech.skills.slice(0, 2).map((s) => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20">
                            {s}
                          </span>
                        ))}
                        {tech.skills.length > 2 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            +{tech.skills.length - 2}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{tech.jobsThisWeek}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{tech.completionPct}%</TableCell>
                    <TableCell className="text-right"><StarRating rating={tech.rating} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-end">
                        <UtilBar pct={tech.utilizationPct} className="w-16" />
                        <span className="text-xs text-muted-foreground w-8 text-right">{tech.utilizationPct}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                      No technicians match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Profile drawer */}
      {selectedTech && (
        <ProfileDrawer tech={selectedTech} onClose={() => setSelectedTech(null)} />
      )}
    </>
  )
}
