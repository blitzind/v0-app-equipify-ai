"use client"

import { useState } from "react"
import Link from "next/link"
import { Globe } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import type { GrowthBrowserIntakeResult } from "@/lib/growth/browser-intake/browser-intake-types"
import { GROWTH_BROWSER_INTAKE_SOURCE_PLATFORMS } from "@/lib/growth/browser-intake/browser-intake-types"

type BrowserIntakeFormValues = {
  company_name: string
  contact_name: string
  title: string
  email: string
  phone: string
  website: string
  linkedin_url: string
  source_url: string
  source_platform: (typeof GROWTH_BROWSER_INTAKE_SOURCE_PLATFORMS)[number]
  city: string
  state: string
  notes: string
}

const EMPTY_FORM: BrowserIntakeFormValues = {
  company_name: "",
  contact_name: "",
  title: "",
  email: "",
  phone: "",
  website: "",
  linkedin_url: "",
  source_url: "",
  source_platform: "linkedin",
  city: "",
  state: "",
  notes: "",
}

export default function AdminGrowthBrowserIntakeTestPage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  const [form, setForm] = useState<BrowserIntakeFormValues>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GrowthBrowserIntakeResult | null>(null)

  function updateField<K extends keyof BrowserIntakeFormValues>(key: K, value: BrowserIntakeFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/platform/growth/browser-intake/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.company_name.trim(),
          contact_name: form.contact_name.trim() || null,
          title: form.title.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          website: form.website.trim() || null,
          linkedin_url: form.linkedin_url.trim() || null,
          source_url: form.source_url.trim() || null,
          source_platform: form.source_platform,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })

      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean
        result?: GrowthBrowserIntakeResult
        error?: string
        message?: string
      } | null

      if (!res.ok || !payload?.result) {
        setError(payload?.message ?? payload?.error ?? `Request failed (${res.status})`)
        return
      }

      setResult(payload.result)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed")
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setForm(EMPTY_FORM)
    setError(null)
    setResult(null)
  }

  const leadId =
    result && (result.status === "created" || result.status === "updated") ? result.lead_id : null

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <Globe size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Browser Intake Test</h1>
              <p className="text-sm text-muted-foreground">
                Debug form for the future Chrome extension intake API. Submits operator-captured
                company and contact data into Growth Engine without outreach or sequence enrollment.
              </p>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="company_name">Company name *</Label>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={(e) => updateField("company_name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact name</Label>
              <Input
                id="contact_name"
                value={form.contact_name}
                onChange={(e) => updateField("contact_name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={form.website}
                onChange={(e) => updateField("website", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                value={form.linkedin_url}
                onChange={(e) => updateField("linkedin_url", e.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="source_url">Source URL</Label>
              <Input
                id="source_url"
                value={form.source_url}
                onChange={(e) => updateField("source_url", e.target.value)}
                placeholder="https://www.linkedin.com/in/..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source_platform">Source platform</Label>
              <Select
                value={form.source_platform}
                onValueChange={(value) =>
                  updateField(
                    "source_platform",
                    value as BrowserIntakeFormValues["source_platform"],
                  )
                }
              >
                <SelectTrigger id="source_platform">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {GROWTH_BROWSER_INTAKE_SOURCE_PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(e) => updateField("state", e.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <p className="font-medium">Status: {result.status}</p>
              {"lead_id" in result ? (
                <p className="mt-1">
                  Lead:{" "}
                  {leadId ? (
                    <Link href={`/admin/growth/leads/${leadId}`} className="underline">
                      {leadId}
                    </Link>
                  ) : (
                    leadId
                  )}
                </p>
              ) : null}
              {"decision_maker_id" in result && result.decision_maker_id ? (
                <p className="mt-1">Decision maker: {result.decision_maker_id}</p>
              ) : null}
              {"rule" in result ? (
                <p className="mt-1">
                  Dedupe: {result.rule} ({Math.round(result.confidence * 100)}%)
                </p>
              ) : null}
              {result.warnings.length > 0 ? (
                <ul className="mt-2 list-disc pl-5">
                  {result.warnings.map((warning) => (
                    <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Submitting…" : "Submit browser intake"}
            </Button>
            <Button type="button" variant="outline" onClick={handleReset} disabled={saving}>
              Reset
            </Button>
          </div>
        </form>
      </div>
    </PlatformAdminPageShell>
  )
}
