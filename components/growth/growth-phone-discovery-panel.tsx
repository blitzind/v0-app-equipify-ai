"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEmailDiscoveryRolePicker } from "@/components/growth/growth-email-discovery-role-picker"
import { formatCanonicalPersonBackfillRequestError } from "@/lib/growth/canonical-persons/canonical-person-backfill-api"
import {
  findEmailDiscoveryRolePair,
  type EmailDiscoveryRolePairRow,
} from "@/lib/growth/email-discovery/email-discovery-role-pairs"
import { GROWTH_PHONE_DISCOVERY_QA_MARKER } from "@/lib/growth/phone-discovery/phone-discovery-types"
import { GROWTH_PHONE_DISCOVERY_RUNTIME_QA_MARKER } from "@/lib/growth/phone-discovery/phone-discovery-runtime-types"
import type { GrowthPhoneDiscoveryRunDetail } from "@/lib/growth/phone-discovery/phone-discovery-types"

type DiscoveryResult = {
  run_id: string
  candidate_count: number
  verified_count: number
  promoted_count: number
  candidates: Array<{
    id: string
    phone: string
    source: string
    confidence: number
    confidence_tier: string
    verification_status: string
    promotion_status: string
    promotion_reason?: string
    verification_provider?: string
    verification_reasons?: string[]
    evidence_count: number
  }>
  messages: string[]
}

