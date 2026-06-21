"use client"

import { useState } from "react"
import { ThumbsDown, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  GROWTH_PERSONALIZATION_NEGATIVE_FEEDBACK_REASONS,
  type GrowthPersonalizationNegativeFeedbackReason,
} from "@/lib/growth/personalization/personalization-types"
import { negativeFeedbackReasonLabel } from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-utils"

export function GrowthPersonalizationOperatorFeedbackPanel({
  generationId,
  disabled,
  onSubmitted,
}: {
  generationId: string
  disabled?: boolean
  onSubmitted?: () => void
}) {
  const [pending, setPending] = useState(false)
  const [showNegativeForm, setShowNegativeForm] = useState(false)
  const [negativeReason, setNegativeReason] =
    useState<GrowthPersonalizationNegativeFeedbackReason>("too_generic")
  const [customNote, setCustomNote] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  async function submit(input: {
    sentiment: "helpful" | "not_helpful"
    negativeReason?: GrowthPersonalizationNegativeFeedbackReason
  }) {
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch(
        `/api/platform/growth/personalization/generations/${generationId}/evaluation-feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sentiment: input.sentiment,
            ...(input.sentiment === "not_helpful"
              ? { negativeReason: input.negativeReason ?? negativeReason, customNote: customNote.trim() || undefined }
              : { customNote: customNote.trim() || undefined }),
          }),
        },
      )
      const payload = (await response.json()) as { ok?: boolean; message?: string }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Could not record feedback.")
      }
      setMessage("Feedback recorded — thank you.")
      setShowNegativeForm(false)
      onSubmitted?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not record feedback.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Was this draft helpful?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || pending}
          onClick={() => void submit({ sentiment: "helpful" })}
        >
          <ThumbsUp className="mr-1 size-3.5" />
          Helpful
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || pending}
          onClick={() => setShowNegativeForm((current) => !current)}
        >
          <ThumbsDown className="mr-1 size-3.5" />
          Not Helpful
        </Button>
      </div>

      {showNegativeForm ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">What was wrong?</p>
          <div className="flex flex-wrap gap-2">
            {GROWTH_PERSONALIZATION_NEGATIVE_FEEDBACK_REASONS.map((reason) => (
              <Button
                key={reason}
                size="sm"
                variant={negativeReason === reason ? "default" : "outline"}
                disabled={pending}
                onClick={() => setNegativeReason(reason)}
              >
                {negativeFeedbackReasonLabel(reason)}
              </Button>
            ))}
          </div>
          <Textarea
            value={customNote}
            onChange={(event) => setCustomNote(event.target.value)}
            rows={2}
            placeholder="Optional note"
            disabled={pending}
          />
          <Button
            size="sm"
            disabled={pending}
            onClick={() => void submit({ sentiment: "not_helpful", negativeReason })}
          >
            Submit feedback
          </Button>
        </div>
      ) : null}

      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
    </div>
  )
}
