"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Building2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEmailDiscoveryRolePicker } from "@/components/growth/growth-email-discovery-role-picker"
import type { EmailDiscoveryRolePairRow } from "@/lib/growth/email-discovery/email-discovery-role-pairs"
import { GROWTH_COMPANY_INTELLIGENCE_QA_MARKER } from "@/lib/growth/company-intelligence/company-intelligence-types"
import type { GrowthCompanyIntelligenceRunDetail } from "@/lib/growth/company-intelligence/company-intelligence-types"

type DiscoveryResult = {
  run_id: string
  finding_count: number
  verified_count: number
  promoted_count: number
  findings: Array<{
    finding_ref: string
    intelligence_category: string
    intelligence_key: string
    value_text: string | null
    source: string
    confidence: number
    verification_status: string
    promotion_status: string
    promotion_reason?: string
    evidence_count: number
  }>
  messages: string[]
}

export function GrowthCompanyIntelligencePanel() {
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
  const [detail, setDetail] = useState<GrowthCompanyIntelligenceRunDetail | null>(null)
  const [promote, setPromote] = useState(true)
  const [operatorStatus, setOperatorStatus] = useState<{
    snapshot_count: number
    categories_present: string[]
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
            `/api/platform/growth/company-intelligence/operator-status?company_id=${encodeURIComponent(companyId.trim())}`,
            { cache: "no-store" },
          )
          const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean
            status?: { snapshot_count: number; categories_present: string[] }
          }
          if (cancelled) return
          if (res.ok && data.ok && data.status) {
            setCompanyCheck("valid")
            setOperatorStatus({
              snapshot_count: data.status.snapshot_count,
              categories_present: data.status.categories_present,
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
      const res = await fetch("/api/platform/growth/company-intelligence/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId.trim(), promote }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: DiscoveryResult
        message?: string
      }
      if (!res.ok || !data.ok || !data.result) {
        throw new Error(data.message ?? "Company intelligence run failed.")
      }
      setResult(data.result)
      setNotice(
        `Run ${data.result.run_id.slice(0, 8)}… — ${data.result.verified_count} verified, ${data.result.promoted_count} promoted.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Company intelligence run failed.")
    } finally {
      setRunning(false)
    }
  }

  const loadRunDetail = async (runId: string) => {
    setLoadingDetail(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/company-intelligence/runs/${runId}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        detail?: GrowthCompanyIntelligenceRunDetail
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
      title="Company intelligence (7.6A)"
      icon={<Building2 size={17} />}
      data-qa-marker={GROWTH_COMPANY_INTELLIGENCE_QA_MARKER}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Evidence-backed firmographics from public website, staging, and canonical sources. Sync HTTP
        run only — no jobs, cron, or browser automation in 7.6A.
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
          <Label htmlFor="ci-company-id">Canonical company ID</Label>
          <Input
            id="ci-company-id"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            placeholder="UUID from canonical companies backfill"
          />
          {companyCheck === "checking" && (
            <p className="text-xs text-muted-foreground">Validating company…</p>
          )}
          {companyCheck === "valid" && operatorStatus && (
            <p className="text-xs text-muted-foreground">
              Snapshots: {operatorStatus.snapshot_count} · categories:{" "}
              {operatorStatus.categories_present.join(", ") || "none"}
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
          Promote verified findings to canonical intelligence snapshots
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={running || !companyId.trim() || !hasValidCompany}
            onClick={() => void runDiscovery()}
          >
            {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Collect company intelligence
          </Button>
          {result?.run_id && (
            <Button
              type="button"
              variant="outline"
              disabled={loadingDetail}
              onClick={() => void loadRunDetail(result.run_id)}
            >
              {loadingDetail ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Load run evidence
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

        {result && (
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">
              Findings {result.finding_count} · verified {result.verified_count} · promoted{" "}
              {result.promoted_count}
            </p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {result.findings.slice(0, 30).map((f) => (
                <li key={f.finding_ref} className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={f.intelligence_category} tone="neutral" />
                  <span className="text-muted-foreground">{f.intelligence_key}</span>
                  <span className="truncate">{f.value_text ?? "—"}</span>
                  <GrowthBadge label={f.verification_status} tone="status" />
                </li>
              ))}
            </ul>
            {result.messages.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">{result.messages.join(" · ")}</p>
            )}
          </div>
        )}

        {detail && (
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">Evidence rows ({detail.evidence.length})</p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto font-mono text-xs">
              {detail.evidence.slice(0, 40).map((e) => (
                <li key={e.id}>
                  [{e.evidence_type}] {e.intelligence_category}/{e.intelligence_key}:{" "}
                  {e.evidence_text.slice(0, 80)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </GrowthEngineCard>
  )
}
