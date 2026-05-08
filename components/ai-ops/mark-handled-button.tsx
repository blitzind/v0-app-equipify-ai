"use client"

/**
 * AI Ops Phase 3 — "Mark as handled" outcome button.
 *
 * Records an `acted_on` outcome with an optional short note in
 * `ai_ops_outcomes.context.note`. Does **not** mutate the source
 * record; this is purely a manager affirmation that the
 * recommendation has been worked. The card is kept in the UI
 * unless the manager also dismisses or snoozes it — separation of
 * concerns between "I worked this" and "stop showing me this".
 */

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import type { Recommendation } from "@/lib/ai-ops/types"
import { logAiOpsOutcome } from "./log-outcome"

export function MarkHandledButton({
  rec,
  organizationId,
  onHandled,
}: {
  rec: Recommendation
  organizationId: string
  onHandled?: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!organizationId) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/outcomes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recommendationKey: rec.key,
            category: rec.category,
            ruleId: rec.ruleId,
            outcome: "acted_on",
            context: note.trim() ? { note: note.trim().slice(0, 280) } : {},
          }),
        },
      )
      if (!res.ok) throw new Error("Failed to record outcome.")
      // also fire the beacon-style logger so client-side fallbacks
      // catch this even if the manager closes the tab quickly.
      logAiOpsOutcome(organizationId, rec, "acted_on", note.trim() ? { note: note.trim().slice(0, 280) } : {})
      setDone(true)
      setOpen(false)
      toast({ title: "Marked as handled", description: "Recorded for the digest activity recap." })
      onHandled?.()
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={done ? "outline" : "outline"}
          size="sm"
          className="h-8 gap-1"
          disabled={done}
        >
          {done ? <Check className="h-3 w-3 text-emerald-600" aria-hidden /> : <Check className="h-3 w-3" aria-hidden />}
          {done ? "Handled" : "Mark as handled"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <p className="text-xs font-semibold mb-1">What did you do?</p>
        <p className="text-[11px] text-muted-foreground mb-2 leading-snug">
          Optional. Used in the weekly digest activity recap. Equipify will not change any
          records or send messages — this is just a note for your team.
        </p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Called the customer, rescheduled for Tuesday."
          rows={3}
          maxLength={280}
          className="text-xs"
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void submit()} disabled={busy} className="gap-1">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" aria-hidden />}
            Confirm
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
