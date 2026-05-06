"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTenant } from "@/lib/tenant-store"
import { Upload, Check, Globe, Palette, Building2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { getPlan, type PlanId } from "@/lib/plans"

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Tokyo",
]
const DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"]
const ACCENT_PRESETS = ["#2563eb", "#0f766e", "#7c3aed", "#dc2626", "#d97706", "#16a34a", "#0284c7", "#db2777"]

function apiErrorDescription(body: { error?: string; message?: string } | null | undefined, fallback: string) {
  const parts = [body?.error, body?.message].filter((s): s is string => typeof s === "string" && s.trim().length > 0)
  return parts.length ? parts.join(": ") : fallback
}

function withLogoPreviewBust(url: string, nonce: number) {
  if (!url.trim() || nonce < 1) return url
  return `${url}${url.includes("?") ? "&" : "?"}v=${nonce}`
}

function SettingCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

type WorkspaceApiOrganization = {
  id?: string
  name: string
  slug: string
  /** ISO timestamp when present on the row */
  createdAt?: string | null
  companyEmail: string
  companyPhone: string
  companyWebsite: string
  companyAddress: string
  timezone: string
  dateFormat: string
  currency: string
  logoUrl: string
  documentLogoUrl: string
  primaryColor: string
  secondaryBrandColor: string
  whiteLabelSettings: Record<string, unknown>
}

