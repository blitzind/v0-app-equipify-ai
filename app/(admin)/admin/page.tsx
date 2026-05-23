"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Building2, Users, DollarSign, TrendingUp, TrendingDown, MoreHorizontal,
  LogIn, ShieldAlert, CheckCircle2, XCircle, Clock, Zap, AlertTriangle,
  ChevronRight, ArrowUpRight, Filter, Info, Eye, RefreshCw, RotateCcw,
  ScrollText, Gauge, Flag, Activity, Archive, Trash2, Loader2, CreditCard, Ticket, Brain, Database,
} from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import {
  FEATURE_FLAGS, ADMIN_AUDIT_LOG,
  type AccountDisplayStatus,
  type PlatformAccount,
  type PlatformAccountsSummary,
  type FeatureFlag,
} from "@/lib/admin-data"
import { initialsFromDisplayLabel } from "@/lib/user-display"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BrandLogo } from "@/components/brand-logo"
import { AiOperationsContent } from "@/components/admin/ai-operations-content"
import { BlitzpayOperationsContent } from "@/components/admin/blitzpay-operations-content"
import { ImportOperationsContent } from "@/components/admin/import-operations-content"
import { MasterContextTabContent } from "@/components/admin/master-context-tab-content"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import { planTierLabelFromDbPlanId } from "@/lib/plan-display"
import { applyDiscountToMrrCents, resolveListMrrCents } from "@/lib/billing/discount-pricing"
import type { OrganizationDeleteInvoiceBlockDetails } from "@/lib/platform/organization-delete-guards"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_PLAN_OPTIONS = [
  { id: "solo", label: "Solo" },
  { id: "core", label: "Core" },
  { id: "growth", label: "Growth" },
  { id: "scale", label: "Scale" },
] as const

const ADMIN_BILLING_STATUSES = [
  { id: "trialing", label: "Trialing" },
  { id: "active", label: "Active" },
  { id: "past_due", label: "Past Due" },
  { id: "canceled", label: "Canceled" },
] as const

function billingStatusLabel(raw: string | null | undefined): string {
  if (!raw) return "—"
  const s = raw.trim().toLowerCase()
  const row = ADMIN_BILLING_STATUSES.find((x) => x.id === s)
  return row?.label ?? raw.replace(/_/g, " ")
}

/** Plan pill from `organization_subscriptions.plan_id` only (no demo / tier fallback). */
function adminPlanPillFromAccount(account: PlatformAccount): string {
  return planTierLabelFromDbPlanId(account.planId)
}

/** Status pill from org archive + raw `subscriptionStatus` only. */
function adminStatusPillFromAccount(account: PlatformAccount): AccountDisplayStatus {
  if (account.organizationArchived) return "Archived"
  const raw = account.subscriptionStatus
  if (raw == null || String(raw).trim() === "") return "—"
  const st = String(raw).trim().toLowerCase()
  switch (st) {
    case "trialing":
      return "Trialing"
    case "active":
      return "Active"
    case "past_due":
      return "Past Due"
    case "canceled":
    case "unpaid":
      return "Canceled"
    case "paused":
      return "Suspended"
    case "incomplete":
      return "Trialing"
    case "incomplete_expired":
      return "Canceled"
    default:
      return "—"
  }
}

