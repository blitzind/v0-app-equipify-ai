"use client"

import { useState, useMemo, useEffect, useCallback, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Technician, TechStatus, TechSkill } from "@/lib/mock-data"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { TechnicianDrawer } from "@/components/drawers/technician-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { ViewToggle } from "@/components/ui/view-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Search,
  Star,
  MapPin,
  Phone,
  Mail,
  CalendarDays,
  CheckCircle2,
  Clock,
  ClipboardList,
  ShieldCheck,
  X,
  ChevronRight,
  User,
  MoreHorizontal,
  MessageSquare,
  Calendar,
  Loader2,
  Copy,
  Trash2,
  Eye,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "card" | "table"
type KpiFilter = "active" | "today" | "performance" | "expiring" | null
type MessageTab = "sms" | "email" | "note"

const ALL_STATUSES: TechStatus[] = ["Available", "On Job", "Off", "Vacation"]
const ALL_SKILLS: TechSkill[] = [
  "HVAC", "Electrical", "Calibration", "Medical Equipment",
  "Industrial Repair", "Installations", "Refrigeration", "Hydraulics", "Welding", "PLC / Controls",
]
const ALL_REGIONS = ["Midwest", "Northeast", "Southeast", "Southwest", "West"]
const ALL_ROLES = [
  "Senior Field Technician", "Lead Calibration Specialist", "Industrial Repair Technician",
  "Field Technician II", "Field Technician I",
]

const ROSTER_MEMBER_ROLES = ["owner", "admin", "manager", "tech"] as const

function formatMemberRole(role: string): string {
  if (!role) return "Member"
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function localDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Monday–Sunday week containing `d`, as YYYY-MM-DD bounds (local). */
function weekBoundsStrings(d: Date): { start: string; end: string } {
  const day = d.getDay()
  const diffFromMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffFromMonday)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: localDateString(monday), end: localDateString(sunday) }
}

