"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import type { OrganizationAccountType } from "@/lib/platform/platform-metrics-organizations"

const CLASSIFICATION_OPTIONS: { id: OrganizationAccountType; label: string }[] = [
  { id: "customer", label: "Real customer" },
  { id: "demo", label: "Demo account" },
  { id: "internal", label: "Internal account" },
  { id: "test", label: "Test account" },
  { id: "unbillable", label: "Unbillable account" },
]

type ClassificationData = {
  accountType: OrganizationAccountType
  excludeFromPlatformMetrics: boolean
  accountTypeBadge: string | null
  exclusionReason: string | null
  excludedAt: string | null
}

type AidenActionsAvailability = {
  enabled: boolean
  source: "plan_entitlement" | "manual_enable" | "forced_disable" | "not_entitled"
  planEntitled: boolean
  manuallyEnabled: boolean
  manuallyDisabled: boolean
  reason: string | null
  planId: string
}

type ResponseData = {
  ok?: boolean
  organization?: { id: string; name: string; slug: string | null }
  onboardingMetadata?: {
    industry: string | null
    howHeardAboutEquipify: string | null
    createdAt: string | null
  } | null
  aidenActions?: AidenActionsAvailability
  message?: string
  error?: string
}

function sourceLabel(source: string) {
  return source.replace(/_/g, " ")
}

export default function AdminAccountFeaturePage() {
  const params = useParams<{ organizationId: string }>()
  const organizationId = params.organizationId
  const [data, setData] = useState<ResponseData | null>(null)
  const [classification, setClassification] = useState<ClassificationData | null>(null)
  const [classificationType, setClassificationType] = useState<OrganizationAccountType>("customer")
  const [classificationReason, setClassificationReason] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [featuresRes, classificationRes] = await Promise.all([
        fetch(`/api/platform/accounts/${organizationId}/features`, { cache: "no-store" }),
        fetch(`/api/platform/accounts/${organizationId}/classification`, { cache: "no-store" }),
      ])
      const json = (await featuresRes.json().catch(() => ({}))) as ResponseData
      if (!featuresRes.ok || !json.ok) throw new Error(json.message ?? json.error ?? "Could not load account features.")
      setData(json)
      setReason(json.aidenActions?.reason ?? "")

      const classJson = (await classificationRes.json().catch(() => ({}))) as {
        ok?: boolean
        classification?: ClassificationData
        message?: string
      }
      if (classificationRes.ok && classJson.ok && classJson.classification) {
        setClassification(classJson.classification)
        setClassificationType(classJson.classification.accountType)
        setClassificationReason(classJson.classification.exclusionReason ?? "")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load account features.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [organizationId])

  async function saveClassification() {
    setSaving("classification")
    setError(null)
    try {
      const res = await fetch(`/api/platform/accounts/${organizationId}/classification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: classificationType,
          exclusionReason: classificationReason,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        classification?: ClassificationData
        message?: string
      }
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Could not update account classification.")
      if (json.classification) {
        setClassification(json.classification)
        setClassificationType(json.classification.accountType)
        setClassificationReason(json.classification.exclusionReason ?? "")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update account classification.")
    } finally {
      setSaving(null)
    }
  }

  async function save(mode: "manual_enable" | "forced_disable" | "clear_override") {
    setSaving(mode)
    setError(null)
    try {
      const res = await fetch(`/api/platform/accounts/${organizationId}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, reason }),
      })
      const json = (await res.json().catch(() => ({}))) as ResponseData
      if (!res.ok || !json.ok) throw new Error(json.message ?? json.error ?? "Could not update feature override.")
      setData((prev) => ({ ...(prev ?? {}), aidenActions: json.aidenActions }))
      setReason(json.aidenActions?.reason ?? "")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update feature override.")
    } finally {
      setSaving(null)
    }
  }

  const availability = data?.aidenActions
  const onboardingMeta = data?.onboardingMetadata

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center gap-4 border-b border-white/10 bg-[#0F172A] px-6">
        <Link href="/admin" className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
          <ArrowLeft size={14} />
          Platform Admin
        </Link>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>{data?.organization?.name ?? "Account Features"}</h1>
              <p className="text-sm text-muted-foreground">Manual feature controls for this organization.</p>
            </div>
          </div>

          {loading ? (
            <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading feature controls...
            </div>
          ) : availability ? (
            <div className="mt-6 space-y-5">
              {error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">Platform metrics classification</p>
                  {classification?.accountTypeBadge ? (
                    <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                      {classification.accountTypeBadge}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Mark demo, internal, test, or unbillable accounts so they are excluded from platform KPIs.
                </p>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Classification</label>
                    <select
                      className="input-base w-full text-sm"
                      value={classificationType}
                      onChange={(e) => setClassificationType(e.target.value as OrganizationAccountType)}
                    >
                      {CLASSIFICATION_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {classificationType !== "customer" ? (
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Exclusion reason (optional)</span>
                      <Textarea
                        value={classificationReason}
                        onChange={(e) => setClassificationReason(e.target.value)}
                        placeholder="Why this account is excluded from platform metrics…"
                      />
                    </label>
                  ) : null}
                  {classification?.excludedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Last excluded: {classification.excludedAt.slice(0, 10)}
                    </p>
                  ) : null}
                  <Button onClick={() => void saveClassification()} disabled={saving === "classification"}>
                    {saving === "classification" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Save classification
                  </Button>
                </div>
              </div>

              {onboardingMeta ? (
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="font-semibold">Onboarding metadata</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Self-serve signup context captured at workspace creation.
                  </p>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">How they heard about Equipify</dt>
                      <dd className="font-medium">{onboardingMeta.howHeardAboutEquipify ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Industry (workspace)</dt>
                      <dd className="font-medium capitalize">{onboardingMeta.industry?.replace(/_/g, " ") ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Workspace created</dt>
                      <dd className="font-medium">
                        {onboardingMeta.createdAt ? onboardingMeta.createdAt.slice(0, 10) : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">AIden Actions</p>
                    <p className="text-sm text-muted-foreground">AI-assisted workflow execution after explicit user confirmation.</p>
                  </div>
                  <span className={availability.enabled ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"}>
                    {availability.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Plan</dt>
                    <dd className="font-medium capitalize">{availability.planId}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Plan entitlement</dt>
                    <dd className="font-medium">{availability.planEntitled ? "Included" : "Not included"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Current source</dt>
                    <dd className="font-medium capitalize">{sourceLabel(availability.source)}</dd>
                  </div>
                </dl>
              </div>

              <label className="block space-y-1">
                <span className="text-sm font-medium">Override reason</span>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional internal reason..." />
              </label>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void save("manual_enable")} disabled={Boolean(saving)}>
                  {saving === "manual_enable" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Enable AIden Actions
                </Button>
                <Button variant="destructive" onClick={() => void save("forced_disable")} disabled={Boolean(saving)}>
                  {saving === "forced_disable" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Disable AIden Actions
                </Button>
                <Button variant="outline" onClick={() => void save("clear_override")} disabled={Boolean(saving)}>
                  {saving === "clear_override" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Use Plan Entitlement
                </Button>
              </div>
            </div>
          ) : error ? (
            <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
          ) : null}
        </section>
      </main>
    </div>
  )
}
