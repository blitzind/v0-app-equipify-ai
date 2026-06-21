"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  GROWTH_PERSONALIZATION_REGENERATION_FEEDBACK_OPTIONS,
  regenerationFeedbackLabel,
  type GrowthPersonalizationRegenerationFeedbackCategory,
} from "@/lib/growth/personalization/personalization-generation-ux"

export function GrowthPersonalizationRegenerationFeedbackPanel({
  onSubmit,
  disabled,
  submitLabel = "Regenerate with Feedback",
}: {
  onSubmit: (input: {
    category: GrowthPersonalizationRegenerationFeedbackCategory
    customNotes?: string
  }) => void
  disabled?: boolean
  submitLabel?: string
}) {
  const [category, setCategory] = useState<GrowthPersonalizationRegenerationFeedbackCategory>("too_generic")
  const [customNotes, setCustomNotes] = useState("")

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3" data-qa="growth-personalization-regeneration-feedback">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Regeneration feedback</p>
      <div className="flex flex-wrap gap-2">
        {GROWTH_PERSONALIZATION_REGENERATION_FEEDBACK_OPTIONS.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={category === option ? "default" : "outline"}
            onClick={() => setCategory(option)}
            disabled={disabled}
          >
            {regenerationFeedbackLabel(option)}
          </Button>
        ))}
      </div>
      {category === "custom" ? (
        <Textarea
          value={customNotes}
          onChange={(event) => setCustomNotes(event.target.value)}
          rows={3}
          placeholder="Tell the reviewer what to improve on the next version…"
          disabled={disabled}
        />
      ) : null}
      <Button
        type="button"
        size="sm"
        disabled={disabled || (category === "custom" && !customNotes.trim())}
        onClick={() =>
          onSubmit({
            category,
            customNotes: category === "custom" ? customNotes.trim() : undefined,
          })
        }
      >
        {submitLabel}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Feedback is stored on the generation record for operator review. It does not change AI behavior yet.
      </p>
    </div>
  )
}
