"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SHARE_PAGE_TEMPLATE_INSTANTIATION_QA_MARKER } from "@/lib/growth/share-pages/share-page-template-types"
import type { GrowthSharePageTemplate } from "@/lib/growth/share-pages/share-page-template-types"

type InstantiateResponse = {
  ok: boolean
  share_page_id?: string
  template_id?: string
  template_version_id?: string
  template_version_number?: number
  no_live_page_publish?: boolean
  message?: string
}

export function GrowthSharePageTemplateInstantiateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: GrowthSharePageTemplate
}) {
  const [leadId, setLeadId] = useState("")
  const [bookingPageId, setBookingPageId] = useState("")
  const [draftTitle, setDraftTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<InstantiateResponse | null>(null)

  const canInstantiate = template.status === "published" && Boolean(template.publishedVersion)

  async function submit() {
    if (!leadId.trim()) {
      setError("Lead id is required.")
      return
    }

    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/share-pages/templates/${template.id}/instantiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId.trim(),
          booking_page_id: bookingPageId.trim() || null,
          draft_title: draftTitle.trim() || null,
          build_context: true,
        }),
      })
      const data = (await res.json()) as InstantiateResponse
      if (!res.ok || !data.share_page_id) {
        setError(data.message ?? "Instantiation failed")
        return
      }
      setResult(data)
    } catch {
      setError("Instantiation failed")
    } finally {
      setBusy(false)
    }
  }

  function resetAndClose(nextOpen: boolean) {
    if (!nextOpen) {
      setLeadId("")
      setBookingPageId("")
      setDraftTitle("")
      setError(null)
      setResult(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-lg" data-qa-marker={GROWTH_SHARE_PAGE_TEMPLATE_INSTANTIATION_QA_MARKER}>
        <DialogHeader>
          <DialogTitle>Use template</DialogTitle>
          <DialogDescription>
            Create a draft share page from the published template version. This does not publish a live page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <GrowthBadge tone="neutral" label={template.name} />
            {template.publishedVersion ? (
              <GrowthBadge tone="healthy" label={`Published v${template.publishedVersion.versionNumber}`} />
            ) : null}
          </div>

          {!canInstantiate ? (
            <p className="text-sm text-amber-700">Publish this template before creating a share page from it.</p>
          ) : null}

          {result?.share_page_id ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-medium">Draft share page created</p>
              <p className="mt-1 text-emerald-800">
                Template v{result.template_version_number} frozen on share page {result.share_page_id}.
              </p>
              <Button asChild size="sm" className="mt-3" variant="outline">
                <Link href={`/admin/growth/share-pages/${result.share_page_id}`}>
                  <ExternalLink className="mr-1.5 size-3.5" />
                  Open draft share page
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Lead id</Label>
                <Input
                  value={leadId}
                  onChange={(event) => setLeadId(event.target.value)}
                  placeholder="UUID of target growth lead"
                  disabled={!canInstantiate || busy}
                />
                <p className="text-[11px] text-muted-foreground">
                  Minimal admin-safe selector. Replace with lead picker in a follow-up.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Booking page override (optional)</Label>
                <Input
                  value={bookingPageId}
                  onChange={(event) => setBookingPageId(event.target.value)}
                  placeholder="Booking page UUID"
                  disabled={!canInstantiate || busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Draft headline override (optional)</Label>
                <Input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="Optional headline for the draft page"
                  disabled={!canInstantiate || busy}
                />
              </div>
            </>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => resetAndClose(false)} disabled={busy}>
            Close
          </Button>
          {!result?.share_page_id ? (
            <Button disabled={!canInstantiate || busy} onClick={() => void submit()}>
              {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Sparkles className="mr-1.5 size-3.5" />}
              Create draft share page
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
