"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE,
  GROWTH_ENTERPRISE_GOVERNANCE_QA_MARKER,
  GROWTH_GOVERNANCE_EXPORT_TYPES,
  GROWTH_GOVERNANCE_POLICY_CATEGORIES,
  governanceCategoryLabel,
  governancePolicyStatusLabel,
  governanceRuleTypeLabel,
  type GrowthEnterpriseGovernanceDashboard,
  type GrowthGovernancePolicy,
} from "@/lib/growth/governance/governance-types"

type TabKey = "policies" | "rules" | "audit" | "exports" | "retention" | "violations"

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function GrowthEnterpriseGovernanceDashboardView() {
  const [tab, setTab] = useState<TabKey>("policies")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthEnterpriseGovernanceDashboard | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [newPolicyName, setNewPolicyName] = useState("")
  const [retentionDays, setRetentionDays] = useState("365")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/governance/dashboard", { cache: "no-store" })
      const payload = (await response.json()) as {
        ok?: boolean
        dashboard?: GrowthEnterpriseGovernanceDashboard
        message?: string
      }
      if (!response.ok || !payload.ok || !payload.dashboard) {
        throw new Error(payload.message ?? "Could not load governance dashboard.")
      }
      setDashboard(payload.dashboard)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load governance dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createPolicy() {
    if (!newPolicyName.trim()) return
    setActionId("create-policy")
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/governance/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPolicyName.trim(),
          category: "sending",
          rules: [{ ruleType: "role_can_send", ruleConfig: { allowed_roles: ["platform_admin"] } }],
        }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? "Could not create policy.")
      setNewPolicyName("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.")
    } finally {
      setActionId(null)
    }
  }

  async function policyAction(policy: GrowthGovernancePolicy, action: "activate" | "pause") {
    setActionId(`${action}:${policy.id}`)
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/governance/policies/${policy.id}/${action}`, { method: "POST" })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? `${action} failed.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : `${action} failed.`)
    } finally {
      setActionId(null)
    }
  }

  async function generateExport(exportType: (typeof GROWTH_GOVERNANCE_EXPORT_TYPES)[number]) {
    setActionId(`export:${exportType}`)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/governance/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportType, humanApprovalConfirmed: true }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? "Export failed.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.")
    } finally {
      setActionId(null)
    }
  }

  async function saveRetention() {
    setActionId("retention")
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/governance/retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "audit",
          retentionDays: Number(retentionDays) || 365,
          legalHold: false,
          description: "Default audit retention",
        }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? "Retention update failed.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retention update failed.")
    } finally {
      setActionId(null)
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading governance controls…
      </div>
    )
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "policies", label: "Policies" },
    { key: "rules", label: "Rules" },
    { key: "audit", label: "Approval Audit" },
    { key: "exports", label: "Exports" },
    { key: "retention", label: "Retention" },
    { key: "violations", label: "Violations" },
  ]

  return (
    <div className="space-y-6">
      <GrowthEngineCard title="Enterprise Governance" icon={<ShieldCheck className="size-4" />}>
        <p className="mb-4 text-xs text-muted-foreground">{GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE}</p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <GrowthBadge label={GROWTH_ENTERPRISE_GOVERNANCE_QA_MARKER} tone="neutral" />
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1 size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Active Policies" value={dashboard?.activePolicies ?? 0} />
          <StatTile label="Approval Events" value={dashboard?.approvalEvents ?? 0} />
          <StatTile label="Exports Generated" value={dashboard?.exportsGenerated ?? 0} />
          <StatTile label="Retention Policies" value={dashboard?.retentionPolicies ?? 0} />
          <StatTile label="Policy Violations" value={dashboard?.policyViolations ?? 0} />
          <StatTile label="Legal Hold" value={dashboard?.legalHoldCount ?? 0} />
        </div>
      </GrowthEngineCard>

      <div className="flex flex-wrap gap-2">
        {tabs.map((entry) => (
          <Button
            key={entry.key}
            variant={tab === entry.key ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      {tab === "policies" ? (
        <GrowthEngineCard title="Policies">
          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              value={newPolicyName}
              onChange={(e) => setNewPolicyName(e.target.value)}
              placeholder="New policy name"
              className="max-w-xs"
            />
            <Button size="sm" disabled={actionId === "create-policy"} onClick={() => void createPolicy()}>
              Create draft policy
            </Button>
          </div>
          {!dashboard?.policies.length ? (
            <p className="text-sm text-muted-foreground">No governance policies yet.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.policies.map((policy) => (
                <div key={policy.id} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{policy.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {governanceCategoryLabel(policy.category)} · {policy.rules.length} rules
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <GrowthBadge label={governancePolicyStatusLabel(policy.status)} tone="neutral" />
                      {policy.status === "draft" || policy.status === "paused" ? (
                        <Button size="sm" variant="outline" disabled={Boolean(actionId)} onClick={() => void policyAction(policy, "activate")}>
                          Activate
                        </Button>
                      ) : null}
                      {policy.status === "active" ? (
                        <Button size="sm" variant="outline" disabled={Boolean(actionId)} onClick={() => void policyAction(policy, "pause")}>
                          Pause
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>
      ) : null}

      {tab === "rules" ? (
        <GrowthEngineCard title="Rules">
          {!dashboard?.policies.some((policy) => policy.rules.length > 0) ? (
            <p className="text-sm text-muted-foreground">No rules configured yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dashboard.policies.flatMap((policy) =>
                policy.rules.map((rule) => (
                  <li key={rule.id} className="rounded-lg border border-border/60 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{policy.name}</span>
                      <GrowthBadge label={governanceRuleTypeLabel(rule.ruleType)} tone="medium" />
                      <GrowthBadge label={`priority ${rule.priority}`} tone="neutral" />
                    </div>
                  </li>
                )),
              )}
            </ul>
          )}
        </GrowthEngineCard>
      ) : null}

      {tab === "audit" ? (
        <GrowthEngineCard title="Approval Audit">
          {!dashboard?.recentAudit.length ? (
            <p className="text-sm text-muted-foreground">No approval audit events yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dashboard.recentAudit.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border/60 px-3 py-2">
                  <p className="font-medium">
                    {entry.action} · {entry.entityType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actorEmail} · {entry.sourceRoute} · {formatWhen(entry.recordedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      ) : null}

      {tab === "exports" ? (
        <GrowthEngineCard title="Exports">
          <div className="mb-4 flex flex-wrap gap-2">
            {GROWTH_GOVERNANCE_EXPORT_TYPES.map((exportType) => (
              <Button
                key={exportType}
                size="sm"
                variant="outline"
                disabled={Boolean(actionId)}
                onClick={() => void generateExport(exportType)}
              >
                {exportType.replace(/_/g, " ")}
              </Button>
            ))}
          </div>
          {!dashboard?.recentExports.length ? (
            <p className="text-sm text-muted-foreground">No exports generated yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dashboard.recentExports.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border/60 px-3 py-2">
                  <p className="font-medium">{entry.fileLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.exportType} · {entry.rowCount} rows · {formatWhen(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      ) : null}

      {tab === "retention" ? (
        <GrowthEngineCard title="Retention Policies">
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Audit retention days</label>
              <Input value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} className="w-32" />
            </div>
            <Button size="sm" disabled={actionId === "retention"} onClick={() => void saveRetention()}>
              Save retention policy
            </Button>
          </div>
          {!dashboard?.retention.length ? (
            <p className="text-sm text-muted-foreground">No retention policies configured.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dashboard.retention.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border/60 px-3 py-2">
                  <p className="font-medium">
                    {entry.scope} · {entry.retentionDays} days
                  </p>
                  {entry.legalHold ? <GrowthBadge label="legal hold" tone="critical" /> : null}
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      ) : null}

      {tab === "violations" ? (
        <GrowthEngineCard title="Policy Violations">
          {!dashboard?.recentViolations.length ? (
            <p className="text-sm text-muted-foreground">No policy violations recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dashboard.recentViolations.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border/60 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{entry.title}</span>
                    <GrowthBadge label={entry.severity} tone="attention" />
                  </div>
                  <p className="text-xs text-muted-foreground">{entry.description}</p>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Categories: {GROWTH_GOVERNANCE_POLICY_CATEGORIES.map(governanceCategoryLabel).join(", ")}
      </p>
    </div>
  )
}
