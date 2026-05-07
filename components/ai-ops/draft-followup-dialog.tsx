"use client"

/**
 * AI Ops Phase 2 — AI-drafted prospect follow-up dialog.
 *
 * Calls the existing `/prospects/{id}/draft-followup` endpoint —
 * the same one the prospect drawer uses — so we never duplicate
 * AI prompting. Returns subject + body for human review only;
 * never auto-sends.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bot, Check, Copy, ExternalLink, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import type { Recommendation } from "@/lib/ai-ops/types"
import { logAiOpsOutcome } from "./log-outcome"

export function DraftFollowupDialog({
  open,
  onOpenChange,
  rec,
  organizationId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  rec: Recommendation | null
  organizationId: string
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null)
  const [copied, setCopied] = useState<"subject" | "body" | null>(null)

  useEffect(() => {
    if (!open || !rec) {
      setDraft(null)
      setError(null)
      return
    }
    if (!rec.entity || rec.entity.type !== "prospect" || !organizationId) {
      setError("This action is only available for prospect recommendations.")
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/prospects/${encodeURIComponent(rec.entity!.id)}/draft-followup`,
          { method: "POST" },
        )
        const body = (await res.json()) as {
          ok?: boolean
          subject?: string
          body?: string
          message?: string
          error?: string
        }
        if (!res.ok || !body.ok) throw new Error(body.message ?? body.error ?? "Draft failed.")
        if (!cancelled) {
          setDraft({ subject: body.subject ?? "", body: body.body ?? "" })
          logAiOpsOutcome(organizationId, rec, "drafted_followup", { entityId: rec.entity!.id })
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Draft failed.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, rec, organizationId])

  async function copy(part: "subject" | "body") {
    if (!draft) return
    try {
      await navigator.clipboard.writeText(part === "subject" ? draft.subject : draft.body)
      setCopied(part)
      setTimeout(() => setCopied(null), 1500)
      toast({ title: `${part === "subject" ? "Subject" : "Body"} copied` })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
            AI follow-up draft
          </DialogTitle>
          <DialogDescription>
            Reviewed by you, sent by you. Equipify never auto-sends drafts —
            copy the message into your inbox or open the prospect to send via the live route.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Drafting…
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : draft ? (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Subject</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] gap-1"
                  onClick={() => void copy("subject")}
                >
                  {copied === "subject" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Copy
                </Button>
              </div>
              <p className="text-sm font-medium rounded-md border border-border bg-muted/30 px-3 py-2">
                {draft.subject}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Body</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] gap-1"
                  onClick={() => void copy("body")}
                >
                  {copied === "body" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Copy
                </Button>
              </div>
              <pre className="text-xs leading-relaxed whitespace-pre-wrap rounded-md border border-border bg-muted/30 px-3 py-2 font-sans">
                {draft.body}
              </pre>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {rec?.entity?.href ? (
            <Button asChild>
              <Link href={rec.entity.href}>
                Open prospect
                <ExternalLink className="h-3.5 w-3.5 ml-1.5" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
