"use client"

/**
 * Leads + Follow-Up Phase 2 — AI follow-up draft review dialog.
 *
 * Generates a draft subject + body via the prospect-specific AI route,
 * then lets the user copy the draft, open their mail client (mailto:), or
 * save the text as a follow-up note. Equipify never auto-sends — the user
 * stays in control. The dialog mirrors the AiInsightActions email modal
 * so the review experience is familiar.
 */

import { useCallback, useState } from "react"
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MessageSquarePlus,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import type { ProspectListItem } from "@/lib/prospects/types"

export type AiDraftFollowUpDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  prospect: ProspectListItem | null
  onSavedAsNote?: () => void
}

export function AiDraftFollowUpDialog({
  open,
  onOpenChange,
  organizationId,
  prospect,
  onSavedAsNote,
}: AiDraftFollowUpDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [copied, setCopied] = useState(false)

  const canMailto = Boolean(prospect?.contact_email)

  const generate = useCallback(async () => {
    if (!prospect) return
    setLoading(true)
    setError(null)
    setSubject("")
    setBody("")
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/prospects/${encodeURIComponent(prospect.id)}/draft-followup`,
        { method: "POST" },
      )
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        subject?: string
        body?: string
        error?: string
        message?: string
      }
      if (!res.ok || !j.ok || !j.subject || !j.body) {
        const reason =
          j.error === "not_configured"
            ? "AI providers aren't configured for this workspace."
            : j.error === "plan_blocked"
              ? "AI drafting isn't included on your current plan."
              : j.error === "budget_exceeded"
                ? "Monthly AI budget has been reached."
                : (j.message ?? "Could not generate draft.")
        throw new Error(reason)
      }
      setSubject(j.subject)
      setBody(j.body)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setLoading(false)
    }
  }, [organizationId, prospect])

  const copyAll = useCallback(async () => {
    const text = `Subject: ${subject}\n\n${body}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({ title: "Draft copied" })
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast({ title: "Copy failed", description: "Select the text and copy manually.", variant: "destructive" })
    }
  }, [subject, body, toast])

  const openInMail = useCallback(() => {
    if (!prospect?.contact_email || !subject) return
    const url = `mailto:${encodeURIComponent(prospect.contact_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = url
  }, [prospect, subject, body])

  const saveAsNote = useCallback(async () => {
    if (!prospect || !subject || !body) return
    setSavingNote(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/prospects/${encodeURIComponent(prospect.id)}/follow-up`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "system",
            summary: `AI draft saved as note: ${subject}`.slice(0, 240),
            body,
          }),
        },
      )
      const j = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) throw new Error(j.message ?? "Could not save draft.")
      toast({ title: "Saved to timeline" })
      onSavedAsNote?.()
      onOpenChange(false)
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed",
        variant: "destructive",
      })
    } finally {
      setSavingNote(false)
    }
  }, [organizationId, prospect, subject, body, toast, onSavedAsNote, onOpenChange])

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setError(null)
      setSubject("")
      setBody("")
      setCopied(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> AI follow-up draft
          </DialogTitle>
          <DialogDescription>
            We pull this prospect&apos;s status, notes, and recent touches to draft a short, professional
            follow-up. Review carefully — Equipify never sends messages on your behalf.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
            {error}
          </p>
        ) : null}

        {!subject && !body && !loading && !error ? (
          <div className="flex flex-col items-center text-center gap-2 py-6">
            <Sparkles className="w-6 h-6 text-primary" />
            <p className="text-sm font-medium">Draft a thoughtful follow-up in seconds.</p>
            <p className="text-xs text-muted-foreground max-w-md">
              We&apos;ll generate a short subject + body tailored to{" "}
              <strong>{prospect?.company_name ?? "this prospect"}</strong>. Nothing leaves Equipify
              automatically.
            </p>
            <Button size="sm" className="mt-1 gap-1.5" onClick={() => void generate()}>
              <Sparkles className="w-3.5 h-3.5" /> Generate draft
            </Button>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Drafting follow-up…
          </div>
        ) : null}

        {!loading && (subject || body) ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Subject</Label>
              <p className="text-sm font-medium rounded-md border border-border bg-muted/30 px-3 py-2">
                {subject}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Body</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Edit freely — your changes only affect copy/open-in-mail.
              </p>
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2 sm:flex-nowrap">
          {(subject || body) && !loading ? (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => void generate()}
              disabled={loading}
            >
              <Sparkles className="w-3.5 h-3.5" /> Regenerate
            </Button>
          ) : null}
          {(subject || body) && !loading ? (
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => void copyAll()}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy all"}
            </Button>
          ) : null}
          {(subject || body) && !loading ? (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={openInMail}
              disabled={!canMailto}
              title={canMailto ? undefined : "Add an email to this prospect to open in your mail client"}
            >
              <Mail className="w-3.5 h-3.5" /> Open in email
              <ExternalLink className="w-3 h-3 opacity-70" />
            </Button>
          ) : null}
          {(subject || body) && !loading ? (
            <Button
              type="button"
              className="gap-1.5"
              onClick={() => void saveAsNote()}
              disabled={savingNote}
            >
              {savingNote ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MessageSquarePlus className="w-3.5 h-3.5" />
              )}
              {savingNote ? "Saving…" : "Save as note"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
