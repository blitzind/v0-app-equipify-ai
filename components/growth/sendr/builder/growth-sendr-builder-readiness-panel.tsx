"use client"

import { CalendarDays, CheckCircle2, Circle, Layers, Rocket, Video } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type {
  GrowthSendrBookingAsset,
  GrowthSendrLandingPage,
  GrowthSendrLandingPageSection,
  GrowthSendrVideoAsset,
} from "@/lib/growth/sendr/growth-sendr-types"
import { buildSendrPagePublicPath } from "@/lib/growth/sendr/growth-sendr-slug-runtime"
import { cn } from "@/lib/utils"

type CheckItem = {
  label: string
  done: boolean
  hint: string
}

function buildChecklist(input: {
  page: GrowthSendrLandingPage
  sections: GrowthSendrLandingPageSection[]
  videoAsset?: GrowthSendrVideoAsset | null
  bookingAsset?: GrowthSendrBookingAsset | null
}): CheckItem[] {
  const hasHero = input.sections.some((s) => s.sectionType === "hero")
  const hasCta =
    input.sections.some((s) => s.sectionType === "cta" || s.sectionType === "calendar") ||
    Boolean(input.bookingAsset?.meetingLink)
  const hasVideo = Boolean(input.videoAsset?.sourceUrl) || input.sections.some((s) => s.sectionType === "video")
  const isPublished = input.page.status === "published"

  return [
    {
      label: "Hero section",
      done: hasHero,
      hint: "Introduce your prospect with a personalized headline",
    },
    {
      label: "Video attached",
      done: hasVideo,
      hint: "Add a walkthrough from Growth Video library",
    },
    {
      label: "Booking or CTA",
      done: hasCta,
      hint: "Give prospects a clear next step",
    },
    {
      label: "Published",
      done: isPublished,
      hint: "Publish to generate a shareable link",
    },
  ]
}

type Props = {
  page: GrowthSendrLandingPage
  sections: GrowthSendrLandingPageSection[]
  videoAsset?: GrowthSendrVideoAsset | null
  bookingAsset?: GrowthSendrBookingAsset | null
  publicLink?: string | null
  className?: string
}

export function GrowthSendrBuilderReadinessPanel({
  page,
  sections,
  videoAsset,
  bookingAsset,
  publicLink,
  className,
}: Props) {
  const checklist = buildChecklist({ page, sections, videoAsset, bookingAsset })
  const completed = checklist.filter((item) => item.done).length
  const slugPath =
    publicLink ??
    (page.publishedSlug ?? page.slug ? buildSendrPagePublicPath(page.publishedSlug ?? page.slug ?? "") : null)

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Page readiness</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {completed}/{checklist.length} ready to send
          </h2>
        </div>
        <Badge variant={page.status === "published" ? "default" : "outline"}>{page.status}</Badge>
      </div>

      <ul className="mt-5 space-y-3">
        {checklist.map((item) => (
          <li key={item.label} className="flex items-start gap-3 rounded-xl bg-slate-50/80 px-3 py-2.5 dark:bg-slate-950/40">
            {item.done ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-slate-300 dark:text-slate-600" />
            )}
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{item.label}</p>
              <p className="text-xs text-slate-500">{item.hint}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 px-3 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Layers className="size-3.5" />
            Sections
          </div>
          <p className="mt-1 text-lg font-semibold">{sections.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 px-3 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Video className="size-3.5" />
            Video
          </div>
          <p className="mt-1 text-sm font-medium">{videoAsset ? "Attached" : "Not yet"}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 px-3 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CalendarDays className="size-3.5" />
            Booking
          </div>
          <p className="mt-1 text-sm font-medium">{bookingAsset ? "Connected" : "Not yet"}</p>
        </div>
      </div>

      {slugPath ? (
        <p className="mt-4 truncate text-xs text-slate-500">
          <Rocket className="mr-1 inline size-3.5" />
          {slugPath}
        </p>
      ) : (
        <p className="mt-4 text-xs text-slate-500">Publish to generate your prospect URL.</p>
      )}

      {page.publishedAt ? (
        <p className="mt-2 text-xs text-slate-400">
          Last published {new Date(page.publishedAt).toLocaleString()} · v{page.publishedVersion ?? 1}
        </p>
      ) : null}
    </div>
  )
}