export function GrowthPhoneDiscoveryPanel() {
  const [companyId, setCompanyId] = useState("")
  const [personId, setPersonId] = useState("")
  const [selectedRole, setSelectedRole] = useState<EmailDiscoveryRolePairRow | null>(null)
  const [rolePairs, setRolePairs] = useState<EmailDiscoveryRolePairRow[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [rolesLoadError, setRolesLoadError] = useState<string | null>(null)
  const [manualRoleCheck, setManualRoleCheck] = useState<"idle" | "checking" | "valid" | "invalid">("idle")
  const [running, setRunning] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [result, setResult] = useState<DiscoveryResult | null>(null)
  const [detail, setDetail] = useState<GrowthPhoneDiscoveryRunDetail | null>(null)
  const [promote, setPromote] = useState(true)

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
        throw new Error(data.message ?? "Could not load company/person roles.")
      }
      setRolePairs(data.pairs)
    } catch (e) {
      setRolePairs([])
      setRolesLoadError(e instanceof Error ? e.message : "Could not load company/person roles.")
    } finally {
      setRolesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRolePairs()
  }, [loadRolePairs])

  const matchedRole = useMemo(
    () => findEmailDiscoveryRolePair(rolePairs, companyId, personId),
    [rolePairs, companyId, personId],
  )

  const hasValidRole =
    Boolean(
      selectedRole &&
        selectedRole.company_id === companyId.trim() &&
        selectedRole.person_id === personId.trim(),
    ) ||
    manualRoleCheck === "valid" ||
    Boolean(matchedRole)

  useEffect(() => {
    if (!companyId.trim() || !personId.trim()) {
      setManualRoleCheck("idle")
      return
    }
    if (matchedRole) {
      setManualRoleCheck("valid")
      return
    }
    if (selectedRole?.company_id === companyId.trim() && selectedRole?.person_id === personId.trim()) {
      setManualRoleCheck("valid")
      return
    }

    let cancelled = false
    setManualRoleCheck("checking")
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({
            company_id: companyId.trim(),
            person_id: personId.trim(),
            limit: "1",
          })
          const res = await fetch(`/api/platform/growth/email-discovery/role-pairs?${params}`, {
            cache: "no-store",
          })
          const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean
            pairs?: EmailDiscoveryRolePairRow[]
          }
          if (cancelled) return
          const valid = res.ok && data.ok && (data.pairs?.length ?? 0) > 0
          setManualRoleCheck(valid ? "valid" : "invalid")
        } catch {
          if (!cancelled) setManualRoleCheck("invalid")
        }
      })()
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [companyId, personId, matchedRole, selectedRole])

  function handleRoleSelect(row: EmailDiscoveryRolePairRow | null) {
    setSelectedRole(row)
    if (row) {
      setCompanyId(row.company_id)
      setPersonId(row.person_id)
      setManualRoleCheck("valid")
      setError(null)
    }
  }

  function handleCompanyIdChange(value: string) {
    setCompanyId(value)
    setSelectedRole(null)
    setError(null)
  }

  function handlePersonIdChange(value: string) {
    setPersonId(value)
    setSelectedRole(null)
    setError(null)
  }

  async function loadRunDetail(runId: string) {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/platform/growth/phone-discovery/runs/${runId}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        detail?: GrowthPhoneDiscoveryRunDetail
        message?: string
      }
      if (!res.ok || !data.ok || !data.detail) {
        throw new Error(data.message ?? "Could not load run evidence.")
      }
      setDetail(data.detail)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load evidence.")
    } finally {
      setLoadingDetail(false)
    }
  }

  async function runDiscovery(sync = false) {
    if (!hasValidRole) {
      setError("Select a company/person role pair or enter IDs with an existing person_company_roles row.")
      return
    }

    setRunning(true)
    setError(null)
    setNotice(null)
    setResult(null)
    setDetail(null)
    try {
      const endpoint = sync
        ? "/api/platform/growth/phone-discovery/run"
        : "/api/platform/growth/phone-discovery/jobs"
      const body = sync
        ? {
            company_id: companyId.trim(),
            person_id: personId.trim(),
            promote,
          }
        : {
            company_id: companyId.trim(),
            person_id: personId.trim(),
            promote_on_complete: promote,
            trigger_source: "infrastructure_panel",
          }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: DiscoveryResult
        enqueued?: boolean
        job_id?: string | null
        reason?: string | null
        message?: string
        error?: unknown
      }
      if (!res.ok || !data.ok) {
        throw new Error(formatCanonicalPersonBackfillRequestError(data))
      }
      if (sync && data.result) {
        setResult(data.result)
        await loadRunDetail(data.result.run_id)
      } else {
        setNotice(
          data.enqueued
            ? `Queued job ${data.job_id ?? ""}. The growth-phone-discovery-worker cron processes pending jobs.`
            : data.reason === "verified_phone_exists"
              ? "Verified phone already on file — job not queued."
              : data.reason === "active_job_exists"
                ? "Discovery already queued or running."
                : "Discovery was not queued.",
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Phone discovery failed.")
    } finally {
      setRunning(false)
    }
  }

  const detailByCandidateId = new Map(detail?.candidates.map((c) => [c.id, c]) ?? [])
  const canRun =
    Boolean(companyId.trim() && personId.trim()) &&
    hasValidRole &&
    manualRoleCheck !== "checking" &&
    !running

  return (
    <GrowthEngineCard title="Phone discovery (7.4A + 7.4B)">
      <div
        className="space-y-4"
        data-qa-marker={GROWTH_PHONE_DISCOVERY_QA_MARKER}
        data-runtime-qa-marker={GROWTH_PHONE_DISCOVERY_RUNTIME_QA_MARKER}
      >
        <p className="text-sm text-muted-foreground">
          Discover phones for a canonical company + person with an existing{" "}
          <code className="text-xs">person_company_roles</code> link. Deterministic verification only
          (no paid providers, no AI guessing, no outbound dialing). Only{" "}
          <code className="text-xs">verified</code> candidates at confidence ≥ 0.85 promote to{" "}
          <code className="text-xs">growth.person_phones</code>. Default action queues async jobs
          processed by <code className="text-xs">growth-phone-discovery-worker</code>.
        </p>

        <GrowthEmailDiscoveryRolePicker
          pairs={rolePairs}
          loading={rolesLoading}
          loadError={rolesLoadError}
          selected={selectedRole}
          onSelect={handleRoleSelect}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone-discovery-company-id">Canonical company ID (fallback)</Label>
            <Input
              id="phone-discovery-company-id"
              value={companyId}
              onChange={(e) => handleCompanyIdChange(e.target.value)}
              placeholder="uuid"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone-discovery-person-id">Canonical person ID (fallback)</Label>
            <Input
              id="phone-discovery-person-id"
              value={personId}
              onChange={(e) => handlePersonIdChange(e.target.value)}
              placeholder="uuid"
            />
          </div>
        </div>

        {companyId.trim() && personId.trim() ? (
          <p
            className={
              manualRoleCheck === "invalid"
                ? "text-xs text-destructive"
                : manualRoleCheck === "valid"
                  ? "text-xs text-green-700 dark:text-green-400"
                  : "text-xs text-muted-foreground"
            }
          >
            {manualRoleCheck === "checking"
              ? "Checking person_company_roles…"
              : manualRoleCheck === "valid"
                ? "Valid company/person role — discovery allowed."
                : manualRoleCheck === "invalid"
                  ? "No person_company_roles row for these IDs. Discovery will be rejected."
                  : null}
          </p>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={promote} onChange={(e) => setPromote(e.target.checked)} />
          Promote verified candidates to person_phones
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!canRun} onClick={() => void runDiscovery(false)}>
            {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Phone className="mr-2 size-4" />}
            Queue discovery (7.4B)
          </Button>
          <Button type="button" variant="outline" disabled={!canRun} onClick={() => void runDiscovery(true)}>
            Run sync (debug)
          </Button>
        </div>

        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

        {result ? (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <GrowthBadge label={`candidates ${result.candidate_count}`} tone="neutral" />
              <GrowthBadge label={`verified ${result.verified_count}`} tone="attention" />
              <GrowthBadge label={`promoted ${result.promoted_count}`} tone="healthy" />
            </div>
            <p className="text-muted-foreground">Run ID: {result.run_id}</p>
            {result.messages.length > 0 ? (
              <ul className="list-disc pl-5 text-muted-foreground">
                {result.messages.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : null}
            {loadingDetail ? <p className="text-muted-foreground">Loading evidence…</p> : null}
            {result.candidates.length > 0 ? (
              <ul className="max-h-96 space-y-3 overflow-y-auto rounded-lg border p-3">
                {result.candidates.map((c) => {
                  const rich = detailByCandidateId.get(c.id)
                  return (
                    <li key={c.id} className="border-b border-border/40 pb-3 last:border-0">
                      <div className="font-medium">{c.phone}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.source} · {c.confidence_tier} · conf {c.confidence.toFixed(2)} ·{" "}
                        {c.verification_status}
                        {c.verification_provider ? ` · via ${c.verification_provider}` : ""} ·{" "}
                        {c.promotion_status}
                      </div>
                      {c.promotion_reason ? (
                        <p className="mt-1 text-xs text-muted-foreground">Promotion: {c.promotion_reason}</p>
                      ) : null}
                      {(c.verification_reasons ?? rich?.verification_reasons)?.length ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Verification:{" "}
                          {(c.verification_reasons ?? rich?.verification_reasons ?? []).join(" · ")}
                        </p>
                      ) : null}
                      {rich?.evidence?.length ? (
                        <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                          {rich.evidence.map((ev) => (
                            <li key={ev.id}>
                              <span className="font-medium">{ev.evidence_type}</span>: {ev.evidence_text}
                              {ev.source_url ? (
                                <>
                                  {" "}
                                  (
                                  <a
                                    href={ev.source_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                  >
                                    source
                                  </a>
                                  )
                                </>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.evidence_count} evidence row(s)
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </GrowthEngineCard>
  )
}
