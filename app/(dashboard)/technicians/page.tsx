"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { Technician, TechStatus, TechSkill } from "@/lib/mock-data"
import { useWorkspaceData } from "@/lib/tenant-store"
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
  Loader2,
  Copy,
  Trash2,
  Eye,
  StickyNote,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "card" | "table"
type KpiFilter = "active" | "today" | "performance" | "expiring" | null
type DrawerTab = "overview" | "schedule" | "certifications" | "history" | "performance" | "notes"
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

const SCHEDULE_STYLE: Record<string, string> = {
  "Confirmed":  "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Tentative":  "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Completed":  "bg-muted text-muted-foreground border-border",
}

const AVATAR_COLORS = [
  "bg-[var(--ds-info-subtle)]", "bg-[var(--ds-success-subtle)]", "bg-[var(--ds-accent-subtle)]",
  "bg-[var(--ds-danger-subtle)]", "bg-[var(--ds-warning-subtle)]", "bg-primary",
]

function avatarColor(id: string) {
  const idx = parseInt(id.replace("T-", ""), 10) - 1
  return AVATAR_COLORS[idx % AVATAR_COLORS.length]
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
  const sz = size === "lg" ? "w-14 h-14 text-lg" : size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0", avatarColor(tech.id), sz)}>
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

// ─── Schedule Modal ──────────────────────────────────────────���────────���───────

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
}: {
  tech: Technician
  onSelect: () => void
  onSchedule: () => void
  onMessage: () => void
  onStatusChange: (s: TechStatus) => void
  onDuplicate: () => void
  onDelete: () => void
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
              <DropdownMenuItem className="cursor-pointer gap-2" onClick={onSelect}>
                <Eye className="w-3.5 h-3.5" /> Edit Technician
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer gap-2" onClick={onDuplicate}>
                <Copy className="w-3.5 h-3.5" /> Duplicate Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onStatusChange("Available")}>
                <span className="w-2 h-2 rounded-full bg-[color:var(--status-success)] inline-block" /> Mark Available
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onStatusChange("Off")}>
                <span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" /> Mark Off Duty
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer gap-2" onClick={onSchedule}>
                <Calendar className="w-3.5 h-3.5" /> View Schedule
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer gap-2 text-destructive focus:text-destructive" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Profile Drawer ───────────────────────────────────────────────────────────

