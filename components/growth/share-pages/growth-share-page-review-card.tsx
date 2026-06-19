"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthSharePageRecipientSelection } from "@/components/growth/share-pages/growth-share-page-recipient-picker"
import { growthSharePageTemplateCategoryLabel } from "@/components/growth/share-pages/growth-share-page-template-picker"
import type { GrowthSharePageTemplate } from "@/lib/growth/share-pages/share-page-template-types"

export function GrowthSharePageReviewCard({
  recipient,
  template,
  headline,
  introCopy,
  ctaText,
  calendarUrl,
  personalizationScore,
}: {
  recipient: GrowthSharePageRecipientSelection | null
  template: GrowthSharePageTemplate | null
  headline: string
  introCopy: string
  ctaText: string
  calendarUrl: string
  personalizationScore: number
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <section className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-sm font-semibold">Recipient</h4>
        {recipient ? (
          <dl className="mt-3 space-y-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{recipient.displayName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Company</dt>
              <dd>{recipient.companyName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{recipient.email ?? "—"}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No recipient selected.</p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-sm font-semibold">Page</h4>
        <dl className="mt-3 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <GrowthBadge tone="attention" label="Pending review" />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Template</dt>
            <dd>{template?.name ?? "Custom (no template)"}</dd>
          </div>
          {template ? (
            <div>
              <dt className="text-muted-foreground">Category</dt>
              <dd>{growthSharePageTemplateCategoryLabel(template.category)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-sm font-semibold">Personalization summary</h4>
        <dl className="mt-3 space-y-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Personalization score</dt>
            <dd className="font-medium">{personalizationScore}/100</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Headline</dt>
            <dd>{headline.trim() || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">CTA</dt>
            <dd>{ctaText.trim() || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Calendar URL</dt>
            <dd className="break-all">{calendarUrl.trim() || "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

function computePersonalizationScore(input: {
  recipient: GrowthSharePageRecipientSelection | null
  template: GrowthSharePageTemplate | null
  headline: string
  introCopy: string
  ctaText: string
  ctaUrl: string
  calendarUrl: string
  heroImageUrl: string
}): number {
  let score = 0
  if (input.recipient) score += 25
  if (input.template) score += 15
  if (input.headline.trim()) score += 15
  if (input.introCopy.trim()) score += 20
  if (input.ctaText.trim() && input.ctaUrl.trim()) score += 15
  if (input.calendarUrl.trim()) score += 5
  if (input.heroImageUrl.trim()) score += 5
  return Math.min(100, score)
}

export { computePersonalizationScore as growthSharePagePersonalizationScore }