function dateStrInRangeInclusive(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type WoRow = { assigned_user_id: string | null; status: string; scheduled_on: string | null }

function aggregateWoStats(
  rows: WoRow[],
  userId: string,
  weekStart: string,
  weekEnd: string,
  todayStr: string
): {
  jobsThisWeek: number
  totalCompleted: number
  completionPct: number
  hasJobsToday: boolean
} {
  let jobsThisWeek = 0
  let completed = 0
  let totalForRate = 0
  let hasJobsToday = false

  for (const r of rows) {
    if (r.assigned_user_id !== userId) continue
    if (r.scheduled_on === todayStr) hasJobsToday = true
    if (r.scheduled_on && dateStrInRangeInclusive(r.scheduled_on, weekStart, weekEnd)) {
      jobsThisWeek++
    }
    if (r.status === "completed" || r.status === "invoiced") {
      completed++
    }
    if (
      r.status === "open" ||
      r.status === "scheduled" ||
      r.status === "in_progress" ||
      r.status === "completed" ||
      r.status === "invoiced"
    ) {
      totalForRate++
    }
  }

  const completionPct =
    totalForRate > 0 ? Math.round((completed / totalForRate) * 100) : 0

  return { jobsThisWeek, totalCompleted: completed, completionPct, hasJobsToday }
}

function buildTechnicianFromProfile(
  profile: { id: string; email: string | null; full_name: string | null; created_at: string },
  memberRole: string,
  stats: ReturnType<typeof aggregateWoStats>
): Technician {
  const name =
    (profile.full_name && profile.full_name.trim()) ||
    (profile.email && profile.email.trim()) ||
    "Technician"
  const hireDate =
    profile.created_at && /^\d{4}-\d{2}-\d{2}/.test(profile.created_at)
      ? profile.created_at.slice(0, 10)
      : "—"

  return {
    id: profile.id,
    name,
    avatar: initialsFromName(name),
    role: formatMemberRole(memberRole),
    region: "—",
    email: profile.email ?? "",
    phone: "—",
    hireDate,
    status: "Available",
    skills: [] as TechSkill[],
    jobsThisWeek: stats.jobsThisWeek,
    completionPct: stats.completionPct,
    rating: 0,
    utilizationPct: 0,
    totalCompleted: stats.totalCompleted,
    avgJobDurationHrs: 0,
    certifications: [],
    schedule: [],
    history: [],
    bio: `${name} (${formatMemberRole(memberRole)}). Performance metrics below reflect assigned work orders when available.`,
  }
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<TechStatus, string> = {
  "Available": "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "On Job":    "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Off":       "bg-muted text-muted-foreground border-border",
  "Vacation":  "ds-badge-accent border",
}

const STATUS_DOT: Record<TechStatus, string> = {
  "Available": "bg-[color:var(--status-success)]",
  "On Job":    "bg-[color:var(--status-warning)]",
  "Off":       "bg-muted-foreground",
  "Vacation":  "bg-[var(--ds-accent-subtle)]",
}

const AVATAR_COLORS = [
  "bg-[oklch(0.48_0.18_245)]",  // blue
  "bg-[oklch(0.44_0.16_160)]",  // teal/green
  "bg-[oklch(0.52_0.20_290)]",  // violet
  "bg-[oklch(0.47_0.20_25)]",   // red-orange
  "bg-[oklch(0.50_0.18_55)]",   // amber
  "bg-primary",
]

function avatarColor(id: string) {
  // Extract trailing numeric part robustly for both "T-01" and "MT-01"
  const match = id.match(/(\d+)$/)
  const idx = match ? parseInt(match[1], 10) - 1 : 0
  return AVATAR_COLORS[Math.abs(idx) % AVATAR_COLORS.length]
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastMsg { id: number; message: string; type: "success" | "info" }

function ToastStack({ toasts, onRemove }: { toasts: ToastMsg[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-200",
            t.type === "success"
              ? "bg-[color:var(--status-success)] text-white"
              : "bg-foreground text-background"
          )}
        >
          {t.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {t.message}
          <Button variant="ghost" size="icon-sm" onClick={() => onRemove(t.id)} className="ml-1 opacity-70 hover:opacity-100 size-5">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
    </div>
  )
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
  const sz = size === "lg" ? "w-14 h-14 text-base" : size === "sm" ? "w-8 h-8 text-[11px]" : "w-10 h-10 text-[13px]"
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white shrink-0 ring-2 ring-background select-none",
        avatarColor(tech.id),
        sz
      )}
      aria-label={tech.name}
    >
      {tech.avatar}
    </div>
  )
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  tech, onConfirm, onCancel,
}: { tech: Technician; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative z-10 bg-background rounded-xl border border-border shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Delete Technician</h3>
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Are you sure you want to remove <strong className="text-foreground">{tech.name}</strong> from the team roster?
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Technician Modal ─────────────────────────────────────────────────────

function AddTechModal({
  onClose, onAdd,
}: { onClose: () => void; onAdd: (t: Technician) => void }) {
  const [loading, setLoading] = useState(false)
  const [selectedSkills, setSelectedSkills] = useState<TechSkill[]>([])
  const [form, setForm] = useState({
    name: "", email: "", phone: "", role: "", region: "",
    status: "Available" as TechStatus, startDate: "",
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  function toggleSkill(s: TechSkill) {
    setSelectedSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.role || !form.region) return
    setLoading(true)
    setTimeout(() => {
      const initials = form.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
      const newId = `T-0${Math.floor(Math.random() * 900 + 100)}`
      const newTech: Technician = {
        id: newId, name: form.name, avatar: initials,
        role: form.role, region: form.region,
        email: form.email, phone: form.phone,
        hireDate: form.startDate || "2026-05-01",
        status: form.status,
        skills: selectedSkills,
        jobsThisWeek: 0, completionPct: 0, rating: 0, utilizationPct: 0,
        totalCompleted: 0, avgJobDurationHrs: 0,
        certifications: [], schedule: [], history: [],
        bio: `${form.name} joined the team in ${form.startDate ? form.startDate.slice(0, 4) : "2026"} as ${form.role} covering the ${form.region} region.`,
      }
      onAdd(newTech)
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 bg-background rounded-xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background z-10">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Add Technician</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Fill in the details to create a new team member.</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="add-name">Full Name <span className="text-destructive">*</span></Label>
              <Input id="add-name" placeholder="e.g. Jordan Mills" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-email">Email <span className="text-destructive">*</span></Label>
              <Input id="add-email" type="email" placeholder="j.mills@equipify.ai" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-phone">Phone</Label>
              <Input id="add-phone" placeholder="(555) 000-0000" value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Role <span className="text-destructive">*</span></Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Region <span className="text-destructive">*</span></Label>
              <Select value={form.region} onValueChange={(v) => setForm((f) => ({ ...f, region: v }))}>
                <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent>
                  {ALL_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as TechStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-start">Start Date</Label>
              <Input id="add-start" type="date" value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Skill Tags</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_SKILLS.map((s) => (
                <button
                  key={s} type="button"
                  onClick={() => toggleSkill(s)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer",
                    selectedSkills.includes(s)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : "Create Technician"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Schedule Modal ──────────────────────────────────────────������───────���───────

function ScheduleModal({
  tech, onClose, onSave,
}: { tech: Technician; onClose: () => void; onSave: (msg: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    date: "2026-05-05", time: "9:00 AM", customer: "", jobType: "", notes: "",
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer || !form.jobType) return
    setLoading(true)
    setTimeout(() => {
      onSave(`Job assigned to ${tech.name}`)
    }, 700)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 bg-background rounded-xl border border-border shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Schedule Job</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Assigning to <strong>{tech.name}</strong></p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sched-date">Date <span className="text-destructive">*</span></Label>
              <Input id="sched-date" type="date" value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched-time">Time <span className="text-destructive">*</span></Label>
              <Input id="sched-time" placeholder="e.g. 9:00 AM" value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sched-customer">Customer <span className="text-destructive">*</span></Label>
            <Input id="sched-customer" placeholder="e.g. Apex Fabricators" value={form.customer}
              onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sched-job">Job Type <span className="text-destructive">*</span></Label>
            <Input id="sched-job" placeholder="e.g. HVAC Preventive Maintenance" value={form.jobType}
              onChange={(e) => setForm((f) => ({ ...f, jobType: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sched-notes">Notes</Label>
            <Textarea id="sched-notes" placeholder="Any special instructions…" rows={3} value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Assigning…</> : "Assign Job"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Message Modal ────────────────────────────────────────────────────────────

function MessageModal({
  tech, onClose, onSend,
}: { tech: Technician; onClose: () => void; onSend: (msg: string) => void }) {
  const [tab, setTab] = useState<MessageTab>("sms")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  function handleSend() {
    if (!message.trim()) return
    setLoading(true)
    setTimeout(() => {
      const label = tab === "sms" ? "SMS" : tab === "email" ? "Email" : "Internal note"
      onSend(`${label} sent to ${tech.name}`)
    }, 600)
  }

  const tabLabel: Record<MessageTab, string> = { sms: "SMS", email: "Email", note: "Internal Note" }
  const placeholder: Record<MessageTab, string> = {
    sms: "Type your text message…",
    email: "Compose your email body…",
    note: "Add an internal note about this technician…",
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 bg-background rounded-xl border border-border shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Send Message</h2>
            <p className="text-xs text-muted-foreground mt-0.5">To: <strong>{tech.name}</strong> &bull; {tech.email}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex border-b border-border px-6">
          {(["sms", "email", "note"] as MessageTab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                "py-3 px-3 text-sm font-medium border-b-2 transition-colors",
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {tabLabel[t]}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Recipient</Label>
            <Input
              value={tab === "sms" ? tech.phone : tab === "email" ? tech.email : tech.name}
              readOnly className="bg-secondary/50 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea
              placeholder={placeholder[tab]} rows={5} value={message}
              onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button className="flex-1" onClick={handleSend} disabled={loading || !message.trim()}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : "Send Message"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, iconClass, active, onClick,
}: {
  label: string; value: string | number; sub: string
  icon: React.ElementType; iconClass: string
  active?: boolean; onClick?: () => void
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "transition-all",
        onClick ? "cursor-pointer hover:border-primary/40 hover:shadow-sm" : "",
        active ? "border-primary ring-1 ring-primary/30" : "",
      )}
    >
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

function TechCard({
  tech, onSelect, onSchedule, onMessage, onStatusChange, onDuplicate, onDelete,
  rosterEditsEnabled = true,
}: {
  tech: Technician
  onSelect: () => void
  onSchedule: () => void
  onMessage: () => void
  onStatusChange: (s: TechStatus) => void
  onDuplicate: () => void
  onDelete: () => void
  rosterEditsEnabled?: boolean
}) {
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
          <Button size="sm" variant="default" className="flex-1 h-8 text-xs cursor-pointer" onClick={onSelect}>
            View
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs px-3 cursor-pointer" onClick={onSchedule}>
            <Calendar className="w-3.5 h-3.5 mr-1" />Schedule
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs px-3 cursor-pointer" onClick={onMessage}>
            <MessageSquare className="w-3.5 h-3.5 mr-1" />Message
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 cursor-pointer">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className={cn("gap-2", rosterEditsEnabled ? "cursor-pointer" : "opacity-50 pointer-events-none")}
                onClick={rosterEditsEnabled ? onSelect : undefined}
              >
                <Eye className="w-3.5 h-3.5" /> Edit Technician
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn("gap-2", rosterEditsEnabled ? "cursor-pointer" : "opacity-50 pointer-events-none")}
                onClick={rosterEditsEnabled ? onDuplicate : undefined}
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={cn("gap-2", rosterEditsEnabled ? "cursor-pointer" : "opacity-50 pointer-events-none")}
                onClick={rosterEditsEnabled ? () => onStatusChange("Available") : undefined}
              >
                <span className="w-2 h-2 rounded-full bg-[color:var(--status-success)] inline-block" /> Mark Available
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn("gap-2", rosterEditsEnabled ? "cursor-pointer" : "opacity-50 pointer-events-none")}
                onClick={rosterEditsEnabled ? () => onStatusChange("Off") : undefined}
              >
                <span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" /> Mark Off Duty
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer gap-2" onClick={onSchedule}>
                <Calendar className="w-3.5 h-3.5" /> View Schedule
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={cn(
                  "gap-2 text-destructive focus:text-destructive",
                  rosterEditsEnabled ? "cursor-pointer" : "opacity-50 pointer-events-none"
                )}
                onClick={rosterEditsEnabled ? onDelete : undefined}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function TechniciansPageInner() {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const [techs, setTechs] = useState<Technician[]>([])
  const [woRows, setWoRows] = useState<WoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [view, setView] = useState<ViewMode>("table")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [skillFilter, setSkillFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null)

  const [selectedTech, setSelectedTech] = useState<Technician | null>(null)
  const [rosterRefresh, setRosterRefresh] = useState(0)
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    let active = true

    async function loadRoster() {
      setLoading(true)
      setLoadError(null)
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (active) {
          setTechs([])
          setWoRows([])
          setLoading(false)
        }
        return
      }

      if (orgStatus !== "ready" || !activeOrgId) {
        if (active) {
          setTechs([])
          setWoRows([])
          setLoadError(
            orgStatus === "ready" && !activeOrgId
              ? "No organization selected."
              : null,
          )
          setLoading(false)
        }
        return
      }

      const orgId = activeOrgId

      const { data: members, error: memError } = await supabase
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .in("role", [...ROSTER_MEMBER_ROLES])

      if (memError) {
        if (active) {
          setLoadError(memError.message)
          setTechs([])
          setWoRows([])
          setLoading(false)
        }
        return
      }

      const memberList = (members ?? []) as Array<{ user_id: string; role: string }>
      const userIds = [...new Set(memberList.map((m) => m.user_id))]
      const roleByUser = new Map(memberList.map((m) => [m.user_id, m.role]))

      if (userIds.length === 0) {
        if (active) {
          setTechs([])
          setWoRows([])
          setLoading(false)
        }
        return
      }

      const { data: profRows, error: profError } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .in("id", userIds)

      if (profError) {
        if (active) {
          setLoadError(profError.message)
          setTechs([])
          setWoRows([])
          setLoading(false)
        }
        return
      }

      const { data: woData, error: woError } = await supabase
        .from("work_orders")
        .select("assigned_user_id, status, scheduled_on")
        .eq("organization_id", orgId)
        .eq("is_archived", false)

      const woList = (woError ? [] : ((woData ?? []) as WoRow[])) as WoRow[]

      const todayStr = localDateString(new Date())
      const { start: weekStart, end: weekEnd } = weekBoundsStrings(new Date())

      const list: Technician[] = (
        (profRows ?? []) as Array<{
          id: string
          email: string | null
          full_name: string | null
          created_at: string
        }>
      )
        .filter((p) => roleByUser.has(p.id))
        .map((p) => {
          const role = roleByUser.get(p.id) ?? "tech"
          const stats = aggregateWoStats(woList, p.id, weekStart, weekEnd, todayStr)
          return buildTechnicianFromProfile(p, role, stats)
        })
        .sort((a, b) => a.name.localeCompare(b.name))

      if (active) {
        setWoRows(woList)
        setTechs(list)
        setLoading(false)
      }
    }

    void loadRoster()
    return () => {
      active = false
    }
  }, [rosterRefresh, orgStatus, activeOrgId])

  useEffect(() => {
    const openId = searchParams.get("open")
    if (openId && techs.length > 0) {
      const match = techs.find((t) => t.id === openId)
      if (match) {
        setSelectedTech(match)
        router.replace("/technicians", { scroll: false })
      }
    }
  }, [searchParams, techs, router])

  const [scheduleTech, setScheduleTech] = useState<Technician | null>(null)
  const [messageTech, setMessageTech] = useState<Technician | null>(null)

  const [toasts, setToasts] = useState<ToastMsg[]>([])
  let toastId = 0

  const addToast = useCallback((message: string, type: ToastMsg["type"] = "success") => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const todayStr = localDateString(new Date())

  const jobsTodaySet = useMemo(() => {
    const s = new Set<string>()
    for (const r of woRows) {
      if (r.scheduled_on === todayStr && r.assigned_user_id) {
        s.add(r.assigned_user_id)
      }
    }
    return s
  }, [woRows, todayStr])

  // KPI derived values
  const activeTechs = techs.filter((t) => t.status !== "Off" && t.status !== "Vacation").length
  const scheduledToday = woRows.filter((r) => r.scheduled_on === todayStr).length
  const avgCompletion = techs.length
    ? Math.round(techs.reduce((a, t) => a + t.completionPct, 0) / techs.length)
    : 0
  const certExpiring = 0

  const filtered = useMemo(() => {
    return techs
      .filter((t) => {
        if (kpiFilter === "active" && (t.status === "Off" || t.status === "Vacation")) return false
        if (kpiFilter === "today" && !jobsTodaySet.has(t.id)) return false
        if (
          kpiFilter === "expiring" &&
          !t.certifications.some((c) => {
            const diff = (new Date(c.expiryDate).getTime() - Date.now()) / 86400000
            return diff >= 0 && diff <= 90
          })
        ) {
          return false
        }
        if (search) {
          const q = search.toLowerCase()
          const match =
            t.name.toLowerCase().includes(q) ||
            t.role.toLowerCase().includes(q) ||
            t.region.toLowerCase().includes(q) ||
            t.skills.some((s) => s.toLowerCase().includes(q))
          if (!match) return false
        }
        if (statusFilter !== "all" && t.status !== statusFilter) return false
        if (skillFilter !== "all" && !t.skills.includes(skillFilter as TechSkill)) return false
        if (regionFilter !== "all" && t.region !== regionFilter) return false
        return true
      })
      .sort((a, b) => {
        if (kpiFilter === "performance") return b.completionPct - a.completionPct
        return 0
      })
  }, [techs, search, statusFilter, skillFilter, regionFilter, kpiFilter, jobsTodaySet])

  function toggleKpi(f: KpiFilter) {
    setKpiFilter((prev) => (prev === f ? null : f))
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {loadError && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {loadError}
          </p>
        )}

        {/* KPI cards — clickable filters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Active Techs" value={activeTechs}
            sub={loading ? "Loading…" : `${techs.length - activeTechs} off / vacation`}
            icon={User} iconClass="bg-primary/10 text-primary"
            active={kpiFilter === "active"} onClick={() => toggleKpi("active")}
          />
          <KpiCard
            label="Scheduled Today" value={loading ? "—" : scheduledToday}
            sub="work orders for today (org)"
            icon={CalendarDays} iconClass="bg-[color:var(--status-info)]/10 text-[color:var(--status-info)]"
            active={kpiFilter === "today"} onClick={() => toggleKpi("today")}
          />
          <KpiCard
            label="Avg Completion Rate" value={loading ? "—" : `${avgCompletion}%`}
            sub="from assigned work orders"
            icon={CheckCircle2} iconClass="bg-[color:var(--status-success)]/10 text-[color:var(--status-success)]"
            active={kpiFilter === "performance"} onClick={() => toggleKpi("performance")}
          />
          <KpiCard
            label="Certifications Expiring" value={certExpiring}
            sub="not tracked in app yet"
            icon={ShieldCheck}
            iconClass="bg-[color:var(--status-success)]/10 text-[color:var(--status-success)]"
            active={kpiFilter === "expiring"} onClick={() => toggleKpi("expiring")}
          />
        </div>

        {/* Active KPI label */}
        {kpiFilter && (
          <div className="flex items-center gap-2 -mt-3">
            <span className="text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
              {kpiFilter === "active" && "Showing: Active techs only"}
              {kpiFilter === "today" && "Showing: Scheduled today"}
              {kpiFilter === "performance" && "Sorted by: Completion rate"}
              {kpiFilter === "expiring" && "Showing: Certs expiring in 90 days"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setKpiFilter(null)} className="text-xs gap-1 h-7">
              <X className="w-3 h-3" /> Clear
            </Button>
          </div>
        )}

        {/* Filter toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:flex-1 sm:min-w-0 sm:max-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, role, region, skill…"
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-sm cursor-pointer">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={skillFilter} onValueChange={setSkillFilter}>
            <SelectTrigger className="w-44 h-9 text-sm cursor-pointer">
              <SelectValue placeholder="Skill" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Skills</SelectItem>
              {ALL_SKILLS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-36 h-9 text-sm cursor-pointer">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {ALL_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Link
            href="/technicians/daily"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <CalendarDays className="w-4 h-4" /> Daily Dispatch
          </Link>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <ViewToggle view={view} onViewChange={setView} />
            <Button
              type="button"
              className="gap-2 h-9"
              disabled
              title="Invite team members from Settings — roster edits coming soon."
            >
              <Plus className="w-4 h-4" /> Add Technician
            </Button>
          </div>

          {(statusFilter !== "all" || skillFilter !== "all" || regionFilter !== "all" || search) && (
            <button
              onClick={() => { setStatusFilter("all"); setSkillFilter("all"); setRegionFilter("all"); setSearch("") }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            ><X className="w-3 h-3" /> Clear filters</button>
          )}
        </div>

        {/* Result count */}
        <p className="text-xs text-muted-foreground -mt-3">
          {loading ? "Loading team…" : `${filtered.length} of ${techs.length} technicians`}
        </p>

        {/* ── Card view ── */}
        {view === "card" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm">Loading team…</p>
              </div>
            )}
            {!loading && filtered.map((tech) => (
              <TechCard
                key={tech.id} tech={tech}
                onSelect={() => setSelectedTech(tech)}
                onSchedule={() => setScheduleTech(tech)}
                onMessage={() => setMessageTech(tech)}
                onStatusChange={() => {}}
                onDuplicate={() => {}}
                onDelete={() => {}}
                rosterEditsEnabled={false}
              />
            ))}
            {!loading && filtered.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <User className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No technicians found</p>
                <p className="text-xs text-muted-foreground">Try adjusting your search or filters.</p>
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
                {loading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                      Loading team…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.map((tech) => (
                  <TableRow key={tech.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelectedTech(tech)}>
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
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20">{s}</span>
                        ))}
                        {tech.skills.length > 2 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">+{tech.skills.length - 2}</span>
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
                {!loading && filtered.length === 0 && (
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

      {/* ── Overlays ── */}

      {selectedTech && (
        <TechnicianDrawer
          techId={selectedTech.id}
          onClose={() => setSelectedTech(null)}
          onUpdated={() => setRosterRefresh((n) => n + 1)}
          onSchedule={({ id }) => {
            const t = techs.find((x) => x.id === id)
            if (t) setScheduleTech(t)
            setSelectedTech(null)
          }}
          onMessage={({ id }) => {
            const t = techs.find((x) => x.id === id)
            if (t) setMessageTech(t)
            setSelectedTech(null)
          }}
        />
      )}

      {scheduleTech && (
        <ScheduleModal
          tech={scheduleTech}
          onClose={() => setScheduleTech(null)}
          onSave={(msg) => { setScheduleTech(null); addToast(msg) }}
        />
      )}

      {messageTech && (
        <MessageModal
          tech={messageTech}
          onClose={() => setMessageTech(null)}
          onSend={(msg) => { setMessageTech(null); addToast(msg) }}
        />
      )}

      <ToastStack toasts={toasts} onRemove={removeToast} />
    </>
  )
}

export default function TechniciansPage() {
  return <Suspense fallback={null}><TechniciansPageInner /></Suspense>
}
