"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { GrowthSendrLandingPage } from "@/lib/growth/sendr/growth-sendr-types"
import { buildSendrPagePublicLink } from "@/lib/growth/sendr/growth-sendr-slug-runtime"
import { cn } from "@/lib/utils"

function statusTone(status: string): { badge: "default" | "secondary" | "outline"; label: string; hint: string } {
  if (status === "published") {
    return {
      badge: "default",
      label: "Live",
      hint: "Ready to send — prospects can view this page now.",
    }
  }
  if (status === "archived") {
    return { badge: "secondary", label: "Archived", hint: "This page is no longer active for new sends." }
  }
  return {
    badge: "outline",
    label: "Draft",
    hint: "Finish sections, video, and booking — then publish when you are ready to send.",
  }
}

type Props = {
  page: GrowthSendrLandingPage
  loading: boolean
  copied: boolean
  onRefresh: () => void
  onCopyLink: () => void
  className?: string
}

export function GrowthSendrBuilderHeader({
  page,
  loading,
  copied,
  onRefresh,
  onCopyLink,
  className,
}: Props) {
  const tone = statusTone(page.status)
  const slug = page.publishedSlug ?? page.slug
  const liveHref = slug ? buildSendrPagePublicLink(slug, typeof window !== "undefined" ? window.location.origin : "") : null

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50/80 via-white to-blue-50/30 px-5 py-5 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground" asChild>
                <Link href="/growth/sendr">
                  <ArrowLeft className="mr-1.5 size-4" />
                  Workspace
                </Link>
              </Button>
              <Badge variant={tone.badge}>{tone.label}</Badge>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Sparkles className="size-5" />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-[1.65rem]">
                  {page.title}
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {tone.hint}
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            </Button>
            <Button size="sm" variant="outline" onClick={onCopyLink} disabled={!slug}>
              {copied ? <Check className="mr-1.5 size-4" /> : <Copy className="mr-1.5 size-4" />}
              Copy link
            </Button>
            {liveHref ? (
              <Button size="sm" asChild>
                <a href={liveHref} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 size-4" />
                  Open live page
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function GrowthSendrBuilderMessage({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
      {children}
    </div>
  )
}
