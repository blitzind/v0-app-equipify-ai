"use client"

import { Check, Copy, ExternalLink, Rocket, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { GrowthSendrLandingPage, GrowthSendrLandingPagePublication } from "@/lib/growth/sendr/growth-sendr-types"
import { buildSendrPagePublicLink, buildSendrPagePublicPath } from "@/lib/growth/sendr/growth-sendr-slug-runtime"
import { cn } from "@/lib/utils"

type Props = {
  page: GrowthSendrLandingPage
  publications: GrowthSendrLandingPagePublication[]
  publicLink?: string | null
  busy?: boolean
  copied?: boolean
  onPublish: () => void
  onArchive: () => void
  onCopyLink: () => void
  className?: string
}

export function GrowthSendrBuilderPublishPanel({
  page,
  publications,
  publicLink,
  busy,
  copied,
  onPublish,
  onArchive,
  onCopyLink,
  className,
}: Props) {
  const slug = page.publishedSlug ?? page.slug
  const path = publicLink ?? (slug ? buildSendrPagePublicPath(slug) : null)
  const liveHref = slug ? buildSendrPagePublicLink(slug, typeof window !== "undefined" ? window.location.origin : "") : null
  const isPublished = page.status === "published"
  const isArchived = page.status === "archived"

  return (
    <div className={cn("space-y-4", className)}>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-blue-50/80 via-white to-emerald-50/40 dark:border-slate-800 dark:from-blue-950/30 dark:via-slate-900 dark:to-emerald-950/20">
        <div className="border-b border-slate-200/80 px-5 py-5 dark:border-slate-800 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Rocket className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
                  {isPublished ? "Ready to send" : "Almost there"}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {isPublished ? "Your page is live for prospects" : "Publish when your page feels right"}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {isPublished
                    ? "Share the link in sequences, emails, or direct outreach. Each publish creates an immutable snapshot."
                    : "Publishing creates a snapshot your prospects will see — hero, video, testimonials, and booking CTAs included."}
                </p>
              </div>
            </div>
            <Badge variant={isPublished ? "default" : isArchived ? "secondary" : "outline"}>{page.status}</Badge>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          {path ? (
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prospect URL</p>
              <p className="mt-2 break-all font-mono text-sm text-slate-800 dark:text-slate-200">{path}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={onCopyLink}>
                  {copied ? <Check className="mr-1.5 size-4" /> : <Copy className="mr-1.5 size-4" />}
                  Copy link
                </Button>
                {liveHref ? (
                  <Button size="sm" variant="outline" asChild>
                    <a href={liveHref} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 size-4" />
                      Preview live
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 px-4 py-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400">
              Publish once to generate your shareable prospect URL.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || isPublished} onClick={onPublish}>
              <Send className="mr-1.5 size-4" />
              Publish page
            </Button>
            <Button variant="outline" disabled={busy || isArchived} onClick={onArchive}>
              Archive
            </Button>
          </div>

          {page.publishedAt ? (
            <p className="text-xs text-slate-500">
              Last published {new Date(page.publishedAt).toLocaleString()} · version {page.publishedVersion ?? 1}
            </p>
          ) : null}
        </div>
      </div>

      {publications.length > 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="font-medium text-slate-900 dark:text-slate-50">Publication history</p>
          <ul className="mt-3 space-y-2">
            {publications.map((pub, index) => (
              <li
                key={pub.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950/40"
              >
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  v{publications.length - index}
                </span>
                <span className="text-slate-500">{new Date(pub.publishedAt).toLocaleString()}</span>
                <span className="text-slate-400">{pub.publishedBy?.slice(0, 8) ?? "system"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
