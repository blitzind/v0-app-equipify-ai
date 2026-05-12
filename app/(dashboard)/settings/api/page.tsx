"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { BookOpen, Code2, Info, KeyRound, Loader2, Shield, Webhook, Activity } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { getOrganizationSubscription, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import { getPlan } from "@/lib/plans"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import {
  DEVELOPER_API_MIN_PLAN,
  isDeveloperAccessEntitled,
  plannedMonthlyApiRequestCap,
  resolveDeveloperAccessBand,
  type DeveloperAccessBand,
} from "@/lib/developers/developer-settings-access"
import { cn } from "@/lib/utils"

function CardShell({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <h3 className="text-sm font-semibold text-foreground [&_svg]:inline [&_svg]:align-text-bottom">{title}</h3>
        {description ?
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
        : null}
      </div>
      <div className="px-4 py-4 sm:px-6">{children}</div>
    </div>
  )
}

export default function ApiDevelopersSettingsPage() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { status: permStatus, permissions } = useOrgPermissions()

  const canOpenPage = permissions.canManageWorkspaceSettings || permissions.canManageApiKeys
  const canManageKeys = permissions.canManageApiKeys

  const [sub, setSub] = useState<OrganizationSubscription | null>(null)
  const [subLoading, setSubLoading] = useState(true)
  const [subError, setSubError] = useState<string | null>(null)
  const [comingSoonOpen, setComingSoonOpen] = useState(false)
  const [comingSoonKind, setComingSoonKind] = useState<"api_key" | "webhook">("api_key")

  const loadSub = useCallback(async () => {
    if (orgStatus !== "ready" || !organizationId) {
      setSub(null)
      setSubLoading(orgStatus === "loading")
      setSubError(null)
      return
    }
    setSubLoading(true)
    setSubError(null)
    try {
      const supabase = createBrowserSupabaseClient()
      const row = await getOrganizationSubscription(supabase, organizationId)
      setSub(row)
    } catch (e) {
      setSub(null)
      setSubError(e instanceof Error ? e.message : "Could not load workspace plan.")
    } finally {
      setSubLoading(false)
    }
  }, [organizationId, orgStatus])

  useEffect(() => {
    void loadSub()
  }, [loadSub])

  const storedPlanId = sub?.plan_id ?? null
  const band = resolveDeveloperAccessBand(storedPlanId, sub)
  const tierEntitled = isDeveloperAccessEntitled(storedPlanId, sub)
  /** Tier allows preview UI; key/webhook issuance is still not implemented server-side. */
  const developerPreviewUnlocked = tierEntitled
  const planCap = plannedMonthlyApiRequestCap(storedPlanId, sub)
  const minPlan = getPlan(DEVELOPER_API_MIN_PLAN)

  const permReady = permStatus === "ready"
  const showGatedActions = permReady && canManageKeys && developerPreviewUnlocked
  const showReadOnlyActions = permReady && canManageKeys && !developerPreviewUnlocked
  const showManagerReadOnly = permReady && !canManageKeys && permissions.canManageWorkspaceSettings

  function openComingSoon(kind: "api_key" | "webhook") {
    setComingSoonKind(kind)
    setComingSoonOpen(true)
  }

  function accessSummary(
    b: DeveloperAccessBand,
    entitled: boolean,
  ): { title: string; body: string; tone: "default" | "success" } {
    if (entitled) {
      return {
        title: "Developer access (preview)",
        body: "Your workspace tier is eligible for the developer access preview. API key creation and outbound webhooks are not live yet — controls below explain what will ship next.",
        tone: "success",
      }
    }
    if (b === "growth") {
      return {
        title: "Developer access not active yet",
        body: `Growth workspaces do not include public HTTP API access in the current entitlement matrix. Upgrade to ${minPlan.name} in Billing when you are ready for API keys and signed webhooks.`,
        tone: "default",
      }
    }
    return {
      title: "Developer access not active yet",
      body: `Solo and Core workspaces do not include developer API access today. Upgrade to ${minPlan.name} in Billing when you need org-scoped keys and webhooks.`,
      tone: "default",
    }
  }

  const summary = accessSummary(band, tierEntitled)

  if (permReady && !canOpenPage) {
    return (
      <div className="flex max-w-full flex-col gap-6 pb-10">
        <Alert variant="destructive">
          <AlertTitle>Access restricted</AlertTitle>
          <AlertDescription>
            You do not have permission to open API and developer settings for this workspace.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex max-w-full flex-col gap-6 overflow-x-hidden pb-10">
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2">
          <Code2 size={18} className="shrink-0 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">API / Developers</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Developer access lets your team connect Equipify with approved external systems using secure API keys and
          signed webhooks.
        </p>
      </div>

      {subError ?
        <Alert variant="destructive">
          <AlertTitle>Could not load plan</AlertTitle>
          <AlertDescription>{subError}</AlertDescription>
        </Alert>
      : null}

      {showManagerReadOnly ?
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>View only</AlertTitle>
          <AlertDescription>
            You can review this page with your workspace role. Creating API keys and webhook endpoints is limited to
            members with the API keys capability (typically owners and admins).
          </AlertDescription>
        </Alert>
      : null}

      {!tierEntitled ?
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Developer access is not active for this workspace yet.</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Dashboard and portal traffic today uses your signed-in session — not a third-party HTTP API with
              developer keys. When developer access is enabled for your tier, you will manage keys and webhooks here.
            </p>
            <p>
              <Link href="/settings/billing" className="font-medium text-primary underline-offset-2 hover:underline">
                Open Billing
              </Link>{" "}
              to review your plan.
            </p>
          </AlertDescription>
        </Alert>
      : null}

      <CardShell
        title={
          <span className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-muted-foreground" aria-hidden />
            Developer access
          </span>
        }
        description="Availability for this workspace based on your subscription tier and trial state."
      >
        {subLoading ?
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Loading workspace plan…
          </p>
        : (
          <div className="space-y-3">
            <div
              className={cn(
                "rounded-lg border px-3 py-3 text-sm",
                summary.tone === "success" && "border-primary/25 bg-primary/5",
                summary.tone === "default" && "border-border bg-secondary/30",
              )}
            >
              <p className="font-medium text-foreground">{summary.title}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{summary.body}</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Internal dashboard routes and integrations (for example QuickBooks) are separate from a public developer
              API. See the repository file{" "}
              <span className="font-mono text-[11px] text-foreground/80">docs/PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md</span>{" "}
              for the roadmap.
            </p>
          </div>
        )}
      </CardShell>

      <CardShell
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />
            API keys
          </span>
        }
        description="API keys will allow approved systems to connect with this workspace. Keys are scoped to this organization."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2 text-sm text-muted-foreground">
            <p>No API keys yet.</p>
            <p className="text-xs leading-relaxed">
              Keys are stored hashed at rest with rotation and audit trails in the planned model — plaintext secrets are
              never kept in the database.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <Button
              type="button"
              size="sm"
              className="w-full min-h-[44px] sm:w-auto"
              disabled={!showGatedActions}
              onClick={() => {
                if (!showGatedActions) return
                openComingSoon("api_key")
              }}
            >
              Create API key
            </Button>
            {!permReady ?
              <p className="text-[11px] text-muted-foreground text-center sm:text-right">Checking permissions…</p>
            : showReadOnlyActions ?
              <p className="text-[11px] text-muted-foreground text-center sm:text-right max-w-[220px]">
                Upgrade your plan in Billing to unlock developer access for this workspace.
              </p>
            : showManagerReadOnly ?
              <p className="text-[11px] text-muted-foreground text-center sm:text-right max-w-[220px]">
                View only — owners and admins manage API keys.
              </p>
            : !canManageKeys ?
              <p className="text-[11px] text-muted-foreground text-center sm:text-right">View only</p>
            : null}
          </div>
        </div>
      </CardShell>

      <CardShell
        title={
          <span className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-muted-foreground" aria-hidden />
            Webhook endpoints
          </span>
        }
        description="Receive outbound event deliveries to your HTTPS endpoints when integrations support it."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            No webhook endpoints registered. Outbound webhooks are planned for approved integrations. Delivery signing and
            retry controls are not active yet.
          </p>
          <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
            Planned fields: endpoint URL, subscribed events, status, and last delivery time — shown here once delivery is
            implemented.
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full min-h-[44px] sm:w-auto"
              disabled={!showGatedActions}
              onClick={() => {
                if (!showGatedActions) return
                openComingSoon("webhook")
              }}
            >
              Add endpoint
            </Button>
          </div>
        </div>
      </CardShell>

      <CardShell
        title={
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
            Usage & limits
          </span>
        }
        description="Usage will reflect your workspace once metering is connected to the public API."
      >
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
            <dt className="text-xs font-medium text-muted-foreground">API requests this month</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">Not recording yet</dd>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
            <dt className="text-xs font-medium text-muted-foreground">Webhook deliveries this month</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">Not recording yet</dd>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
            <dt className="text-xs font-medium text-muted-foreground">Planned monthly allowance</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {planCap != null ? `${planCap.toLocaleString()} requests` : "Not set for this tier"}
            </dd>
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
              From your commercial plan matrix — not a live counter.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
            <dt className="text-xs font-medium text-muted-foreground">Reset period</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">Monthly (UTC)</dd>
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
              Usage tracking will appear here once developer access is active.
            </p>
          </div>
        </dl>
      </CardShell>

      <CardShell title="Security notes" description="How we will treat developer credentials when the feature ships.">
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground leading-relaxed">
          <li>Secrets are shown once at creation; afterward only fingerprints and metadata are visible in the UI.</li>
          <li>No plaintext API keys in the database — hashes and rotation only.</li>
          <li>Webhook deliveries will use signed payloads and org-scoped verification.</li>
          <li className="flex items-start gap-2 list-none -ml-1 pl-0">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              Future permission: today, use{" "}
              <span className="font-medium text-foreground/90">Manage API keys</span> for issuance when live; a dedicated
              capability may split read vs write later (
              <span className="font-medium text-foreground/90">canManageApiKeys</span> in the permissions model).
            </span>
          </li>
        </ul>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Read <span className="font-medium text-foreground/90">PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md</span> in the
            repo for key storage, RLS, rate limits, and webhook signing — engineering source of truth.
          </p>
        </div>
      </CardShell>

      <Dialog open={comingSoonOpen} onOpenChange={setComingSoonOpen}>
        <DialogContent className="max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {comingSoonKind === "api_key" ? "API key creation" : "Webhook endpoint"}
            </DialogTitle>
            <DialogDescription className="text-left leading-relaxed">
              {comingSoonKind === "api_key" ?
                "API key creation will be available after developer access is enabled for this workspace and the secure storage model is deployed."
              : "Registering outbound webhook endpoints will be available once delivery signing, retries, and audit logging are deployed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setComingSoonOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
