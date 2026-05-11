"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Paintbrush,
  Save,
  Check,
  Shield,
  Layers,
  Info,
  LayoutGrid,
  LogIn,
  Mail,
  Link2,
} from "lucide-react"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { CERTIFICATE_RELEASE_OPTIONS } from "@/lib/portal/certificate-release-staff"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { StaffPortalPreviewLaunchButton } from "@/components/portal/staff-portal-preview-launch-button"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionCard({ title, description, icon: Icon, children }: {
  title: string
  description: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/8 border border-primary/15 shrink-0">
          <Icon size={17} className="text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function FieldRow({ label, description, children }: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-border/60 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0 w-64">{children}</div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked)
      }}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        checked ? "bg-primary" : "bg-muted-foreground/25",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalSettingsPage() {
  const { organizationId, organizationName, status: orgStatus } = useActiveOrganization()
  const { has, status: permStatus } = useOrgPermissions()
  const { toast } = useToast()
  const [saved, setSaved] = useState(false)

  const canEditPortalSettings = has("canManagePortalSettings")
  const canViewDocActivity = has("canManagePortalSettings") || has("canReleaseCertificatesToPortal")

  const [certificateReleaseMode, setCertificateReleaseMode] = useState<
    "immediate_release" | "release_on_payment" | "manual_release" | "internal_only"
  >("immediate_release")
  const [certificateReleaseLoading, setCertificateReleaseLoading] = useState(true)

  const [consolidatedDocumentsDefault, setConsolidatedDocumentsDefault] = useState(false)
  const [consolidatedLoading, setConsolidatedLoading] = useState(true)
  const [consolidatedSchemaPending, setConsolidatedSchemaPending] = useState(false)
  const [confirmConsolidatedOpen, setConfirmConsolidatedOpen] = useState(false)

  type ActivityRow = {
    at: string
    action: string
    label: string
    path: string | null
    metadata: Record<string, unknown>
  }
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activitySchemaPending, setActivitySchemaPending] = useState(false)

  useEffect(() => {
    if (orgStatus !== "ready" || !organizationId?.trim()) {
      setCertificateReleaseLoading(false)
      return
    }
    let cancelled = false
    setCertificateReleaseLoading(true)
    void (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId.trim())}/portal/certificate-release-default`,
        )
        const data = (await res.json().catch(() => ({}))) as {
          portal_certificate_release_mode?: string
        }
        if (cancelled) return
        const m = data.portal_certificate_release_mode
        if (m === "immediate_release" || m === "release_on_payment" || m === "manual_release" || m === "internal_only") {
          setCertificateReleaseMode(m)
        }
      } finally {
        if (!cancelled) setCertificateReleaseLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgStatus, organizationId])

  useEffect(() => {
    if (orgStatus !== "ready" || !organizationId?.trim()) {
      setConsolidatedLoading(false)
      return
    }
    let cancelled = false
    setConsolidatedLoading(true)
    void (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId.trim())}/portal/consolidated-documents-default`,
        )
        const data = (await res.json().catch(() => ({}))) as {
          portal_consolidated_documents_default?: boolean
          schema_migration_pending?: boolean
        }
        if (cancelled) return
        setConsolidatedSchemaPending(data.schema_migration_pending === true)
        setConsolidatedDocumentsDefault(data.portal_consolidated_documents_default === true)
      } finally {
        if (!cancelled) setConsolidatedLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgStatus, organizationId])

  useEffect(() => {
    if (
      orgStatus !== "ready" ||
      !organizationId?.trim() ||
      permStatus !== "ready" ||
      !canViewDocActivity
    ) {
      setActivityRows([])
      setActivityLoading(false)
      return
    }
    let cancelled = false
    setActivityLoading(true)
    void (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId.trim())}/portal/document-access-activity`,
        )
        const data = (await res.json().catch(() => ({}))) as {
          items?: ActivityRow[]
          schema_migration_pending?: boolean
        }
        if (cancelled) return
        setActivitySchemaPending(data.schema_migration_pending === true)
        setActivityRows(Array.isArray(data.items) ? data.items : [])
      } finally {
        if (!cancelled) setActivityLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgStatus, organizationId, permStatus, canViewDocActivity])

  async function handleSave() {
    if (orgStatus !== "ready" || !organizationId?.trim()) {
      toast({
        variant: "destructive",
        title: "Workspace not ready",
        description: "Select a workspace and wait for it to load before saving.",
      })
      return
    }

    const oid = organizationId.trim()
    const savedBits: string[] = []

    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(oid)}/portal/certificate-release-default`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal_certificate_release_mode: certificateReleaseMode }),
      })
      const errBody = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not save certificate release default",
          description: errBody.error ?? res.statusText,
        })
        return
      }
      savedBits.push("Certificate release default")

      if (canEditPortalSettings && !consolidatedSchemaPending) {
        const res2 = await fetch(`/api/organizations/${encodeURIComponent(oid)}/portal/consolidated-documents-default`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portal_consolidated_documents_default: consolidatedDocumentsDefault,
          }),
        })
        const err2 = (await res2.json().catch(() => ({}))) as { error?: string }
        if (!res2.ok) {
          toast({
            variant: "destructive",
            title: "Could not save consolidated document setting",
            description: err2.error ?? res2.statusText,
          })
          return
        }
        savedBits.push("Consolidated document library default")
      } else if (consolidatedSchemaPending) {
        savedBits.push("Consolidated documents skipped (migration pending)")
      }

      setSaved(true)
      toast({
        title: "Portal defaults saved",
        description: savedBits.join(". ") + ".",
      })
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save portal settings",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">Customer Portal</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Workspace defaults for certificates, document library rollup, and activity. Branding is managed under{" "}
            <Link href="/settings/workspace" className="underline underline-offset-2 hover:text-foreground">
              Workspace
            </Link>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StaffPortalPreviewLaunchButton
            organizationId={organizationId?.trim() ?? ""}
            disabled={orgStatus !== "ready" || !organizationId?.trim()}
          >
            Preview portal
          </StaffPortalPreviewLaunchButton>
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleSave}
            disabled={
              permStatus !== "ready" ||
              !canEditPortalSettings ||
              orgStatus !== "ready" ||
              !organizationId?.trim()
            }
          >
            {saved ? <><Check size={13} /> Saved</> : <><Save size={13} /> Save Changes</>}
          </Button>
        </div>
      </div>

      {/* Branding — source of truth is Workspace settings (shared with portal + preview). */}
      <SectionCard
        title="Branding"
        description="Logo and accent color apply to the customer portal header and staff preview. They are not edited on this page."
        icon={Paintbrush}
      >
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground space-y-2">
          <p>
            <span className="font-medium text-foreground">Workspace name:</span>{" "}
            {organizationName?.trim() ? organizationName : "—"}{" "}
            <span className="text-muted-foreground">(from your workspace profile)</span>
          </p>
          <p>
            Upload the <strong className="text-foreground">workspace logo</strong> and{" "}
            <strong className="text-foreground">document logo</strong>, and set the{" "}
            <strong className="text-foreground">primary color</strong>, under{" "}
            <Link href="/settings/workspace" className="text-foreground underline underline-offset-2">
              Settings → Workspace
            </Link>
            . The portal reuses the same assets as invoices and the app sidebar.
          </p>
        </div>
      </SectionCard>

      {/* Certificate portal release (persisted) */}
      <SectionCard
        title="Certificates & compliance"
        description="Default rule for when calibration certificates appear in the customer portal. Owners and admins can change this; managers use customer or invoice overrides for day-to-day operations."
        icon={Shield}
      >
        <FieldRow
          label="Default certificate release mode"
          description="Applies when a customer has no override and an invoice does not override the rule."
        >
          <div className="space-y-1.5">
            <select
              value={certificateReleaseMode}
              onChange={(e) =>
                setCertificateReleaseMode(
                  e.target.value as "immediate_release" | "release_on_payment" | "manual_release" | "internal_only",
                )
              }
              disabled={
                permStatus !== "ready" ||
                !canEditPortalSettings ||
                certificateReleaseLoading ||
                orgStatus !== "ready" ||
                !organizationId?.trim()
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
              aria-label="Default certificate release mode"
            >
              {CERTIFICATE_RELEASE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground leading-snug">
              {
                CERTIFICATE_RELEASE_OPTIONS.find((o) => o.value === certificateReleaseMode)?.detail
              }
            </p>
          </div>
        </FieldRow>
      </SectionCard>

      {/* Consolidated portal documents (workspace default) */}
      <SectionCard
        title="Portal document library"
        description="Control whether parent-account portal users can include child-account documents in the unified library. Certificate and payment rules are unchanged."
        icon={Layers}
      >
        {consolidatedSchemaPending ? (
          <p className="text-xs text-muted-foreground">
            Consolidated document settings are not available on this workspace until your environment is updated to the latest Equipify release.
          </p>
        ) : (
          <>
            <FieldRow
              label="Consolidated documents (workspace default)"
              description="Off by default. When on, customers without a per-account override may include sub-accounts in the portal document library, if the account is a parent in your hierarchy."
            >
              <div className="space-y-1.5">
                <Toggle
                  checked={consolidatedDocumentsDefault}
                  disabled={
                    !canEditPortalSettings ||
                    consolidatedLoading ||
                    consolidatedSchemaPending
                  }
                  onChange={(v) => {
                    if (!canEditPortalSettings) return
                    if (v && !consolidatedDocumentsDefault) {
                      setConfirmConsolidatedOpen(true)
                      return
                    }
                    setConsolidatedDocumentsDefault(v)
                  }}
                />
                <div
                  className={cn(
                    "rounded-md border px-2.5 py-2 text-[10px] leading-snug",
                    consolidatedDocumentsDefault
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                      : "border-border bg-muted/30 text-muted-foreground",
                  )}
                >
                  {consolidatedDocumentsDefault ? (
                    <strong className="font-medium text-foreground">
                      Warning:{" "}
                    </strong>
                  ) : null}
                  Eligible parent portal logins may view documents belonging to linked child accounts. Invoice and
                  certificate release rules still apply. Save changes to apply this workspace default.
                </div>
                {!canEditPortalSettings ? (
                  <p className="text-[10px] text-muted-foreground">
                    Only workspace owners and admins can change this setting.
                  </p>
                ) : null}
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Default is <span className="font-medium text-foreground">Off</span>. Per-customer overrides are
                  available when editing a customer.
                </p>
              </div>
            </FieldRow>

            {canViewDocActivity ? (
              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-xs font-medium text-foreground">Recent portal document activity</p>
                <p className="text-[11px] text-muted-foreground">
                  Opens and downloads from the customer portal document library (no file URLs stored here).
                </p>
                {activitySchemaPending ? (
                  <p className="text-xs text-muted-foreground">Activity history is not available for this workspace yet.</p>
                ) : activityLoading ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : activityRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No document views or downloads recorded yet.</p>
                ) : (
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                        <tr>
                          <th className="px-3 py-2 font-medium">When</th>
                          <th className="px-3 py-2 font-medium">What</th>
                          <th className="px-3 py-2 font-medium hidden sm:table-cell">Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {activityRows.map((row, i) => (
                          <tr key={`${row.at}-${row.action}-${i}`} className="bg-card">
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground align-top">
                              {new Date(row.at).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="px-3 py-2 text-foreground align-top">{row.label}</td>
                            <td className="px-3 py-2 text-muted-foreground align-top hidden sm:table-cell">
                              {(() => {
                                const k = row.metadata?.kind
                                const sb = row.metadata?.source_category
                                const parts: string[] = []
                                if (typeof k === "string") parts.push(k.replace(/_/g, " "))
                                if (typeof sb === "string") parts.push(sb.replace(/_/g, " "))
                                if (row.metadata?.cross_account === true) parts.push("cross-account")
                                return parts.length ? parts.join(" · ") : "—"
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </>
        )}
      </SectionCard>

      <AlertDialog open={confirmConsolidatedOpen} onOpenChange={setConfirmConsolidatedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn on consolidated portal documents?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              When enabled for this workspace (and not overridden per customer), eligible parent portal users may see
              invoices, certificates, service summaries, and related documents for linked child accounts. Certificate
              release and invoice payment rules still apply. Continue only if your customers expect this behavior.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="text-xs"
              onClick={() => {
                setConsolidatedDocumentsDefault(true)
                setConfirmConsolidatedOpen(false)
              }}
            >
              Enable consolidated access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Portal navigation — not gated by persisted module flags yet */}
      <SectionCard
        title="Portal modules"
        description="Per-feature visibility for customers is planned; toggles are not stored yet."
        icon={LayoutGrid}
      >
        <div className="flex gap-3 rounded-lg border border-border bg-muted/15 px-4 py-3">
          <Info className="shrink-0 text-muted-foreground mt-0.5" size={16} aria-hidden />
          <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
            <p>
              The live portal and staff preview still show standard sections (overview, requests, equipment, work orders,
              maintenance, invoices, quotes, documents, reports, certificates, etc.) according to{" "}
              <strong className="text-foreground">data access and release rules</strong>, not module switches on this page.
            </p>
            <p>
              When per-customer or workspace module defaults ship, they will persist here. Until then, visibility follows
              your data-access and release rules in the live portal.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Login & session"
        description="How customers sign in today — advanced customization is not configurable here yet."
        icon={LogIn}
      >
        <div className="rounded-lg border border-border bg-muted/15 px-4 py-3 text-xs text-muted-foreground leading-relaxed space-y-2">
          <p>
            Customers use <strong className="text-foreground">magic-link email</strong> sign-in. Welcome copy, support
            email, password login, and configurable session length are <strong className="text-foreground">not stored</strong>{" "}
            from this screen.
          </p>
          <p>
            Including your workspace id on the sign-in link only preloads your workspace name and accent color for a
            consistent experience. It does not sign anyone in or grant access by itself.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Email templates"
        description="Staff-editable portal email bodies are not wired yet."
        icon={Mail}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          Invite, magic login, work order, invoice, and quote emails use system templates. Per-workspace editors are{" "}
          <strong className="text-foreground">coming soon</strong>.
        </p>
      </SectionCard>

      <SectionCard
        title="Custom domain"
        description="Serving the portal from your own hostname is not available yet."
        icon={Link2}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          Customers use the shared Equipify portal URL. Vanity domains and DNS verification are{" "}
          <strong className="text-foreground">planned</strong> — there is nothing to configure here today.
        </p>
      </SectionCard>
    </div>
  )
}
