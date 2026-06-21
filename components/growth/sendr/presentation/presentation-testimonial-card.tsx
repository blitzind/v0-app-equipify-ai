"use client"

import { Quote, Star } from "lucide-react"
import type { PresentationTestimonialItem } from "@/lib/growth/sendr/growth-sendr-presentation-content"
import { cn } from "@/lib/utils"

export function PresentationTestimonialCard({
  item,
  className,
}: {
  item: PresentationTestimonialItem
  className?: string
}) {
  const attribution = [item.author, item.role, item.company].filter(Boolean).join(" · ")

  return (
    <figure
      className={cn(
        "relative rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-6 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950/50",
        className,
      )}
    >
      <Quote className="size-8 text-blue-500/20" />
      <div className="mt-2 flex gap-0.5 text-amber-400">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} className="size-3.5 fill-current" />
        ))}
      </div>
      <blockquote className="mt-4 text-base leading-relaxed text-slate-700 dark:text-slate-200">
        {item.quote}
      </blockquote>
      {attribution ? (
        <figcaption className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
          {attribution}
        </figcaption>
      ) : null}
    </figure>
  )
}