export default function WorkspacePage() {
  const { toast } = useToast()
  const { dispatch } = useTenant()
  const { status, organizationId } = useActiveOrganization()

  const [loadState, setLoadState] = useState<"idle" | "loading" | "error" | "ready">("idle")
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)
  const [uploadingDocLogo, setUploadingDocLogo] = useState(false)
  const [removingDocLogo, setRemovingDocLogo] = useState(false)
  const [brandingAllowed, setBrandingAllowed] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [planId, setPlanId] = useState<PlanId>("solo")
  const [loadErrorDetail, setLoadErrorDetail] = useState<string | null>(null)
  const [workspaceSlug, setWorkspaceSlug] = useState<string>("")
  const [workspaceCreatedAt, setWorkspaceCreatedAt] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: "",
    companyEmail: "",
    companyPhone: "",
    companyWebsite: "",
    companyAddress: "",
    timezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
    currency: "USD",
    primaryColor: "#2563eb",
  })
  const [logoUrl, setLogoUrl] = useState("")
  const [documentLogoUrl, setDocumentLogoUrl] = useState("")
  const [logoPreviewNonce, setLogoPreviewNonce] = useState(0)
  const [docLogoPreviewNonce, setDocLogoPreviewNonce] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const documentFileRef = useRef<HTMLInputElement>(null)

  const applyOrganization = useCallback(
    (org: WorkspaceApiOrganization) => {
      const wl =
        org.whiteLabelSettings &&
        typeof org.whiteLabelSettings === "object" &&
        !Array.isArray(org.whiteLabelSettings)
          ? org.whiteLabelSettings
          : {}
      setForm({
        name: org.name,
        companyEmail: org.companyEmail,
        companyPhone: org.companyPhone,
        companyWebsite: org.companyWebsite,
        companyAddress: org.companyAddress,
        timezone: org.timezone,
        dateFormat: org.dateFormat,
        currency: org.currency,
        primaryColor: org.primaryColor,
      })
      setLogoUrl(org.logoUrl ?? "")
      setDocumentLogoUrl(org.documentLogoUrl ?? "")
      setWorkspaceSlug(org.slug ?? "")
      setWorkspaceCreatedAt(org.createdAt ?? null)
      dispatch({
        type: "HYDRATE_ORGANIZATION_PROFILE",
        payload: {
          name: org.name,
          slug: org.slug,
          companyEmail: org.companyEmail,
          companyPhone: org.companyPhone,
          companyWebsite: org.companyWebsite,
          companyAddress: org.companyAddress,
          timezone: org.timezone,
          dateFormat: org.dateFormat,
          currency: org.currency,
          logoUrl: org.logoUrl ?? "",
          documentLogoUrl: org.documentLogoUrl ?? "",
          primaryColor: org.primaryColor,
          secondaryBrandColor: org.secondaryBrandColor ?? "",
          whiteLabelSettings: wl,
        },
      })
    },
    [dispatch],
  )

  const refetchWorkspace = useCallback(async (): Promise<boolean> => {
    if (!organizationId) return false
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/workspace`, {
        cache: "no-store",
      })
      const data = (await res.json()) as {
        organization?: WorkspaceApiOrganization
        brandingAllowed?: boolean
        canEdit?: boolean
        planId?: PlanId
      }
      if (!res.ok || !data.organization) return false
      if (process.env.NODE_ENV === "development") {
        console.info("[workspace settings] GET workspace (refetch)", {
          organizationId,
          logoUrl: data.organization.logoUrl,
          documentLogoUrl: data.organization.documentLogoUrl,
        })
      }
      setBrandingAllowed(Boolean(data.brandingAllowed))
      setCanEdit(Boolean(data.canEdit))
      setPlanId(data.planId ?? "solo")
      applyOrganization(data.organization)
      return true
    } catch {
      return false
    }
  }, [organizationId, applyOrganization])

  useEffect(() => {
    if (status !== "ready") return
    if (!organizationId) {
      setLoadState("idle")
      return
    }
    let cancelled = false
    setLoadState("loading")
    setLoadErrorDetail(null)
    void (async () => {
      try {
        const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/workspace`, {
          cache: "no-store",
        })
        let data: {
          error?: string
          message?: string
          organization?: WorkspaceApiOrganization
          brandingAllowed?: boolean
          canEdit?: boolean
          planId?: PlanId
        }
        try {
          data = (await res.json()) as typeof data
        } catch (parseErr) {
          const detail = `Invalid JSON response (${res.status})`
          if (process.env.NODE_ENV === "development") {
            console.info("[workspace settings] Failed to parse GET response", {
              organizationId,
              status: res.status,
              parseErr,
            })
          }
          if (!cancelled) {
            setLoadErrorDetail(detail)
            setLoadState("error")
            toast({
              variant: "destructive",
              title: "Could not load workspace",
              description: detail,
            })
          }
          return
        }
        if (cancelled) return
        if (!res.ok) {
          const detail =
            typeof data.message === "string"
              ? data.message
              : typeof data.error === "string"
                ? `${data.error}${res.status ? ` (${res.status})` : ""}`
                : `Request failed (${res.status})`
          setLoadErrorDetail(detail)
          if (process.env.NODE_ENV === "development") {
            console.info("[workspace settings] GET /workspace failed", {
              organizationId,
              status: res.status,
              error: data.error,
              message: data.message,
            })
          }
          setLoadState("error")
          toast({
            variant: "destructive",
            title: "Could not load workspace",
            description: detail,
          })
          return
        }
        if (!data.organization) {
          const detail = "Response missing organization payload."
          setLoadErrorDetail(detail)
          if (process.env.NODE_ENV === "development") {
            console.info("[workspace settings] Missing organization in response", { organizationId, data })
          }
          setLoadState("error")
          toast({
            variant: "destructive",
            title: "Could not load workspace",
            description: detail,
          })
          return
        }
        setBrandingAllowed(Boolean(data.brandingAllowed))
        setCanEdit(Boolean(data.canEdit))
        setPlanId(data.planId ?? "solo")
        applyOrganization(data.organization)
        setLoadState("ready")
      } catch (e) {
        if (!cancelled) {
          const detail = e instanceof Error ? e.message : "Network error."
          setLoadErrorDetail(detail)
          if (process.env.NODE_ENV === "development") {
            console.info("[workspace settings] GET failed", { organizationId, error: e })
          }
          setLoadState("error")
          toast({
            variant: "destructive",
            title: "Could not load workspace",
            description: "Network error. Check your connection and try again.",
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, organizationId, toast, applyOrganization])

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!organizationId || !canEdit || saving) return
    const email = form.companyEmail.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        variant: "destructive",
        title: "Invalid email",
        description: "Enter a valid company email or leave the field blank.",
      })
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        companyEmail: form.companyEmail.trim(),
        companyPhone: form.companyPhone.trim(),
        companyWebsite: form.companyWebsite.trim(),
        companyAddress: form.companyAddress.trim(),
        timezone: form.timezone,
        dateFormat: form.dateFormat,
        currency: form.currency,
      }
      if (brandingAllowed) {
        body.primaryColor = form.primaryColor.trim()
      }
      if (process.env.NODE_ENV === "development") {
        console.info("[workspace settings] PATCH workspace body", { organizationId, body })
      }
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/workspace`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        organization?: WorkspaceApiOrganization
      }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Save failed",
          description: typeof data.message === "string" ? data.message : "Could not save workspace settings.",
        })
        return
      }
      const synced = await refetchWorkspace()
      if (!synced && data.organization) {
        applyOrganization(data.organization)
      }
      if (!synced && !data.organization) {
        toast({
          variant: "destructive",
          title: "Saved but could not refresh",
          description: "Reload the page to confirm your changes.",
        })
        return
      }
      toast({ title: "Settings saved", description: "Workspace details were updated." })
    } catch {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Network error. Try again.",
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !organizationId || !canEdit || !brandingAllowed || uploadingLogo) return
    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.set("file", file)
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/workspace/logo`, {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      })
      const data = (await res.json()) as {
        ok?: boolean
        logoUrl?: string
        documentLogoUrl?: string
        organization?: WorkspaceApiOrganization
        message?: string
        error?: string
      }
      if (process.env.NODE_ENV === "development") {
        console.info("[workspace settings] POST /workspace/logo response", {
          organizationId,
          ok: res.ok,
          status: res.status,
          data,
        })
      }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: apiErrorDescription(data, "Could not upload logo."),
        })
        return
      }
      if (data.organization) {
        applyOrganization(data.organization)
      } else if (data.logoUrl) {
        setLogoUrl(data.logoUrl)
        setLogoPreviewNonce((n) => n + 1)
        dispatch({ type: "SET_LOGO", payload: data.logoUrl })
        if (typeof data.documentLogoUrl === "string") {
          dispatch({ type: "SET_WORKSPACE", payload: { documentLogoUrl: data.documentLogoUrl } })
        }
      }
      await refetchWorkspace()
      toast({ title: "Logo updated", description: "Your app branding logo was saved." })
    } catch {
      toast({ variant: "destructive", title: "Upload failed", description: "Network error." })
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleDocumentLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !organizationId || !canEdit || !brandingAllowed || uploadingDocLogo) return
    setUploadingDocLogo(true)
    try {
      const fd = new FormData()
      fd.set("file", file)
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/workspace/document-logo`,
        { method: "POST", body: fd, credentials: "same-origin" },
      )
      const data = (await res.json()) as {
        ok?: boolean
        logoUrl?: string
        documentLogoUrl?: string
        organization?: WorkspaceApiOrganization
        message?: string
        error?: string
      }
      if (process.env.NODE_ENV === "development") {
        console.info("[workspace settings] POST /workspace/document-logo response", {
          organizationId,
          ok: res.ok,
          status: res.status,
          data,
        })
      }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: apiErrorDescription(data, "Could not upload document logo."),
        })
        return
      }
      if (data.organization) {
        applyOrganization(data.organization)
      } else if (data.documentLogoUrl) {
        setDocumentLogoUrl(data.documentLogoUrl)
        setDocLogoPreviewNonce((n) => n + 1)
        dispatch({ type: "SET_WORKSPACE", payload: { documentLogoUrl: data.documentLogoUrl } })
        if (typeof data.logoUrl === "string") {
          dispatch({ type: "SET_LOGO", payload: data.logoUrl })
        }
      }
      await refetchWorkspace()
      toast({ title: "Document logo updated", description: "Saved for PDFs and documents." })
    } catch {
      toast({ variant: "destructive", title: "Upload failed", description: "Network error." })
    } finally {
      setUploadingDocLogo(false)
    }
  }

  async function handleRemoveDocumentLogo() {
    if (!organizationId || !canEdit || !brandingAllowed || removingDocLogo) return
    setRemovingDocLogo(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/workspace`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentLogoUrl: null }),
      })
      const data = (await res.json()) as { message?: string; organization?: WorkspaceApiOrganization }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not remove document logo",
          description: typeof data.message === "string" ? data.message : "Try again.",
        })
        return
      }
      const synced = await refetchWorkspace()
      if (!synced) {
        if (data.organization) {
          applyOrganization(data.organization)
        } else {
          setDocumentLogoUrl("")
        }
      }
      toast({ title: "Document logo removed" })
    } catch {
      toast({ variant: "destructive", title: "Could not remove document logo", description: "Network error." })
    } finally {
      setRemovingDocLogo(false)
    }
  }

  async function handleRemoveLogo() {
    if (!organizationId || !canEdit || !brandingAllowed || removingLogo) return
    setRemovingLogo(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/workspace`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: null }),
      })
      const data = (await res.json()) as { message?: string; organization?: WorkspaceApiOrganization }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not remove logo",
          description: typeof data.message === "string" ? data.message : "Try again.",
        })
        return
      }
      const synced = await refetchWorkspace()
      if (!synced) {
        if (data.organization) {
          applyOrganization(data.organization)
        } else {
          setLogoUrl("")
          dispatch({ type: "SET_LOGO", payload: "" })
        }
      }
      toast({ title: "Logo removed" })
    } catch {
      toast({ variant: "destructive", title: "Could not remove logo", description: "Network error." })
    } finally {
      setRemovingLogo(false)
    }
  }

  const planMeta = useMemo(() => getPlan(planId), [planId])

  const createdAtLabel = useMemo(() => {
    if (!workspaceCreatedAt) return null
    const d = new Date(workspaceCreatedAt)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  }, [workspaceCreatedAt])

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading organization…</span>
      </div>
    )
  }

  if (!organizationId) {
    return <div className="text-sm text-muted-foreground py-8">Select an organization to manage workspace settings.</div>
  }

  if (loadState === "idle" || loadState === "loading") {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading workspace settings…</span>
      </div>
    )
  }

  if (loadState === "error") {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center space-y-2">
        <p className="text-sm text-foreground font-medium">Could not load settings</p>
        <p className="text-xs text-muted-foreground">Refresh the page or switch organization and try again.</p>
        {loadErrorDetail && (
          <p className="text-xs text-left mt-3 rounded-md bg-secondary/80 border border-border px-3 py-2 font-mono break-all text-muted-foreground">
            {loadErrorDetail}
          </p>
        )}
      </div>
    )
  }

  const inputLocked = !canEdit
  const brandBusy = uploadingLogo || removingLogo || uploadingDocLogo || removingDocLogo

  return (
    <div className="flex flex-col gap-6">
      {!canEdit && (
        <p className="text-xs text-muted-foreground rounded-lg border border-border bg-secondary/40 px-4 py-3">
          You can view workspace details, but only owners and admins can make changes.
        </p>
      )}

      {/* General */}
      <SettingCard title="General" description="Basic workspace information shown across the platform.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(workspaceSlug || createdAtLabel) && (
            <div className="sm:col-span-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground border-b border-border pb-4 mb-1">
              {workspaceSlug ? (
                <span>
                  <span className="font-medium text-foreground/80">Slug:</span> {workspaceSlug}
                </span>
              ) : null}
              {createdAtLabel ? (
                <span>
                  <span className="font-medium text-foreground/80">Created:</span> {createdAtLabel}
                </span>
              ) : null}
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Workspace name</label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="input-base"
              readOnly={inputLocked}
              disabled={inputLocked}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Company email</label>
            <input
              type="email"
              value={form.companyEmail}
              onChange={(e) => setField("companyEmail", e.target.value)}
              className="input-base"
              readOnly={inputLocked}
              disabled={inputLocked}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Company phone</label>
            <input
              value={form.companyPhone}
              onChange={(e) => setField("companyPhone", e.target.value)}
              className="input-base"
              readOnly={inputLocked}
              disabled={inputLocked}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Company website</label>
            <input
              value={form.companyWebsite}
              onChange={(e) => setField("companyWebsite", e.target.value)}
              className="input-base"
              placeholder="https://example.com"
              readOnly={inputLocked}
              disabled={inputLocked}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Company address</label>
            <input
              value={form.companyAddress}
              onChange={(e) => setField("companyAddress", e.target.value)}
              className="input-base"
              readOnly={inputLocked}
              disabled={inputLocked}
            />
          </div>
        </div>
      </SettingCard>

      {/* Localization */}
      <SettingCard title="Localization" description="Date format, currency, and timezone for this workspace.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) => setField("timezone", e.target.value)}
              className="input-base"
              disabled={inputLocked}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date format</label>
            <select
              value={form.dateFormat}
              onChange={(e) => setField("dateFormat", e.target.value)}
              className="input-base"
              disabled={inputLocked}
            >
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Currency</label>
            <select
              value={form.currency}
              onChange={(e) => setField("currency", e.target.value)}
              className="input-base"
              disabled={inputLocked}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SettingCard>

      {/* White-label branding */}
      <SettingCard
        title="White-label branding"
        description={
          brandingAllowed
            ? "Upload your logo and choose an accent color for your workspace and customer portal."
            : undefined
        }
      >
        {!brandingAllowed ? (
          <div className="flex items-center gap-3 py-2">
            <div className="w-8 h-8 rounded-full ds-icon-tile-warning flex items-center justify-center">
              <Globe size={14} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Available on Growth and Scale</p>
              <p className="text-xs text-muted-foreground">
                Upload a custom logo and set your brand color.{" "}
                <a href="/settings/billing" className="text-primary underline">
                  Upgrade your plan
                </a>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">App branding logo</p>
              <p className="text-[11px] text-muted-foreground mb-2 max-w-xl leading-relaxed">
                Used in the sidebar, app chrome, and customer portal. Any aspect ratio is fine — we generate a centered{" "}
                256×256 square PNG automatically (transparent background when possible).
              </p>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-secondary disabled:opacity-50"
                  style={{ cursor: inputLocked || brandBusy ? "not-allowed" : "pointer" }}
                  onClick={() => !inputLocked && !brandBusy && fileRef.current?.click()}
                  disabled={inputLocked || brandBusy}
                >
                  {uploadingLogo ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : logoUrl ? (
                    <img
                      src={withLogoPreviewBust(logoUrl, logoPreviewNonce)}
                      alt="App branding logo"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <Upload size={20} className="text-muted-foreground" />
                  )}
                </button>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    className="text-primary hover:text-primary gap-1"
                    disabled={inputLocked || brandBusy}
                  >
                    <Upload size={13} /> Upload app logo
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP, GIF, or SVG — max 2MB.</p>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRemoveLogo()}
                      className="text-xs ds-text-danger h-6 px-1 mt-1"
                      disabled={inputLocked || brandBusy}
                    >
                      {removingLogo ? "Removing…" : "Remove"}
                    </Button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={inputLocked || brandBusy}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Company logo (PDFs &amp; documents)</p>
              <p className="text-[11px] text-muted-foreground mb-2 max-w-xl leading-relaxed">
                Used for certificates, invoices, PDFs, and printed documents. Prefer a wide horizontal logo; raster images are
                sized down (max ~1600×480) while keeping aspect ratio. SVG uploads are kept as vectors when supported by your
                browser print preview.
              </p>
              <div className="flex flex-wrap items-start gap-4">
                <button
                  type="button"
                  className="w-[180px] h-[72px] rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-secondary disabled:opacity-50 px-2"
                  style={{ cursor: inputLocked || brandBusy ? "not-allowed" : "pointer" }}
                  onClick={() => !inputLocked && !brandBusy && documentFileRef.current?.click()}
                  disabled={inputLocked || brandBusy}
                >
                  {uploadingDocLogo ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : documentLogoUrl ? (
                    <img
                      src={withLogoPreviewBust(documentLogoUrl, docLogoPreviewNonce)}
                      alt="Document logo preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <Upload size={20} className="text-muted-foreground" />
                  )}
                </button>
                <div className="min-w-[160px]">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => documentFileRef.current?.click()}
                    className="text-primary hover:text-primary gap-1"
                    disabled={inputLocked || brandBusy}
                  >
                    <Upload size={13} /> Upload document logo
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP, GIF, or SVG — max 4MB.</p>
                  {documentLogoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRemoveDocumentLogo()}
                      className="text-xs ds-text-danger h-6 px-1 mt-1"
                      disabled={inputLocked || brandBusy}
                    >
                      {removingDocLogo ? "Removing…" : "Remove"}
                    </Button>
                  )}
                </div>
                <input
                  ref={documentFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  onChange={handleDocumentLogoUpload}
                  disabled={inputLocked || brandBusy}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Palette size={13} className="text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Brand accent color</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => !inputLocked && setField("primaryColor", c)}
                    disabled={inputLocked}
                    className="w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center disabled:opacity-50"
                    style={{
                      background: c,
                      borderColor: form.primaryColor === c ? "var(--background)" : "transparent",
                    }}
                  >
                    {form.primaryColor === c && <Check size={12} className="text-white" />}
                  </button>
                ))}
                <div className="flex items-center gap-1.5 ml-1">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => setField("primaryColor", e.target.value)}
                    className="w-7 h-7 rounded-full border border-border cursor-pointer p-0 bg-transparent disabled:opacity-50"
                    title="Custom color"
                    disabled={inputLocked}
                  />
                  <span className="text-xs text-muted-foreground font-mono">{form.primaryColor}</span>
                </div>
              </div>
              <div className="mt-4 p-4 rounded-lg border border-border bg-secondary">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Building2 size={11} /> Brand preview
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                    style={{ background: form.primaryColor }}
                  >
                    {logoUrl ? (
                      <img
                        src={withLogoPreviewBust(logoUrl, logoPreviewNonce)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (form.name.trim()[0] ?? "?").toUpperCase()
                    )}
                  </div>
                  <span className="text-sm font-semibold text-foreground">{form.name || "Workspace"}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                    style={{ background: form.primaryColor }}
                  >
                    {planMeta.name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </SettingCard>

      {/* Danger zone */}
      <SettingCard title="Danger zone">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Delete workspace</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Workspace deletion is not available in the app. Contact support to archive or close an organization.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled className="shrink-0 border-muted text-muted-foreground">
            Contact support
          </Button>
        </div>
      </SettingCard>

      {/* Save */}
      <div className="flex justify-end">
        <Button type="button" onClick={() => void handleSave()} disabled={!canEdit || saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </div>
  )
}