function initialPlanKey(account: PlatformAccount): string {
  const raw = account.planId
  if (raw != null && String(raw).trim() !== "") {
    const t = String(raw).trim().toLowerCase()
    if (t === "enterprise") return "scale"
    return normalizePlanIdForRead(raw)
  }
  return "solo"
}

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function datetimeLocalToIso(local: string): string | null {
  const t = local.trim()
  if (!t) return null
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function normalizeAdminBillingStatus(raw: string | null | undefined): (typeof ADMIN_BILLING_STATUSES)[number]["id"] {
  const s = raw?.trim().toLowerCase() ?? ""
  if (s === "trialing" || s === "active" || s === "past_due" || s === "canceled") return s
  if (s === "unpaid") return "canceled"
  return "active"
}

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

/** End of local calendar day for expiration. */
function dateInputToExpiresIso(dateStr: string): string | null {
  const t = dateStr.trim()
  if (!t) return null
  const d = new Date(`${t}T23:59:59`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

const DISCOUNT_TYPE_OPTIONS = [
  { id: "none", label: "None" },
  { id: "percent", label: "Percent" },
  { id: "fixed", label: "Fixed amount" },
] as const

function fmt$(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
}

function statusColor(status: AccountDisplayStatus) {
  switch (status) {
    case "Active":    return { color: "#15803d", bg: "#f0fdf4" }
    case "Trialing":  return { color: "#b45309", bg: "#fffbeb" }
    case "Past Due":  return { color: "#dc2626", bg: "#fef2f2" }
    case "Canceled":  return { color: "#6b7280", bg: "#f3f4f6" }
    case "Suspended": return { color: "#6b7280", bg: "#f3f4f6" }
    case "Archived":  return { color: "#64748b", bg: "#f1f5f9" }
    case "Unassigned": return { color: "#64748b", bg: "#f1f5f9" }
    case "—":         return { color: "#64748b", bg: "#f1f5f9" }
    default:          return { color: "#6b7280", bg: "#f3f4f6" }
  }
}

function TrialColumnCell({ account }: { account: PlatformAccount }) {
  const raw = account.subscriptionStatus?.trim().toLowerCase()
  const trialEnds = account.trialEndsAt
  if (raw !== "trialing" || !trialEnds) {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  const now = new Date()
  const end = new Date(trialEnds)
  const diffMs = end.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  const pill = "px-2 py-0.5 rounded bg-muted text-xs inline-block tabular-nums"

  if (days <= 0) {
    return <span className={`${pill} text-sm text-red-600 font-semibold`}>Expired</span>
  }

  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const calDiff = Math.round((startEnd.getTime() - startToday.getTime()) / 86400000)

  if (calDiff <= 0) {
    return <span className={`${pill} text-sm text-red-500 font-semibold`}>Ends today</span>
  }
  if (calDiff === 1) {
    return <span className={`${pill} text-sm text-red-500 font-semibold`}>Ends tomorrow</span>
  }

  if (days <= 3) {
    return (
      <span className={`${pill} text-sm text-orange-500 font-medium`}>Ends in {days} days</span>
    )
  }

  return <span className={`${pill} text-sm text-muted-foreground`}>{days} days left</span>
}

/** Short badge text for active internal discounts (−20% / −$50). */
function adminDiscountShortLabel(account: PlatformAccount): string | null {
  if (!account.hasActiveDiscount || !account.discountType) return null
  const t = account.discountType.trim().toLowerCase()
  if (t === "percent" && account.discountValue != null && Number.isFinite(Number(account.discountValue))) {
    return `−${Math.round(Number(account.discountValue))}%`
  }
  if (t === "fixed" && account.discountValue != null && Number.isFinite(Number(account.discountValue))) {
    return `−${fmt$(Number(account.discountValue))}`
  }
  return null
}

/** Matches server rules for when list + discount MRR is shown in the accounts grid. */
function accountShowsAdminMrr(account: PlatformAccount): boolean {
  if (account.organizationArchived) return false
  if (account.planId == null && account.subscriptionStatus == null) return false
  const st = account.subscriptionStatus?.trim().toLowerCase()
  if (!st) return false
  if (st === "canceled" || st === "unpaid" || st === "incomplete_expired") return false
  return true
}

function planColor(plan: string) {
  switch (plan) {
    case "Enterprise":
    case "Scale":
      return { color: "#7c3aed", bg: "#f5f3ff" }
    case "Growth":
      return { color: "#1d4ed8", bg: "#eff6ff" }
    case "Core":
      return { color: "#0f766e", bg: "#ccfbf1" }
    case "Solo":
      return { color: "#b45309", bg: "#fffbeb" }
    case "—":
    case "No plan":
      return { color: "#64748b", bg: "#f1f5f9" }
    default:
      return { color: "#64748b", bg: "#f1f5f9" }
  }
}

function severityIcon(sev: string) {
  if (sev === "critical") return <ShieldAlert size={13} className="ds-icon-danger shrink-0" />
  if (sev === "warning")  return <AlertTriangle size={13} className="ds-icon-warning shrink-0" />
  return <Info size={13} className="ds-icon-info shrink-0" />
}

type Tab =
  | "accounts"
  | "analytics"
  | "flags"
  | "audit"
  | "ai_operations"
  | "import_operations"
  | "master_context"
  | "blitzpay_operations"

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0" style={{ background: color + "18" }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground leading-tight mt-0.5 ds-tabular">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function AccountsTab({
  accounts,
  loading,
  loadError,
  onImpersonate,
  onRefresh,
}: {
  accounts: PlatformAccount[]
  loading: boolean
  loadError: string | null
  onImpersonate: (a: PlatformAccount) => void
  onRefresh: () => void
}) {
  const [search, setSearch] = useState("")
  const [planFilter, setPlanFilter] = useState<string>("All")
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Trialing" | "Archived">(
    "All",
  )
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null)
  const [reactivateBusyId, setReactivateBusyId] = useState<string | null>(null)
  const [convertBusyId, setConvertBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlatformAccount | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteInvoiceBlockDetails, setDeleteInvoiceBlockDetails] =
    useState<OrganizationDeleteInvoiceBlockDetails | null>(null)

  const [planTarget, setPlanTarget] = useState<PlatformAccount | null>(null)
  const [planFormPlanId, setPlanFormPlanId] = useState<string>("solo")
  const [planFormBillingCycle, setPlanFormBillingCycle] = useState<"monthly" | "annual">("monthly")
  const [planFormStatus, setPlanFormStatus] = useState<string>("trialing")
  const [planFormTrialLocal, setPlanFormTrialLocal] = useState("")
  const [planFormDiscountType, setPlanFormDiscountType] = useState<"none" | "percent" | "fixed">("none")
  const [planFormDiscountPercent, setPlanFormDiscountPercent] = useState("")
  const [planFormDiscountFixed, setPlanFormDiscountFixed] = useState("")
  const [planFormDiscountLabel, setPlanFormDiscountLabel] = useState("")
  const [planFormDiscountExpiresLocal, setPlanFormDiscountExpiresLocal] = useState("")
  const [planBusy, setPlanBusy] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [planSaveNotice, setPlanSaveNotice] = useState<string | null>(null)

  const [discountTarget, setDiscountTarget] = useState<PlatformAccount | null>(null)
  const [discountFormType, setDiscountFormType] = useState<"none" | "percent" | "fixed">("none")
  const [discountPercentValue, setDiscountPercentValue] = useState("")
  const [discountFixedDollars, setDiscountFixedDollars] = useState("")
  const [discountReason, setDiscountReason] = useState("")
  const [discountExpiresDate, setDiscountExpiresDate] = useState("")
  const [discountBusy, setDiscountBusy] = useState(false)
  const [discountError, setDiscountError] = useState<string | null>(null)

  const discountPreview = useMemo(() => {
    if (!discountTarget) return null
    const expIso = dateInputToExpiresIso(discountExpiresDate)
    const pid = normalizePlanIdForRead(String(discountTarget.planId ?? "solo"))
    const baseM = resolveListMrrCents(pid, "monthly")
    const baseA = resolveListMrrCents(pid, "annual")

    if (discountFormType === "none") {
      return {
        monthly: { base: baseM, final: baseM },
        annual: { base: baseA, final: baseA },
      }
    }

    let valueNum: number | null = null
    if (discountFormType === "percent") {
      const p = parseFloat(discountPercentValue)
      valueNum = Number.isFinite(p) ? p : null
    } else {
      const dollars = parseFloat(discountFixedDollars)
      valueNum = Number.isFinite(dollars) ? Math.round(dollars * 100) : null
    }

    if (valueNum == null || !Number.isFinite(valueNum)) {
      return {
        monthly: { base: baseM, final: baseM },
        annual: { base: baseA, final: baseA },
      }
    }

    const t = discountFormType === "none" ? null : discountFormType
    const pm = applyDiscountToMrrCents(baseM, t, valueNum, expIso)
    const pa = applyDiscountToMrrCents(baseA, t, valueNum, expIso)
    return {
      monthly: { base: baseM, final: pm.finalCents },
      annual: { base: baseA, final: pa.finalCents },
    }
  }, [
    discountTarget,
    discountFormType,
    discountPercentValue,
    discountFixedDollars,
    discountExpiresDate,
  ])

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const q = search.toLowerCase()
      const matchQ = !q || a.name.toLowerCase().includes(q) || a.ownerEmail.toLowerCase().includes(q)
      const planPill = adminPlanPillFromAccount(a)
      const statusPill = adminStatusPillFromAccount(a)
      const planForFilter = planPill === "—" ? "No plan" : planPill
      const matchPlan = planFilter === "All" || planForFilter === planFilter

      if (statusFilter === "Archived") {
        if (!a.organizationArchived) return false
      } else {
        if (a.organizationArchived) return false
        if (statusFilter === "Active" && statusPill !== "Active") return false
        if (statusFilter === "Trialing" && statusPill !== "Trialing") return false
      }

      return matchQ && matchPlan
    })
  }, [accounts, search, planFilter, statusFilter])

  const [trialSortUrgentFirst, setTrialSortUrgentFirst] = useState(false)

  const displayedAccounts = useMemo(() => {
    const rows = [...filtered]
    if (!trialSortUrgentFirst) return rows
    rows.sort((a, b) => {
      const key = (x: PlatformAccount) => {
        const st = x.subscriptionStatus?.trim().toLowerCase()
        if (st !== "trialing") return Number.POSITIVE_INFINITY
        const iso = x.trialEndsAt
        if (!iso) return Number.POSITIVE_INFINITY
        return new Date(iso).getTime()
      }
      return key(a) - key(b)
    })
    return rows
  }, [filtered, trialSortUrgentFirst])

  async function reactivateAccount(account: PlatformAccount) {
    if (!account.organizationArchived) return
    if (
      !window.confirm(
        "Reactivate this account? Users will regain access to this workspace.",
      )
    ) {
      return
    }
    setReactivateBusyId(account.id)
    try {
      const res = await fetch(`/api/platform/accounts/${account.id}/reactivate`, {
        method: "PATCH",
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) {
        window.alert(typeof data.message === "string" ? data.message : "Could not reactivate account.")
        return
      }
      await onRefresh()
    } finally {
      setReactivateBusyId(null)
    }
  }

  async function archiveAccount(account: PlatformAccount) {
    if (
      !window.confirm(
        `Archive “${account.name}”? Members will lose access; data is preserved.`,
      )
    ) {
      return
    }
    setArchiveBusyId(account.id)
    try {
      const res = await fetch(`/api/platform/accounts/${account.id}/archive`, { method: "PATCH" })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) {
        window.alert(data.message ?? "Could not archive account.")
        return
      }
      onRefresh()
    } finally {
      setArchiveBusyId(null)
      setMenuOpen(null)
    }
  }

  async function convertToPaid(account: PlatformAccount) {
    if (
      !window.confirm(
        "Open Stripe Checkout to convert this trial to a paid subscription? Payment completes on Stripe; the account updates when checkout finishes.",
      )
    ) {
      return
    }
    setConvertBusyId(account.id)
    try {
      const planId = normalizePlanIdForRead(String(account.planId ?? "solo"))
      const billingCycle = account.billingCycle === "annual" ? "annual" : "monthly"
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: account.id,
          planId,
          billingCycle,
          skipTrial: true,
        }),
      })
      const data = (await res.json()) as { url?: string; message?: string }
      if (!res.ok) {
        window.alert(typeof data.message === "string" ? data.message : "Could not start Stripe checkout.")
        return
      }
      if (data.url) {
        console.log("Converted org to paid (Stripe checkout):", account.id)
        window.open(data.url, "_blank", "noopener,noreferrer")
        setMenuOpen(null)
        return
      }
      window.alert("Stripe did not return a checkout URL.")
    } finally {
      setConvertBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteConfirmName.trim() !== deleteTarget.name.trim()) return
    setDeleteBusy(true)
    setDeleteError(null)
    setDeleteInvoiceBlockDetails(null)
    try {
      const res = await fetch(`/api/platform/accounts/${deleteTarget.id}`, { method: "DELETE" })
      const data = (await res.json()) as {
        message?: string
        error?: string
        details?: OrganizationDeleteInvoiceBlockDetails
      }
      if (!res.ok) {
        setDeleteError(data.message ?? "Delete failed.")
        if (data.error === "unpaid_invoices" && data.details) {
          setDeleteInvoiceBlockDetails(data.details)
        }
        return
      }
      setDeleteTarget(null)
      setDeleteConfirmName("")
      onRefresh()
    } finally {
      setDeleteBusy(false)
    }
  }

  function openPlanDialog(account: PlatformAccount) {
    setPlanTarget(account)
    setPlanFormPlanId(initialPlanKey(account))
    setPlanFormBillingCycle(account.billingCycle === "annual" ? "annual" : "monthly")
    setPlanFormStatus(normalizeAdminBillingStatus(account.subscriptionStatus))
    setPlanFormTrialLocal(isoToDatetimeLocal(account.trialEndsAt))
    const dt = account.discountType?.trim().toLowerCase()
    if (dt === "percent") {
      setPlanFormDiscountType("percent")
      setPlanFormDiscountPercent(
        account.discountValue != null && Number.isFinite(Number(account.discountValue))
          ? String(account.discountValue)
          : "",
      )
      setPlanFormDiscountFixed("")
    } else if (dt === "fixed") {
      setPlanFormDiscountType("fixed")
      const cents = account.discountValue != null ? Number(account.discountValue) : 0
      setPlanFormDiscountFixed(Number.isFinite(cents) && cents > 0 ? (cents / 100).toFixed(2) : "")
      setPlanFormDiscountPercent("")
    } else {
      setPlanFormDiscountType("none")
      setPlanFormDiscountPercent("")
      setPlanFormDiscountFixed("")
    }
    setPlanFormDiscountLabel((account.discountLabel ?? account.discountReason ?? "").trim())
    setPlanFormDiscountExpiresLocal(isoToDatetimeLocal(account.discountExpiresAt))
    setPlanError(null)
    setPlanSaveNotice(null)
    setMenuOpen(null)
  }

  function openDiscountDialog(account: PlatformAccount) {
    setDiscountTarget(account)
    const dt = account.discountType?.trim().toLowerCase()
    if (dt === "percent") {
      setDiscountFormType("percent")
      setDiscountPercentValue(
        account.discountValue != null && Number.isFinite(Number(account.discountValue))
          ? String(account.discountValue)
          : "",
      )
      setDiscountFixedDollars("")
    } else if (dt === "fixed") {
      setDiscountFormType("fixed")
      const cents = account.discountValue != null ? Number(account.discountValue) : 0
      setDiscountFixedDollars(Number.isFinite(cents) && cents > 0 ? (cents / 100).toFixed(2) : "")
      setDiscountPercentValue("")
    } else {
      setDiscountFormType("none")
      setDiscountPercentValue("")
      setDiscountFixedDollars("")
    }
    setDiscountReason((account.discountLabel ?? account.discountReason ?? "").trim())
    setDiscountExpiresDate(isoToDateInput(account.discountExpiresAt))
    setDiscountError(null)
    setPlanSaveNotice(null)
    setMenuOpen(null)
  }

  async function saveDiscount() {
    if (!discountTarget) return
    setDiscountBusy(true)
    setDiscountError(null)
    try {
      if (discountFormType === "percent") {
        const p = parseFloat(discountPercentValue)
        if (!Number.isFinite(p) || p < 1 || p > 100) {
          setDiscountError("Percent discount must be between 1 and 100.")
          return
        }
      } else if (discountFormType === "fixed") {
        const dollars = parseFloat(discountFixedDollars)
        if (!Number.isFinite(dollars) || dollars <= 0) {
          setDiscountError("Fixed amount must be greater than 0.")
          return
        }
        const cents = Math.round(dollars * 100)
        const cycle = discountTarget.billingCycle === "annual" ? "annual" : "monthly"
        const base = resolveListMrrCents(
          normalizePlanIdForRead(String(discountTarget.planId ?? "solo")),
          cycle,
        )
        if (cents > base) {
          setDiscountError("Fixed discount cannot exceed list price for the current billing cycle.")
          return
        }
      }

      const res = await fetch(`/api/platform/accounts/${discountTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountType: discountFormType === "none" ? null : discountFormType,
          discountValue:
            discountFormType === "percent"
              ? parseFloat(discountPercentValue)
              : discountFormType === "fixed"
                ? Math.round(parseFloat(discountFixedDollars) * 100)
                : null,
          discountLabel: discountReason.trim() || null,
          discountReason: discountReason.trim() || null,
          discountExpiresAt: dateInputToExpiresIso(discountExpiresDate),
        }),
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) {
        setDiscountError(data.message ?? "Could not save discount.")
        return
      }
      setPlanSaveNotice("Discount saved.")
      setDiscountTarget(null)
      onRefresh()
    } finally {
      setDiscountBusy(false)
    }
  }

  async function savePlan() {
    if (!planTarget) return
    if (planFormStatus === "trialing" && !planFormTrialLocal.trim()) {
      setPlanError("Trial end date is required when status is Trialing.")
      return
    }
    if (planFormDiscountType === "percent") {
      const p = parseFloat(planFormDiscountPercent)
      if (!Number.isFinite(p) || p < 1 || p > 100) {
        setPlanError("Percent discount must be between 1 and 100.")
        return
      }
    } else if (planFormDiscountType === "fixed") {
      const dollars = parseFloat(planFormDiscountFixed)
      if (!Number.isFinite(dollars) || dollars <= 0) {
        setPlanError("Fixed discount amount must be greater than 0.")
        return
      }
      const cents = Math.round(dollars * 100)
      const cycle = planFormBillingCycle === "annual" ? "annual" : "monthly"
      const base = resolveListMrrCents(normalizePlanIdForRead(planFormPlanId), cycle)
      if (cents > base) {
        setPlanError("Fixed discount cannot exceed list price for the selected plan and billing cycle.")
        return
      }
    }

    setPlanBusy(true)
    setPlanError(null)
    try {
      const payload: Record<string, unknown> = {
        plan_id: planFormPlanId,
        billing_cycle: planFormBillingCycle,
        status: planFormStatus,
      }
      if (planFormStatus === "trialing") {
        const iso = datetimeLocalToIso(planFormTrialLocal)
        if (!iso) {
          setPlanError("Invalid trial end date.")
          return
        }
        payload.trial_ends_at = iso
      }
      const res = await fetch(`/api/platform/accounts/${planTarget.id}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) {
        setPlanError(data.message ?? "Could not update subscription.")
        return
      }

      const discRes = await fetch(`/api/platform/accounts/${planTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountType: planFormDiscountType === "none" ? null : planFormDiscountType,
          discountValue:
            planFormDiscountType === "percent"
              ? parseFloat(planFormDiscountPercent)
              : planFormDiscountType === "fixed"
                ? Math.round(parseFloat(planFormDiscountFixed) * 100)
                : null,
          discountLabel: planFormDiscountLabel.trim() || null,
          discountReason: planFormDiscountLabel.trim() || null,
          discountExpiresAt: datetimeLocalToIso(planFormDiscountExpiresLocal),
        }),
      })
      const discData = (await discRes.json()) as { message?: string }
      if (!discRes.ok) {
        setPlanError(discData.message ?? "Plan saved, but discount update failed.")
        onRefresh()
        return
      }

      setPlanSaveNotice("Subscription updated.")
      setPlanTarget(null)
      onRefresh()
    } finally {
      setPlanBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {planSaveNotice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {planSaveNotice}
        </div>
      )}
      {loadError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}
      {loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading accounts…
        </p>
      )}

      {/* Toolbar */}
      <div className="flex items-end gap-4 flex-wrap justify-between">
        <div className="flex gap-4 items-end">
          <div className="flex flex-col gap-1 w-[320px]">
            <label className="text-xs text-muted-foreground" htmlFor="platform-admin-accounts-search">
              Search
            </label>
            <Input
              id="platform-admin-accounts-search"
              placeholder="Search accounts, emails..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1 w-[180px]">
            <label className="text-xs text-muted-foreground" htmlFor="platform-admin-accounts-status">
              Status
            </label>
            <select
              id="platform-admin-accounts-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="input-base h-9 w-full text-sm"
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Trialing">Trialing</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 w-[200px]">
            <label className="text-xs text-muted-foreground" htmlFor="platform-admin-accounts-plan">
              Plan
            </label>
            <select
              id="platform-admin-accounts-plan"
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="input-base h-9 w-full text-sm"
            >
              <option value="All">All Plans</option>
              <option value="Solo">Solo</option>
              <option value="Core">Core</option>
              <option value="Growth">Growth</option>
              <option value="Scale">Scale</option>
              <option value="Enterprise">Enterprise</option>
              <option value="No plan">No plan</option>
            </select>
          </div>
        </div>
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {accounts.length} accounts
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 dark:bg-card">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Account
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Plan
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Status
                </th>
                <th
                  className="text-left px-3 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground w-[1%]"
                  title={
                    trialSortUrgentFirst
                      ? "Click to use default order"
                      : "Sort by trial end (soonest first)"
                  }
                  onClick={() => setTrialSortUrgentFirst((v) => !v)}
                >
                  Trial{trialSortUrgentFirst ? " ↑" : ""}
                </th>
                {["MRR", "Seats", "Work Orders", "Last Active", ""].map((h) => (
                  <th
                    key={h || "actions"}
                    className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedAccounts.map((account) => {
                const pillPlan = adminPlanPillFromAccount(account)
                const pillStatus = adminStatusPillFromAccount(account)
                const sc = statusColor(pillStatus)
                const pc = planColor(pillPlan)
                const archived = Boolean(account.organizationArchived)
                return (
                  <tr
                    key={account.id}
                    className="border-t border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: "var(--primary)" }}
                        >
                          {account.name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{account.name}</p>
                          <p className="text-xs text-muted-foreground">{account.ownerEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 align-top max-w-[200px]"
                      title={
                        [
                          account.subscriptionStatus ? `status: ${account.subscriptionStatus}` : null,
                          account.billingCycle ? `cycle: ${account.billingCycle}` : null,
                          account.subscriptionCurrentPeriodEnd
                            ? `period ends: ${account.subscriptionCurrentPeriodEnd.slice(0, 10)}`
                            : null,
                          account.subscriptionUpdatedAt
                            ? `subscription row updated: ${account.subscriptionUpdatedAt}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || undefined
                      }
                    >
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: pc.color, background: pc.bg }}
                      >
                        {pillPlan}
                      </span>
                      {(account.billingCycle || account.subscriptionCurrentPeriodEnd) && (
                        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                          {account.billingCycle === "annual"
                            ? "Annual"
                            : account.billingCycle === "monthly"
                              ? "Monthly"
                              : ""}
                          {account.subscriptionCurrentPeriodEnd
                            ? `${account.billingCycle ? " · " : ""}through ${account.subscriptionCurrentPeriodEnd.slice(0, 10)}`
                            : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: sc.color, background: sc.bg }}
                      >
                        {pillStatus}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top whitespace-nowrap max-w-[160px]">
                      <TrialColumnCell account={account} />
                    </td>
                    <td className="px-4 py-3 text-sm ds-tabular">
                      {!accountShowsAdminMrr(account) ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5 items-start font-medium">
                          {account.mrrBaseCents != null && account.mrrBaseCents > account.mrr ? (
                            <span className="text-xs tabular-nums">
                              <span className="text-muted-foreground line-through font-normal">
                                {fmt$(account.mrrBaseCents)}
                              </span>
                              <span className="text-muted-foreground"> → </span>
                              <span className="text-foreground font-semibold">{fmt$(account.mrr)}</span>
                            </span>
                          ) : (
                            <span className="tabular-nums">{fmt$(account.mrr)}</span>
                          )}
                          {account.hasActiveDiscount && adminDiscountShortLabel(account) && (
                            <span className="text-xs text-green-600 dark:text-green-500 font-medium tabular-nums">
                              {adminDiscountShortLabel(account)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm ds-tabular text-muted-foreground">{account.seats}</td>
                    <td className="px-4 py-3 text-sm ds-tabular text-muted-foreground">
                      {account.workOrderCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{account.lastActive}</td>
                    <td className="px-4 py-3">
                      <div className="relative flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={archived}
                          title={
                            archived
                              ? "Reactivate this account before using Login as."
                              : undefined
                          }
                          onClick={() => onImpersonate(account)}
                        >
                          <LogIn size={11} /> Login as
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setMenuOpen(menuOpen === account.id ? null : account.id)}
                        >
                          <MoreHorizontal size={13} />
                        </Button>
                        {menuOpen === account.id && (
                          <div
                            className="absolute right-0 top-8 z-50 w-52 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
                            onMouseLeave={() => setMenuOpen(null)}
                          >
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
                              disabled={archived}
                              title={
                                archived ? "Reactivate this account before impersonation." : undefined
                              }
                              onClick={() => {
                                onImpersonate(account)
                                setMenuOpen(null)
                              }}
                            >
                              <LogIn size={13} className="text-muted-foreground" /> Impersonate
                            </button>
                            {archived && (
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left text-emerald-700 dark:text-emerald-400 disabled:opacity-50"
                                disabled={reactivateBusyId === account.id}
                                onClick={() => {
                                  void reactivateAccount(account)
                                  setMenuOpen(null)
                                }}
                              >
                                {reactivateBusyId === account.id ? (
                                  <Loader2 size={13} className="animate-spin text-muted-foreground" />
                                ) : (
                                  <RotateCcw size={13} className="text-muted-foreground" />
                                )}
                                Reactivate account
                              </button>
                            )}
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
                              onClick={() => openPlanDialog(account)}
                            >
                              <CreditCard size={13} className="text-muted-foreground" /> Change plan
                            </button>
                            {account.subscriptionStatus?.trim().toLowerCase() === "trialing" &&
                              !archived && (
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left disabled:opacity-50"
                                disabled={
                                  convertBusyId === account.id ||
                                  (account.planId == null && account.subscriptionStatus == null)
                                }
                                title={
                                  account.planId == null && account.subscriptionStatus == null
                                    ? "No subscription row for this organization."
                                    : undefined
                                }
                                onClick={() => void convertToPaid(account)}
                              >
                                {convertBusyId === account.id ? (
                                  <Loader2 size={13} className="animate-spin text-muted-foreground" />
                                ) : (
                                  <Zap size={13} className="text-muted-foreground" />
                                )}
                                Convert to Paid
                              </button>
                            )}
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left disabled:opacity-50"
                              disabled={account.planId == null && account.subscriptionStatus == null}
                              title={
                                account.planId == null && account.subscriptionStatus == null
                                  ? "No subscription row yet — use Change plan first."
                                  : undefined
                              }
                              onClick={() => openDiscountDialog(account)}
                            >
                              <Ticket size={13} className="text-muted-foreground" /> Manage discount
                            </button>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 dark:text-amber-500 hover:bg-amber-500/10 transition-colors text-left disabled:opacity-50"
                              onClick={() => {
                                void archiveAccount(account)
                              }}
                              disabled={archived || archiveBusyId === account.id}
                            >
                              {archiveBusyId === account.id ? (
                                <Loader2 size={13} className="animate-spin text-amber-700 dark:text-amber-500" />
                              ) : (
                                <Archive size={13} className="text-amber-700 dark:text-amber-500" />
                              )}
                              Archive account
                            </button>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/15 transition-colors text-left"
                              onClick={() => {
                                setDeleteTarget(account)
                                setDeleteConfirmName("")
                                setDeleteError(null)
                                setDeleteInvoiceBlockDetails(null)
                                setMenuOpen(null)
                              }}
                            >
                              <Trash2 size={13} className="text-destructive" strokeWidth={2.25} /> Delete account…
                            </button>
                            <div className="border-t border-border">
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
                              >
                                <Eye size={13} className="text-muted-foreground" /> View details
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
                              >
                                <RefreshCw size={13} className="text-muted-foreground" /> Reset password
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            setDeleteConfirmName("")
            setDeleteError(null)
            setDeleteInvoiceBlockDetails(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Permanently delete organization</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the organization and related data. You cannot undo this. Deletion is blocked when there is a
            billable Stripe subscription (not trial) or non-sample customer invoices that still have a balance due
            (demo/sample invoices are ignored by this check).
          </p>
          {deleteTarget && (
            <p className="text-sm font-medium text-foreground">
              Type <span className="font-bold">{deleteTarget.name}</span> to confirm.
            </p>
          )}
          <input
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
            className="input-base w-full text-sm"
            placeholder="Organization name"
            autoComplete="off"
          />
          {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
          {deleteInvoiceBlockDetails && deleteInvoiceBlockDetails.blockingRealInvoiceCount > 0 && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs space-y-2">
              <p className="font-medium text-foreground">
                Production open AR: {deleteInvoiceBlockDetails.blockingRealInvoiceCount} invoice
                {deleteInvoiceBlockDetails.blockingRealInvoiceCount === 1 ? "" : "s"}
                {deleteInvoiceBlockDetails.excludedDemoSampleInvoicesWithBalanceDueCount > 0
                  ? ` · Demo/sample invoices with balance (not blockers): ${deleteInvoiceBlockDetails.excludedDemoSampleInvoicesWithBalanceDueCount}`
                  : ""}
              </p>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto text-muted-foreground">
                {deleteInvoiceBlockDetails.blockingInvoices.map((inv) => (
                  <li key={inv.id} className="border-b border-border/60 pb-1.5 last:border-0 last:pb-0">
                    <span className="font-mono text-[11px] text-foreground">{inv.id.slice(0, 8)}…</span>
                    {inv.invoiceNumber ? (
                      <span className="text-foreground/80"> · #{inv.invoiceNumber}</span>
                    ) : null}
                    <span className="text-foreground/80"> · {inv.status}</span>
                    <span className="tabular-nums"> · due {fmt$(inv.balanceDueCents)}</span>
                    {inv.customerLabel ? (
                      <span className="block pl-0 text-foreground/90">Customer: {inv.customerLabel}</span>
                    ) : null}
                    <span className="block text-[11px]">
                      Flags: invoice is_sample={String(inv.isSample)}
                      {inv.customerIsSample != null ? ` · customer is_sample=${String(inv.customerIsSample)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground">
                Use <span className="font-medium text-foreground">Login as</span>, then fix these{" "}
                <span className="font-medium text-foreground">production</span> invoices in Invoices or Billing (collect
                payment, void, or credit). Onboarding sample invoices are never blockers.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteTarget(null)
                setDeleteConfirmName("")
                setDeleteError(null)
                setDeleteInvoiceBlockDetails(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                deleteBusy ||
                !deleteTarget ||
                deleteConfirmName.trim() !== (deleteTarget?.name ?? "").trim()
              }
              onClick={() => void confirmDelete()}
            >
              {deleteBusy ? <Loader2 size={14} className="animate-spin" /> : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={planTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setPlanTarget(null)
            setPlanError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change plan & billing</DialogTitle>
          </DialogHeader>
          {planTarget && (
            <>
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs space-y-1">
                <p>
                  <span className="text-muted-foreground">Current plan (display):</span>{" "}
                  <span className="font-medium text-foreground">
                    {adminPlanPillFromAccount(planTarget)}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Billing status:</span>{" "}
                  <span className="font-medium text-foreground">
                    {billingStatusLabel(planTarget.subscriptionStatus)}
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Plan</label>
                  <select
                    className="input-base w-full text-sm"
                    value={planFormPlanId}
                    onChange={(e) => setPlanFormPlanId(e.target.value)}
                  >
                    {ADMIN_PLAN_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Billing cycle</label>
                  <select
                    className="input-base w-full text-sm"
                    value={planFormBillingCycle}
                    onChange={(e) => setPlanFormBillingCycle(e.target.value as "monthly" | "annual")}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>

                <div className="rounded-lg border border-border bg-card px-3 py-3 space-y-3">
                  <p className="text-xs font-semibold text-foreground">Discount</p>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Discount type</label>
                    <select
                      className="input-base w-full text-sm"
                      value={planFormDiscountType}
                      onChange={(e) =>
                        setPlanFormDiscountType(e.target.value as "none" | "percent" | "fixed")
                      }
                    >
                      {DISCOUNT_TYPE_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {planFormDiscountType === "percent" && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Percent off (1–100)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        className="input-base w-full text-sm"
                        value={planFormDiscountPercent}
                        onChange={(e) => setPlanFormDiscountPercent(e.target.value)}
                      />
                    </div>
                  )}
                  {planFormDiscountType === "fixed" && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Fixed amount off (USD)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input-base w-full text-sm"
                        value={planFormDiscountFixed}
                        onChange={(e) => setPlanFormDiscountFixed(e.target.value)}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Label (optional)
                    </label>
                    <input
                      type="text"
                      className="input-base w-full text-sm"
                      placeholder="e.g. Partner pilot"
                      value={planFormDiscountLabel}
                      onChange={(e) => setPlanFormDiscountLabel(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Expiration (optional, local time)
                    </label>
                    <input
                      type="datetime-local"
                      className="input-base w-full text-sm"
                      value={planFormDiscountExpiresLocal}
                      onChange={(e) => setPlanFormDiscountExpiresLocal(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Subscription status</label>
                  <select
                    className="input-base w-full text-sm"
                    value={planFormStatus}
                    onChange={(e) => setPlanFormStatus(e.target.value)}
                  >
                    {ADMIN_BILLING_STATUSES.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {planFormStatus === "trialing" && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Trial ends (local time)
                    </label>
                    <input
                      type="datetime-local"
                      className="input-base w-full text-sm"
                      value={planFormTrialLocal}
                      onChange={(e) => setPlanFormTrialLocal(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {planError && <p className="text-xs text-destructive">{planError}</p>}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPlanTarget(null)
                    setPlanError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" disabled={planBusy} onClick={() => void savePlan()}>
                  {planBusy ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={discountTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDiscountTarget(null)
            setDiscountError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage discount</DialogTitle>
          </DialogHeader>
          {discountTarget && discountPreview && (
            <>
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs space-y-1">
                <p>
                  <span className="text-muted-foreground">Plan:</span>{" "}
                  <span className="font-medium text-foreground">
                    {adminPlanPillFromAccount(discountTarget)}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Billing status:</span>{" "}
                  <span className="font-medium text-foreground">
                    {billingStatusLabel(discountTarget.subscriptionStatus)}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">List price (monthly):</span>{" "}
                  <span className="font-medium tabular-nums">
                    {fmt$(
                      resolveListMrrCents(
                        normalizePlanIdForRead(String(discountTarget.planId ?? "solo")),
                        "monthly",
                      ),
                    )}
                    /mo
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">List price (annual billing cycle):</span>{" "}
                  <span className="font-medium tabular-nums">
                    {fmt$(
                      resolveListMrrCents(
                        normalizePlanIdForRead(String(discountTarget.planId ?? "solo")),
                        "annual",
                      ),
                    )}
                    /mo
                  </span>
                </p>
              </div>

              <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs space-y-1">
                <p className="font-medium text-foreground">Preview</p>
                <p>
                  <span className="text-muted-foreground">Effective monthly rate:</span>{" "}
                  <span className="font-semibold tabular-nums">{fmt$(discountPreview.monthly.final)}</span>
                  {discountPreview.monthly.final < discountPreview.monthly.base && (
                    <span className="text-muted-foreground line-through ml-2 tabular-nums">
                      {fmt$(discountPreview.monthly.base)}
                    </span>
                  )}
                </p>
                <p>
                  <span className="text-muted-foreground">Effective annual-cycle rate (/mo):</span>{" "}
                  <span className="font-semibold tabular-nums">{fmt$(discountPreview.annual.final)}</span>
                  {discountPreview.annual.final < discountPreview.annual.base && (
                    <span className="text-muted-foreground line-through ml-2 tabular-nums">
                      {fmt$(discountPreview.annual.base)}
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground pt-1">
                  Percent applies to list price. Fixed amount is dollars off per billing period (stored as cents).
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Discount type</label>
                  <select
                    className="input-base w-full text-sm"
                    value={discountFormType}
                    onChange={(e) =>
                      setDiscountFormType(e.target.value as "none" | "percent" | "fixed")
                    }
                  >
                    {DISCOUNT_TYPE_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {discountFormType === "percent" && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Percent off (1–100)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      className="input-base w-full text-sm"
                      value={discountPercentValue}
                      onChange={(e) => setDiscountPercentValue(e.target.value)}
                    />
                  </div>
                )}
                {discountFormType === "fixed" && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Fixed amount off (USD per billing period)
                    </label>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      className="input-base w-full text-sm"
                      value={discountFixedDollars}
                      onChange={(e) => setDiscountFixedDollars(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    className="input-base w-full text-sm"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="e.g. Partner referral"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Discount expires (optional)
                  </label>
                  <input
                    type="date"
                    className="input-base w-full text-sm"
                    value={discountExpiresDate}
                    onChange={(e) => setDiscountExpiresDate(e.target.value)}
                  />
                </div>
              </div>

              {discountError && <p className="text-xs text-destructive">{discountError}</p>}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDiscountTarget(null)
                    setDiscountError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" disabled={discountBusy} onClick={() => void saveDiscount()}>
                  {discountBusy ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

type PlatformAnalyticsResponse = {
  current: {
    total_accounts: number
    active_accounts: number
    trialing_accounts: number
    archived_accounts: number
    paid_mrr_cents: number
    trial_pipeline_mrr_cents: number
    total_mrr_cents: number
    active_seats: number
    equipment_records: number
    work_orders: number
    plan_distribution: { plan: string; accounts: number; color: string }[]
  }
  chart_monthly: { month: string; mrr: number }[]
  mrr_growth_pct: number | null
  account_growth_pct: number | null
}

function AnalyticsTab() {
  const [data, setData] = useState<PlatformAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) {
      setLoading(true)
      setError(null)
    } else {
      setError(null)
    }
    try {
      const res = await fetch("/api/platform/analytics")
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(typeof j.message === "string" ? j.message : "Failed to load analytics")
      }
      const j = (await res.json()) as PlatformAnalyticsResponse
      setData(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function runSnapshot() {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/analytics/snapshot", { method: "POST" })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(typeof j.message === "string" ? j.message : "Could not refresh metrics")
      }
      await load(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh metrics")
    } finally {
      setRefreshing(false)
    }
  }

  const current = data?.current
  const chartData = data?.chart_monthly ?? []
  const nonArchived =
    current != null ? Math.max(0, current.total_accounts - current.archived_accounts) : 0

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-destructive">{error}</div>
      ) : null}

      {/* MRR trend chart */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Paid MRR trend</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Last 6 months from stored daily snapshots (paid subscriptions only). Forward-filled when some months have no snapshot.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold">
              {loading ? (
                <span className="text-muted-foreground">…</span>
              ) : data?.mrr_growth_pct == null ? (
                <span className="text-muted-foreground">— MoM</span>
              ) : data.mrr_growth_pct >= 0 ? (
                <span className="ds-text-success flex items-center gap-1">
                  <TrendingUp size={13} /> +{data.mrr_growth_pct.toFixed(1)}% MoM
                </span>
              ) : (
                <span className="text-destructive flex items-center gap-1">
                  <TrendingDown size={13} /> {data.mrr_growth_pct.toFixed(1)}% MoM
                </span>
              )}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={loading || refreshing}
              onClick={() => void runSnapshot()}
            >
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh metrics
            </Button>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex h-[180px] items-center justify-center text-xs text-muted-foreground">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading analytics…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => "$" + (v / 100).toLocaleString()} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={64} />
                <Tooltip formatter={(v: number) => [fmt$(v), "Paid MRR"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
                <Area type="monotone" dataKey="mrr" stroke="var(--primary)" strokeWidth={2} fill="url(#mrrGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Plan distribution */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(current?.plan_distribution ?? []).map(({ plan, accounts, color }) => (
          <div key={plan} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color, background: color + "18" }}>{plan}</span>
              <span className="text-2xl font-bold ds-tabular">{loading ? "—" : accounts}</span>
            </div>
            <p className="text-xs text-muted-foreground">accounts (non-archived)</p>
            <div className="mt-3 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${nonArchived > 0 ? (accounts / nonArchived) * 100 : 0}%`,
                  background: color,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Usage metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        {[
          {
            label: "Total Accounts",
            value: current ? current.total_accounts.toString() : "—",
            sub: current
              ? `${current.active_accounts} active · ${current.trialing_accounts} trialing · ${current.archived_accounts} archived${
                  loading || data?.account_growth_pct == null
                    ? ""
                    : ` · ${data.account_growth_pct >= 0 ? "+" : ""}${data.account_growth_pct.toFixed(1)}% (30d)`
                }`
              : "",
            icon: Building2,
            color: "#1d4ed8",
          },
          {
            label: "Paid MRR",
            value: current ? fmt$(current.paid_mrr_cents) : "—",
            sub: "Active subscriptions after discounts (annual → monthly)",
            icon: DollarSign,
            color: "#15803d",
          },
          {
            label: "Trial pipeline",
            value: current ? fmt$(current.trial_pipeline_mrr_cents) : "—",
            sub: "If active trials converted at list − discount",
            icon: Ticket,
            color: "#b45309",
          },
          {
            label: "Active Seats",
            value: current ? current.active_seats.toLocaleString() : "—",
            sub: "non-archived workspaces",
            icon: Users,
            color: "#15803d",
          },
          {
            label: "Equipment Records",
            value: current ? current.equipment_records.toLocaleString() : "—",
            sub: "non-archived orgs",
            icon: Gauge,
            color: "#b45309",
          },
          {
            label: "Work Orders",
            value: current ? current.work_orders.toLocaleString() : "—",
            sub: "not archived",
            icon: Activity,
            color: "#7c3aed",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} style={{ color }} />
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
            </div>
            <p className="text-xl font-bold ds-tabular">{value}</p>
            {sub ? <p className="text-[11px] text-muted-foreground mt-1">{sub}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function FlagsTab() {
  const [flags, setFlags] = useState(() =>
    FEATURE_FLAGS.map(f => ({ ...f, localEnabled: f.enabledFor !== "none" && f.enabledFor !== [] }))
  )

  const categories = Array.from(new Set(FEATURE_FLAGS.map(f => f.category)))

  function toggleFlag(id: string) {
    setFlags(prev => prev.map(f => f.id === id ? { ...f, localEnabled: !f.localEnabled } : f))
  }

  const categoryColor: Record<string, string> = {
    AI:         "#7c3aed",
    Billing:    "#15803d",
    Portal:     "#1d4ed8",
    Operations: "#b45309",
    Lab:        "#0891b2",
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl ds-alert-warning border px-5 py-3">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 ds-icon-warning" />
        <p className="text-xs">Feature flags are global toggles. Changes take effect immediately for all accounts matching the target plan tier. Use caution.</p>
      </div>

      {categories.map(cat => (
        <div key={cat} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: categoryColor[cat] }}>{cat}</span>
          </div>
          <div className="divide-y divide-border">
            {flags.filter(f => f.category === cat).map(flag => {
              const on = flag.localEnabled
              const targetLabel = Array.isArray(flag.enabledFor)
                ? `${flag.enabledFor.length} specific accounts`
                : flag.enabledFor === "all" ? "All plans"
                : flag.enabledFor === "enterprise" ? "Enterprise only"
                : flag.enabledFor === "growth_up" ? "Growth + Enterprise"
                : "None"
              return (
                <div key={flag.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{flag.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">{flag.id}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                    <p className="text-xs mt-1.5">
                      <span className="text-muted-foreground">Target: </span>
                      <span className="font-medium text-foreground">{targetLabel}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFlag(flag.id)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors mt-0.5",
                      on ? "bg-primary" : "bg-border"
                    )}
                    role="switch"
                    aria-checked={on}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                      on ? "translate-x-4" : "translate-x-0"
                    )} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function AuditTab() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold">Platform audit log</h3>
        <p className="text-xs text-muted-foreground mt-0.5">All admin actions across Equipify.ai</p>
      </div>
      <div className="divide-y divide-border">
        {ADMIN_AUDIT_LOG.map(event => (
          <div key={event.id} className="flex items-start gap-3 px-6 py-4">
            <div className="mt-0.5">{severityIcon(event.severity)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground">{event.actor}</span>
                <span className="text-[10px] px-1.5 py-px rounded-full bg-secondary text-muted-foreground">{event.actorRole}</span>
                <span className="text-xs text-muted-foreground font-mono">{event.action.replace(/_/g, " ")}</span>
                <span className="text-xs font-medium text-foreground">{event.target}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{event.detail}</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 ds-tabular whitespace-nowrap">
              {new Date(event.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlatformAdminPage() {
  const router = useRouter()
  const { sessionIdentity, startImpersonation } = useAdmin()
  const displayName = sessionIdentity?.displayName?.trim() ?? ""
  const email = sessionIdentity?.email?.trim() ?? ""
  const headerLine1 = displayName || email || "…"
  const headerLine2 =
    displayName && email && displayName.toLowerCase() !== email.toLowerCase()
      ? email
      : (sessionIdentity?.platformRoleLabel ?? "Platform Admin")
  const headerInitials = initialsFromDisplayLabel(displayName || email || "?")
  const [activeTab, setActiveTab] = useState<Tab>("accounts")
  const [accounts, setAccounts] = useState<PlatformAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [accountsSummary, setAccountsSummary] = useState<PlatformAccountsSummary | null>(null)
  const [overview, setOverview] = useState<PlatformAnalyticsResponse | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError(null)
    try {
      const res = await fetch("/api/platform/accounts", { cache: "no-store" })
      const data = (await res.json()) as {
        accounts?: PlatformAccount[]
        summary?: PlatformAccountsSummary
        message?: string
      }
      if (!res.ok) {
        setAccountsError(
          typeof data.message === "string" ? data.message : "Could not load accounts.",
        )
        setAccounts([])
        setAccountsSummary(null)
        return
      }
      const rows = data.accounts ?? []
      setAccounts(rows)
      if (data.summary && typeof data.summary === "object") {
        setAccountsSummary(data.summary)
      } else {
        setAccountsSummary(null)
      }
    } catch {
      setAccountsError("Could not load accounts.")
      setAccounts([])
      setAccountsSummary(null)
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true)
    setOverviewError(null)
    try {
      const res = await fetch("/api/platform/analytics", { cache: "no-store" })
      const data = (await res.json()) as PlatformAnalyticsResponse & {
        message?: string
        error?: string
      }
      if (!res.ok) {
        setOverview(null)
        const msg =
          typeof data.message === "string"
            ? data.message
            : typeof data.error === "string"
              ? data.error
              : `Analytics request failed (${res.status})`
        setOverviewError(msg)
        return
      }
      setOverview(data)
    } catch (e) {
      setOverview(null)
      setOverviewError(e instanceof Error ? e.message : "Could not load analytics.")
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAccounts()
    void loadOverview()
  }, [loadAccounts, loadOverview])

  const nonArchivedAccounts = useMemo(
    () => accounts.filter((a) => !a.organizationArchived),
    [accounts],
  )

  /** Legacy fallback if an older API omits `summary` (should not happen in production). */
  const summaryFallback = useMemo((): PlatformAccountsSummary => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    return {
      totalNonArchivedAccounts: nonArchivedAccounts.length,
      activeAccounts: nonArchivedAccounts.filter(
        (a) => a.subscriptionStatus?.trim().toLowerCase() === "active",
      ).length,
      trialingAccounts: nonArchivedAccounts.filter(
        (a) => a.subscriptionStatus?.trim().toLowerCase() === "trialing",
      ).length,
      paidMrrCents: nonArchivedAccounts
        .filter((a) => a.subscriptionStatus?.trim().toLowerCase() === "active")
        .reduce((sum, a) => sum + (Number.isFinite(a.mrr) ? a.mrr : 0), 0),
      trialPipelineMrrCents: nonArchivedAccounts
        .filter((a) => a.subscriptionStatus?.trim().toLowerCase() === "trialing")
        .reduce((sum, a) => sum + (Number.isFinite(a.mrr) ? a.mrr : 0), 0),
      activeSeats: nonArchivedAccounts.reduce(
        (sum, a) => sum + (Number.isFinite(a.seats) ? a.seats : 0),
        0,
      ),
      newAccountsLast30Days: nonArchivedAccounts.filter((a) => {
        const t = new Date(a.createdAt).getTime()
        return Number.isFinite(t) && t >= cutoff
      }).length,
    }
  }, [nonArchivedAccounts])

  const kpi =
    accountsLoading || accountsError ? null : (accountsSummary ?? summaryFallback)

  const totalAccountsValue = kpi?.totalNonArchivedAccounts
  const activeSeatsValue = kpi?.activeSeats
  const paidMrrValue = kpi?.paidMrrCents
  const trialPipelineValue = kpi?.trialPipelineMrrCents
  const newAccountsLast30Days = kpi?.newAccountsLast30Days

  async function handleImpersonate(account: PlatformAccount) {
    const res = await fetch("/api/platform/support-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: account.id }),
    })
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) {
      window.alert(typeof body.message === "string" && body.message.trim() ? body.message : "Could not open workspace.")
      return
    }
    startImpersonation(account)
    router.push("/")
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "accounts",  label: "Accounts",   icon: Building2 },
    { key: "analytics", label: "Analytics",  icon: TrendingUp },
    { key: "flags",     label: "Feature Flags", icon: Flag },
    { key: "audit",     label: "Audit Log",  icon: ScrollText },
    { key: "ai_operations", label: "AI Operations", icon: Brain },
    { key: "import_operations", label: "Import Ops", icon: Database },
    { key: "master_context", label: "Master Context", icon: ScrollText },
    { key: "blitzpay_operations", label: "BlitzPay Ops", icon: CreditCard },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="flex items-center h-14 px-6 bg-[#0F172A] border-b border-white/10 gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <BrandLogo className="h-7 w-auto max-h-7" priority />
          <span className="ml-2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-200 border border-violet-400/25">
            Platform Admin
          </span>
        </div>
        <div className="flex-1" />
        {/* Admin identity */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#7c3aed] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {headerInitials}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-white leading-tight">{headerLine1}</p>
            <p className="text-[10px] text-slate-400">{headerLine2}</p>
          </div>
        </div>
        <Link
          href="/admin/growth/leads"
          className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-white"
        >
          Growth Engine
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors ml-4">
          Back to app <ChevronRight size={12} />
        </Link>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
        {process.env.NODE_ENV === "development" && overviewError ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-100">
            <span className="font-semibold">Analytics (dev):</span> {overviewError} — KPIs above use the
            accounts API; charts on the Analytics tab may be incomplete.
          </div>
        ) : null}
        {/* KPI strip — server aggregates from GET /api/platform/accounts; MoM from analytics when available */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            icon={Building2}
            label="Total Accounts"
            value={
              accountsError
                ? "—"
                : accountsLoading || totalAccountsValue == null
                  ? "…"
                  : String(totalAccountsValue)
            }
            sub={
              kpi != null
                ? `${kpi.activeAccounts} active · ${kpi.trialingAccounts} trialing`
                : ""
            }
            color="#1d4ed8"
          />
          <StatCard
            icon={DollarSign}
            label="Paid MRR"
            value={
              accountsError
                ? "—"
                : accountsLoading || paidMrrValue == null
                  ? "…"
                  : fmt$(paidMrrValue)
            }
            sub={
              overviewLoading || overview?.mrr_growth_pct == null
                ? "Active subscriptions after discounts"
                : `${overview.mrr_growth_pct >= 0 ? "+" : ""}${overview.mrr_growth_pct.toFixed(1)}% MoM (chart)`
            }
            color="#15803d"
          />
          <StatCard
            icon={Ticket}
            label="Trial pipeline"
            value={
              accountsError
                ? "—"
                : accountsLoading || trialPipelineValue == null
                  ? "…"
                  : fmt$(trialPipelineValue)
            }
            sub="If active trials converted at list − discount"
            color="#b45309"
          />
          <StatCard
            icon={Users}
            label="Active Seats"
            value={
              accountsError
                ? "—"
                : accountsLoading || activeSeatsValue == null
                  ? "…"
                  : String(activeSeatsValue)
            }
            sub="Active members in non-archived orgs"
            color="#0f766e"
          />
          <StatCard
            icon={TrendingUp}
            label="Account Growth"
            value={
              accountsError
                ? "—"
                : accountsLoading || newAccountsLast30Days == null
                  ? "…"
                  : `+${newAccountsLast30Days}`
            }
            sub="New accounts last 30 days"
            color="#7c3aed"
          />
        </div>

        {/* Tabs */}
        <div className="flex flex-col gap-6">
          <nav className="flex items-center gap-1 border-b border-border overflow-x-auto pb-px [scrollbar-width:thin]">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0",
                  activeTab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </nav>

          {activeTab === "accounts" && (
            <AccountsTab
              accounts={accounts}
              loading={accountsLoading}
              loadError={accountsError}
              onImpersonate={handleImpersonate}
              onRefresh={() => void loadAccounts()}
            />
          )}
          {activeTab === "analytics" && <AnalyticsTab />}
          {activeTab === "flags"     && <FlagsTab />}
          {activeTab === "audit"     && <AuditTab />}
          {activeTab === "ai_operations" && <AiOperationsContent />}
          {activeTab === "import_operations" && <ImportOperationsContent />}
          {activeTab === "master_context" && <MasterContextTabContent />}
          {activeTab === "blitzpay_operations" && <BlitzpayOperationsContent />}
        </div>
      </div>
    </div>
  )
}
