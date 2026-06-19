"use client"

import type { GrowthSharePageOperatorReviewContext } from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"

function formatWhen(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

export function GrowthSharePageReviewPanel({ review }: { review: GrowthSharePageOperatorReviewContext }) {
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-labelledby="sp-page-review">
      <h3 id="sp-page-review" className="text-sm font-semibold">
        Share page review
      </h3>

      <div>
        <p className="text-xs font-medium text-muted-foreground">Template</p>
        <dl className="mt-2 space-y-1 text-xs">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd>{review.template.name ?? "Custom page"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Category</dt>
            <dd>{review.template.category ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last updated</dt>
            <dd>{formatWhen(review.template.lastUpdatedAt)}</dd>
          </div>
        </dl>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground">Personalization</p>
        <dl className="mt-2 space-y-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Headline</dt>
            <dd>{review.personalization.headline || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Intro</dt>
            <dd className="whitespace-pre-wrap">{review.personalization.intro || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">CTA</dt>
            <dd>{review.personalization.cta ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Calendar URL</dt>
            <dd className="break-all">{review.personalization.calendarUrl ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Hero image</dt>
            <dd className="break-all">{review.personalization.heroImageUrl ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Logo</dt>
            <dd className="break-all">{review.personalization.logoUrl ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Brand colors</dt>
            <dd className="flex items-center gap-2">
              <span
                className="inline-block size-3 rounded-full border"
                style={{ backgroundColor: review.personalization.brandColors.primary }}
                aria-hidden
              />
              {review.personalization.brandColors.primary}
              <span
                className="inline-block size-3 rounded-full border"
                style={{ backgroundColor: review.personalization.brandColors.accent }}
                aria-hidden
              />
              {review.personalization.brandColors.accent}
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground">Merge variables</p>
        <dl className="mt-2 space-y-1 text-xs">
          <div>
            <dt className="text-muted-foreground">Used</dt>
            <dd>{review.mergeVariables.used.length > 0 ? review.mergeVariables.used.join(", ") : "None"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Missing</dt>
            <dd>{review.mergeVariables.missing.length > 0 ? review.mergeVariables.missing.join(", ") : "None"}</dd>
          </div>
        </dl>
        {Object.keys(review.mergeVariables.resolvedValues).length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs">
            {Object.entries(review.mergeVariables.resolvedValues).map(([key, value]) => (
              <li key={key} className="rounded border px-2 py-1">
                <span className="font-medium">{key}</span>: {value || "—"}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
