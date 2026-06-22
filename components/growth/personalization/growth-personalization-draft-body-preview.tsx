"use client"

import { formatPersonalizationDraftBodyParagraphsForDisplay } from "@/lib/growth/personalization/growth-personalization-draft-formatting"
import { cn } from "@/lib/utils"

type Props = {
  body: string
  className?: string
  paragraphClassName?: string
  compact?: boolean
}

export function GrowthPersonalizationDraftBodyPreview({
  body,
  className,
  paragraphClassName,
  compact = false,
}: Props) {
  const paragraphs = formatPersonalizationDraftBodyParagraphsForDisplay(body)
  if (!paragraphs.length) return null

  return (
    <div className={cn("space-y-5", className)} data-qa="growth-personalization-draft-body-preview">
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          className={cn(
            "whitespace-pre-wrap text-sm leading-7 text-foreground",
            compact && "text-xs leading-relaxed",
            paragraphClassName,
          )}
        >
          {paragraph}
        </p>
      ))}
    </div>
  )
}
