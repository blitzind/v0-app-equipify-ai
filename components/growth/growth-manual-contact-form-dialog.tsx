"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import type { GrowthManualContactEntryResult } from "@/lib/growth/manual-entry/manual-contact-entry-types"

export type GrowthManualContactFormValues = {
  company_name: string
  contact_name: string
  title: string
  email: string
  phone: string
  website: string
  linkedin_url: string
  city: string
  state: string
  source_note: string
  verify_email: boolean
}

const EMPTY_FORM: GrowthManualContactFormValues = {
  company_name: "",
  contact_name: "",
  title: "",
  email: "",
  phone: "",
  website: "",
  linkedin_url: "",
  city: "",
  state: "",
  source_note: "",
  verify_email: false,
}

type GrowthManualContactFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  acquisitionRunId?: string | null
  onSuccess?: (result: GrowthManualContactEntryResult) => void
}

export function GrowthManualContactFormDialog({
  open,
  onOpenChange,
  acquisitionRunId,
  onSuccess,
}: GrowthManualContactFormDialogProps) {
  const pathname = usePathname()
  const [form, setForm] = useState<GrowthManualContactFormValues>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GrowthManualContactEntryResult | null>(null)

  function updateField<K extends keyof GrowthManualContactFormValues>(
    key: K,
    value: GrowthManualContactFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetDialog() {
    setForm(EMPTY_FORM)
    setError(null)
    setResult(null)
    setSaving(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetDialog()
    onOpenChange(next)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/platform/growth/manual-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.company_name.trim(),
          contact_name: form.contact_name.trim(),
          title: form.title.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          website: form.website.trim() || null,
          linkedin_url: form.linkedin_url.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          source_note: form.source_note.trim() || null,
          verify_email: form.verify_email && Boolean(form.email.trim()),
          acquisition_run_id: acquisitionRunId ?? null,
        }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: GrowthManualContactEntryResult
        message?: string
        error?: string
      }

      if (!data.result) {
        throw new Error(data.message ?? data.error ?? "Could not save contact.")
      }

      setResult(data.result)
      onSuccess?.(data.result)

      if (data.result.status === "error") {
        setError(data.result.message)
      } else if (data.result.status === "suppressed") {
        setError(data.result.reason)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save contact.")
    } finally {
      setSaving(false)
    }
  }

  const leadHref =
    result && (result.status === "created" || result.status === "linked_duplicate")
      ? growthFeaturePath(pathname, `leads/${result.lead_id}`)
      : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add contact manually</DialogTitle>
        </DialogHeader>

        {result && (result.status === "created" || result.status === "linked_duplicate") ? (
          <div className="space-y-4">
            <div
              className={
                result.status === "created"
                  ? "rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-foreground"
                  : "rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-foreground"
              }
            >
              <p className="font-medium">
                {result.status === "created"
                  ? "Lead and decision maker created."
                  : "Linked to existing lead (duplicate)."}
              </p>
              {result.status === "created" && result.email_status ? (
                <p className="mt-1 text-muted-foreground">
                  Email status: {result.email_status}
                  {result.verified_by_provider ? " (provider verified)" : ""}
                </p>
              ) : null}
              {result.status === "linked_duplicate" ? (
                <p className="mt-1 text-muted-foreground">
                  Matched rule: {result.rule} ({Math.round(result.confidence * 100)}% confidence)
                </p>
              ) : null}
            </div>

            {result.warnings.length > 0 ? (
              <ul className="space-y-1 rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                {result.warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            ) : null}

            {leadHref ? (
              <Button asChild>
                <Link href={leadHref}>Open lead</Link>
              </Button>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  resetDialog()
                }}
              >
                Add another
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="manual-contact-company">Company name *</Label>
                <Input
                  id="manual-contact-company"
                  value={form.company_name}
                  onChange={(e) => updateField("company_name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-contact-name">Contact name *</Label>
                <Input
                  id="manual-contact-name"
                  value={form.contact_name}
                  onChange={(e) => updateField("contact_name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-contact-title">Title</Label>
                <Input
                  id="manual-contact-title"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-contact-email">Email</Label>
                <Input
                  id="manual-contact-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-contact-phone">Phone</Label>
                <Input
                  id="manual-contact-phone"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="manual-contact-website">Website</Label>
                <Input
                  id="manual-contact-website"
                  value={form.website}
                  onChange={(e) => updateField("website", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="manual-contact-linkedin">LinkedIn URL</Label>
                <Input
                  id="manual-contact-linkedin"
                  value={form.linkedin_url}
                  onChange={(e) => updateField("linkedin_url", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-contact-city">City</Label>
                <Input
                  id="manual-contact-city"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-contact-state">State</Label>
                <Input
                  id="manual-contact-state"
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="manual-contact-source">Source note</Label>
                <Textarea
                  id="manual-contact-source"
                  value={form.source_note}
                  onChange={(e) => updateField("source_note", e.target.value)}
                  placeholder="Where you found this contact (referral, trade show, LinkedIn, etc.)"
                  rows={2}
                />
              </div>
              {form.email.trim() ? (
                <div className="flex items-start gap-2 sm:col-span-2">
                  <Checkbox
                    id="manual-contact-verify"
                    checked={form.verify_email}
                    onCheckedChange={(checked) => updateField("verify_email", checked === true)}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="manual-contact-verify" className="font-normal">
                      Verify email with ZeroBounce before saving
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      If unchecked, email is saved as unknown until verified. No outreach is sent.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : result?.status === "suppressed" ? (
              <p className="text-sm text-destructive">{result.reason}</p>
            ) : null}

            {result?.warnings && result.warnings.length > 0 && result.status === "suppressed" ? (
              <ul className="space-y-1 text-xs text-destructive">
                {result.warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !form.company_name.trim() || !form.contact_name.trim()}
              >
                {saving ? "Saving…" : "Add contact"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
