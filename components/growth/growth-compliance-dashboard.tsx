"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GrowthSettingsCard,
  GROWTH_SETTINGS_INNER_GAP,
} from "@/components/growth/growth-settings-ui"
import type { GrowthComplianceDashboard } from "@/lib/growth/compliance/compliance-types"
import { maskComplianceEmailHash } from "@/lib/growth/compliance/compliance-types"
import { senderReputationTierLabel } from "@/lib/growth/compliance/sender-reputation"
import { cn } from "@/lib/utils"

function formatRate(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

const REPUTATION_TONE: Record<string, "healthy" | "attention" | "warning" | "critical" | "neutral"> = {
  healthy: "healthy",
  monitor: "neutral",
  warning: "warning",
  critical: "critical",
}

function ComplianceSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const sectionId = `compliance-section-${title.replace(/\s+/g, "-").toLowerCase()}`
  return (
    <section className="space-y-3" aria-labelledby={sectionId}>
      <div>
        <h2 id={sectionId} className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function GuidanceCard({
  title,
  tone,
  items,
  footnote,
}: {
  title: string
  tone: "ready" | "attention" | "neutral"
  items: string[]
  footnote: string
}) {
  const toneClass =
    tone === "ready"
      ? "border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
      : tone === "attention"
        ? "border-amber-200/70 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20"
        : "border-border/70 bg-muted/20"

  return (
    <div className={cn("rounded-xl border p-4", toneClass)}>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">{footnote}</p>
    </div>
  )
}

export function GrowthComplianceDashboardPanel({
  variant = "default",
}: {
  variant?: "default" | "operator"
}) {
  const isOperator = variant === "operator"
  const [dashboard, setDashboard] = useState<GrowthComplianceDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/compliance/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthComplianceDashboard
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load compliance dashboard.")
      }
      setDashboard(data.dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load compliance status.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {isOperator ? "Loading compliance status…" : "Loading compliance dashboard…"}
      </div>
    )
  }

  if (error && !dashboard) {
    return (
      <p className="text-sm text-rose-600" role="alert" aria-live="polite">
        {error}
      </p>
    )
  }

  if (!dashboard) return null

  const reputationTier = dashboard.senderReputation.tier
  const CardShell = isOperator ? GrowthSettingsCard : GrowthEngineCard

  if (isOperator) {
    return (
      <div className="space-y-6">
        <ComplianceSection
          title="Workspace compliance"
          description="Overall policy status and email sender health."
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Bounce rate" value={formatRate(dashboard.hardBounceRate)} />
              <StatTile label="Complaint rate" value={formatRate(dashboard.complaintRate)} />
              <StatTile label="Active suppressions" value={dashboard.suppressionCount} />
              <StatTile label="Sender score" value={dashboard.senderReputation.score} />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh compliance status"
            >
              {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
              Refresh
            </Button>
          </div>

          <CardShell title="Email sender health" icon={<ShieldAlert className="size-4" />}>
            <div className="flex flex-wrap items-center gap-3">
              <GrowthBadge
                label={senderReputationTierLabel(reputationTier)}
                tone={REPUTATION_TONE[reputationTier] ?? "neutral"}
              />
              <span className="text-sm text-muted-foreground">
                Score {dashboard.senderReputation.score} · Hard bounces {dashboard.senderReputation.hardBounces} ·
                Complaints {dashboard.senderReputation.complaints}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {reputationTier === "healthy" || reputationTier === "monitor"
                ? "Your workspace is within acceptable sending limits. Keep monitoring bounce and complaint rates."
                : "Review recent bounces and complaints below. Consider pausing outreach until rates improve."}
            </p>
          </CardShell>
        </ComplianceSection>

        <ComplianceSection
          title="Communication compliance"
          description="Consent, opt-outs, suppressions, and recent delivery issues."
        >
          <CardShell title="Suppression list">
            <p className="mb-3 text-sm text-muted-foreground">
              Contacts blocked from outreach because of bounces, complaints, or opt-outs.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Recipient</th>
                    <th className="px-2 py-2 font-medium">Reason</th>
                    <th className="px-2 py-2 font-medium">Scope</th>
                    <th className="px-2 py-2 font-medium">Added</th>
                    <th className="px-2 py-2 font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.suppressions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-8 text-center text-muted-foreground">
                        <p className="font-medium text-foreground">No active suppressions</p>
                        <p className="mt-1 text-sm">Blocked contacts will appear here when opt-outs or bounces occur.</p>
                      </td>
                    </tr>
                  ) : (
                    dashboard.suppressions.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="px-2 py-2 text-xs">{maskComplianceEmailHash(row.emailHash)}</td>
                        <td className="px-2 py-2 capitalize">{row.reason.replace(/_/g, " ")}</td>
                        <td className="px-2 py-2">{row.leadId ? "Contact" : "Workspace"}</td>
                        <td className="px-2 py-2">{formatDate(row.createdAt)}</td>
                        <td className="px-2 py-2">{formatDate(row.expiresAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardShell>

          <div className="grid gap-4 xl:grid-cols-2">
            <CardShell title="Recent bounces">
              {dashboard.recentBounces.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bounces recorded recently.</p>
              ) : (
                <ul className="space-y-2">
                  {dashboard.recentBounces.map((bounce) => (
                    <li key={bounce.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <GrowthBadge
                          label={bounce.bounceType === "hard" ? "Hard bounce" : "Bounce"}
                          tone={bounce.retryAllowed ? "attention" : "critical"}
                        />
                        <span className="text-xs text-muted-foreground">{formatDate(bounce.occurredAt)}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{bounce.senderLabel ?? "Sender account"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardShell>

            <CardShell title="Recent complaints">
              {dashboard.recentComplaints.length === 0 ? (
                <p className="text-sm text-muted-foreground">No complaints recorded recently.</p>
              ) : (
                <ul className="space-y-2">
                  {dashboard.recentComplaints.map((complaint) => (
                    <li key={complaint.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <GrowthBadge label="Complaint" tone="critical" />
                        <span className="text-xs text-muted-foreground">{formatDate(complaint.occurredAt)}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{complaint.senderLabel ?? "Sender account"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardShell>
          </div>
        </ComplianceSection>

        <ComplianceSection title="Data handling" description="How recipient data is protected and retained.">
          <CardShell title="Privacy and retention">
            <div className={GROWTH_SETTINGS_INNER_GAP}>
              <p className="text-sm text-muted-foreground">
                Recipient identities are stored as secure hashes — not raw email addresses. Compliance events are
                retained according to your workspace policy.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Privacy</p>
                  <p className="mt-1 text-sm font-medium">Hashed recipient identity</p>
                  <p className="mt-1 text-xs text-muted-foreground">No raw emails stored in compliance records.</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Retention</p>
                  <p className="mt-1 text-sm font-medium">Configured</p>
                  <p className="mt-1 text-xs text-muted-foreground">Suppression and event history follow workspace defaults.</p>
                </div>
              </div>
            </div>
          </CardShell>

          <CardShell title="Email templates">
            <p className="text-sm text-muted-foreground">
              Outbound emails must include an unsubscribe link when required. Approved templates are managed in Content
              Library by Platform admin.
            </p>
          </CardShell>
        </ComplianceSection>

        <ComplianceSection
          title="Operator guidance"
          description="What is enforced automatically, what you own, and what Platform admin configures."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <GuidanceCard
              title="Automatically enforced"
              tone="ready"
              items={[
                "Suppression list blocks outreach",
                "Unsubscribe requests honored",
                "Hard bounces stop future sends",
                "Complaints trigger suppression",
              ]}
              footnote="These protections run without manual action."
            />
            <GuidanceCard
              title="Your responsibility"
              tone="attention"
              items={[
                "Review bounce and complaint trends",
                "Pause campaigns when rates spike",
                "Approve voice consent when prompted",
                "Use approved email templates",
              ]}
              footnote="Act when monitoring surfaces issues."
            />
            <GuidanceCard
              title="Managed by Platform admin"
              tone="neutral"
              items={[
                "Governance exports and audits",
                "Deliverability configuration",
                "Template and footer approval",
                "Advanced compliance rules",
              ]}
              footnote="Contact your administrator to change policy."
            />
          </div>

          <CardShell title="Platform admin">
            <p className="text-sm text-muted-foreground">
              Advanced compliance configuration, deliverability tooling, and governance exports are managed in Platform
              admin.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/admin/growth/providers/compliance">Open compliance admin</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/growth/settings/communications/deliverability">View deliverability</Link>
              </Button>
            </div>
          </CardShell>
        </ComplianceSection>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Hard bounce rate" value={formatRate(dashboard.hardBounceRate)} />
          <StatTile label="Complaint rate" value={formatRate(dashboard.complaintRate)} />
          <StatTile label="Suppression count" value={dashboard.suppressionCount} />
          <StatTile label="Sender reputation" value={dashboard.senderReputation.score} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/settings/governance">Governance Exports</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <GrowthEngineCard title="Sender health" icon={<ShieldAlert className="size-4" />}>
        <div className="flex flex-wrap items-center gap-3">
          <GrowthBadge
            label={senderReputationTierLabel(reputationTier)}
            tone={REPUTATION_TONE[reputationTier] ?? "neutral"}
          />
          <span className="text-sm text-muted-foreground">
            Score {dashboard.senderReputation.score} · Hard {dashboard.senderReputation.hardBounces} · Complaints{" "}
            {dashboard.senderReputation.complaints}
          </span>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Suppression table">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Email</th>
                <th className="px-2 py-2 font-medium">Reason</th>
                <th className="px-2 py-2 font-medium">Scope</th>
                <th className="px-2 py-2 font-medium">Created</th>
                <th className="px-2 py-2 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.suppressions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                    No active suppressions.
                  </td>
                </tr>
              ) : (
                dashboard.suppressions.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="px-2 py-2 font-mono text-xs">{maskComplianceEmailHash(row.emailHash)}</td>
                    <td className="px-2 py-2">{row.reason}</td>
                    <td className="px-2 py-2">{row.leadId ? "lead" : "global"}</td>
                    <td className="px-2 py-2">{formatDate(row.createdAt)}</td>
                    <td className="px-2 py-2">{formatDate(row.expiresAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Compliance merge fields">
        <p className="text-sm text-muted-foreground">
          Outbound templates must include <code>{`{{unsubscribe.link}}`}</code> when compliance footer is required.
          Manage approved templates in Content Library.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/admin/growth/copilot/content-library">Open Content Library</Link>
        </Button>
      </GrowthEngineCard>

      <GrowthEngineCard title="Deliverability compliance risks">
        <p className="text-sm text-muted-foreground">
          Bounce rate {formatRate(dashboard.hardBounceRate)} · Complaint rate {formatRate(dashboard.complaintRate)}.
          Review bounce, complaint, and unsubscribe spikes in Deliverability Ops.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/admin/growth/providers/deliverability-ops">Open Deliverability Ops</Link>
        </Button>
      </GrowthEngineCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <GrowthEngineCard title="Bounce feed">
          {dashboard.recentBounces.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bounces recorded.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.recentBounces.map((bounce) => (
                <li key={bounce.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <GrowthBadge label={bounce.bounceType} tone={bounce.retryAllowed ? "attention" : "critical"} />
                    <span className="text-xs text-muted-foreground">{formatDate(bounce.occurredAt)}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {bounce.providerLabel} · {bounce.senderLabel}
                  </p>
                  {bounce.providerReason ? <p className="text-xs">{bounce.providerReason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Complaint feed">
          {dashboard.recentComplaints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No complaints recorded.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.recentComplaints.map((complaint) => (
                <li key={complaint.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <GrowthBadge label={complaint.complaintType} tone="critical" />
                    <span className="text-xs text-muted-foreground">{formatDate(complaint.occurredAt)}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {complaint.providerLabel} · {complaint.senderLabel}
                  </p>
                  {complaint.providerReason ? <p className="text-xs">{complaint.providerReason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      </div>
    </div>
  )
}
