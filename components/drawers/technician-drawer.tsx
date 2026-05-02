"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { WorkOrderDrawer } from "@/components/drawers/work-order-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DrawerToastStack, type ToastItem } from "@/components/detail-drawer"
import {
  Mail,
  Calendar,
  ClipboardList,
  MessageSquare,
  X,
  Loader2,
  Pencil,
  StickyNote,
} from "lucide-react"

let toastCounter = 0

type DrawerTab = "overview" | "schedule" | "certifications" | "history" | "performance" | "notes"

const ORG_ROLES = ["owner", "admin", "manager", "tech", "viewer"] as const
const MEMBER_STATUSES = ["invited", "active", "suspended"] as const

function formatMemberRole(role: string): string {
  if (!role) return "Member"
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatWoScheduleTime(isoOrTime: string | null): string {
  if (!isoOrTime) return "—"
  const t = isoOrTime.trim()
  if (t.length >= 5 && t.includes(":")) return t.slice(0, 5)
  return t
}

function mapDbStatusToLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open"
    case "scheduled":
      return "Scheduled"
    case "in_progress":
      return "In Progress"
    case "completed":
      return "Completed"
    case "invoiced":
      return "Invoiced"
    default:
      return "Open"
  }
}

function mapDbTypeToLabel(type: string): string {
  switch (type) {
    case "repair":
      return "Repair"
    case "pm":
      return "PM"
    case "inspection":
      return "Inspection"
    case "install":
      return "Install"
    case "emergency":
      return "Emergency"
    default:
      return "Repair"
  }
}

const WO_SCHEDULE_STATUS_BADGE: Record<string, string> = {
  open: "bg-muted text-muted-foreground border-border",
  scheduled: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  in_progress: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  completed: "bg-muted text-muted-foreground border-border",
  invoiced: "bg-muted text-muted-foreground border-border",
}

const AVATAR_COLORS = [
  "bg-[oklch(0.48_0.18_245)]",
  "bg-[oklch(0.44_0.16_160)]",
  "bg-[oklch(0.52_0.20_290)]",
  "bg-[oklch(0.47_0.20_25)]",
  "bg-[oklch(0.50_0.18_55)]",
  "bg-primary",
]

function avatarColor(id: string) {
  const match = id.match(/(\d+)/)
  const idx = match ? parseInt(match[1]!, 10) : id.charCodeAt(0)
  return AVATAR_COLORS[Math.abs(idx) % AVATAR_COLORS.length]
}

function MemberStatusBadge({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30"
      : status === "suspended"
        ? "bg-destructive/10 text-destructive border-destructive/30"
        : "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30"
  return (
    <Badge variant="secondary" className={cn("text-xs font-medium border capitalize", cls)}>
      {status}
    </Badge>
  )
}

function MockPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center space-y-2">
      <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{title}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  )
}

export interface TechnicianDrawerProps {
  techId: string | null
  onClose: () => void
  onMessage?: (tech: { id: string; name: string; email: string }) => void
  onSchedule?: (tech: { id: string; name: string }) => void
  onUpdated?: () => void
}

