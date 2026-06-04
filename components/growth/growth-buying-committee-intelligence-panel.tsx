"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Users, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEmailDiscoveryRolePicker } from "@/components/growth/growth-email-discovery-role-picker"
import type { EmailDiscoveryRolePairRow } from "@/lib/growth/email-discovery/email-discovery-role-pairs"
import { formatCanonicalPersonBackfillRequestError } from "@/lib/growth/canonical-persons/canonical-person-backfill-api"
import { GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import { GROWTH_BUYING_COMMITTEE_INTELLIGENCE_RUNTIME_QA_MARKER } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-runtime-types"
import type { GrowthBuyingCommitteeIntelligenceRunDetail } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

type DiscoveryResult = {
  run_id: string
  member_count: number
  verified_count: number
  promoted_count: number
  coverage: {
    coverage_score: number
    roles_present: string[]
    roles_missing: string[]
    single_thread_risk: boolean
  }
  assignments: Array<{
    person_id: string
    full_name: string
    committee_role: string
    verification_status: string
    promotion_status: string
    confidence: number
  }>
  messages: string[]
}

export function GrowthBuyingCommitteeIntelligencePanel() {
  const [companyId, setCompanyId] = useState("")
  const [selectedRole, setSelectedRole] = useState<EmailDiscoveryRolePairRow | null>(null)
  const [rolePairs, setRolePairs] = useState<EmailDiscoveryRolePairRow[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [rolesLoadError, setRolesLoadError] = useState<string | null>(null)
  const [companyCheck, setCompanyCheck] = useState<"idle" | "checking" | "valid" | "invalid">("idle")
  const [running, setRunning] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [result, setResult] = useState<DiscoveryResult | null>(null)
  const [detail, setDetail] = useState<GrowthBuyingCommitteeIntelligenceRunDetail | null>(null)
  const [promote, setPromote] = useState(true)
  const [syncRun, setSyncRun] = useState(false)
  const [operatorStatus, setOperatorStatus] = useState<{
    verified_member_count: number
    coverage_score: number
    roles_present: string[]
    roles_missing: string[]
    discovery_status: string
    has_verified_committee: boolean
  } | null>(null)

  const loadRolePairs = useCallback(async () => {
    setRolesLoading(true)
    setRolesLoadError(null)
    try {
      const res = await fetch("/api/platform/growth/email-discovery/role-pairs?limit=500", {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        pairs?: EmailDiscoveryRolePairRow[]
        message?: string
      }
      if (!res.ok || !data.ok || !Array.isArray(data.pairs)) {
        throw new Error(data.message ?? "Could not load company roles.")
      }
      setRolePairs(data.pairs)
    } catch (e) {
      setRolePairs([])
      setRolesLoadError(e instanceof Error ? e.message : "Could not load company roles.")
    } finally {
      setRolesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRolePairs()
  }, [loadRolePairs])

  const companyOptions = useMemo(() => {
    const seen = new Set<string>()
    return rolePairs.filter((p) => {
      if (seen.has(p.company_id)) return false
      seen.add(p.company_id)
      return true
    })
  }, [rolePairs])

  const hasValidCompany =
    Boolean(selectedRole?.company_id === companyId.trim()) ||
    companyCheck === "valid" ||
    companyOptions.some((p) => p.company_id === companyId.trim())

  useEffect(() => {
    if (!companyId.trim()) {
      setCompanyCheck("idle")
      setOperatorStatus(null)
      return
    }
    let cancelled = false
    setCompanyCheck("checking")
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/platform/growth/buying-committee-intelligence/operator-status?company_id=${encodeURIComponent(companyId.trim())}`,
            { cache: "no-store" },
          )
          const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean
            status?: {
              verified_member_count: number
              coverage_score: number
              roles_present: string[]
              roles_missing: string[]
              discovery_status: string
              has_verified_committee: boolean
            }
          }
          if (cancelled) return
          if (res.ok && data.ok && data.status) {
            setCompanyCheck("valid")
            setOperatorStatus({
              verified_member_count: data.status.verified_member_count,
              coverage_score: data.status.coverage_score,
              roles_present: data.status.roles_present,
              roles_missing: data.status.roles_missing,
              discovery_status: data.status.discovery_status,
              has_verified_committee: data.status.has_verified_committee,
            })
          } else {
            setCompanyCheck("invalid")
            setOperatorStatus(null)
          }
        } catch {
          if (!cancelled) {
            setCompanyCheck("invalid")
            setOperatorStatus(null)
          }
        }
      })()
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [companyId])

  const runDiscovery = async () => {
    setRunning(true)
    setError(null)
    setNotice(null)
    setResult(null)
    setDetail(null)
    try {
      const endpoint = syncRun
        ? "/api/platform/growth/buying-committee-intelligence/run"
        : "/api/platform/growth/buying-committee-intelligence/jobs"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId.trim(),
          promote_on_complete: promote,
          promote: syncRun ? promote : undefined,
          trigger_source: "infrastructure_panel",
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: DiscoveryResult
        enqueued?: boolean
        reason?: string | null
        message?: string
        error?: unknown
      }
      if (!res.ok || !data.ok) {
        throw new Error(formatCanonicalPersonBackfillRequestError(data))
      }
      if (syncRun && data.result) {
        setResult(data.result)
        setNotice(
          `Run ${data.result.run_id.slice(0, 8)}… — ${data.result.verified_count} verified, ${data.result.promoted_count} promoted · coverage ${(data.result.coverage.coverage_score * 100).toFixed(0)}%.`,
        )
      } else {
        setNotice(
          data.enqueued
            ? "Buying committee intelligence job queued."
            : data.reason === "verified_committee_exists"
              ? "Verified committee members already on file."
              : data.reason === "active_job_exists"
                ? "Job already pending or running."
                : "Job was not queued.",
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Buying committee intelligence run failed.")
    } finally {
      setRunning(false)
    }
  }

  const loadRunDetail = async (runId: string) => {
    setLoadingDetail(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/buying-committee-intelligence/runs/${runId}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        detail?: GrowthBuyingCommitteeIntelligenceRunDetail
        message?: string
      }
      if (!res.ok || !data.ok || !data.detail) {
        throw new Error(data.message ?? "Could not load run detail.")
      }
      setDetail(data.detail)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load run detail.")
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <GrowthEngineCard
      title="Buying committee intelligence (7.7A + 7.7B)"
      icon={<Users size={17} />}
      data-qa-marker={GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER}
      data-runtime-qa-marker={GROWTH_BUYING_COMMITTEE_INTELLIGENCE_RUNTIME_QA_MARKER}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Evidence-backed buying committee role assignments from canonical employment, staging contacts,
        and confirmed decision makers. Default: async job queue (cron worker). Sync run for debug only.
      </p>
      <div className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label>Pick company via canonical person role</Label>
          <GrowthEmailDiscoveryRolePicker
            pairs={rolePairs}
            loading={rolesLoading}
            loadError={rolesLoadError}
            selected={selectedRole}
            onSelect={(row) => {
              setSelectedRole(row)
              if (row) setCompanyId(row.company_id)
            }}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="bci-company-id">Canonical company ID</Label>
          <Input
            id="bci-company-id"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            placeholder="UUID from canonical companies backfill"
          />
          {companyCheck === "checking" && (
            <p className="text-xs text-muted-foreground">Validating company…</p>
          )}
          {companyCheck === "valid" && operatorStatus && (
            <p className="text-xs text-muted-foreground">
              Status: {operatorStatus.discovery_status} · verified members:{" "}
              {operatorStatus.verified_member_count} · coverage{" "}
              {(operatorStatus.coverage_score * 100).toFixed(0)}% · present:{" "}
              {operatorStatus.roles_present.join(", ") || "none"} · missing:{" "}
              {operatorStatus.roles_missing.join(", ") || "none"}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={promote}
            onChange={(e) => setPromote(e.target.checked)}
            className="rounded border-border"
          />
          Promote verified assignments to canonical committee intelligence
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={syncRun}
            onChange={(e) => setSyncRun(e.target.checked)}
            className="rounded border-border"
          />
          Sync debug run (HTTP, bypasses job queue)
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={running || !hasValidCompany || !companyId.trim()}
            onClick={() => void runDiscovery()}
          >
            {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {syncRun ? "Run sync collection" : "Queue buying committee intelligence"}
          </Button>
          {result?.run_id && (
            <Button
              type="button"
              variant="outline"
              disabled={loadingDetail}
              onClick={() => void loadRunDetail(result.run_id)}
            >
              {loadingDetail ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Load run detail
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

        {result && (
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">Latest run</p>
            <p className="text-muted-foreground">
              {result.member_count} assignments · {result.verified_count} verified ·{" "}
              {result.promoted_count} promoted
            </p>
            {result.coverage.single_thread_risk && (
              <GrowthBadge variant="warning" className="mt-2">
                Single-thread risk
              </GrowthBadge>
            )}
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {result.assignments.slice(0, 12).map((a) => (
                <li key={`${a.person_id}-${a.committee_role}`} className="text-xs">
                  {a.full_name} — {a.committee_role} ({a.verification_status})
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={loadingDetail}
              onClick={() => void loadRunDetail(result.run_id)}
            >
              {loadingDetail ? "Loading…" : "Load run detail"}
            </Button>
          </div>
        )}

        {detail && (
          <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            Run {detail.run_id.slice(0, 8)}… · evidence rows: {detail.evidence.length}
          </div>
        )}
      </div>
    </GrowthEngineCard>
  )
}
