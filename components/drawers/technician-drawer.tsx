"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import type { TechSkill, TechStatus } from "@/lib/mock-data"
import {
  ALL_REGIONS,
  ALL_ROLES,
  ALL_SKILLS,
  ALL_STATUSES,
} from "@/lib/technicians/roster-form-constants"
import {
  queryDrawerOrganizationMember,
  queryDrawerProfile,
} from "@/lib/technicians/roster-queries"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { formatWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
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
import { DrawerViewport, DrawerToastStack, type ToastItem } from "@/components/detail-drawer"
import {
  Mail,
  Calendar,
  ClipboardList,
  Wrench,
  MessageSquare,
  X,
  Loader2,
  Pencil,
  StickyNote,
  Trash2,
  Camera,
} from "lucide-react"
import { TechnicianAvatar } from "@/components/technician/technician-avatar"
import {
  uploadProfileAvatar,
  removeAvatarObjectIfInBucket,
} from "@/lib/profile/avatar-storage"

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
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Coming soon</p>
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
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const [tab, setTab] = useState<DrawerTab>("overview")
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewerUserId, setViewerUserId] = useState<string | null>(null)
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [memberRole, setMemberRole] = useState<string>("tech")
  const [memberStatus, setMemberStatus] = useState<string>("active")
  const [jobTitle, setJobTitle] = useState("")
  const [region, setRegion] = useState("")
  const [skills, setSkills] = useState<TechSkill[]>([])
  const [availabilityStatus, setAvailabilityStatus] = useState<TechStatus>("Available")
  const [startDate, setStartDate] = useState("")

  const [editOpen, setEditOpen] = useState(false)
  const [draftName, setDraftName] = useState("")
  const [draftPhone, setDraftPhone] = useState("")
  const [draftOrgRole, setDraftOrgRole] = useState<string>("tech")
  const [draftMemberStatus, setDraftMemberStatus] = useState<string>("active")
  const [draftJobTitle, setDraftJobTitle] = useState("")
  const [draftRegion, setDraftRegion] = useState("")
  const [draftSkills, setDraftSkills] = useState<TechSkill[]>([])
  const [draftAvailability, setDraftAvailability] = useState<TechStatus>("Available")
  const [draftStartDate, setDraftStartDate] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const avatarFileRef = useRef<HTMLInputElement>(null)

  const [openScheduleWoId, setOpenScheduleWoId] = useState<string | null>(null)
  const [scheduleRefresh, setScheduleRefresh] = useState(0)
  const [assignmentListRefresh, setAssignmentListRefresh] = useState(0)
  const [openAssignments, setOpenAssignments] = useState<
    Array<{
      id: string
      title: string
      status: string
      scheduled_on: string | null
      work_order_number?: number | null
    }>
  >([])
  const [openAssignmentsLoading, setOpenAssignmentsLoading] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [scheduleRows, setScheduleRows] = useState<
    Array<{
      id: string
      workOrderNumber: number
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

    const oid = orgStatus === "ready" ? activeOrgId : null

    if (!oid) {
      setLoadError(orgStatus === "ready" && !activeOrgId ? "No organization selected." : "Loading organization…")
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

    const { data: targetProfile, error: pErr } = await queryDrawerProfile(supabase, techId)

    if (pErr || !targetProfile) {
      setLoadError(pErr?.message ?? "Could not load profile.")
      setLoading(false)
      return
    }

    const { data: targetOm, error: omErr } = await queryDrawerOrganizationMember(supabase, oid, techId)

    if (omErr || !targetOm) {
      setLoadError(omErr?.message ?? "This user is not a member of your organization.")
      setLoading(false)
      return
    }

    const tp = targetProfile as {
      full_name: string | null
      email: string | null
      avatar_url: string | null
      phone?: string | null
    }
    const tom = targetOm as {
      role: string
      status: string
      job_title?: string | null
      region?: string | null
      skills?: string[] | null
      availability_status?: string | null
      start_date?: string | null
    }

    const skillAllow = new Set<string>(ALL_SKILLS)
    const parsedSkills = (tom.skills ?? []).filter((s): s is TechSkill => skillAllow.has(s))
    const av = tom.availability_status
    const parsedAvail: TechStatus =
      av === "Available" || av === "On Job" || av === "Off" || av === "Vacation" ? av : "Available"
    const sd = tom.start_date != null ? String(tom.start_date) : ""
    const startDateStr = /^\d{4}-\d{2}-\d{2}/.test(sd) ? sd.slice(0, 10) : ""

    setFullName(tp.full_name?.trim() || tp.email?.split("@")[0] || "Member")
    setEmail(tp.email ?? "")
    setPhone(tp.phone?.trim() ?? "")
    setAvatarUrl(tp.avatar_url?.trim() || null)
    setMemberRole(tom.role)
    setMemberStatus(tom.status)
    setJobTitle(tom.job_title?.trim() ?? "")
    setRegion(tom.region?.trim() ?? "")
    setSkills(parsedSkills)
    setAvailabilityStatus(parsedAvail)
    setStartDate(startDateStr)
    setLoading(false)
  }, [techId, activeOrgId, orgStatus])

  useEffect(() => {
    if (!techId) return
    void reloadTech()
  }, [techId, reloadTech])

  useEffect(() => {
    setOpenScheduleWoId(null)
    setTab("overview")
  }, [techId])

  useEffect(() => {
    if (!techId || orgStatus !== "ready" || !activeOrgId) {
      setOpenAssignments([])
      return
    }

    let cancelled = false

    async function loadOpenAssignments() {
      setOpenAssignmentsLoading(true)
      const supabase = createBrowserSupabaseClient()
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, title, status, scheduled_on, work_order_number")
        .eq("organization_id", activeOrgId)
        .eq("assigned_user_id", techId)
        .eq("is_archived", false)
        .in("status", ["open", "scheduled", "in_progress"])
        .order("scheduled_on", { ascending: true, nullsFirst: false })

      if (cancelled) return
      if (error) {
        setOpenAssignments([])
        setOpenAssignmentsLoading(false)
        return
      }
      setOpenAssignments(
        (data ?? []) as Array<{
          id: string
          title: string
          status: string
          scheduled_on: string | null
          work_order_number?: number | null
        }>,
      )
      setOpenAssignmentsLoading(false)
    }

    void loadOpenAssignments()
    return () => {
      cancelled = true
    }
  }, [techId, activeOrgId, orgStatus, scheduleRefresh, assignmentListRefresh])

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
    if (tab !== "schedule" || !techId || !activeOrgId) return

    let cancelled = false

    async function loadSchedule() {
      setScheduleLoading(true)
      setScheduleError(null)
      const supabase = createBrowserSupabaseClient()

      const techSchedSelectWithNum =
        "id, work_order_number, title, status, type, scheduled_on, scheduled_time, customer_id, equipment_id"
      const techSchedSelect = techSchedSelectWithNum.replace("work_order_number, ", "")

      let woRes = await supabase
        .from("work_orders")
        .select(techSchedSelectWithNum)
        .eq("organization_id", activeOrgId)
        .eq("assigned_user_id", techId)
        .eq("is_archived", false)
        .not("scheduled_on", "is", null)

      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes = await supabase
          .from("work_orders")
          .select(techSchedSelect)
          .eq("organization_id", activeOrgId)
          .eq("assigned_user_id", techId)
          .eq("is_archived", false)
          .not("scheduled_on", "is", null)
      }

      const { data: woRows, error: woError } = woRes

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
        work_order_number?: number | null
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
          .eq("organization_id", activeOrgId)
          .in("id", customerIds)
        ;((custRows as Array<{ id: string; company_name: string }> | null) ?? []).forEach((c) => {
          customerMap.set(c.id, c.company_name)
        })
      }

      const equipmentMap = new Map<
        string,
        {
          name: string
          location: string
          equipment_code: string | null
          serial_number: string | null
          category: string | null
        }
      >()
      if (equipmentIds.length > 0) {
        const { data: eqRows } = await supabase
          .from("equipment")
          .select("id, name, location_label, equipment_code, serial_number, category")
          .eq("organization_id", activeOrgId)
          .in("id", equipmentIds)
        ;(
          (eqRows as Array<{
            id: string
            name: string
            location_label: string | null
            equipment_code: string | null
            serial_number: string | null
            category: string | null
          }> | null) ?? []
        ).forEach((e) => {
          equipmentMap.set(e.id, {
            name: e.name,
            location: e.location_label?.trim() ?? "",
            equipment_code: e.equipment_code,
            serial_number: e.serial_number,
            category: e.category,
          })
        })
      }

      if (cancelled) return

      const mapped = upcoming.map((r) => {
        const eq = equipmentMap.get(r.equipment_id)
        const loc = eq?.location
        const primary = eq
          ? getEquipmentDisplayPrimary({
              id: r.equipment_id,
              name: eq.name,
              equipment_code: eq.equipment_code,
              serial_number: eq.serial_number,
              category: eq.category,
            })
          : "Equipment"
        const equipmentLine = eq && loc ? `${primary} · ${loc}` : primary
        return {
          id: r.id,
          workOrderNumber: r.work_order_number ?? undefined,
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
  }, [tab, techId, activeOrgId, scheduleRefresh])

  function openEdit() {
    const jobTitleSet = new Set<string>(ALL_ROLES)
    const regionSet = new Set<string>(ALL_REGIONS)
    setDraftName(fullName)
    setDraftPhone(phone)
    setDraftOrgRole(memberRole)
    setDraftMemberStatus(memberStatus)
    setDraftJobTitle(jobTitle.trim() && jobTitleSet.has(jobTitle) ? jobTitle : "")
    setDraftRegion(region.trim() && regionSet.has(region) ? region : "")
    setDraftSkills([...skills])
    setDraftAvailability(availabilityStatus)
    setDraftStartDate(startDate)
    setAvatarError(null)
    setEditOpen(true)
  }

  function toggleDraftSkill(s: TechSkill) {
    setDraftSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const canEditAvatar = Boolean(
    techId && (viewerIsAdmin || (viewerUserId !== null && techId === viewerUserId)),
  )

  async function applyAvatarFile(file: File) {
    if (!techId || !canEditAvatar) return
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose an image file (JPEG, PNG, WebP, or GIF).")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image must be 5 MB or smaller.")
      return
    }

    setAvatarUploading(true)
    setAvatarError(null)
    const supabase = createBrowserSupabaseClient()

    const uploaded = await uploadProfileAvatar(supabase, { targetUserId: techId, file })
    if ("error" in uploaded) {
      setAvatarError(uploaded.error)
      setAvatarUploading(false)
      return
    }

    await removeAvatarObjectIfInBucket(supabase, avatarUrl)

    const { error: upProf } = await supabase
      .from("profiles")
      .update({ avatar_url: uploaded.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", techId)

    if (upProf) {
      setAvatarError(upProf.message)
      setAvatarUploading(false)
      return
    }

    setAvatarUrl(uploaded.publicUrl)
    setAvatarUploading(false)
    toast("Profile photo updated.")
    onUpdated?.()
  }

  async function removeAvatarPhoto() {
    if (!techId || !canEditAvatar) return
    setAvatarUploading(true)
    setAvatarError(null)
    const supabase = createBrowserSupabaseClient()

    await removeAvatarObjectIfInBucket(supabase, avatarUrl)

    const { error: upProf } = await supabase
      .from("profiles")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("id", techId)

    if (upProf) {
      setAvatarError(upProf.message)
      setAvatarUploading(false)
      return
    }

    setAvatarUrl(null)
    setAvatarUploading(false)
    toast("Profile photo removed.")
    onUpdated?.()
  }

  async function saveEdit() {
    if (!techId || !activeOrgId) return
    const nameTrim = draftName.trim()
    if (!nameTrim) {
      toast("Name is required.", "info")
      return
    }

    setEditSaving(true)
    const supabase = createBrowserSupabaseClient()
    const editingSelf = viewerUserId === techId
    const canMemberFields = viewerIsAdmin

    const rosterFields = {
      job_title: draftJobTitle.trim() || null,
      region: draftRegion.trim() || null,
      skills: draftSkills,
      availability_status: draftAvailability,
      start_date: draftStartDate.trim() || null,
    }

    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          full_name: nameTrim,
          phone: draftPhone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", techId)

      if (pErr) {
        toast(pErr.message, "info")
        setEditSaving(false)
        return
      }

      if (canMemberFields) {
        const { error: omErr } = await supabase
          .from("organization_members")
          .update({
            role: draftOrgRole,
            status: draftMemberStatus,
            job_title: rosterFields.job_title,
            region: rosterFields.region,
            skills: rosterFields.skills,
            availability_status: rosterFields.availability_status,
            start_date: rosterFields.start_date,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", activeOrgId)
          .eq("user_id", techId)

        if (omErr) {
          toast(omErr.message, "info")
          setEditSaving(false)
          return
        }
      } else if (editingSelf) {
        const { error: rpcErr } = await supabase.rpc("patch_member_roster_details", {
          p_organization_id: activeOrgId,
          p_user_id: techId,
          p_job_title: rosterFields.job_title,
          p_region: rosterFields.region,
          p_skills: rosterFields.skills,
          p_availability_status: rosterFields.availability_status,
          p_start_date: rosterFields.start_date,
        })

        if (rpcErr) {
          toast(rpcErr.message, "info")
          setEditSaving(false)
          return
        }
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
      <DrawerViewport open={!!techId} onClose={onClose} width="lg" ariaLabel={displayName}>
        <div className="flex items-start justify-between gap-2 p-6 border-b border-border shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            {loading ? (
              <div
                className={cn(
                  "rounded-full flex items-center justify-center shrink-0 ring-2 ring-background select-none w-14 h-14 text-base",
                  techId ? avatarColor(techId) : AVATAR_COLORS[0],
                )}
              >
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            ) : (
              <TechnicianAvatar
                userId={techId}
                name={displayName}
                initials={avatarLetter}
                avatarUrl={avatarUrl}
                size="lg"
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-lg font-bold text-foreground truncate">{displayName}</h2>
                {!loading && !loadError && <MemberStatusBadge status={memberStatus} />}
              </div>
              <p className="text-sm text-muted-foreground">
                {jobTitle.trim() ? jobTitle : formatMemberRole(memberRole)}
              </p>
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

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
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
                {phone.trim() ? (
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Phone</div>
                    <p className="text-xs font-medium text-foreground">{phone}</p>
                  </div>
                ) : null}
                {jobTitle.trim() ? (
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Role</div>
                    <p className="text-xs font-medium text-foreground">{jobTitle}</p>
                  </div>
                ) : null}
                {region.trim() ? (
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Region</div>
                    <p className="text-xs font-medium text-foreground">{region}</p>
                  </div>
                ) : null}
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Field status</div>
                  <p className="text-xs font-medium text-foreground">{availabilityStatus}</p>
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

              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Open work orders</p>
                </div>
                {openAssignmentsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading assignments…
                  </div>
                ) : openAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open or in-progress jobs assigned.</p>
                ) : (
                  <ul className="space-y-2">
                    {openAssignments.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => setOpenScheduleWoId(row.id)}
                          className="w-full text-left rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 px-3 py-2.5 transition-colors cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-foreground line-clamp-2">{row.title}</span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] shrink-0 border capitalize",
                                WO_SCHEDULE_STATUS_BADGE[row.status] ?? WO_SCHEDULE_STATUS_BADGE.open,
                              )}
                            >
                              {mapDbStatusToLabel(row.status)}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 font-mono text-primary">
                            {formatWorkOrderDisplay(row.work_order_number, row.id)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {row.scheduled_on
                              ? `Scheduled ${new Date(row.scheduled_on + "T12:00:00").toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}`
                              : "Not scheduled"}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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
                          {entry.typeLabel} · {entry.timeLabel} · <span className="font-mono text-primary">{formatWorkOrderDisplay(entry.workOrderNumber, entry.id)}</span>
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
      </DrawerViewport>

      <WorkOrderDrawer
        workOrderId={openScheduleWoId}
        onClose={() => setOpenScheduleWoId(null)}
        onUpdated={() => {
          setScheduleRefresh((n) => n + 1)
          setAssignmentListRefresh((n) => n + 1)
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit technician</DialogTitle>
            <DialogDescription className="text-xs">
              {viewerIsAdmin
                ? "Update roster details, profile, and organization membership."
                : "Update your profile and roster details. Organization role and membership status require an owner or admin."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ""
                if (f) void applyAvatarFile(f)
              }}
            />

            {canEditAvatar ? (
              <div className="flex flex-col items-center gap-3 pb-4 border-b border-border">
                <TechnicianAvatar
                  userId={techId!}
                  name={draftName.trim() || displayName}
                  initials={initialsFromName(draftName.trim() || displayName)}
                  avatarUrl={avatarUrl}
                  size="lg"
                />
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs cursor-pointer"
                    disabled={avatarUploading || editSaving}
                    onClick={() => avatarFileRef.current?.click()}
                  >
                    {avatarUploading ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {avatarUrl ? "Change photo" : "Upload photo"}
                  </Button>
                  {avatarUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground cursor-pointer"
                      disabled={avatarUploading || editSaving}
                      onClick={() => void removeAvatarPhoto()}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Remove
                    </Button>
                  ) : null}
                </div>
                <p className="text-[10px] text-muted-foreground text-center">JPEG, PNG, WebP, or GIF · max 5 MB</p>
                {avatarError ? (
                  <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2 py-1.5 w-full text-center">
                    {avatarError}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="tech-full-name">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tech-full-name"
                  placeholder="e.g. Jordan Mills"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="tech-email">Email</Label>
                <Input
                  id="tech-email"
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  className="bg-muted/50 cursor-not-allowed"
                />
                <p className="text-[10px] text-muted-foreground">
                  Email is tied to the login account. Changing it requires account administration.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tech-phone">Phone</Label>
                <Input
                  id="tech-phone"
                  placeholder="(555) 000-0000"
                  value={draftPhone}
                  onChange={(e) => setDraftPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={draftJobTitle} onValueChange={setDraftJobTitle}>
                  <SelectTrigger id="tech-job-title" className="cursor-pointer">
                    <SelectValue placeholder="Job title (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="cursor-pointer">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Region</Label>
                <Select value={draftRegion} onValueChange={setDraftRegion}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Region (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_REGIONS.map((r) => (
                      <SelectItem key={r} value={r} className="cursor-pointer">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={draftAvailability}
                  onValueChange={(v) => setDraftAvailability(v as TechStatus)}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="cursor-pointer">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tech-start">Start Date</Label>
                <Input
                  id="tech-start"
                  type="date"
                  value={draftStartDate}
                  onChange={(e) => setDraftStartDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Skill Tags</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_SKILLS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleDraftSkill(s)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer",
                      draftSkills.includes(s)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
              <div className="space-y-1.5">
                <Label>Organization role</Label>
                <Select value={draftOrgRole} onValueChange={setDraftOrgRole} disabled={!viewerIsAdmin}>
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
                {!viewerIsAdmin ? (
                  <p className="text-[10px] text-muted-foreground">Only owners and admins can change this.</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>Membership status</Label>
                <Select
                  value={draftMemberStatus}
                  onValueChange={setDraftMemberStatus}
                  disabled={!viewerIsAdmin}
                >
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
                {!viewerIsAdmin ? (
                  <p className="text-[10px] text-muted-foreground">Only owners and admins can change this.</p>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-4">
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