export function TechnicianDrawer({
  techId,
  onClose,
  onMessage,
  onSchedule,
  onUpdated,
}: TechnicianDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>("overview")
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [viewerUserId, setViewerUserId] = useState<string | null>(null)
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [memberRole, setMemberRole] = useState<string>("tech")
  const [memberStatus, setMemberStatus] = useState<string>("active")

  const [editOpen, setEditOpen] = useState(false)
  const [draftName, setDraftName] = useState("")
  const [draftRole, setDraftRole] = useState<string>("tech")
  const [draftStatus, setDraftStatus] = useState<string>("active")
  const [editSaving, setEditSaving] = useState(false)

  const [openScheduleWoId, setOpenScheduleWoId] = useState<string | null>(null)
  const [scheduleRefresh, setScheduleRefresh] = useState(0)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [scheduleRows, setScheduleRows] = useState<
    Array<{
      id: string
      title: string
      typeLabel: string
      statusDb: string
      scheduled_on: string
      timeLabel: string
      customerName: string
      equipmentLine: string
    }>
  >([])

  function toast(message: string, type: "success" | "info" = "success") {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  const reloadTech = useCallback(async () => {
    if (!techId) return
    setLoading(true)
    setLoadError(null)
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoadError("Not signed in.")
      setLoading(false)
      return
    }

    setViewerUserId(user.id)

    const { data: viewerProfile } = await supabase
      .from("profiles")
      .select("default_organization_id")
      .eq("id", user.id)
      .single()

    const oid = viewerProfile?.default_organization_id ?? null
    setOrgId(oid)

    if (!oid) {
      setLoadError("No default organization.")
      setLoading(false)
      return
    }

    const { data: viewerOm } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", oid)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    const vr = (viewerOm as { role: string } | null)?.role ?? ""
    setViewerIsAdmin(vr === "owner" || vr === "admin")

    const { data: targetProfile, error: pErr } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", techId)
      .single()

    if (pErr || !targetProfile) {
      setLoadError(pErr?.message ?? "Could not load profile.")
      setLoading(false)
      return
    }

    const { data: targetOm, error: omErr } = await supabase
      .from("organization_members")
      .select("role, status")
      .eq("organization_id", oid)
      .eq("user_id", techId)
      .maybeSingle()

    if (omErr || !targetOm) {
      setLoadError(omErr?.message ?? "This user is not a member of your organization.")
      setLoading(false)
      return
    }

    const tp = targetProfile as { full_name: string | null; email: string | null }
    const tom = targetOm as { role: string; status: string }

    setFullName(tp.full_name?.trim() || tp.email?.split("@")[0] || "Member")
    setEmail(tp.email ?? "")
    setMemberRole(tom.role)
    setMemberStatus(tom.status)
    setLoading(false)
  }, [techId])

  useEffect(() => {
    if (!techId) return
    void reloadTech()
  }, [techId, reloadTech])

  useEffect(() => {
    setOpenScheduleWoId(null)
    setTab("overview")
  }, [techId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (openScheduleWoId) return
      if (editOpen) return
      onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose, openScheduleWoId, editOpen])

  useEffect(() => {
    if (tab !== "schedule" || !techId || !orgId) return

    let cancelled = false

    async function loadSchedule() {
      setScheduleLoading(true)
      setScheduleError(null)
      const supabase = createBrowserSupabaseClient()

      const { data: woRows, error: woError } = await supabase
        .from("work_orders")
        .select(
          "id, title, status, type, scheduled_on, scheduled_time, customer_id, equipment_id"
        )
        .eq("organization_id", orgId)
        .eq("assigned_user_id", techId)
        .eq("is_archived", false)
        .not("scheduled_on", "is", null)

      if (woError || cancelled) {
        if (!cancelled) {
          setScheduleRows([])
          setScheduleLoading(false)
          setScheduleError(woError?.message ?? "Failed to load schedule.")
        }
        return
      }

      const raw = (woRows ?? []) as Array<{
        id: string
        title: string
        status: string
        type: string
        scheduled_on: string
        scheduled_time: string | null
        customer_id: string
        equipment_id: string
      }>

      const upcoming = raw.filter((r) => r.status !== "completed" && r.status !== "invoiced")
      upcoming.sort((a, b) => {
        const d = a.scheduled_on.localeCompare(b.scheduled_on)
        if (d !== 0) return d
        const ta = a.scheduled_time ?? "99:99:99"
        const tb = b.scheduled_time ?? "99:99:99"
        return String(ta).localeCompare(String(tb))
      })

      const customerIds = [...new Set(upcoming.map((r) => r.customer_id))]
      const equipmentIds = [...new Set(upcoming.map((r) => r.equipment_id))]

      const customerMap = new Map<string, string>()
      if (customerIds.length > 0) {
        const { data: custRows } = await supabase
          .from("customers")
          .select("id, company_name")
          .eq("organization_id", orgId)
          .in("id", customerIds)
        ;((custRows as Array<{ id: string; company_name: string }> | null) ?? []).forEach((c) => {
          customerMap.set(c.id, c.company_name)
        })
      }

      const equipmentMap = new Map<string, { name: string; location: string }>()
      if (equipmentIds.length > 0) {
        const { data: eqRows } = await supabase
          .from("equipment")
          .select("id, name, location_label")
          .eq("organization_id", orgId)
          .in("id", equipmentIds)
        ;(
          (eqRows as Array<{ id: string; name: string; location_label: string | null }> | null) ??
          []
        ).forEach((e) => {
          equipmentMap.set(e.id, { name: e.name, location: e.location_label?.trim() ?? "" })
        })
      }

      if (cancelled) return

      const mapped = upcoming.map((r) => {
        const eq = equipmentMap.get(r.equipment_id)
        const loc = eq?.location
        const equipmentLine =
          eq && loc ? `${eq.name} · ${loc}` : eq?.name ?? "Equipment"
        return {
          id: r.id,
          title: r.title,
          typeLabel: mapDbTypeToLabel(r.type),
          statusDb: r.status,
          scheduled_on: r.scheduled_on,
          timeLabel: formatWoScheduleTime(r.scheduled_time),
          customerName: customerMap.get(r.customer_id) ?? "Customer",
          equipmentLine,
        }
      })

      setScheduleRows(mapped)
      setScheduleLoading(false)
    }

    void loadSchedule()
    return () => {
      cancelled = true
    }
  }, [tab, techId, orgId, scheduleRefresh])

  function openEdit() {
    setDraftName(fullName)
    setDraftRole(memberRole)
    setDraftStatus(memberStatus)
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!techId || !orgId) return
    const nameTrim = draftName.trim()
    if (!nameTrim) {
      toast("Name is required.", "info")
      return
    }

    setEditSaving(true)
    const supabase = createBrowserSupabaseClient()
    const isSelf = viewerUserId === techId
    const canMemberFields = viewerIsAdmin

    try {
      if (canMemberFields) {
        const { error: pErr } = await supabase
          .from("profiles")
          .update({ full_name: nameTrim, updated_at: new Date().toISOString() })
          .eq("id", techId)

        if (pErr) {
          toast(pErr.message, "info")
          setEditSaving(false)
          return
        }

        const { error: omErr } = await supabase
          .from("organization_members")
          .update({
            role: draftRole,
            status: draftStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", orgId)
          .eq("user_id", techId)

        if (omErr) {
          toast(omErr.message, "info")
          setEditSaving(false)
          return
        }

        setFullName(nameTrim)
        setMemberRole(draftRole)
        setMemberStatus(draftStatus)
      } else if (isSelf) {
        const { error: pErr } = await supabase
          .from("profiles")
          .update({ full_name: nameTrim, updated_at: new Date().toISOString() })
          .eq("id", techId)

        if (pErr) {
          toast(pErr.message, "info")
          setEditSaving(false)
          return
        }
        setFullName(nameTrim)
      } else {
        setEditSaving(false)
        return
      }

      toast("Technician updated.")
      setEditOpen(false)
      onUpdated?.()
      void reloadTech()
    } finally {
      setEditSaving(false)
    }
  }

  const displayName = fullName || email || "Technician"
  const avatarLetter = initialsFromName(displayName)
  const isSelf = viewerUserId !== null && techId === viewerUserId
  const showEdit =
    techId && (viewerIsAdmin || isSelf) && !loading && !loadError

  const TABS: DrawerTab[] = ["overview", "schedule", "certifications", "history", "performance", "notes"]

  if (!techId) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-background border-l border-border shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-2 p-6 border-b border-border shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className={cn(
                "rounded-full flex items-center justify-center font-semibold text-white shrink-0 ring-2 ring-background select-none w-14 h-14 text-base",
                techId ? avatarColor(techId) : AVATAR_COLORS[0]
              )}
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : avatarLetter}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-lg font-bold text-foreground truncate">{displayName}</h2>
                {!loading && !loadError && <MemberStatusBadge status={memberStatus} />}
              </div>
              <p className="text-sm text-muted-foreground">{formatMemberRole(memberRole)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {showEdit && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs cursor-pointer" onClick={openEdit}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-0 border-b border-border shrink-0 px-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "capitalize text-sm py-3 px-2.5 border-b-2 font-medium transition-colors whitespace-nowrap cursor-pointer",
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "notes" ? (
                <span className="flex items-center gap-1">
                  <StickyNote className="w-3.5 h-3.5" />
                  Notes
                </span>
              ) : (
                t
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loadError && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{loadError}</p>
          )}

          {loading && !loadError && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-8 h-8 animate-spin" />
              Loading technician…
            </div>
          )}

          {!loading && !loadError && tab === "overview" && (
            <>
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    <Mail className="w-3 h-3" />
                    Email
                  </div>
                  <p className="text-xs font-medium text-foreground truncate">
                    {email ? (
                      <a href={`mailto:${email}`} className="text-primary hover:underline">
                        {email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Organization role</div>
                  <p className="text-xs font-medium text-foreground">{formatMemberRole(memberRole)}</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Membership status</div>
                  <p className="text-xs font-medium text-foreground capitalize">{memberStatus}</p>
                </div>
              </div>
            </>
          )}

          {!loading && !loadError && tab === "schedule" && (
            <>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Upcoming Assignments</p>
              {scheduleLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Loading schedule…
                </div>
              ) : scheduleError ? (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{scheduleError}</p>
              ) : scheduleRows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No upcoming assignments scheduled.</div>
              ) : (
                <div className="space-y-3">
                  {scheduleRows.map((entry) => (
                    <div
                      key={entry.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenScheduleWoId(entry.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setOpenScheduleWoId(entry.id)
                        }
                      }}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 hover:border-primary/30 transition-colors cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary leading-none">
                          {new Date(entry.scheduled_on + "T12:00:00").toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
                        </span>
                        <span className="text-sm font-bold text-primary leading-none">
                          {new Date(entry.scheduled_on + "T12:00:00").getDate()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {entry.title}
                          </p>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[10px] shrink-0 border",
                              WO_SCHEDULE_STATUS_BADGE[entry.statusDb] ?? WO_SCHEDULE_STATUS_BADGE.open
                            )}
                          >
                            {mapDbStatusToLabel(entry.statusDb)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{entry.customerName}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{entry.equipmentLine}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {entry.typeLabel} · {entry.timeLabel} · <span className="font-mono text-primary">{entry.id.slice(0, 8)}…</span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-xs h-8 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenScheduleWoId(entry.id)
                        }}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && !loadError && tab === "certifications" && (
            <MockPlaceholder
              title="Certifications"
              body="Certifications are not stored in the database yet. This tab is reserved for future use."
            />
          )}

          {!loading && !loadError && tab === "history" && (
            <MockPlaceholder
              title="Job history"
              body="Historical jobs beyond active work orders are not modeled yet. Use work orders and schedule for current assignments."
            />
          )}

          {!loading && !loadError && tab === "performance" && (
            <MockPlaceholder
              title="Performance metrics"
              body="Ratings, utilization, and KPIs were mock-only. Persisted metrics will appear here when available."
            />
          )}

          {!loading && !loadError && tab === "notes" && (
            <MockPlaceholder
              title="Internal notes"
              body="Technician notes are not stored yet. This section is a placeholder."
            />
          )}
        </div>

        {(onMessage || onSchedule) && (
          <div className="p-4 border-t border-border flex gap-2 shrink-0">
            {onMessage && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 cursor-pointer"
                onClick={() => onMessage({ id: techId, name: displayName, email })}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Message
              </Button>
            )}
            {onSchedule && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 cursor-pointer"
                  onClick={() => onSchedule({ id: techId, name: displayName })}
                >
                  <Calendar className="w-3.5 h-3.5" /> Schedule
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1 gap-1.5 cursor-pointer"
                  onClick={() => onSchedule({ id: techId, name: displayName })}
                >
                  <ClipboardList className="w-3.5 h-3.5" /> Assign Job
                </Button>
              </>
            )}
          </div>
        )}
      </aside>

      <WorkOrderDrawer
        workOrderId={openScheduleWoId}
        onClose={() => setOpenScheduleWoId(null)}
        onUpdated={() => setScheduleRefresh((n) => n + 1)}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit technician</DialogTitle>
            <DialogDescription>
              {viewerIsAdmin
                ? "Update display name and organization membership for this user."
                : "Update your display name. Ask an owner or admin to change role or status."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tech-full-name">Full name</Label>
              <Input
                id="tech-full-name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label>Organization role</Label>
              <Select value={draftRole} onValueChange={setDraftRole} disabled={!viewerIsAdmin}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="cursor-pointer">
                      {formatMemberRole(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Membership status</Label>
              <Select value={draftStatus} onValueChange={setDraftStatus} disabled={!viewerIsAdmin}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="cursor-pointer capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveEdit()} disabled={editSaving}>
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
