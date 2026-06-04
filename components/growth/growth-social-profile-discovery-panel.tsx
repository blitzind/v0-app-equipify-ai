"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Share2 } from "lucide-react"
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
import { GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER } from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"
import type { GrowthSocialProfileDiscoveryRunDetail } from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

type DiscoveryResult = {
  run_id: string
  discovery_scope: string
  candidate_count: number
  verified_count: number
  promoted_count: number
  candidates: Array<{
    id: string
    profile_type: string
    profile_url: string
    source: string
    confidence: number
    confidence_tier: string
    verification_status: string
    promotion_status: string
    promotion_reason?: string
    evidence_count: number
  }>
  messages: string[]
}

export function GrowthSocialProfileDiscoveryPanel() {
  const [discoveryScope, setDiscoveryScope] = useState<"person" | "company">("person")
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
  const [result, setResult] = useState<DiscoveryResult | null>(null)
  const [detail, setDetail] = useState<GrowthSocialProfileDiscoveryRunDetail | null>(null)
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
    discoveryScope === "company" ||
    Boolean(
      selectedRole &&
        selectedRole.company_id === companyId.trim() &&
        selectedRole.person_id === personId.trim(),
    ) ||
    manualRoleCheck === "valid" ||
    Boolean(matchedRole)

  useEffect(() => {
    if (discoveryScope === "company") {
      setManualRoleCheck("idle")
      return
    }
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
  }, [companyId, personId, matchedRole, selectedRole, discoveryScope])

  function handleRoleSelect(row: EmailDiscoveryRolePairRow | null) {
    setSelectedRole(row)
    if (row) {
      setCompanyId(row.company_id)
      setPersonId(row.person_id)
      setDiscoveryScope("person")
      setManualRoleCheck("valid")
      setError(null)
    }
  }

  async function loadRunDetail(runId: string) {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/platform/growth/social-profile-discovery/runs/${runId}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        detail?: GrowthSocialProfileDiscoveryRunDetail
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

  async function runDiscovery() {
    if (discoveryScope === "person" && !hasValidRole) {
      setError("Select a company/person role pair or enter IDs with an existing person_company_roles row.")
      return
    }
    if (!companyId.trim()) {
      setError("company_id is required.")
      return
    }

    setRunning(true)
    setError(null)
    setResult(null)
    setDetail(null)
    try {
      const body: Record<string, unknown> = {
        company_id: companyId.trim(),
        discovery_scope: discoveryScope,
        promote,
      }
      if (discoveryScope === "person") {
        body.person_id = personId.trim()
      }

      const res = await fetch("/api/platform/growth/social-profile-discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: DiscoveryResult
        message?: string
        error?: unknown
      }
      if (!res.ok || !data.ok || !data.result) {
        throw new Error(formatCanonicalPersonBackfillRequestError(data))
      }
      setResult(data.result)
      await loadRunDetail(data.result.run_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Social profile discovery failed.")
    } finally {
      setRunning(false)
    }
  }

  const detailByCandidateId = new Map(detail?.candidates.map((c) => [c.id, c]) ?? [])
  const canRun =
    Boolean(companyId.trim()) &&
    (discoveryScope === "company" || Boolean(personId.trim())) &&
    hasValidRole &&
    manualRoleCheck !== "checking" &&
    !running

  return (
    <GrowthEngineCard title="Social profile discovery (7.5A)">
      <div className="space-y-4" data-qa-marker={GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER}>
        <p className="text-sm text-muted-foreground">
          Evidence-backed social profile URLs for canonical persons or companies. Supported types:
          LinkedIn person/company, X/Twitter, Facebook, Instagram. No AI URL generation, no username
          guessing, no authenticated scraping. Only <code className="text-xs">verified</code> candidates
          at confidence ≥ 0.85 promote to <code className="text-xs">person_profiles</code> or{" "}
          <code className="text-xs">company_profiles</code>. Runtime queues and browser triggers ship in
          7.5B.
        </p>

        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label>Discovery scope</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={discoveryScope === "person" ? "default" : "outline"}
                onClick={() => setDiscoveryScope("person")}
              >
                Person
              </Button>
              <Button
                type="button"
                size="sm"
                variant={discoveryScope === "company" ? "default" : "outline"}
                onClick={() => setDiscoveryScope("company")}
              >
                Company
              </Button>
            </div>
          </div>
        </div>

        {discoveryScope === "person" ? (
          <GrowthEmailDiscoveryRolePicker
            pairs={rolePairs}
            loading={rolesLoading}
            loadError={rolesLoadError}
            selected={selectedRole}
            onSelect={handleRoleSelect}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="spd-company-id">Company ID</Label>
            <Input
              id="spd-company-id"
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value)
                setSelectedRole(null)
                setError(null)
              }}
              placeholder="uuid"
            />
          </div>
          {discoveryScope === "person" ? (
            <div className="space-y-2">
              <Label htmlFor="spd-person-id">Person ID</Label>
              <Input
                id="spd-person-id"
                value={personId}
                onChange={(e) => {
                  setPersonId(e.target.value)
                  setSelectedRole(null)
                  setError(null)
                }}
                placeholder="uuid"
              />
            </div>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={promote}
            onChange={(e) => setPromote(e.target.checked)}
            className="rounded border-border"
          />
          Promote verified candidates to canonical profile tables
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!canRun} onClick={() => void runDiscovery()}>
            {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Share2 className="mr-2 size-4" />}
            Run discovery
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {result ? (
          <div className="space-y-3 rounded-lg border border-border p-4 text-sm">
            <p>
              Run <code className="text-xs">{result.run_id}</code> · scope {result.discovery_scope} ·{" "}
              {result.candidate_count} candidate(s) · {result.verified_count} verified ·{" "}
              {result.promoted_count} promoted
            </p>
            {result.messages.length > 0 ? (
              <ul className="list-inside list-disc text-muted-foreground">
                {result.messages.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : null}
            <div className="space-y-2">
              {result.candidates.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
                  <GrowthBadge variant="outline">{c.profile_type}</GrowthBadge>
                  <span className="truncate font-mono text-xs">{c.profile_url}</span>
                  <GrowthBadge>{c.verification_status}</GrowthBadge>
                  <GrowthBadge variant="secondary">{c.promotion_status}</GrowthBadge>
                  <span className="text-muted-foreground">
                    conf {c.confidence.toFixed(2)} · {c.evidence_count} evidence
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {loadingDetail ? (
          <p className="text-sm text-muted-foreground">Loading evidence…</p>
        ) : detail ? (
          <div className="space-y-3 rounded-lg border border-dashed border-border p-4 text-sm">
            <p className="font-medium">Evidence audit ({detail.candidates.length} candidates)</p>
            {detail.candidates.map((c) => {
              const full = detailByCandidateId.get(c.id)
              return (
                <div key={c.id} className="space-y-1 border-t border-border pt-2">
                  <p className="font-mono text-xs">
                    {c.profile_type}: {c.profile_url}
                  </p>
                  {(full?.evidence ?? []).map((ev) => (
                    <p key={ev.id} className="text-muted-foreground">
                      [{ev.evidence_type}] {ev.evidence_text}
                      {ev.source_url ? ` · ${ev.source_url}` : ""}
                    </p>
                  ))}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </GrowthEngineCard>
  )
}