function ProfileDrawer({
  tech, onClose, onSchedule, onMessage,
}: {
  tech: Technician
  onClose: () => void
  onSchedule: () => void
  onMessage: () => void
}) {
  const [tab, setTab] = useState<DrawerTab>("overview")
  const [notes, setNotes] = useState("")
  const [savedNotes, setSavedNotes] = useState<{ text: string; ts: string }[]>([])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const certExpiringSoon = tech.certifications.filter((c) => {
    const diff = (new Date(c.expiryDate).getTime() - new Date("2026-04-30").getTime()) / 86400000
    return diff <= 180
  })

  function saveNote() {
    if (!notes.trim()) return
    setSavedNotes((prev) => [{ text: notes.trim(), ts: new Date().toLocaleString() }, ...prev])
    setNotes("")
  }

  const TABS: DrawerTab[] = ["overview", "schedule", "certifications", "history", "performance", "notes"]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-background border-l border-border shadow-2xl flex flex-col">

        {/* Header */}
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
                <StarRating rating={tech.rating} />
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />Since {new Date(tech.hireDate).getFullYear()}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border shrink-0 px-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "capitalize text-sm py-3 px-2.5 border-b-2 font-medium transition-colors whitespace-nowrap cursor-pointer",
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "notes" ? <span className="flex items-center gap-1"><StickyNote className="w-3.5 h-3.5" />Notes</span> : t}
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
                  { label: "Hire Date", value: new Date(tech.hireDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }), icon: CalendarDays },
                  { label: "Region", value: tech.region, icon: MapPin },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                      <Icon className="w-3 h-3" />{label}
                    </div>
                    <p className="text-xs font-medium text-foreground truncate">{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {tech.skills.length === 0
                    ? <p className="text-xs text-muted-foreground">No skills listed.</p>
                    : tech.skills.map((s) => (
                      <span key={s} className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/8 text-primary border border-primary/20">{s}</span>
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
                      {c.name} — expires {new Date(c.expiryDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}
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
                <div className="text-center py-12 text-muted-foreground text-sm">No upcoming assignments scheduled.</div>
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
              {tech.certifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No certifications on file.</div>
              ) : (
                <div className="space-y-3">
                  {tech.certifications.map((cert) => {
                    const daysLeft = Math.round((new Date(cert.expiryDate).getTime() - new Date("2026-04-30").getTime()) / 86400000)
                    const isExpired = daysLeft < 0
                    const isExpiringSoon = daysLeft >= 0 && daysLeft <= 180
                    return (
                      <div key={cert.name} className={cn(
                        "p-4 rounded-lg border transition-colors",
                        isExpired ? "border-destructive/40 bg-destructive/5"
                          : isExpiringSoon ? "border-[color:var(--status-warning)]/40 bg-[color:var(--status-warning)]/5"
                          : "border-border bg-secondary/30"
                      )}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <Award className={cn("w-4 h-4 shrink-0",
                              isExpired ? "text-destructive" : isExpiringSoon ? "text-[color:var(--status-warning)]" : "text-[color:var(--status-success)]"
                            )} />
                            <p className="text-sm font-semibold text-foreground">{cert.name}</p>
                          </div>
                          {isExpired && <Badge variant="secondary" className="text-[10px] border bg-destructive/10 text-destructive border-destructive/30 shrink-0">Expired</Badge>}
                          {isExpiringSoon && !isExpired && <Badge variant="secondary" className="text-[10px] border bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30 shrink-0">Expiring Soon</Badge>}
                          {!isExpired && !isExpiringSoon && <Badge variant="secondary" className="text-[10px] border bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30 shrink-0">Valid</Badge>}
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
              )}
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
                        <p className="text-[10px] text-muted-foreground mt-0.5">{entry.completedDate} &bull; {entry.duration} &bull; {entry.woId}</p>
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
                  <div className={cn("h-full rounded-full", tech.utilizationPct >= 90 ? "bg-[color:var(--status-danger)]" : tech.utilizationPct >= 75 ? "bg-[color:var(--status-warning)]" : "bg-primary")}
                    style={{ width: `${tech.utilizationPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>0%</span><span className="text-[color:var(--status-warning)]">75% target</span><span>100%</span>
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

          {/* ── Notes ── */}
          {tab === "notes" && (
            <>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Internal Notes</p>
              <div className="space-y-2">
                <Textarea
                  placeholder={`Add a note about ${tech.name}…`}
                  rows={4} value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <Button size="sm" className="w-full" onClick={saveNote} disabled={!notes.trim()}>
                  Save Note
                </Button>
              </div>
              {savedNotes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No notes yet. Add the first one above.</div>
              ) : (
                <div className="space-y-3">
                  {savedNotes.map((n, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border bg-secondary/30">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{n.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">{n.ts}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Drawer footer */}
        <div className="p-4 border-t border-border flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="flex-1 gap-1.5 cursor-pointer" onClick={onMessage}>
            <MessageSquare className="w-3.5 h-3.5" /> Message
          </Button>
          <Button size="sm" variant="outline" className="flex-1 gap-1.5 cursor-pointer" onClick={onSchedule}>
            <Calendar className="w-3.5 h-3.5" /> Schedule
          </Button>
          <Button size="sm" variant="default" className="flex-1 gap-1.5 cursor-pointer" onClick={onSchedule}>
            <ClipboardList className="w-3.5 h-3.5" /> Assign Job
          </Button>
        </div>
      </aside>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TechniciansPage() {
  const { technicians: wsTechs } = useWorkspaceData()
  const [techs, setTechs] = useState<Technician[]>(wsTechs)

  useEffect(() => {
    setTechs(wsTechs)
  }, [wsTechs])
  const [view, setView] = useState<ViewMode>("card")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [skillFilter, setSkillFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null)

  const [selectedTech, setSelectedTech] = useState<Technician | null>(null)
  const [scheduleTech, setScheduleTech] = useState<Technician | null>(null)
  const [messageTech, setMessageTech] = useState<Technician | null>(null)
  const [deleteTech, setDeleteTech] = useState<Technician | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

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

  // KPI derived values
  const activeTechs = techs.filter((t) => t.status !== "Off" && t.status !== "Vacation").length
  const scheduledToday = techs.reduce((acc, t) => acc + t.schedule.filter((s) => s.date === "2026-04-30" && s.status !== "Completed").length, 0)
  const avgCompletion = techs.length ? Math.round(techs.reduce((a, t) => a + t.completionPct, 0) / techs.length) : 0
  const certExpiring = techs.reduce((acc, t) => {
    return acc + t.certifications.filter((c) => {
      const diff = (new Date(c.expiryDate).getTime() - new Date("2026-04-30").getTime()) / 86400000
      return diff >= 0 && diff <= 90
    }).length
  }, 0)

  const filtered = useMemo(() => {
    return techs.filter((t) => {
      // KPI quick filter
      if (kpiFilter === "active" && (t.status === "Off" || t.status === "Vacation")) return false
      if (kpiFilter === "today" && !t.schedule.some((s) => s.date === "2026-04-30")) return false
      if (kpiFilter === "expiring" && !t.certifications.some((c) => {
        const diff = (new Date(c.expiryDate).getTime() - new Date("2026-04-30").getTime()) / 86400000
        return diff >= 0 && diff <= 90
      })) return false
      // Text search — name, role, region, skills
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
    }).sort((a, b) => {
      if (kpiFilter === "performance") return b.completionPct - a.completionPct
      return 0
    })
  }, [techs, search, statusFilter, skillFilter, regionFilter, kpiFilter])

  function toggleKpi(f: KpiFilter) {
    setKpiFilter((prev) => (prev === f ? null : f))
  }

  function handleAddTech(t: Technician) {
    setTechs((prev) => [t, ...prev])
    setShowAddModal(false)
    addToast(`${t.name} added to the team`)
  }

  function handleDelete(id: string) {
    const tech = techs.find((t) => t.id === id)
    setTechs((prev) => prev.filter((t) => t.id !== id))
    setDeleteTech(null)
    if (selectedTech?.id === id) setSelectedTech(null)
    addToast(`${tech?.name ?? "Technician"} removed from roster`)
  }

  function handleStatusChange(id: string, status: TechStatus) {
    setTechs((prev) => prev.map((t) => t.id === id ? { ...t, status } : t))
    if (selectedTech?.id === id) setSelectedTech((prev) => prev ? { ...prev, status } : prev)
    const tech = techs.find((t) => t.id === id)
    addToast(`${tech?.name} marked as ${status}`)
  }

  function handleDuplicate(tech: Technician) {
    const newId = `T-0${Math.floor(Math.random() * 900 + 100)}`
    const copy: Technician = { ...tech, id: newId, name: `${tech.name} (Copy)`, status: "Available", jobsThisWeek: 0, totalCompleted: 0 }
    setTechs((prev) => [copy, ...prev])
    addToast(`${tech.name} profile duplicated`)
  }

  return (
    <>
      <div className="flex flex-col gap-6">

        {/* Add Technician action */}
        <div className="flex justify-end">
          <Button className="gap-2 shrink-0 cursor-pointer" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" /> Add Technician
          </Button>
        </div>

        {/* KPI cards — clickable filters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Active Techs" value={activeTechs}
            sub={`${techs.length - activeTechs} off / vacation`}
            icon={User} iconClass="bg-primary/10 text-primary"
            active={kpiFilter === "active"} onClick={() => toggleKpi("active")}
          />
          <KpiCard
            label="Scheduled Today" value={scheduledToday}
            sub="confirmed & tentative"
            icon={CalendarDays} iconClass="bg-[color:var(--status-info)]/10 text-[color:var(--status-info)]"
            active={kpiFilter === "today"} onClick={() => toggleKpi("today")}
          />
          <KpiCard
            label="Avg Completion Rate" value={`${avgCompletion}%`}
            sub="click to sort by performance"
            icon={CheckCircle2} iconClass="bg-[color:var(--status-success)]/10 text-[color:var(--status-success)]"
            active={kpiFilter === "performance"} onClick={() => toggleKpi("performance")}
          />
          <KpiCard
            label="Certifications Expiring" value={certExpiring}
            sub="within 90 days"
            icon={ShieldCheck}
            iconClass={certExpiring > 0
              ? "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]"
              : "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)]"}
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

          <div className="ml-auto flex items-center gap-1 border border-border rounded-md p-0.5 bg-background">
            <button
              onClick={() => setView("card")}
              className={cn("p-1.5 rounded transition-colors cursor-pointer", view === "card" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            ><LayoutGrid className="w-4 h-4" /></button>
            <button
              onClick={() => setView("table")}
              className={cn("p-1.5 rounded transition-colors cursor-pointer", view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            ><List className="w-4 h-4" /></button>
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
          {filtered.length} of {techs.length} technicians
        </p>

        {/* ── Card view ── */}
        {view === "card" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((tech) => (
              <TechCard
                key={tech.id} tech={tech}
                onSelect={() => setSelectedTech(tech)}
                onSchedule={() => setScheduleTech(tech)}
                onMessage={() => setMessageTech(tech)}
                onStatusChange={(s) => handleStatusChange(tech.id, s)}
                onDuplicate={() => handleDuplicate(tech)}
                onDelete={() => setDeleteTech(tech)}
              />
            ))}
            {filtered.length === 0 && (
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
                {filtered.map((tech) => (
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

      {/* ── Overlays ── */}

      {selectedTech && (
        <ProfileDrawer
          tech={selectedTech}
          onClose={() => setSelectedTech(null)}
          onSchedule={() => { setScheduleTech(selectedTech); setSelectedTech(null) }}
          onMessage={() => { setMessageTech(selectedTech); setSelectedTech(null) }}
        />
      )}

      {showAddModal && (
        <AddTechModal onClose={() => setShowAddModal(false)} onAdd={handleAddTech} />
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

      {deleteTech && (
        <ConfirmDeleteModal
          tech={deleteTech}
          onConfirm={() => handleDelete(deleteTech.id)}
          onCancel={() => setDeleteTech(null)}
        />
      )}

      <ToastStack toasts={toasts} onRemove={removeToast} />
    </>
  )
}
